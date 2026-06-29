#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const failures = []

const EXPECTED = {
  pearLink: 'pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy',
  catalogRef: 'hyperbee://0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f',
  catalogKey: '0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f',
  sourceRepo: 'https://github.com/iesetorg/matchday-mesh'
}

function fail (message) {
  failures.push(message)
}

function pathOf (relativePath) {
  return join(root, relativePath)
}

function readText (relativePath) {
  try {
    return readFileSync(pathOf(relativePath), 'utf8')
  } catch (err) {
    fail(`${relativePath} is not readable: ${err.message}`)
    return ''
  }
}

function readJson (relativePath) {
  try {
    return JSON.parse(readText(relativePath))
  } catch (err) {
    fail(`${relativePath} is not valid JSON: ${err.message}`)
    return null
  }
}

function requireFile (relativePath) {
  if (!existsSync(pathOf(relativePath))) fail(`${relativePath} is missing`)
}

function requireIncludes (relativePath, text, expected) {
  if (!text.includes(expected)) fail(`${relativePath} should include ${expected}`)
}

function requireImage (relativePath, minBytes) {
  const abs = pathOf(relativePath)
  if (!existsSync(abs)) {
    fail(`${relativePath} is missing`)
    return
  }
  const bytes = readFileSync(abs)
  const pngMagic = bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  const jpegMagic = bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  if (!pngMagic && !jpegMagic) fail(`${relativePath} is not a PNG or JPEG image`)
  if (statSync(abs).size < minBytes) fail(`${relativePath} is unexpectedly small`)
}

for (const relativePath of [
  'README.md',
  'SUBMISSION.md',
  'PRIOR_WORK.md',
  'LICENSE',
  'docs/JUDGE_QUICKSTART.md',
  'docs/DEMO_SCRIPT.md',
  'docs/DORAHACKS_PROJECT_COPY.md',
  'docs/RISK_LEDGER.md',
  'docs/TEST_COMMAND_MATRIX_2026-06-29.md',
  'docs/proof/README.md',
  'docs/proof/pearbrowser-desktop-catalog-rpc-2026-06-30.json',
  'docs/proof/pear-release-renderer-proof-2026-06-30.json',
  'docs/proof/matchday-demo-flow-proof-2026-06-30.json',
  'docs/proof/matchday-live-readiness-2026-06-30.json',
  'docs/proof/matchday-mesh-preview-2026-06-30.jpg',
  'docs/proof/matchday-mesh-preview-flow-2026-06-30.jpg',
  'docs/proof/matchday-mesh-invite-inspector-2026-06-30.jpg',
  'docs/proof/matchday-mesh-invite-export-panel-2026-06-30.jpg',
  'catalog/matchday-mesh.catalog.json',
  'scripts/app-manifest.json'
]) {
  requireFile(relativePath)
}

const readme = readText('README.md')
const submission = readText('SUBMISSION.md')
const doraCopy = readText('docs/DORAHACKS_PROJECT_COPY.md')
const demoScript = readText('docs/DEMO_SCRIPT.md')
const judgeQuickstart = readText('docs/JUDGE_QUICKSTART.md')
const priorWork = readText('PRIOR_WORK.md')
const proofReadme = readText('docs/proof/README.md')
const matrix = readText('docs/TEST_COMMAND_MATRIX_2026-06-29.md')

for (const [relativePath, text] of [
  ['README.md', readme],
  ['SUBMISSION.md', submission],
  ['docs/DORAHACKS_PROJECT_COPY.md', doraCopy],
  ['docs/DEMO_SCRIPT.md', demoScript],
  ['docs/JUDGE_QUICKSTART.md', judgeQuickstart],
  ['docs/TEST_COMMAND_MATRIX_2026-06-29.md', matrix]
]) {
  requireIncludes(relativePath, text, EXPECTED.pearLink)
  requireIncludes(relativePath, text, EXPECTED.catalogRef)
}

