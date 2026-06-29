/** @typedef {import('pear-interface')} */ /* global Pear */

window.matchdayMeshWriteProof = writeBootProof
window.matchdayMeshRuntime = bootPearRuntime()
window.matchdayMeshVisualProof = null
window.matchdayMeshVisualProofError = null

const VISUAL_PROOF_STAGES = new Set(['ui-ready', 'demo-seeded', 'operation-appended'])
let visualProofPending = false

async function bootPearRuntime () {
  await writeBootProof('script-loaded')
  if (typeof Pear === 'undefined' || !Pear.config) {
    await writeBootProof('pear-unavailable')
    return null
  }

  try {
    const { createMatchdayApi } = await import('./runtime-api.js')
    const storagePath = Pear.config.storage || './data'
    const api = await createMatchdayApi(storagePath)
    window.matchdayAPI = api
    window.matchdayMeshRuntimeInfo = await api.info()
    await writeBootProof('runtime-ready', { info: window.matchdayMeshRuntimeInfo })

    if (typeof Pear.teardown === 'function') {
      Pear.teardown(() => {
        Promise.resolve(api.close()).catch((err) => {
          console.error('[matchday-mesh:runtime-close]', err)
        })
      })
    }

    return api
  } catch (err) {
    window.matchdayMeshRuntimeError = err && err.message ? err.message : String(err)
    await writeBootProof('runtime-error', { error: window.matchdayMeshRuntimeError })
    console.error('[matchday-mesh:runtime]', err)
    return null
  }
}

async function writeBootProof (stage, details = {}) {
  const proofPath = getProofPath()
  const visualProofPath = getVisualProofPath()
  if (!proofPath && !visualProofPath) return

  try {
    const { writeFileSync } = await import('fs')
    const api = window.matchdayAPI || null
    const info = api && typeof api.info === 'function'
      ? await api.info().catch((err) => ({ error: err.message }))
      : null
    const proof = {
      ok: !!api && !window.matchdayMeshRuntimeError,
      stage,
      hasPear: typeof Pear !== 'undefined',
      hasMatchdayAPI: !!api,
      runtimeError: window.matchdayMeshRuntimeError || null,
      info,
      ...details,
      writtenAt: new Date().toISOString()
    }
    proof.visualProof = await maybeWriteVisualProof(stage, visualProofPath, proof)
    if (proofPath) writeFileSync(proofPath, JSON.stringify(proof, null, 2))
  } catch (err) {
    console.error('[matchday-mesh:proof]', err)
  }
}

function getProofPath () {
  if (typeof process !== 'undefined' && process.env && process.env.MATCHDAY_MESH_BOOT_PROOF_PATH) {
    return process.env.MATCHDAY_MESH_BOOT_PROOF_PATH
  }
  if (typeof Pear !== 'undefined' && Pear.config?.env?.MATCHDAY_MESH_BOOT_PROOF_PATH) {
    return Pear.config.env.MATCHDAY_MESH_BOOT_PROOF_PATH
  }
  return null
}

function getVisualProofPath () {
  if (typeof process !== 'undefined' && process.env && process.env.MATCHDAY_MESH_VISUAL_PROOF_PATH) {
    return process.env.MATCHDAY_MESH_VISUAL_PROOF_PATH
  }
  if (typeof Pear !== 'undefined' && Pear.config?.env?.MATCHDAY_MESH_VISUAL_PROOF_PATH) {
    return Pear.config.env.MATCHDAY_MESH_VISUAL_PROOF_PATH
  }
  return null
}

async function maybeWriteVisualProof (stage, visualProofPath, proof) {
  if (!visualProofPath || !VISUAL_PROOF_STAGES.has(stage)) return window.matchdayMeshVisualProof
  if (window.matchdayMeshVisualProof || visualProofPending) return window.matchdayMeshVisualProof

  visualProofPending = true
  try {
    try {
      window.matchdayMeshVisualProof = await withTimeout(
        captureDesktopVisualProof(stage, visualProofPath),
        getVisualProofTimeout()
      )
    } catch (err) {
      window.matchdayMeshVisualProof = await captureRendererProofCard(stage, visualProofPath, proof, err.message)
    }
    window.matchdayMeshVisualProofError = null
  } catch (err) {
    window.matchdayMeshVisualProofError = err && err.message ? err.message : String(err)
    window.matchdayMeshVisualProof = {
      ok: false,
      path: visualProofPath,
      stage,
      error: window.matchdayMeshVisualProofError,
      capturedAt: new Date().toISOString()
    }
  } finally {
    visualProofPending = false
  }

  return window.matchdayMeshVisualProof
}

