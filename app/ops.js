import {
  claimPass,
  createMatchHub,
  createPool,
  createState,
  postPrediction,
  postReaction,
  recordPoolContribution,
  scanPass
} from './domain.js'

export const OP_TYPES = Object.freeze({
  CREATE_MATCH: 'match:create',
  CLAIM_PASS: 'pass:claim',
  SCAN_PASS: 'pass:scan',
  POST_REACTION: 'feed:reaction',
  POST_PREDICTION: 'prediction:post',
  CREATE_POOL: 'pool:create',
  RECORD_POOL_CONTRIBUTION: 'pool:contribute'
})

export function createOperation (type, payload = {}, opts = {}) {
  if (!Object.values(OP_TYPES).includes(type)) {
    throw codeError('UNKNOWN_OPERATION', `Unsupported operation type: ${type}`)
  }
  const createdAt = time(opts.now)
  return {
    version: 1,
    id: opts.opId || makeOpId(type, payload, createdAt),
    type,
    payload: clone(payload),
    createdAt,
    actorId: clean(opts.actorId || payload.writerId || payload.actorName || payload.hostName) || 'local-demo',
    entityId: clean(opts.entityId || payload.id) || null,
    feedId: clean(opts.feedId) || null
  }
}

export function applyOperation (state, op) {
  assertOperation(op)
  if (!state.appliedOps) state.appliedOps = {}
  if (state.appliedOps[op.id]) {
    return { skipped: true, reason: 'duplicate-op', opId: op.id }
  }

  const opts = {
    now: op.createdAt,
    id: op.entityId || undefined,
    feedId: op.feedId || undefined
  }

  let result
  switch (op.type) {
    case OP_TYPES.CREATE_MATCH:
      result = createMatchHub(state, op.payload, opts)
      break
    case OP_TYPES.CLAIM_PASS:
      result = claimPass(state, op.payload, opts)
      break
    case OP_TYPES.SCAN_PASS:
      result = scanPass(state, op.payload, opts)
      break
    case OP_TYPES.POST_REACTION:
      result = postReaction(state, op.payload, opts)
      break
    case OP_TYPES.POST_PREDICTION:
      result = postPrediction(state, op.payload, opts)
      break
    case OP_TYPES.CREATE_POOL:
      result = createPool(state, op.payload, opts)
      break
    case OP_TYPES.RECORD_POOL_CONTRIBUTION:
      result = recordPoolContribution(state, op.payload, opts)
      break
    default:
      throw codeError('UNKNOWN_OPERATION', `Unsupported operation type: ${op.type}`)
  }

  state.appliedOps[op.id] = {
    type: op.type,
    createdAt: op.createdAt,
    actorId: op.actorId
  }
  return result
}

export function replayOperations (ops = []) {
  if (!Array.isArray(ops)) throw codeError('INVALID_OPERATION_LOG', 'Operation log must be an array')
  const state = createState()
  for (const op of ops) applyOperation(state, op)
  return state
}

export function createDemoOperations (opts = {}) {
  const baseMs = opts.baseNow
    ? new Date(opts.baseNow).getTime()
    : Date.now() - (3 * 60 * 1000)
  const at = (offsetMs) => new Date(baseMs + offsetMs).toISOString()
  return [
    createOperation(OP_TYPES.CREATE_MATCH, {
      title: 'Final Night Fan Zone',
      homeTeam: 'Pear FC',
      awayTeam: 'Tether United',
      venue: 'Rooftop pitch',
      hostName: 'Mina'
    }, {
      opId: 'op_demo_create_hub',
      entityId: 'hub_final_night',
      actorId: 'host_mina',
      now: at(0)
    }),
    createOperation(OP_TYPES.CLAIM_PASS, {
      hubId: 'hub_final_night',
      displayName: 'Ada',
      writerId: 'fan_ada'
    }, {
      opId: 'op_demo_claim_ada',
      entityId: 'pass_ada',
      actorId: 'fan_ada',
      now: at(60 * 1000)
    }),
    createOperation(OP_TYPES.POST_REACTION, {
      hubId: 'hub_final_night',
      actorName: 'Mina',
      writerId: 'host_mina',
      body: 'Doors open. Bring the noise, keep it friendly.'
    }, {
      opId: 'op_demo_host_note',
      actorId: 'host_mina',
      now: at(120 * 1000)
    })
  ]
}

export function serializeOperations (ops = []) {
  return JSON.stringify({
    version: 1,
    app: 'matchday-mesh',
    exportedAt: new Date().toISOString(),
    ops
  }, null, 2)
}

export function parseOperationEnvelope (text) {
  const parsed = JSON.parse(text)
  if (Array.isArray(parsed)) return parsed
  if (parsed?.app !== 'matchday-mesh' || !Array.isArray(parsed.ops)) {
    throw codeError('INVALID_OPERATION_LOG', 'Operation envelope is not a Matchday Mesh log')
  }
  return parsed.ops
}

function assertOperation (op) {
  if (!op || typeof op !== 'object') throw codeError('INVALID_OPERATION', 'Operation must be an object')
  if (op.version !== 1) throw codeError('INVALID_OPERATION', 'Operation version must be 1')
  if (!op.id || typeof op.id !== 'string') throw codeError('INVALID_OPERATION', 'Operation id is required')
  if (!Object.values(OP_TYPES).includes(op.type)) {
    throw codeError('UNKNOWN_OPERATION', `Unsupported operation type: ${op.type}`)
  }
  if (!op.payload || typeof op.payload !== 'object') {
    throw codeError('INVALID_OPERATION', 'Operation payload is required')
  }
}

function clone (value) {
  return JSON.parse(JSON.stringify(value))
}

function clean (value) {
  return typeof value === 'string' ? value.trim() : ''
}

function time (value) {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && value) return new Date(value).toISOString()
  if (typeof value === 'number') return new Date(value).toISOString()
  return new Date().toISOString()
}

function makeOpId (type, payload, createdAt) {
  const stable = slug(`${type}-${payload.hubId || payload.title || payload.passId || payload.poolId || payload.actorName || 'op'}`)
  return `op_${stable}_${hash(`${type}:${JSON.stringify(payload)}:${createdAt}`).slice(0, 8)}`
}

function slug (value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'op'
}

function hash (value) {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function codeError (code, message) {
  const err = new Error(message)
  err.code = code
  return err
}
