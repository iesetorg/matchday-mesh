import test from 'node:test'
import assert from 'node:assert/strict'
import { createPool, createState, recordPoolContribution } from '../app/domain.js'
import {
  confirmDemoPoolContribution,
  createPoolReceiveRequest,
  paymentModuleStatus,
  PAYMENT_MODES
} from '../app/payments.js'

test('creates a WDK-shaped demo receive request for a pool', () => {
  const receive = createPoolReceiveRequest({
    hubId: 'hub_final',
    title: 'Host snacks pool',
    targetAmount: 50
  }, {
    now: '2026-06-29T20:00:00.000Z'
  })

  assert.equal(receive.mode, PAYMENT_MODES.DEMO_LEDGER)
  assert.equal(receive.asset, 'USDt')
  assert.equal(receive.targetAmount, 50)
  assert.match(receive.receiveAddress, /^demo-usdt:\/\/matchday-mesh\/hub_final\/recv_/)
  assert.equal(receive.qrPayload, receive.receiveAddress)
})

test('refuses real WDK mode until the SDK path is enabled', () => {
  assert.throws(() => createPoolReceiveRequest({
    mode: PAYMENT_MODES.WDK,
    hubId: 'hub_final'
  }), { code: 'PAYMENT_MODE_UNAVAILABLE' })
})

test('confirms a demo contribution and records it through the domain', () => {
  const state = createState()
  state.hubs.hub_final = {
    id: 'hub_final',
    title: 'Final Night',
    homeTeam: 'Pear FC',
    awayTeam: 'Tether United',
    hostName: 'Mina'
  }
  const receive = createPoolReceiveRequest({ hubId: 'hub_final', title: 'Host snacks pool' })
  const pool = createPool(state, {
    hubId: 'hub_final',
    title: 'Host snacks pool',
    paymentMode: receive.mode,
    receiveRequestId: receive.id,
    receiveAddress: receive.receiveAddress
  }, { id: 'pool_snacks', now: '2026-06-29T20:00:00.000Z' })

  const receipt = confirmDemoPoolContribution(pool, {
    actorName: 'Ada',
    amount: 5
  }, { id: 'demo_pay_ada', now: '2026-06-29T20:01:00.000Z' })

  const payment = recordPoolContribution(state, {
    poolId: pool.id,
    actorName: receipt.actorName,
    amount: receipt.amount,
    status: receipt.status,
    receipt: receipt.receipt
  }, { id: receipt.id, now: receipt.confirmedAt })

  assert.equal(payment.id, 'demo_pay_ada')
  assert.equal(payment.receipt, 'demo-receipt:demo_pay_ada')
  assert.equal(paymentModuleStatus(state).claim, 'WDK-shaped demo receive path')
})
