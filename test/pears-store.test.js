import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createDemoOperations, createOperation, OP_TYPES } from '../app/ops.js'
import { openMatchdayPearsStore } from '../app/pears-store.js'

async function withStore (fn) {
  const dir = await mkdtemp(join(tmpdir(), 'matchday-mesh-pears-'))
  let store
  try {
    store = await openMatchdayPearsStore(dir)
    await fn(store, dir)
  } finally {
    try { await store?.close() } catch {}
    await rm(dir, { recursive: true, force: true })
  }
}

test('persists and replays operations from Corestore/Hyperbee', async () => {
  await withStore(async (store) => {
    const ops = createDemoOperations({ baseNow: '2026-06-29T20:00:00.000Z' })
    const results = await store.appendOperations(ops)
    const listed = await store.listOperations()
    const state = await store.replayState()
    const info = await store.info()

    assert.deepEqual(results.map((r) => r.seq), [1, 2, 3])
    assert.equal(listed.length, 3)
    assert.equal(state.hubs.hub_final_night.title, 'Final Night Fan Zone')
    assert.equal(state.passes.pass_ada.displayName, 'Ada')
    assert.equal(info.operations, 3)
    assert.match(info.key, /^[0-9a-f]{64}$/)
    assert.match(info.discoveryKey, /^[0-9a-f]{64}$/)
  })
})

test('reopens the same storage path with the same operation log', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'matchday-mesh-pears-reopen-'))
  try {
    const first = await openMatchdayPearsStore(dir)
    await first.appendOperations(createDemoOperations({ baseNow: '2026-06-29T20:00:00.000Z' }))
    const firstInfo = await first.info()
    await first.close()

    const second = await openMatchdayPearsStore(dir)
    const secondInfo = await second.info()
    const state = await second.replayState()
    await second.close()

    assert.equal(secondInfo.key, firstInfo.key)
    assert.equal(secondInfo.operations, 3)
    assert.equal(state.feed.length, 3)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('deduplicates operation ids in the Hyperbee index', async () => {
  await withStore(async (store) => {
    const op = createOperation(OP_TYPES.CREATE_MATCH, {
      title: 'Final Night Fan Zone',
      homeTeam: 'Pear FC',
      awayTeam: 'Tether United'
    }, {
      opId: 'op_same',
      entityId: 'hub_final',
      now: '2026-06-29T20:00:00.000Z'
    })

    const first = await store.appendOperation(op)
    const second = await store.appendOperation(op)
    const listed = await store.listOperations()

    assert.equal(first.skipped, false)
    assert.equal(second.skipped, true)
    assert.equal(second.opId, 'op_same')
    assert.equal(listed.length, 1)
  })
})

test('clears and reseeds the operation log', async () => {
  await withStore(async (store) => {
    await store.appendOperations(createDemoOperations({ baseNow: '2026-06-29T20:00:00.000Z' }))
    const cleared = await store.clearOperations()
    const emptyInfo = await store.info()

    assert.ok(cleared.cleared >= 7)
    assert.equal(emptyInfo.operations, 0)

    const op = createOperation(OP_TYPES.CREATE_MATCH, {
      title: 'Quarter-Final Room',
      homeTeam: 'Pear FC',
      awayTeam: 'Mesh City'
    }, {
      opId: 'op_after_clear',
      entityId: 'hub_after_clear',
      now: '2026-06-29T21:00:00.000Z'
    })
    const result = await store.appendOperation(op)
    const listed = await store.listOperations()

    assert.equal(result.seq, 1)
    assert.equal(listed.length, 1)
    assert.equal(listed[0].id, 'op_after_clear')
  })
})
