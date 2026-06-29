import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { Duplex, PassThrough } from 'node:stream'
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

test('runtime API hosts and joins a read-only pairing replica', async () => {
  const hostDir = await mkdtemp(join(tmpdir(), 'matchday-mesh-api-host-'))
  const guestDir = await mkdtemp(join(tmpdir(), 'matchday-mesh-api-guest-'))
  const network = new FakeSwarmNetwork()
  let hostApi
  let guestApi

  try {
    hostApi = await createMatchdayApi(hostDir, { createSwarm: () => network.createSwarm() })
    guestApi = await createMatchdayApi(guestDir, { createSwarm: () => network.createSwarm() })
    await hostApi.resetOperations(createDemoOperations({ baseNow: '2026-06-29T20:00:00.000Z' }))

    const invite = await hostApi.invite()
    const hostPairing = await hostApi.startPairingHost()
    const joined = await guestApi.joinReplica(invite, { timeout: 5000 })

    assert.equal(hostPairing.status, 'hosting')
    assert.equal(hostPairing.descriptor.topic, joined.descriptor.topic)
    assert.equal(joined.status, 'joined')
    assert.equal(joined.writable, false)
    assert.equal(joined.operations, 3)
    assert.equal(joined.stateCounts.hubs, 1)
    assert.equal(joined.latestFeedCard.body, 'Doors open. Bring the noise, keep it friendly.')

    const liveOp = createOperation(OP_TYPES.POST_REACTION, {
      hubId: 'hub_final_night',
      actorName: 'Nora',
      body: 'Runtime join received this live update.'
    }, {
      opId: 'op_runtime_pairing_update',
      entityId: 'feed_runtime_pairing_update',
      now: '2026-06-29T20:08:00.000Z'
    })
    await hostApi.appendOperation(liveOp)

    const refreshed = await guestApi.joinReplica(await hostApi.invite(), { timeout: 5000 })
    assert.equal(refreshed.operations, 4)
    assert.equal(refreshed.latestFeedCard.body, 'Runtime join received this live update.')
  } finally {
    try { await guestApi?.close() } catch {}
    try { await hostApi?.close() } catch {}
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
