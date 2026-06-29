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

function shortHex (buffer) {
  const value = b4a.toString(buffer, 'hex')
  return `${value.slice(0, 8)}...${value.slice(-6)}`
}