requireIncludes('SUBMISSION.md', submission, 'Primary track: Pears Stack')
requireIncludes('docs/DORAHACKS_PROJECT_COPY.md', doraCopy, 'Primary: Pears Stack')
requireIncludes('docs/DORAHACKS_PROJECT_COPY.md', doraCopy, 'not claimed as primary tracks')
requireIncludes('docs/DORAHACKS_PROJECT_COPY.md', doraCopy, EXPECTED.sourceRepo)
requireIncludes('docs/DEMO_SCRIPT.md', demoScript, 'Target length: 3 minutes')
requireIncludes('docs/JUDGE_QUICKSTART.md', judgeQuickstart, 'npm run check:release')
requireIncludes('docs/JUDGE_QUICKSTART.md', judgeQuickstart, 'npm run handoff:judge')
requireIncludes('docs/JUDGE_QUICKSTART.md', judgeQuickstart, 'matchday-mesh-core-invite-v1')
requireIncludes('PRIOR_WORK.md', priorWork, 'Pear Tickets')
requireIncludes('PRIOR_WORK.md', priorWork, 'Pear POS')
requireIncludes('PRIOR_WORK.md', priorWork, 'PearBrowser')
requireIncludes('docs/proof/README.md', proofReadme, 'pearbrowser-desktop-catalog-rpc-2026-06-30.json')
requireIncludes('docs/proof/README.md', proofReadme, 'pear-release-renderer-proof-2026-06-30.json')
requireIncludes('docs/proof/README.md', proofReadme, 'matchday-demo-flow-proof-2026-06-30.json')
requireIncludes('docs/proof/README.md', proofReadme, 'matchday-live-readiness-2026-06-30.json')

requireImage('docs/proof/matchday-mesh-preview-2026-06-30.jpg', 10_000)
requireImage('docs/proof/matchday-mesh-preview-flow-2026-06-30.jpg', 10_000)
requireImage('docs/proof/matchday-mesh-invite-inspector-2026-06-30.jpg', 10_000)
requireImage('docs/proof/matchday-mesh-invite-export-panel-2026-06-30.jpg', 10_000)

const manifest = readJson('scripts/app-manifest.json')
if (manifest) {
  if (manifest.appId !== 'matchday-mesh') fail('scripts/app-manifest.json appId must be matchday-mesh')
  if (manifest.links?.pearRuntime !== EXPECTED.pearLink) fail('scripts/app-manifest.json links.pearRuntime is stale')
  if (manifest.links?.pearBrowser !== EXPECTED.pearLink) fail('scripts/app-manifest.json links.pearBrowser is stale')
  if (manifest.links?.pearBrowserCatalog !== EXPECTED.catalogRef) fail('scripts/app-manifest.json links.pearBrowserCatalog is stale')
  if (manifest.links?.sourceRepo !== EXPECTED.sourceRepo) fail('scripts/app-manifest.json links.sourceRepo is stale')
  if (!manifest.runtimes?.['pear-browser']?.supported) fail('scripts/app-manifest.json should support pear-browser')
  if (manifest.runtimes?.qvac?.supported !== false) fail('scripts/app-manifest.json should keep qvac gated')
  if (manifest.runtimes?.wdk?.supported !== 'demo') fail('scripts/app-manifest.json should mark wdk as demo')
}

const catalog = readJson('catalog/matchday-mesh.catalog.json')
if (catalog) {
  const app = Array.isArray(catalog.apps) ? catalog.apps.find((entry) => entry?.id === 'matchday-mesh') : null
  if (!app) fail('catalog/matchday-mesh.catalog.json should list matchday-mesh')
  if (app?.link !== EXPECTED.pearLink) fail('catalog/matchday-mesh.catalog.json app link is stale')
  if (app?.sourceUrl !== EXPECTED.sourceRepo) fail('catalog/matchday-mesh.catalog.json app sourceUrl is stale')
  if (!String(catalog.name || '').includes('Tether Developers Cup')) fail('catalog/matchday-mesh.catalog.json should identify the cup catalog')
}

