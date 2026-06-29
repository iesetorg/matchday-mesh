const FEED_TYPES = new Set([
  'feed:system',
  'feed:checkin',
  'feed:prediction',
  'feed:reaction',
  'feed:poll',
  'feed:poll-vote',
  'feed:match-note',
  'feed:pool-opened',
  'feed:pool-contribution',
  'feed:coach-summary',
  'feed:moderation'
])

export function createState () {
  const now = nowIso()
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    appliedOps: {},
    hubs: {},
    passes: {},
    feed: [],
    predictions: {},
    pools: {},
    payments: {}
  }
}

export function createMatchHub (state, input = {}, opts = {}) {
  assertState(state)
  const title = clean(input.title)
  const home = clean(input.homeTeam)
  const away = clean(input.awayTeam)
  if (!title) throw codeError('MATCH_TITLE_REQUIRED', 'Match title is required')
  if (!home || !away) throw codeError('MATCH_TEAMS_REQUIRED', 'Home and away teams are required')

  const id = opts.id || makeId('hub', `${title}-${home}-${away}`, opts.now)
  const hub = {
    id,
    title,
    homeTeam: home,
    awayTeam: away,
    kickoffAt: clean(input.kickoffAt) || null,
    venue: clean(input.venue) || 'Local watch party',
    hostName: clean(input.hostName) || 'Host',
    status: 'open',
    createdAt: time(opts.now),
    updatedAt: time(opts.now),
    inviteCode: opts.inviteCode || makeInviteCode(id)
  }
  state.hubs[id] = hub
  touch(state, opts.now)
  appendFeedCard(state, {
    hubId: id,
    type: 'feed:system',
    actorName: hub.hostName,
    body: `${hub.title} opened for ${hub.homeTeam} vs ${hub.awayTeam}.`
  }, opts)
  return hub
}

export function claimPass (state, input = {}, opts = {}) {
  assertState(state)
  const hub = requireHub(state, input.hubId)
  const displayName = clean(input.displayName)
  if (!displayName) throw codeError('DISPLAY_NAME_REQUIRED', 'Display name is required')
  const writerId = clean(input.writerId) || slug(displayName)
  const existing = Object.values(state.passes).find((pass) => pass.hubId === hub.id && pass.writerId === writerId)
  if (existing) return existing

  const pass = {
    id: opts.id || makeId('pass', `${hub.id}-${writerId}`, opts.now),
    hubId: hub.id,
    writerId,
    displayName,
    role: clean(input.role) || 'fan',
    claimedAt: time(opts.now),
    checkedInAt: null,
    checkedInBy: null,
    qrPayload: null
  }
  pass.qrPayload = `matchday:${hub.id}:${pass.id}:${writerId}`
  state.passes[pass.id] = pass
  touch(state, opts.now)
  appendFeedCard(state, {
    hubId: hub.id,
    type: 'feed:system',
    actorId: writerId,
    actorName: displayName,
    body: `${displayName} claimed a fan pass.`
  }, opts)
  return pass
}

export function scanPass (state, input = {}, opts = {}) {
  assertState(state)
  const pass = state.passes[input.passId]
  if (!pass) throw codeError('PASS_NOT_FOUND', 'Pass was not found')
  requireHub(state, pass.hubId)
  if (pass.checkedInAt) return pass

  pass.checkedInAt = time(opts.now)
  pass.checkedInBy = clean(input.scannerName) || 'Door scanner'
  touch(state, opts.now)
  appendFeedCard(state, {
    hubId: pass.hubId,
    type: 'feed:checkin',
    actorId: pass.writerId,
    actorName: pass.displayName,
    body: `${pass.displayName} checked in.`,
    refs: { passId: pass.id }
  }, opts)
  return pass
}

export function postPrediction (state, input = {}, opts = {}) {
  assertState(state)
  const hub = requireHub(state, input.hubId)
  const writerId = clean(input.writerId) || slug(input.actorName)
  const actorName = clean(input.actorName)
  if (!writerId || !actorName) throw codeError('ACTOR_REQUIRED', 'Prediction needs an actor')
  const key = `${hub.id}!${writerId}`
  if (state.predictions[key]) throw codeError('DUPLICATE_PREDICTION', 'Each fan gets one prediction per match hub')

  const prediction = {
    id: opts.id || makeId('pred', `${hub.id}-${writerId}`, opts.now),
    hubId: hub.id,
    writerId,
    actorName,
    homeScore: numberScore(input.homeScore),
    awayScore: numberScore(input.awayScore),
    winner: clean(input.winner) || null,
    note: clean(input.note) || '',
    createdAt: time(opts.now)
  }
  state.predictions[key] = prediction
  touch(state, opts.now)
  appendFeedCard(state, {
    id: opts.feedId,
    hubId: hub.id,
    type: 'feed:prediction',
    actorId: writerId,
    actorName,
    body: `${actorName} predicts ${hub.homeTeam} ${prediction.homeScore}-${prediction.awayScore} ${hub.awayTeam}.`,
    refs: { predictionId: prediction.id }
  }, opts)
  return prediction
}

export function postReaction (state, input = {}, opts = {}) {
  assertState(state)
  const hub = requireHub(state, input.hubId)
  const actorName = clean(input.actorName)
  const body = clean(input.body)
  if (!actorName) throw codeError('ACTOR_REQUIRED', 'Reaction needs an actor')
  if (!body) throw codeError('REACTION_BODY_REQUIRED', 'Reaction body is required')
  return appendFeedCard(state, {
    hubId: hub.id,
    type: 'feed:reaction',
    actorId: clean(input.writerId) || slug(actorName),
    actorName,
    body
  }, opts)
}

