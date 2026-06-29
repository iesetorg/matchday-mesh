import { normalizeMatchdayInvite } from './invite.js'
import { openMatchdayPearsReplica } from './pears-store.js'
import b4a from 'b4a'
import crypto from 'hypercore-crypto'

export const MATCHDAY_PAIRING_TYPE = 'matchday-mesh-pairing-v1'

export function connectMatchdayStores (leftStore, rightStore) {
  const left = leftStore.replicate(true)
  const right = rightStore.replicate(false)

  left.on('error', noop)
  right.on('error', noop)
  left.pipe(right).pipe(left)

  return async function closeReplication () {
    if (typeof left.destroy === 'function') left.destroy()
    if (typeof right.destroy === 'function') right.destroy()
    await delay(20)
  }
}

export async function openReplicaFromMatchdayInvite (storagePath, invite, opts = {}) {
  const normalized = normalizeMatchdayInvite(invite)
  const store = await openMatchdayPearsReplica(storagePath, normalized.key, opts)
  return {
    invite: normalized,
    store
  }
}

export async function startMatchdayPairingHost (store, invite, opts = {}) {
  const descriptor = createMatchdayPairingDescriptor(invite)
  const swarm = opts.swarm || await createDefaultSwarm(opts.swarmOpts)
  const connections = new Set()
  const topic = b4a.from(descriptor.topic, 'hex')

  function onConnection (conn) {
    connections.add(conn)
    conn.on('close', () => connections.delete(conn))
    conn.on('error', noop)
    replicateOverConnection(store, conn)
  }

  swarm.on('connection', onConnection)
  const discovery = swarm.join(topic, { server: true, client: false })
  if (discovery && typeof discovery.flushed === 'function') await discovery.flushed()
  else if (typeof swarm.flush === 'function') await swarm.flush()

  return {
    role: 'host',
    descriptor,
    topic: descriptor.topic,
    shortTopic: descriptor.shortTopic,
    async close () {
      swarm.off?.('connection', onConnection)
      for (const conn of connections) destroyConnection(conn)
      connections.clear()
      if (!opts.swarm && typeof swarm.destroy === 'function') await swarm.destroy()
    }
  }
}

export async function joinMatchdayPairingReplica (storagePath, invite, opts = {}) {
  const joined = await openReplicaFromMatchdayInvite(storagePath, invite, opts)
  const descriptor = createMatchdayPairingDescriptor(joined.invite)
  const swarm = opts.swarm || await createDefaultSwarm(opts.swarmOpts)
  const connections = new Set()
  const topic = b4a.from(descriptor.topic, 'hex')

  function onConnection (conn) {
    connections.add(conn)
    conn.on('close', () => connections.delete(conn))
    conn.on('error', noop)
    replicateOverConnection(joined.store, conn)
  }

  swarm.on('connection', onConnection)
  const discovery = swarm.join(topic, { server: false, client: true })
  if (discovery && typeof discovery.flushed === 'function') await discovery.flushed()
  if (typeof swarm.flush === 'function') await swarm.flush()

  const expectedOperations = Number.isSafeInteger(opts.expectedOperations)
    ? opts.expectedOperations
    : descriptor.operations
  if (expectedOperations > 0) {
    await waitForOperationCount(joined.store, expectedOperations, {
      timeout: opts.timeout || 8000,
      interval: opts.interval || 75
    })
  }

  return {
    role: 'replica',
    invite: joined.invite,
    store: joined.store,
    descriptor,
    topic: descriptor.topic,
    shortTopic: descriptor.shortTopic,
    async close () {
      swarm.off?.('connection', onConnection)
      for (const conn of connections) destroyConnection(conn)
      connections.clear()
      if (!opts.swarm && typeof swarm.destroy === 'function') await swarm.destroy()
      await joined.store.close()
    }
  }
}

export function createMatchdayPairingDescriptor (invite) {
  const normalized = normalizeMatchdayInvite(invite)
  const topic = createMatchdayPairingTopic(normalized)
  return {
    type: MATCHDAY_PAIRING_TYPE,
    app: normalized.app,
    mode: 'read-only-replica',
    transport: 'hyperswarm-topic',
    coreName: normalized.coreName,
    key: normalized.key,
    discoveryKey: normalized.discoveryKey,
    topic: b4a.toString(topic, 'hex'),
    shortTopic: shortHex(topic),
    operations: normalized.operations,
    writable: false,
    createdAt: normalized.createdAt
  }
}

export function createMatchdayPairingTopic (invite) {
  const normalized = normalizeMatchdayInvite(invite)
  return crypto.hash(b4a.from([
    MATCHDAY_PAIRING_TYPE,
    normalized.app,
    normalized.coreName,
    normalized.key,
    normalized.discoveryKey
  ].join(':')))
}

export async function waitForOperationCount (store, expectedCount, opts = {}) {
  const timeout = opts.timeout || 5000
  const interval = opts.interval || 50
  const started = Date.now()
  let lastError = null

  while (Date.now() - started < timeout) {
    try {
      await store.update()
      const ops = await store.listOperations()
      if (ops.length >= expectedCount) return ops
    } catch (err) {
      lastError = err
    }
    await delay(interval)
  }

  if (lastError) throw lastError
  throw new Error(`Timed out waiting for ${expectedCount} replicated operations`)
}

function noop () {}

function delay (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function destroyConnection (conn) {
  if (typeof conn.destroy === 'function') conn.destroy()
  else if (typeof conn.end === 'function') conn.end()
}

async function createDefaultSwarm (opts = {}) {
  const mod = await import('hyperswarm')
  const Hyperswarm = mod.default || mod
  return new Hyperswarm(opts || {})
}

function replicateOverConnection (store, conn) {
  if (conn.noiseStream) {
    const stream = store.replicateConnection
      ? store.replicateConnection(conn)
      : store.store.replicate(conn)
    if (stream && typeof stream.on === 'function') stream.on('error', noop)
    return stream
  }

  const stream = store.replicate(conn.isInitiator === true)
  stream.on('error', noop)
  stream.pipe(conn).pipe(stream)
  return stream
}

function shortHex (buffer) {
  const value = b4a.toString(buffer, 'hex')
  return `${value.slice(0, 8)}...${value.slice(-6)}`
}
