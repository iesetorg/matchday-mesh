#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const defaultProofPath = join(root, 'docs/proof/matchday-live-readiness-2026-06-30.json')

const EXPECTED = {
  pearLink: 'pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy',
  catalogRef: 'hyperbee://0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f',
  catalogKey: '0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f',
  sourceRepo: 'https://github.com/iesetorg/matchday-mesh',
  previewUrl: 'http://127.0.0.1:4173/'
}

const args = parseArgs(process.argv.slice(2))
const failures = []
const checks = {}

function parseArgs (argv) {
  const parsed = { writePath: null, noPreview: false, noProcesses: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--write') {
      const next = argv[i + 1]
      parsed.writePath = next && !next.startsWith('--')
        ? resolve(root, argv[++i])
        : defaultProofPath
    } else if (arg === '--no-preview') {
      parsed.noPreview = true
    } else if (arg === '--no-processes') {
      parsed.noProcesses = true
    } else {
      usage(`unknown argument: ${arg}`)
    }
  }
  return parsed
}

function usage (message) {
  if (message) console.error(`error: ${message}`)
  console.error('usage: node scripts/verify-live-readiness.mjs [--write [path]] [--no-preview] [--no-processes]')
  process.exit(2)
}

function fail (name, message) {
  checks[name] = false
  failures.push(`${name}: ${message}`)
}

function pass (name) {
  checks[name] = true
}

function readText (relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

function readJson (relativePath) {
  return JSON.parse(readText(relativePath))
}

function hasTrueChecks (value) {
  const entries = Object.entries(value || {})
  return entries.length > 0 && entries.every(([, passed]) => passed === true)
}

function getProcessRows () {
  const output = execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' })
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^(\d+)\s+(.*)$/.exec(line)
      return match ? { pid: Number(match[1]), command: match[2] } : { pid: null, command: line }
    })
}

function findProcess (rows, predicate) {
  return rows.find((row) => predicate(row.command))
}