async function captureDesktopVisualProof (stage, visualProofPath) {
  await delay(getVisualProofDelay())
  const mod = await import('pear-electron')
  const ui = mod.default || mod
  if (!ui?.media?.desktopSources) throw new Error('Pear UI desktop capture API is unavailable')

  if (typeof ui.app?.show === 'function') await ui.app.show().catch(noop)
  if (typeof ui.app?.focus === 'function') await ui.app.focus({ steal: true }).catch(noop)
  await delay(300)

  const screenStatus = typeof ui.media?.status?.screen === 'function'
    ? await ui.media.status.screen().catch(() => null)
    : null
  const sourceId = typeof ui.app?.getMediaSourceId === 'function'
    ? await ui.app.getMediaSourceId().catch(() => null)
    : null
  const sources = await ui.media.desktopSources({
    types: ['window'],
    thumbnailSize: { width: 1280, height: 820 },
    fetchWindowIcons: false
  })
  const source = selectCaptureSource(sources, sourceId)
  if (!source?.thumbnail) throw new Error('Matchday Mesh window source was not available')

  const png = nativeImageToPng(source.thumbnail)
  if (window.matchdayMeshVisualProof) throw new Error('Visual proof was already written')
  const { writeFileSync } = await import('fs')
  writeFileSync(visualProofPath, png)

  return {
    ok: true,
    path: visualProofPath,
    mode: 'desktop-capture',
    screenshot: true,
    stage,
    sourceId: source.id || sourceId || null,
    sourceName: source.name || null,
    screenStatus,
    bytes: png.byteLength || png.length || 0,
    capturedAt: new Date().toISOString()
  }
}

async function captureRendererProofCard (stage, visualProofPath, proof, fallbackReason) {
  await delay(100)
  const png = renderProofCardPng(proof, fallbackReason)
  const { writeFileSync } = await import('fs')
  writeFileSync(visualProofPath, png)
  return {
    ok: true,
    path: visualProofPath,
    mode: 'renderer-proof-card',
    screenshot: false,
    stage,
    sourceId: null,
    sourceName: 'Matchday Mesh renderer proof card',
    fallbackReason,
    bytes: png.byteLength || png.length || 0,
    capturedAt: new Date().toISOString()
  }
}

function selectCaptureSource (sources, sourceId) {
  if (!Array.isArray(sources) || sources.length === 0) return null
  return sources.find((source) => source.id === sourceId) ||
    sources.find((source) => sourceId && String(source.id || '').includes(sourceId)) ||
    sources.find((source) => /matchday mesh/i.test(source.name || '')) ||
    sources[0]
}

function nativeImageToPng (thumbnail) {
  if (thumbnail && typeof thumbnail.toPNG === 'function') return thumbnail.toPNG()
  if (thumbnail && typeof thumbnail.toDataURL === 'function') return dataUrlToBytes(thumbnail.toDataURL())
  throw new Error('Captured thumbnail cannot be converted to PNG')
}

