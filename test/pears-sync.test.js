import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createMatchdayInvite } from '../app/invite.js'
import { createDemoOperations, createOperation, OP_TYPES } from '../app/ops.js'
import { openMatchdayPearsStore } from '../app/pears-store.js'
import { connectMatchdayStores, openReplicaFromMatchdayInvite, waitForOperationCount } from '../app/pears-sync.js'

async function tempDir (prefix) {
  return mkdtemp(join(tmpdir(), prefix))
}

test('replicates the operation log to a read-only Corestore peer', async () => {
  const hostDir = await tempDir('matchday-mesh-sync-host-')
  const guestDir = await tempDir('matchday-mesh-sync-guest-')
  let host
  let guest
  let closeReplication

  try {
    host = await openMatchdayPearsStore(hostDir)
    await host.appendOperations(createDemoOperations({ baseNow: '2026-06-29T20:00:00.000Z' }))
    const hostInfo = await host.info()

    const invite = createMatchdayInvite(hostInfo, { createdAt: '2026-06-29T20:00:01.000Z' })
    const joined = await openReplicaFromMatchdayInvite(guestDir, invite)
    guest = joined.store
    closeReplication = connectMatchdayStores(host, guest)

    const seededOps = await waitForOperationCount(guest, 3)
    const seededState = await guest.replayState()

    assert.equal(joined.invite.key, hostInfo.key)
    assert.equal(joined.invite.discoveryKey, hostInfo.discoveryKey)
    assert.equal(joined.invite.writable, false)
    assert.equal(seededOps.length, 3)
    assert.equal(seededState.hubs.hub_final_night.title, 'Final Night Fan Zone')
    assert.equal((await guest.info()).writable, false)

    const liveOp = createOperation(OP_TYPES.POST_REACTION, {
      hubId: 'hub_final_night',
      actorName: 'Nora',
      body: 'Guest peer sees the chant card.'
    }, {
      opId: 'op_guest_peer_reaction',
      entityId: 'feed_guest_peer_reaction',
      now: '2026-06-29T20:05:00.000Z'
    })
    await host.appendOperation(liveOp)

    const replicatedOps = await waitForOperationCount(guest, 4)
    const replicatedState = await guest.replayState()

    assert.equal(replicatedOps.length, 4)
    assert.equal(replicatedState.feed.at(-1).body, 'Guest peer sees the chant card.')

    const guestWrite = createOperation(OP_TYPES.POST_REACTION, {
      hubId: 'hub_final_night',
      actorName: 'Guest',
      body: 'Read-only peer should not append.'
    }, {
      opId: 'op_guest_readonly_write',
      entityId: 'feed_guest_readonly_write',
      now: '2026-06-29T20:06:00.000Z'
    })
    await assert.rejects(() => guest.appendOperation(guestWrite))
  } finally {
    try { await closeReplication?.() } catch {}
    try { await host?.close() } catch {}
    try { await guest?.close() } catch {}
    await rm(hostDir, { recursive: true, force: true })
    await rm(guestDir, { recursive: true, force: true })
  }
})