async function checkPreview () {
  if (args.noPreview) {
    checks.previewResponds = 'skipped'
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    const response = await fetch(EXPECTED.previewUrl, { signal: controller.signal })
    const text = await response.text()
    if (!response.ok) fail('previewResponds', `HTTP ${response.status}`)
    else if (!text.includes('Matchday Mesh')) fail('previewResponds', 'preview HTML did not include Matchday Mesh')
    else pass('previewResponds')
    return {
      url: EXPECTED.previewUrl,
      status: response.status,
      hasMatchdayMesh: text.includes('Matchday Mesh')
    }
  } catch (err) {
    fail('previewResponds', err.message)
    return {
      url: EXPECTED.previewUrl,
      error: err.message
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function main () {
  const packageJson = readJson('package.json')
  const manifest = readJson('scripts/app-manifest.json')
  const catalog = readJson('catalog/matchday-mesh.catalog.json')
  const releaseProof = readJson('docs/proof/pear-release-renderer-proof-2026-06-30.json')
  const catalogProof = readJson('docs/proof/pearbrowser-desktop-catalog-rpc-2026-06-30.json')
  const demoProof = readJson('docs/proof/matchday-demo-flow-proof-2026-06-30.json')

  if (packageJson.name === 'matchday-mesh' && packageJson.pear?.name === 'matchday-mesh') pass('packageIdentity')
  else fail('packageIdentity', 'package identity is not matchday-mesh')

  if (manifest.links?.pearRuntime === EXPECTED.pearLink &&
    manifest.links?.pearBrowser === EXPECTED.pearLink &&
    manifest.links?.pearBrowserCatalog === EXPECTED.catalogRef &&
    manifest.links?.sourceRepo === EXPECTED.sourceRepo) {
    pass('manifestLinks')
  } else {
    fail('manifestLinks', 'manifest links do not match the public launch surface')
  }

  const catalogApp = Array.isArray(catalog.apps) ? catalog.apps.find((entry) => entry?.id === 'matchday-mesh') : null
  if (catalog.name === 'Tether Developers Cup Apps' &&
    catalogApp?.link === EXPECTED.pearLink &&
    catalogApp?.sourceUrl === EXPECTED.sourceRepo) {
    pass('catalogManifest')
  } else {
    fail('catalogManifest', 'catalog manifest does not contain the released Matchday Mesh app row')
  }

  if (releaseProof.ok === true &&
    releaseProof.release === 1944 &&
    releaseProof.length === 1944 &&
    releaseProof.backendLabel === 'Corestore/Hyperbee' &&
    releaseProof.inviteType === 'matchday-mesh-core-invite-v1') {
    pass('releasedPearProof')
  } else {
    fail('releasedPearProof', 'released Pear proof is missing or stale')
  }

  const loadedCatalog = Array.isArray(catalogProof.loadedCatalogues)
    ? catalogProof.loadedCatalogues.find((entry) => entry?.keyHex === EXPECTED.catalogKey)
    : null
  if (catalogProof.ok === true &&
    catalogProof.pearBrowserRpc?.dhtConnected === true &&
    loadedCatalog &&
    catalogProof.matchdayMesh?.pearLink === EXPECTED.pearLink) {
    pass('pearBrowserCatalogProof')
  } else {
    fail('pearBrowserCatalogProof', 'PearBrowser catalog RPC proof is missing or stale')
  }

  if (demoProof.app?.pearLink === EXPECTED.pearLink &&
    demoProof.scenario?.operationCount === 8 &&
    demoProof.payments?.status === 'demo-ledger-active' &&
    hasTrueChecks(demoProof.checks)) {
    pass('deterministicDemoProof')
  } else {
    fail('deterministicDemoProof', 'deterministic demo proof is missing or stale')
  }

  const processRows = args.noProcesses ? [] : getProcessRows()
  const previewProcess = args.noProcesses
    ? null
    : findProcess(processRows, (command) => command.includes('scripts/serve.mjs') && command.includes('--port 4173'))
  const catalogProcess = args.noProcesses
    ? null
    : findProcess(processRows, (command) => command.includes('publish-catalog-bee.js') &&
      command.includes('matchday-mesh.catalog.json') &&
      command.includes('--serve'))
  const seedProcess = args.noProcesses
    ? null
    : findProcess(processRows, (command) => command.includes('pear seed') &&
      command.includes(EXPECTED.pearLink))

  if (args.noProcesses) {
    checks.previewProcess = 'skipped'
    checks.catalogServeProcess = 'skipped'
    checks.pearSeedProcess = 'skipped'
  } else {
    if (previewProcess) pass('previewProcess')
    else fail('previewProcess', 'local preview server is not running on port 4173')

    if (catalogProcess) pass('catalogServeProcess')
    else fail('catalogServeProcess', 'catalog serve process is not running')

    if (seedProcess) pass('pearSeedProcess')
    else fail('pearSeedProcess', 'released Pear app seed process is not running')
  }

  const preview = await checkPreview()

  const proof = {
    ok: failures.length === 0,
    capturedAt: new Date().toISOString(),
    app: {
      pearLink: EXPECTED.pearLink,
      catalog: EXPECTED.catalogRef,
      sourceRepo: EXPECTED.sourceRepo,
      release: releaseProof.release,
      length: releaseProof.length
    },
    checks,
    preview,
    processes: {
      preview: previewProcess || null,
      catalogServe: catalogProcess || null,
      pearSeed: seedProcess || null
    },
    catalogRpc: {
      dhtConnected: catalogProof.pearBrowserRpc?.dhtConnected === true,
      peerCount: catalogProof.pearBrowserRpc?.peerCount || 0,
      hiveRelays: catalogProof.pearBrowserRpc?.hiveRelays || 0,
      loadedCatalogName: loadedCatalog?.name || null,
      loadedCatalogApps: loadedCatalog?.apps || 0
    },
    failures
  }

  if (args.writePath) {
    writeFileSync(args.writePath, `${JSON.stringify(proof, null, 2)}\n`)
  }

  if (failures.length > 0) {
    for (const message of failures) console.error('FAIL:', message)
    if (args.writePath) console.error(`Wrote ${relative(root, args.writePath)}`)
    process.exit(1)
  }

  console.log('Matchday Mesh live readiness OK')
  console.log(`  pear: ${EXPECTED.pearLink}`)
  console.log(`  catalog: ${EXPECTED.catalogRef}`)
  console.log(`  preview: ${EXPECTED.previewUrl}`)
  if (args.writePath) console.log(`  proof: ${relative(root, args.writePath)}`)
}

main().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
