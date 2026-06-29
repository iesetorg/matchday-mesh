import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyOperation,
  createDemoOperations,
  createOperation,
  OP_TYPES,
  parseOperationEnvelope,
  replayOperations,
  serializeOperations
} from '../app/ops.js'
import { createState, listFeed, moduleStatus } from '../app/domain.js'

test('replays the demo operation log into deterministic state', () => {
  const ops = createDemoOperations({ baseNow: '2026-06-29T20:00:00.000Z' })
  const state = replayOperations(ops)

  assert.equal(Object.keys(state.hubs).length, 1)
  assert.equal(Object.keys(state.passes).length, 1)
  assert.equal(listFeed(state, 'hub_final_night').length, 3)
  assert.equal(moduleStatus(state).pearsStack, 'op-log-ready')
  assert.equal(moduleStatus(state).opLog, 3)
})

test('skips duplicate operation ids without duplicating feed cards', () => {
  const state = createState()
  const op = createOperation(OP_TYPES.CREATE_MATCH, {
    title: 'Final Night Fan Zone',
    homeTeam: 'Pear FC',
    awayTeam: 'Tether United'
  }, {
    opId: 'op_same',
    entityId: 'hub_final',
    now: '2026-06-29T20:00:00.000Z'
  })

  applyOperation(state, op)
  const duplicate = applyOperation(state, op)

  assert.equal(duplicate.skipped, true)
  assert.equal(Object.keys(state.hubs).length, 1)
  assert.equal(listFeed(state, 'hub_final').length, 1)
})

test('serializes and parses operation envelopes', () => {
  const ops = createDemoOperations({ baseNow: '2026-06-29T20:00:00.000Z' })
  const text = serializeOperations(ops)
  const parsed = parseOperationEnvelope(text)

  assert.equal(parsed.length, ops.length)
  assert.equal(replayOperations(parsed).passes.pass_ada.displayName, 'Ada')
})

test('enforces prediction conflict during replay', () => {
  const ops = [
    createOperation(OP_TYPES.CREATE_MATCH, {
      title: 'Final Night Fan Zone',
      homeTeam: 'Pear FC',
      awayTeam: 'Tether United'
    }, {
      opId: 'op_hub',
      entityId: 'hub_final',
      now: '2026-06-29T20:00:00.000Z'
    }),
    createOperation(OP_TYPES.POST_PREDICTION, {
      hubId: 'hub_final',
      actorName: 'Ada',
      writerId: 'fan_ada',
      homeScore: 2,
      awayScore: 1
    }, {
      opId: 'op_pred_1',
      entityId: 'pred_ada_1',
      now: '2026-06-29T20:01:00.000Z'
    }),
    createOperation(OP_TYPES.POST_PREDICTION, {
      hubId: 'hub_final',
      actorName: 'Ada',
      writerId: 'fan_ada',
      homeScore: 3,
      awayScore: 0
    }, {
      opId: 'op_pred_2',
      entityId: 'pred_ada_2',
      now: '2026-06-29T20:02:00.000Z'
    })
  ]

  assert.throws(() => replayOperations(ops), { code: 'DUPLICATE_PREDICTION' })
})
