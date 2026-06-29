import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import b4a from 'b4a'
import { replayOperations } from './ops.js'

const DEFAULT_CORE_NAME = 'matchday-mesh-ops'
const SEQ_KEY = 'meta!seq'
const OP_PREFIX = 'op!'
const OP_ID_PREFIX = 'op-id!'

export class MatchdayPearsStore {
  constructor (storagePath, opts = {}) {
    if (!storagePath) throw codeError('STORAGE_PATH_REQUIRED', 'storagePath is required')
    this.storagePath = storagePath
    this.coreName = opts.coreName || DEFAULT_CORE_NAME
    this.coreKey = opts.key || opts.coreKey || null
    this.writable = this.coreKey ? opts.writable === true : opts.writable
    this.store = null
    this.core = null
    this.bee = null
  }

  async open () {
    if (this.bee) return this
    this.store = new Corestore(this.storagePath)
    await this.store.ready()
    this.core = this.coreKey
      ? this.store.get({ key: decodeCoreKey(this.coreKey), writable: this.writable === true })
      : this.store.get({ name: this.coreName, writable: this.writable })
    this.bee = new Hyperbee(this.core, {
      keyEncoding: 'utf-8',
      valueEncoding: 'binary'
    })
    await this.bee.ready()
    return this
  }

  async close () {
    if (this.bee) {
      await this.bee.close()
      this.bee = null
    }
    if (this.store) {
      await this.store.close()
      this.store = null
    }
    this.core = null
  }

  async appendOperation (op) {
    this._assertOpen()
    assertOperationShape(op)
    const existing = await this.bee.get(OP_ID_PREFIX + op.id)
    if (existing) {
      return {
        skipped: true,
        reason: 'duplicate-op',
        opId: op.id,
        seq: decode(existing)
      }
    }

    const seq = await this._nextSeq()
    const opKey = OP_PREFIX + padSeq(seq) + '!' + op.id
    const stored = {
      ...op,
      storedAt: new Date().toISOString(),
      seq
    }

    const batch = this.bee.batch()
    await batch.put(opKey, encode(stored))
    await batch.put(OP_ID_PREFIX + op.id, encode({ seq, opKey }))
    await batch.put(SEQ_KEY, encode({ seq }))
    await batch.flush()
    return { skipped: false, seq, opKey, op: stored }
  }

  async appendOperations (ops = []) {
    if (!Array.isArray(ops)) throw codeError('INVALID_OPERATION_LOG', 'operations must be an array')
    const results = []
    for (const op of ops) results.push(await this.appendOperation(op))
    return results
  }

  async listOperations () {
    this._assertOpen()
    const ops = []
    const stream = this.bee.createReadStream({
      gte: OP_PREFIX,
      lte: OP_PREFIX + '~'
    })
    for await (const node of stream) {
      const stored = decode(node.value)
      const { storedAt, seq, ...op } = stored
      ops.push(op)
    }
    return ops
  }

  async update (opts = {}) {
    this._assertOpen()
    return this.bee.update(opts)
  }

  replicate (isInitiator, opts = {}) {
    this._assertOpen()
    return this.store.replicate(isInitiator, opts)
  }

  replicateConnection (conn, opts = {}) {
    this._assertOpen()
    return this.store.replicate(conn, opts)
  }

  async clearOperations () {
    this._assertOpen()
    const keys = []
    for await (const node of this.bee.createReadStream({ gte: OP_PREFIX, lte: OP_PREFIX + '~' })) {
      keys.push(node.key)
    }
    for await (const node of this.bee.createReadStream({ gte: OP_ID_PREFIX, lte: OP_ID_PREFIX + '~' })) {
      keys.push(node.key)
    }
    keys.push(SEQ_KEY)

    const batch = this.bee.batch()
    for (const key of keys) await batch.del(key)
    await batch.flush()
    return { cleared: keys.length }
  }

  async replayState () {
    return replayOperations(await this.listOperations())
  }

  async info () {
    this._assertOpen()
    const ops = await this.listOperations()
    return {
      storagePath: this.storagePath,
      coreName: this.coreName,
      key: this.core.key ? b4a.toString(this.core.key, 'hex') : null,
      discoveryKey: this.core.discoveryKey ? b4a.toString(this.core.discoveryKey, 'hex') : null,
      writable: !!this.core.writable,
      operations: ops.length
    }
  }

  async _nextSeq () {
    const current = await this.bee.get(SEQ_KEY)
    const seq = current ? Number(decode(current).seq || 0) + 1 : 1
    if (!Number.isSafeInteger(seq) || seq < 1) {
      throw codeError('INVALID_SEQUENCE', 'Stored operation sequence is invalid')
    }
    return seq
  }

  _assertOpen () {
    if (!this.bee) throw codeError('STORE_NOT_OPEN', 'Matchday Pears store is not open')
  }
}

export async function openMatchdayPearsStore (storagePath, opts = {}) {
  const store = new MatchdayPearsStore(storagePath, opts)
  await store.open()
  return store
}

export async function openMatchdayPearsReplica (storagePath, sourceKey, opts = {}) {
  return openMatchdayPearsStore(storagePath, {
    ...opts,
    key: sourceKey,
    writable: false
  })
}

function encode (value) {
  return b4a.from(JSON.stringify(value))
}

function decode (nodeOrBuffer) {
  const value = nodeOrBuffer && nodeOrBuffer.value ? nodeOrBuffer.value : nodeOrBuffer
  return JSON.parse(b4a.toString(value))
}

function decodeCoreKey (key) {
  if (key && typeof key === 'object' && typeof key.byteLength === 'number') return key
  if (typeof key === 'string' && /^[0-9a-f]{64}$/i.test(key)) return b4a.from(key, 'hex')
  throw codeError('INVALID_CORE_KEY', 'Core key must be a 64 character hex string or Buffer')
}

function padSeq (seq) {
  return String(seq).padStart(12, '0')
}

function assertOperationShape (op) {
  if (!op || typeof op !== 'object') throw codeError('INVALID_OPERATION', 'Operation must be an object')
  if (op.version !== 1) throw codeError('INVALID_OPERATION', 'Operation version must be 1')
  if (!op.id || typeof op.id !== 'string') throw codeError('INVALID_OPERATION', 'Operation id is required')
  if (!op.type || typeof op.type !== 'string') throw codeError('INVALID_OPERATION', 'Operation type is required')
  if (!op.payload || typeof op.payload !== 'object') throw codeError('INVALID_OPERATION', 'Operation payload is required')
}

function codeError (code, message) {
  const err = new Error(message)
  err.code = code
  return err
}
