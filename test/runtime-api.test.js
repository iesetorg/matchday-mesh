import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createDemoOperations, createOperation, OP_TYPES } from '../app/ops.js'
import { createMatchdayApi } from '../app/runtime-api.js'

async function withApi (fn) {
  const dir = await mkdtemp(join(tmpdir(), 'matchday-mesh-api-'))
  let api
  try {
    api = await createMatchdayApi(dir)
    await fn(api, dir)
  } finally {
    try { await api?.close() } catch {}
    await rm(dir, { recursive: true, force: true })
  }
}

test('runtime API resets, appends, and reports Pears store info', async () => {
  await withApi(async (api) => {
    const demoOps = createDemoOperations({ baseNow: '2026-06-29T20:00:00.000Z' })
    await api.resetOperations(demoOps)

    const afterReset = await api.info()
    const listed = await api.listOperations()
    const state = await api.replayState()

    assert.equal(afterReset.backend, 'pears-store')
    assert.equal(afterReset.operations, 3)
    assert.equal(listed.length, 3)
    assert.equal(state.hubs.hub_final_night.title, 'Final Night Fan Zone')

    const invite = await api.invite()
    assert.equal(invite.type, 'matchday-mesh-core-invite-v1')
    assert.equal(invite.app, 'matchday-mesh')
    assert.equal(invite.key, afterReset.key)
    assert.equal(invite.discoveryKey, afterReset.discoveryKey)
    assert.equal(invite.writable, false)
    assert.equal(invite.operations, 3)

    const normalizedInvite = await api.normalizeInvite(JSON.stringify({ ...invite, writable: true }))
    const inviteSummary = await api.summarizeInvite(invite)
    const pairing = await api.pairingDescriptor(invite)
    assert.equal(normalizedInvite.writable, false)
    assert.equal(normalizedInvite.key, invite.key)
    assert.equal(inviteSummary.shortKey, `${invite.key.slice(0, 8)}...${invite.key.slice(-6)}`)
    assert.equal(pairing.type, 'matchday-mesh-pairing-v1')
    assert.equal(pairing.transport, 'hyperswarm-topic')
    assert.equal(pairing.mode, 'read-only-replica')
    assert.equal(pairing.topic.length, 64)
    assert.match(pairing.topic, /^[0-9a-f]{64}$/)
    assert.equal(pairing.shortTopic, `${pairing.topic.slice(0, 8)}...${pairing.topic.slice(-6)}`)

    const op = createOperation(OP_TYPES.POST_REACTION, {
      hubId: 'hub_final_night',
      actorName: 'Sam',
      body: 'Upper stand is loud.'
    }, {
      opId: 'op_api_reaction',
      entityId: 'feed_api_reaction',
      now: '2026-06-29T20:04:00.000Z'
    })
    const append = await api.appendOperation(op)

    assert.equal(append.result.skipped, false)
    assert.equal(append.info.operations, 4)
    assert.equal((await api.listOperations()).length, 4)
  })
})