const catalogProof = readJson('docs/proof/pearbrowser-desktop-catalog-rpc-2026-06-30.json')
if (catalogProof) {
  const loaded = Array.isArray(catalogProof.loadedCatalogues) ? catalogProof.loadedCatalogues : []
  const cupCatalog = loaded.find((entry) => entry?.keyHex === EXPECTED.catalogKey)
  if (catalogProof.ok !== true) fail('PearBrowser catalog RPC proof should be ok')
  if (!catalogProof.pearBrowserRpc?.dhtConnected) fail('PearBrowser catalog RPC proof should be DHT-connected')
  if ((catalogProof.pearBrowserRpc?.peerCount || 0) < 1) fail('PearBrowser catalog RPC proof should have peers')
  if ((catalogProof.pearBrowserRpc?.hiveRelays || 0) < 1) fail('PearBrowser catalog RPC proof should have HiveRelays')
  if (!cupCatalog) fail('PearBrowser catalog RPC proof should load the cup catalog')
  if (cupCatalog && cupCatalog.apps < 1) fail('PearBrowser catalog RPC proof cup catalog should include at least one app')
  if (catalogProof.matchdayMesh?.pearLink !== EXPECTED.pearLink) fail('PearBrowser catalog RPC proof pear link is stale')
  if (catalogProof.matchdayMesh?.sourceRepo !== EXPECTED.sourceRepo) fail('PearBrowser catalog RPC proof source repo is stale')
}

const releaseProof = readJson('docs/proof/pear-release-renderer-proof-2026-06-30.json')
if (releaseProof) {
  if (releaseProof.ok !== true) fail('released link renderer proof should be ok')
  if (releaseProof.hasPear !== true) fail('released link renderer proof should have Pear')
  if (releaseProof.hasMatchdayAPI !== true) fail('released link renderer proof should have matchdayAPI')
  if (releaseProof.backendLabel !== 'Corestore/Hyperbee') fail('released link renderer proof should use Corestore/Hyperbee')
  if (releaseProof.inviteType !== 'matchday-mesh-core-invite-v1') fail('released link renderer proof should export the invite type')
  if ((releaseProof.operationCount || 0) < 3) fail('released link renderer proof should have seeded operations')
}

const demoProof = readJson('docs/proof/matchday-demo-flow-proof-2026-06-30.json')
if (demoProof) {
  if (demoProof.app?.pearLink !== EXPECTED.pearLink) fail('demo flow proof pear link is stale')
  if (demoProof.app?.catalog !== EXPECTED.catalogRef) fail('demo flow proof catalog ref is stale')
  if (demoProof.app?.sourceRepo !== EXPECTED.sourceRepo) fail('demo flow proof source repo is stale')
  if ((demoProof.scenario?.operationCount || 0) < 8) fail('demo flow proof should replay the full scenario')
  if (demoProof.status?.pearsStack !== 'op-log-ready') fail('demo flow proof should prove Pears Stack ops')
  if (demoProof.payments?.status !== 'demo-ledger-active') fail('demo flow proof should prove the USDt demo pool path')
  if (demoProof.invite?.type !== 'matchday-mesh-core-invite-v1') fail('demo flow proof should include the Matchday invite type')
  if (demoProof.invite?.writable !== false) fail('demo flow proof invite should be read-only')
  for (const [key, value] of Object.entries(demoProof.checks || {})) {
    if (value !== true) fail(`demo flow proof check should pass: ${key}`)
  }
}

const liveReadiness = readJson('docs/proof/matchday-live-readiness-2026-06-30.json')
if (liveReadiness) {
  if (liveReadiness.ok !== true) fail('live readiness proof should be ok')
  if (liveReadiness.app?.pearLink !== EXPECTED.pearLink) fail('live readiness proof pear link is stale')
  if (liveReadiness.app?.catalog !== EXPECTED.catalogRef) fail('live readiness proof catalog ref is stale')
  if (liveReadiness.app?.sourceRepo !== EXPECTED.sourceRepo) fail('live readiness proof source repo is stale')
  for (const key of [
    'manifestLinks',
    'catalogManifest',
    'releasedPearProof',
    'pearBrowserCatalogProof',
    'deterministicDemoProof',
    'previewProcess',
    'catalogServeProcess',
    'pearSeedProcess',
    'previewResponds'
  ]) {
    if (liveReadiness.checks?.[key] !== true) fail(`live readiness proof check should pass: ${key}`)
  }
}

if (failures.length > 0) {
  for (const message of failures) console.error('FAIL:', message)
  process.exit(1)
}

console.log('Matchday Mesh submission pack OK')
console.log(`  pear: ${EXPECTED.pearLink}`)
console.log(`  catalog: ${EXPECTED.catalogRef}`)
console.log(`  repo: ${EXPECTED.sourceRepo}`)
