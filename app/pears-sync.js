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