export function createPool (state, input = {}, opts = {}) {
  assertState(state)
  const hub = requireHub(state, input.hubId)
  const title = clean(input.title) || 'Watch-party pool'
  const pool = {
    id: opts.id || makeId('pool', `${hub.id}-${title}`, opts.now),
    hubId: hub.id,
    title,
    asset: clean(input.asset) || 'USDt',
    targetAmount: positiveNumber(input.targetAmount) || null,
    status: 'open',
    createdAt: time(opts.now),
    paymentMode: clean(input.paymentMode) || 'demo-ledger',
    receiveRequestId: clean(input.receiveRequestId) || null,
    receiveAddress: clean(input.receiveAddress) || null
  }
  state.pools[pool.id] = pool
  touch(state, opts.now)
  appendFeedCard(state, {
    hubId: hub.id,
    type: 'feed:pool-opened',
    actorName: clean(input.actorName) || hub.hostName,
    body: `${pool.title} opened in ${pool.asset}.`,
    refs: { poolId: pool.id }
  }, opts)
  return pool
}

export function recordPoolContribution (state, input = {}, opts = {}) {
  assertState(state)
  const pool = state.pools[input.poolId]
  if (!pool) throw codeError('POOL_NOT_FOUND', 'Pool was not found')
  const hub = requireHub(state, pool.hubId)
  const amount = positiveNumber(input.amount)
  const actorName = clean(input.actorName)
  if (!amount) throw codeError('AMOUNT_REQUIRED', 'Contribution amount must be positive')
  if (!actorName) throw codeError('ACTOR_REQUIRED', 'Contribution needs an actor')

  const payment = {
    id: opts.id || makeId('pay', `${pool.id}-${actorName}-${amount}`, opts.now),
    hubId: hub.id,
    poolId: pool.id,
    actorName,
    amount,
    asset: pool.asset,
    status: clean(input.status) || 'confirmed-demo',
    mode: pool.paymentMode,
    receipt: clean(input.receipt) || null,
    createdAt: time(opts.now)
  }
  state.payments[payment.id] = payment
  touch(state, opts.now)
  appendFeedCard(state, {
    hubId: hub.id,
    type: 'feed:pool-contribution',
    actorName,
    body: `${actorName} contributed ${formatAmount(amount)} ${pool.asset}.`,
    refs: { poolId: pool.id, paymentId: payment.id }
  }, opts)
  return payment
}

export function listFeed (state, hubId) {
  assertState(state)
  return state.feed
    .filter((card) => !hubId || card.hubId === hubId)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

export function moduleStatus (state) {
  assertState(state)
  return {
    pearsStack: Object.keys(state.appliedOps || {}).length > 0 ? 'op-log-ready' : 'local-model-ready',
    wdk: Object.keys(state.pools).length > 0 ? 'demo-ledger-active' : 'not-started',
    qvac: 'disabled-until-local-sdk-proof',
    opLog: Object.keys(state.appliedOps || {}).length,
    hubs: Object.keys(state.hubs).length,
    passes: Object.keys(state.passes).length,
    feedCards: state.feed.length
  }
}

export function exportProofPack (state) {
  assertState(state)
  return {
    generatedAt: nowIso(),
    app: 'matchday-mesh',
    version: '0.1.0',
    status: moduleStatus(state),
    opCount: Object.keys(state.appliedOps || {}).length,
    hubIds: Object.keys(state.hubs),
    feedCards: state.feed.length,
    passCount: Object.keys(state.passes).length,
    poolCount: Object.keys(state.pools).length,
    paymentCount: Object.keys(state.payments).length
  }
}

function appendFeedCard (state, input = {}, opts = {}) {
  const hub = requireHub(state, input.hubId)
  if (!FEED_TYPES.has(input.type)) throw codeError('UNKNOWN_FEED_TYPE', `Unsupported feed type: ${input.type}`)
  const card = {
    id: input.id || opts.feedId || makeId('feed', `${hub.id}-${input.type}-${state.feed.length}`, opts.now),
    hubId: hub.id,
    type: input.type,
    actorId: clean(input.actorId) || null,
    actorName: clean(input.actorName) || 'Matchday Mesh',
    body: clean(input.body) || '',
    refs: input.refs || {},
    createdAt: time(opts.now)
  }
  state.feed.push(card)
  touch(state, opts.now)
  return card
}

function assertState (state) {
  if (!state || typeof state !== 'object' || !state.hubs || !state.feed) {
    throw codeError('INVALID_STATE', 'A Matchday Mesh state object is required')
  }
}

function requireHub (state, hubId) {
  const hub = state.hubs[hubId]
  if (!hub) throw codeError('HUB_NOT_FOUND', 'Match hub was not found')
  return hub
}

function touch (state, now) {
  state.updatedAt = time(now)
}

function clean (value) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function numberScore (value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 99) {
    throw codeError('INVALID_SCORE', 'Score must be an integer from 0 to 99')
  }
  return parsed
}

function positiveNumber (value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed * 100) / 100
}

function formatAmount (value) {
  return Number(value).toFixed(2).replace(/\.00$/, '')
}

function slug (value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'fan'
}

function makeInviteCode (hubId) {
  return hubId.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase().padStart(8, 'M')
}

function makeId (prefix, seed, now) {
  const stable = slug(seed).slice(0, 32) || prefix
  const suffix = hash(`${prefix}:${seed}:${time(now)}`).slice(0, 8)
  return `${prefix}_${stable}_${suffix}`
}

function hash (value) {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function time (value) {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && value) return new Date(value).toISOString()
  if (typeof value === 'number') return new Date(value).toISOString()
  return nowIso()
}

function nowIso () {
  return new Date().toISOString()
}

function codeError (code, message) {
  const err = new Error(message)
  err.code = code
  return err
}
