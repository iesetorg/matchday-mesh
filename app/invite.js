export const MATCHDAY_INVITE_TYPE = 'matchday-mesh-core-invite-v1'
export const MATCHDAY_APP_ID = 'matchday-mesh'
export const DEFAULT_CORE_NAME = 'matchday-mesh-ops'

export function createMatchdayInvite (info, opts = {}) {
  const key = normalizeHex(info?.key, 'key')
  const discoveryKey = normalizeHex(info?.discoveryKey, 'discoveryKey')
  const operations = normalizeOperationCount(info?.operations)

  return {
    type: MATCHDAY_INVITE_TYPE,
    app: MATCHDAY_APP_ID,
    coreName: info?.coreName || DEFAULT_CORE_NAME,
    key,
    discoveryKey,
    writable: false,
    operations,
    createdAt: opts.createdAt || new Date().toISOString()
  }
}

export function normalizeMatchdayInvite (value) {
  const invite = parseInvite(value)
  if (invite.type !== MATCHDAY_INVITE_TYPE) {
    throw codeError('INVALID_INVITE_TYPE', `Invite type must be ${MATCHDAY_INVITE_TYPE}`)
  }
  if (invite.app !== MATCHDAY_APP_ID) {
    throw codeError('INVALID_INVITE_APP', `Invite app must be ${MATCHDAY_APP_ID}`)
  }

  return {
    type: MATCHDAY_INVITE_TYPE,
    app: MATCHDAY_APP_ID,
    coreName: typeof invite.coreName === 'string' && invite.coreName.trim()
      ? invite.coreName.trim()
      : DEFAULT_CORE_NAME,
    key: normalizeHex(invite.key, 'key'),
    discoveryKey: normalizeHex(invite.discoveryKey, 'discoveryKey'),
    writable: false,
    operations: normalizeOperationCount(invite.operations),
    createdAt: normalizeCreatedAt(invite.createdAt)
  }
}

export function summarizeMatchdayInvite (value) {
  const invite = normalizeMatchdayInvite(value)
  return {
    type: invite.type,
    app: invite.app,
    coreName: invite.coreName,
    key: invite.key,
    shortKey: shortHex(invite.key),
    discoveryKey: invite.discoveryKey,
    shortDiscoveryKey: shortHex(invite.discoveryKey),
    operations: invite.operations,
    writable: invite.writable,
    createdAt: invite.createdAt
  }
}

function parseInvite (value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      throw codeError('INVALID_INVITE_JSON', 'Invite must be valid JSON')
    }
  }
  if (value && typeof value === 'object') return value
  throw codeError('INVALID_INVITE', 'Invite must be an object or JSON string')
}

function normalizeHex (value, field) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/i.test(value.trim())) {
    throw codeError('INVALID_INVITE_KEY', `Invite ${field} must be a 64 character hex string`)
  }
  return value.trim().toLowerCase()
}

function normalizeOperationCount (value) {
  const operations = Number(value || 0)
  if (!Number.isSafeInteger(operations) || operations < 0) {
    throw codeError('INVALID_INVITE_OPERATIONS', 'Invite operations must be a non-negative integer')
  }
  return operations
}

function normalizeCreatedAt (value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) throw codeError('INVALID_INVITE_CREATED_AT', 'Invite createdAt must be an ISO timestamp')
  return value
}

function shortHex (value) {
  return `${value.slice(0, 8)}...${value.slice(-6)}`
}

function codeError (code, message) {
  const err = new Error(message)
  err.code = code
  return err
}
