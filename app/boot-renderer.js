/** @typedef {import('pear-interface')} */ /* global Pear */

window.matchdayMeshWriteProof = writeBootProof
window.matchdayMeshRuntime = bootPearRuntime()

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
  if (!proofPath) return

  try {
    const { writeFileSync } = await import('fs')
    const api = window.matchdayAPI || null
    const info = api && typeof api.info === 'function'
      ? await api.info().catch((err) => ({ error: err.message }))
      : null
    writeFileSync(proofPath, JSON.stringify({
      ok: !!api && !window.matchdayMeshRuntimeError,
      stage,
      hasPear: typeof Pear !== 'undefined',
      hasMatchdayAPI: !!api,
      runtimeError: window.matchdayMeshRuntimeError || null,
      info,
      ...details,
      writtenAt: new Date().toISOString()
    }, null, 2))
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
