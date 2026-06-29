export const PAYMENT_MODES = Object.freeze({
  DEMO_LEDGER: 'demo-ledger',
  WDK: 'wdk'
})

export function createPoolReceiveRequest (input = {}, opts = {}) {
  const mode = clean(input.mode || opts.mode) || PAYMENT_MODES.DEMO_LEDGER
  if (mode !== PAYMENT_MODES.DEMO_LEDGER) {
    throw codeError('PAYMENT_MODE_UNAVAILABLE', 'Real WDK mode is not enabled in this launch build')
  }

  const hubId = clean(input.hubId)
  const title = clean(input.title) || 'Watch-party pool'
  const asset = clean(input.asset) || 'USDt'
  const targetAmount = positiveNumber(input.targetAmount)
  if (!hubId) throw codeError('HUB_REQUIRED', 'Receive request needs a hub id')

  const id = opts.id || `recv_${slug(`${hubId}-${title}`)}_${hash(`${hubId}:${title}:${asset}:${targetAmount || ''}`).slice(0, 8)}`
  const receiveAddress = `demo-usdt://matchday-mesh/${hubId}/${id}`

  return {
    id,
    mode,
    asset,
    targetAmount,
    receiveAddress,
    qrPayload: receiveAddress,
    status: 'awaiting-demo-contribution',
    createdAt: time(opts.now)
  }
}

export function confirmDemoPoolContribution (pool, input = {}, opts = {}) {
  if (!pool || typeof pool !== 'object') throw codeError('POOL_REQUIRED', 'Pool is required')
  if (pool.paymentMode !== PAYMENT_MODES.DEMO_LEDGER) {
    throw codeError('PAYMENT_MODE_UNAVAILABLE', 'Only demo-ledger confirmation is available in this build')
  }

  const amount = positiveNumber(input.amount)
  const actorName = clean(input.actorName)
  if (!amount) throw codeError('AMOUNT_REQUIRED', 'Contribution amount must be positive')
  if (!actorName) throw codeError('ACTOR_REQUIRED', 'Contribution needs an actor')

  const id = opts.id || `demo_pay_${slug(`${pool.id}-${actorName}-${amount}`)}_${hash(`${pool.id}:${actorName}:${amount}:${time(opts.now)}`).slice(0, 8)}`
  return {
    id,
    poolId: pool.id,
    actorName,
    amount,
    asset: pool.asset || 'USDt',
    mode: PAYMENT_MODES.DEMO_LEDGER,
    status: 'confirmed-demo',
    receipt: `demo-receipt:${id}`,
    receiveAddress: pool.receiveAddress || null,
    confirmedAt: time(opts.now)
  }
}

export function paymentModuleStatus (state) {
  const pools = Object.values(state?.pools || {})
  const demoPools = pools.filter((pool) => pool.paymentMode === PAYMENT_MODES.DEMO_LEDGER)
  const wdkPools = pools.filter((pool) => pool.paymentMode === PAYMENT_MODES.WDK)
  return {
    mode: wdkPools.length > 0 ? PAYMENT_MODES.WDK : PAYMENT_MODES.DEMO_LEDGER,
    status: wdkPools.length > 0 ? 'wdk-enabled' : 'demo-ledger-active',
    demoPools: demoPools.length,
    wdkPools: wdkPools.length,
    claim: wdkPools.length > 0 ? 'WDK receive path active' : 'WDK-shaped demo receive path'
  }
}

function clean (value) {
  return typeof value === 'string' ? value.trim() : ''
}

function positiveNumber (value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed * 100) / 100
}

function slug (value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'payment'
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
  return new Date().toISOString()
}

function codeError (code, message) {
  const err = new Error(message)
  err.code = code
  return err
}
