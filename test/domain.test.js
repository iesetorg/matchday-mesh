import test from 'node:test'
import assert from 'node:assert/strict'
import {
  claimPass,
  createMatchHub,
  createPool,
  createState,
  exportProofPack,
  listFeed,
  moduleStatus,
  postPrediction,
  postReaction,
  recordPoolContribution,
  scanPass
} from '../app/domain.js'

const T0 = '2026-06-29T20:00:00.000Z'

test('creates a match hub and seed system feed card', () => {
  const state = createState()
  const hub = createMatchHub(state, {
    title: 'Final Night Fan Zone',
    homeTeam: 'Pear FC',
    awayTeam: 'Tether United',
    venue: 'Warehouse 9',
    hostName: 'Mina'
  }, { id: 'hub_final', now: T0 })

  assert.equal(hub.id, 'hub_final')
  assert.equal(hub.inviteCode, 'HUBFINAL')
  assert.equal(listFeed(state, hub.id).length, 1)
  assert.match(listFeed(state, hub.id)[0].body, /opened/)
})

test('claims and scans a fan pass once', () => {
  const state = createState()
  const hub = createMatchHub(state, {
    title: 'Final Night Fan Zone',
    homeTeam: 'Pear FC',
    awayTeam: 'Tether United'
  }, { id: 'hub_final', now: T0 })

  const pass = claimPass(state, {
    hubId: hub.id,
    displayName: 'Ada',
    writerId: 'fan_ada'
  }, { id: 'pass_ada', now: T0 })

  const samePass = claimPass(state, {
    hubId: hub.id,
    displayName: 'Ada',
    writerId: 'fan_ada'
  }, { now: T0 })

  assert.equal(samePass.id, pass.id)
  assert.equal(Object.keys(state.passes).length, 1)

  scanPass(state, { passId: pass.id, scannerName: 'Door 1' }, { now: '2026-06-29T20:05:00.000Z' })
  scanPass(state, { passId: pass.id, scannerName: 'Door 2' }, { now: '2026-06-29T20:06:00.000Z' })

  assert.equal(state.passes[pass.id].checkedInBy, 'Door 1')
  assert.equal(listFeed(state, hub.id).filter((card) => card.type === 'feed:checkin').length, 1)
})

test('allows one prediction per writer per match hub', () => {
  const state = createState()
  const hub = createMatchHub(state, {
    title: 'Final Night Fan Zone',
    homeTeam: 'Pear FC',
    awayTeam: 'Tether United'
  }, { id: 'hub_final', now: T0 })

  const prediction = postPrediction(state, {
    hubId: hub.id,
    actorName: 'Ada',
    writerId: 'fan_ada',
    homeScore: 2,
    awayScore: 1
  }, { id: 'pred_ada', now: T0 })

  assert.equal(prediction.homeScore, 2)
  assert.throws(() => postPrediction(state, {
    hubId: hub.id,
    actorName: 'Ada',
    writerId: 'fan_ada',
    homeScore: 3,
    awayScore: 0
  }, { now: T0 }), { code: 'DUPLICATE_PREDICTION' })
})

test('posts reactions and pool contribution feed cards', () => {
  const state = createState()
  const hub = createMatchHub(state, {
    title: 'Final Night Fan Zone',
    homeTeam: 'Pear FC',
    awayTeam: 'Tether United'
  }, { id: 'hub_final', now: T0 })

  postReaction(state, {
    hubId: hub.id,
    actorName: 'Sam',
    body: 'Press high in the first ten.'
  }, { now: T0 })

  const pool = createPool(state, {
    hubId: hub.id,
    title: 'Host snacks pool',
    actorName: 'Mina',
    targetAmount: 50
  }, { id: 'pool_snacks', now: T0 })

  const payment = recordPoolContribution(state, {
    poolId: pool.id,
    actorName: 'Sam',
    amount: 7.5
  }, { id: 'pay_sam', now: T0 })

  assert.equal(payment.asset, 'USDt')
  assert.equal(moduleStatus(state).wdk, 'demo-ledger-active')
  assert.equal(listFeed(state, hub.id).filter((card) => card.type === 'feed:pool-contribution').length, 1)
})

test('exports a compact proof pack for demos', () => {
  const state = createState()
  const hub = createMatchHub(state, {
    title: 'Final Night Fan Zone',
    homeTeam: 'Pear FC',
    awayTeam: 'Tether United'
  }, { id: 'hub_final', now: T0 })

  claimPass(state, { hubId: hub.id, displayName: 'Ada' }, { id: 'pass_ada', now: T0 })
  const proof = exportProofPack(state)

  assert.equal(proof.app, 'matchday-mesh')
  assert.equal(proof.status.hubs, 1)
  assert.equal(proof.passCount, 1)
  assert.equal(proof.version, '0.1.0')
})
