import { openMatchdayPearsStore } from './pears-store.js'
import { createMatchdayInvite, normalizeMatchdayInvite, summarizeMatchdayInvite } from './invite.js'
import {
  createMatchdayPairingDescriptor,
  joinMatchdayPairingReplica,
  startMatchdayPairingHost,
  waitForOperationCount
} from './pears-sync.js'

export async function createMatchdayApi (storagePath, opts = {}) {
  const store = await openMatchdayPearsStore(storagePath, opts)
  const pairingHosts = new Map()
  const replicaSessions = new Map()
  const createSwarm = typeof opts.createSwarm === 'function' ? opts.createSwarm : null

  return {
    backend: 'pears-store',

    async listOperations () {
      return store.listOperations()
    },

    async appendOperation (op) {
      const result = await store.appendOperation(op)
      return {
        result,
        info: await store.info()
      }
    },

    async resetOperations (ops = []) {
      await store.clearOperations()
      const results = await store.appendOperations(ops)
      return {
        results,
        info: await store.info()
      }
    },

    async replayState () {
      return store.replayState()
    },

    async info () {
      return {
        backend: 'pears-store',
        ...(await store.info())
      }
    },

    async invite () {
      const info = await store.info()
      return createMatchdayInvite(info)
    },

    async normalizeInvite (invite) {
      return normalizeMatchdayInvite(invite)
    },

    async summarizeInvite (invite) {
      return summarizeMatchdayInvite(invite)
    },

    async pairingDescriptor (invite) {
      return createMatchdayPairingDescriptor(invite)
    },

    async startPairingHost () {
      const invite = createMatchdayInvite(await store.info())
      const descriptor = createMatchdayPairingDescriptor(invite)
      let session = pairingHosts.get(descriptor.topic)
      if (!session) {
        session = await startMatchdayPairingHost(store, invite, {
          swarm: createSwarm ? createSwarm() : undefined
        })
        pairingHosts.set(descriptor.topic, session)
      }
      return {
        status: 'hosting',
        role: 'host',
        descriptor: session.descriptor
      }
    },

    async joinReplica (invite, joinOpts = {}) {
      const normalized = normalizeMatchdayInvite(invite)
      const descriptor = createMatchdayPairingDescriptor(normalized)
      const expectedOperations = Number.isSafeInteger(joinOpts.expectedOperations)
        ? joinOpts.expectedOperations
        : descriptor.operations
      let session = replicaSessions.get(descriptor.topic)
      if (!session) {
        session = await joinMatchdayPairingReplica(replicaStoragePath(storagePath, normalized), normalized, {
          swarm: createSwarm ? createSwarm() : undefined,
          expectedOperations,
          timeout: joinOpts.timeout || 8000,
          interval: joinOpts.interval || 75
        })
        replicaSessions.set(descriptor.topic, session)
      } else if (expectedOperations > 0) {
        await waitForOperationCount(session.store, expectedOperations, {
          timeout: joinOpts.timeout || 8000,
          interval: joinOpts.interval || 75
        })
      }
      return describeReplicaSession(session)
    },

    async listReplicas () {
      const replicas = []
      for (const session of replicaSessions.values()) replicas.push(await describeReplicaSession(session))
      return replicas
    },

    async close () {
      for (const session of replicaSessions.values()) await session.close()
      replicaSessions.clear()
      for (const session of pairingHosts.values()) await session.close()
      pairingHosts.clear()
      await store.close()
    }
  }
}

async function describeReplicaSession (session) {
  const info = await session.store.info()
  const operations = await session.store.listOperations()
  const state = await session.store.replayState()
  return {
    status: 'joined',
    role: 'replica',
    invite: session.invite,
    descriptor: session.descriptor,
    info,
    operations: operations.length,
    writable: info.writable,
    stateCounts: {
      hubs: Object.keys(state.hubs).length,
      passes: Object.keys(state.passes).length,
      feedCards: state.feed.length,
      payments: Object.keys(state.payments).length
    },
    latestFeedCard: state.feed.at(-1) || null
  }
}

function replicaStoragePath (storagePath, invite) {
  return `${String(storagePath).replace(/\/+$/, '')}/replicas/${invite.key.slice(0, 16)}`
}
