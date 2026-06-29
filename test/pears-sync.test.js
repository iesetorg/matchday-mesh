import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { Duplex, PassThrough } from 'node:stream'
import { tmpdir } from 'node:os'
import { createMatchdayInvite } from '../app/invite.js'
import { createDemoOperations, createOperation, OP_TYPES } from '../app/ops.js'
import { openMatchdayPearsStore } from '../app/pears-store.js'
import {
  connectMatchdayStores,
  createMatchdayPairingDescriptor,
  createMatchdayPairingTopic,
  joinMatchdayPairingReplica,
  MATCHDAY_PAIRING_TYPE,
  openReplicaFromMatchdayInvite,
  startMatchdayPairingHost,
  waitForOperationCount
} from '../app/pears-sync.js'

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

test('creates a stable pairing descriptor from a Matchday invite', () => {
  const invite = createMatchdayInvite({
    coreName: 'matchday-mesh-ops',
    key: 'a'.repeat(64),
    discoveryKey: 'b'.repeat(64),
    operations: 7
  }, { createdAt: '2026-06-30T00:00:00.000Z' })

  const descriptor = createMatchdayPairingDescriptor({ ...invite, writable: true })
  const topic = createMatchdayPairingTopic(invite)
  const sameTopic = createMatchdayPairingTopic(JSON.stringify(invite))

  assert.equal(descriptor.type, MATCHDAY_PAIRING_TYPE)
  assert.equal(descriptor.transport, 'hyperswarm-topic')
  assert.equal(descriptor.mode, 'read-only-replica')
  assert.equal(descriptor.writable, false)
  assert.equal(descriptor.operations, 7)
  assert.equal(descriptor.topic.length, 64)
  assert.equal(topic.byteLength, 32)
  assert.deepEqual(topic, sameTopic)
  assert.equal(descriptor.shortTopic, `${descriptor.topic.slice(0, 8)}...${descriptor.topic.slice(-6)}`)
})

test('joins a hosted pairing topic as a read-only replica', async () => {
  const hostDir = await tempDir('matchday-mesh-pairing-host-')
  const guestDir = await tempDir('matchday-mesh-pairing-guest-')
  const network = new FakeSwarmNetwork()
  let host
  let hostSession
  let guestSession

  try {
    host = await openMatchdayPearsStore(hostDir)
    await host.appendOperations(createDemoOperations({ baseNow: '2026-06-29T20:00:00.000Z' }))
    const hostInfo = await host.info()
    const invite = createMatchdayInvite(hostInfo, { createdAt: '2026-06-29T20:00:01.000Z' })

    hostSession = await startMatchdayPairingHost(host, invite, {
      swarm: network.createSwarm()
    })
    guestSession = await joinMatchdayPairingReplica(guestDir, invite, {
      swarm: network.createSwarm(),
      timeout: 5000
    })

    const guestInfo = await guestSession.store.info()
    const guestState = await guestSession.store.replayState()

    assert.equal(hostSession.descriptor.topic, guestSession.descriptor.topic)
    assert.equal(guestSession.descriptor.transport, 'hyperswarm-topic')
    assert.equal(guestInfo.writable, false)
    assert.equal(guestInfo.operations, 3)
    assert.equal(guestState.hubs.hub_final_night.title, 'Final Night Fan Zone')

    const liveOp = createOperation(OP_TYPES.POST_REACTION, {
      hubId: 'hub_final_night',
      actorName: 'Nora',
      body: 'Pairing topic carried the live update.'
    }, {
      opId: 'op_pairing_topic_reaction',
      entityId: 'feed_pairing_topic_reaction',
      now: '2026-06-29T20:07:00.000Z'
    })
    await host.appendOperation(liveOp)

    await waitForOperationCount(guestSession.store, 4)
    const updatedState = await guestSession.store.replayState()

    assert.equal(updatedState.feed.at(-1).body, 'Pairing topic carried the live update.')
  } finally {
    try { await guestSession?.close() } catch {}
    try { await hostSession?.close() } catch {}
    try { await host?.close() } catch {}
    await rm(hostDir, { recursive: true, force: true })
    await rm(guestDir, { recursive: true, force: true })
  }
})

class FakeSwarmNetwork {
  constructor () {
    this.channels = new Map()
  }

  createSwarm () {
    return new FakeSwarm(this)
  }

  join (swarm, topic, opts) {
    const topicHex = topic.toString('hex')
    const channel = this.channels.get(topicHex) || new Set()
    this.channels.set(topicHex, channel)
    const entry = { swarm, opts }
    channel.add(entry)

    queueMicrotask(() => {
      for (const peer of channel) {
        if (peer === entry) continue
        const canConnect = (opts.client && peer.opts.server) || (opts.server && peer.opts.client)
        if (!canConnect) continue
        const [left, right] = duplexPair()
        left.isInitiator = opts.client === true
        right.isInitiator = peer.opts.client === true
        swarm.emit('connection', left)
        peer.swarm.emit('connection', right)
      }
    })

    return {
      flushed: async () => {}
    }
  }
}

class FakeSwarm extends EventEmitter {
  constructor (network) {
    super()
    this.network = network
  }

  join (topic, opts) {
    return this.network.join(this, topic, opts)
  }

  async flush () {}

  async destroy () {
    this.removeAllListeners()
  }
}

function duplexPair () {
  const leftToRight = new PassThrough()
  const rightToLeft = new PassThrough()
  const left = Duplex.from({ writable: leftToRight, readable: rightToLeft })
  const right = Duplex.from({ writable: rightToLeft, readable: leftToRight })
  return [left, right]
}