function dataUrlToBytes (value) {
  const match = /^data:image\/png;base64,(.+)$/i.exec(String(value || ''))
  if (!match) throw new Error('Captured thumbnail was not a PNG data URL')
  const raw = atob(match[1])
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function getVisualProofDelay () {
  const value = typeof process !== 'undefined' && process.env
    ? process.env.MATCHDAY_MESH_VISUAL_PROOF_DELAY_MS
    : typeof Pear !== 'undefined'
      ? Pear.config?.env?.MATCHDAY_MESH_VISUAL_PROOF_DELAY_MS
      : null
  const delayMs = Number(value || 700)
  return Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 700
}

function getVisualProofTimeout () {
  const value = typeof process !== 'undefined' && process.env
    ? process.env.MATCHDAY_MESH_VISUAL_PROOF_TIMEOUT_MS
    : typeof Pear !== 'undefined'
      ? Pear.config?.env?.MATCHDAY_MESH_VISUAL_PROOF_TIMEOUT_MS
      : null
  const timeoutMs = Number(value || 2500)
  return Number.isFinite(timeoutMs) && timeoutMs >= 1000 ? timeoutMs : 10000
}

function renderProofCardPng (proof, fallbackReason) {
  if (typeof document === 'undefined') throw new Error('Renderer document is unavailable')
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 820
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context is unavailable')

  ctx.fillStyle = '#101211'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  drawHeader(ctx)
  drawBadges(ctx, proof)
  drawPanel(ctx, 64, 210, 550, 430, 'Runtime', [
    ['stage', proof.stage],
    ['backend', proof.backendStatus?.label || proof.info?.backend || 'unknown'],
    ['operations', String(proof.operationCount || proof.backendStatus?.operations || proof.info?.operations || 0)],
    ['pear', proof.hasPear ? 'available' : 'missing'],
    ['api', proof.hasMatchdayAPI ? 'ready' : 'missing']
  ])
  drawPanel(ctx, 666, 210, 550, 430, 'P2P Invite', [
    ['invite', proof.invite?.type || 'missing'],
    ['core', shortProofValue(proof.invite?.key || proof.info?.key)],
    ['discovery', shortProofValue(proof.invite?.discoveryKey || proof.info?.discoveryKey)],
    ['pairing', proof.pairing?.type || 'missing'],
    ['topic', shortProofValue(proof.pairing?.topic)]
  ])
  drawFooter(ctx, proof, fallbackReason)
  return dataUrlToBytes(canvas.toDataURL('image/png'))
}

function drawHeader (ctx) {
  ctx.fillStyle = '#f4f1e8'
  ctx.font = '700 72px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  ctx.fillText('Matchday Mesh', 64, 102)
  ctx.fillStyle = '#9ed7c2'
  ctx.font = '500 25px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  ctx.fillText('Pear Runtime visual proof generated inside the live renderer', 68, 148)
}

function drawBadges (ctx, proof) {
  const badges = [
    ['Pears', proof.backendStatus?.source === 'pears-store' ? 'corestore' : 'preview'],
    ['WDK', 'demo'],
    ['QVAC', 'gated']
  ]
  let x = 68
  for (const [label, value] of badges) {
    ctx.fillStyle = '#22342f'
    roundedRect(ctx, x, 168, 178, 40, 8)
    ctx.fill()
    ctx.fillStyle = '#dff8ed'
    ctx.font = '700 17px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(label, x + 16, 194)
    ctx.font = '500 17px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(value, x + 82, 194)
    x += 194
  }
}

function drawPanel (ctx, x, y, width, height, title, rows) {
  ctx.fillStyle = '#17201d'
  roundedRect(ctx, x, y, width, height, 8)
  ctx.fill()
  ctx.strokeStyle = '#31433d'
  ctx.lineWidth = 1
  roundedRect(ctx, x, y, width, height, 8)
  ctx.stroke()
  ctx.fillStyle = '#f4f1e8'
  ctx.font = '700 30px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  ctx.fillText(title, x + 30, y + 56)

  let rowY = y + 118
  for (const [label, value] of rows) {
    ctx.fillStyle = '#86a99c'
    ctx.font = '600 18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.fillText(label, x + 30, rowY)
    ctx.fillStyle = '#f4f1e8'
    ctx.font = '500 22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    ctx.fillText(String(value || 'n/a'), x + 170, rowY)
    rowY += 58
  }
}

function drawFooter (ctx, proof, fallbackReason) {
  ctx.fillStyle = '#22342f'
  roundedRect(ctx, 64, 676, 1152, 82, 8)
  ctx.fill()
  ctx.fillStyle = '#dff8ed'
  ctx.font = '600 20px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  ctx.fillText(`state: ${Object.entries(proof.stateCounts || {}).map(([key, value]) => `${key} ${value}`).join(' / ')}`, 92, 710)
  ctx.fillStyle = '#9ed7c2'
  ctx.font = '500 16px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  ctx.fillText(`desktop capture fallback: ${fallbackReason || 'not needed'}`, 92, 740)
}

function roundedRect (ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function shortProofValue (value) {
  if (!value) return 'n/a'
  const text = String(value)
  return text.length > 18 ? `${text.slice(0, 8)}...${text.slice(-6)}` : text
}

function delay (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout (promise, ms) {
  let timer = null
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out capturing visual proof after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function noop () {}
