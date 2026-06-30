#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const EXPECTED = {
  pearLink: 'pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy',
  catalog: 'hyperbee://0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f',
  repo: 'https://github.com/iesetorg/matchday-mesh'
}

const failures = []

function readText (relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

function readJson (relativePath) {
  return JSON.parse(readText(relativePath))
}

function fail (message) {
  failures.push(message)
}

function requireEqual (actual, expected, label) {
  if (actual !== expected) fail(`${label} expected ${expected}, got ${actual}`)
}

function requirePositiveInteger (actual, label) {
  if (!Number.isSafeInteger(actual) || actual < 1) fail(`${label} should be a positive integer, got ${actual}`)
}

function requireIncludes (text, expected, label) {
  if (!text.includes(expected)) fail(`${label} should include ${expected}`)
}

const manifest = readJson('scripts/app-manifest.json')
const releaseProof = readJson('docs/proof/pear-release-renderer-proof-2026-06-30.json')
const catalogProof = readJson('docs/proof/pearbrowser-desktop-catalog-rpc-2026-06-30.json')
const catalogVisualProof = readJson('docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.json')
const previewSmoke = readJson('docs/proof/matchday-preview-smoke-2026-06-30.json')
const demoProof = readJson('docs/proof/matchday-demo-flow-proof-2026-06-30.json')
const livePairing = readJson('docs/proof/matchday-live-pairing-2026-06-30.json')
const liveReadiness = readJson('docs/proof/matchday-live-readiness-2026-06-30.json')
const quickstart = readText('docs/JUDGE_QUICKSTART.md')

requireEqual(manifest.links?.pearRuntime, EXPECTED.pearLink, 'manifest pearRuntime')
requireEqual(manifest.links?.pearBrowserCatalog, EXPECTED.catalog, 'manifest catalog')
requireEqual(manifest.links?.sourceRepo, EXPECTED.repo, 'manifest source repo')
requireEqual(releaseProof.ok, true, 'released Pear proof ok')
requirePositiveInteger(releaseProof.release, 'released Pear proof release')
requirePositiveInteger(releaseProof.length, 'released Pear proof length')
requireEqual(releaseProof.backendLabel, 'Corestore/Hyperbee', 'released Pear proof backend')
requireEqual(releaseProof.pairingType, 'matchday-mesh-pairing-v1', 'released Pear proof pairing')
requireEqual(catalogProof.ok, true, 'PearBrowser catalog RPC proof ok')
requireEqual(catalogVisualProof.ok, true, 'PearBrowser catalog visual proof ok')
requireEqual(catalogVisualProof.mode, 'rpc-proof-card', 'PearBrowser catalog visual proof mode')
requireEqual(catalogVisualProof.app?.pearLink, EXPECTED.pearLink, 'PearBrowser catalog visual pear link')
requireEqual(catalogVisualProof.visualProof?.path, 'docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.png', 'PearBrowser catalog visual proof path')
requireEqual(previewSmoke.ok, true, 'preview smoke proof ok')
requireEqual(previewSmoke.scenario?.operationCount, 6, 'preview smoke operation count')
requireEqual(previewSmoke.scenario?.latestFeedCard?.type, 'feed:pool-contribution', 'preview smoke latest feed')
requireEqual(demoProof.checks?.hasPearsStackOps, true, 'demo proof Pears Stack ops')
requireEqual(demoProof.checks?.hasInviteHandoff, true, 'demo proof invite handoff')
requireEqual(demoProof.checks?.hasPairingTopic, true, 'demo proof pairing topic')
requireEqual(demoProof.checks?.hasUsdTPool, true, 'demo proof USDt pool')
requireEqual(livePairing.ok, true, 'live pairing proof ok')
requireEqual(livePairing.replica?.writable, false, 'live pairing replica read-only')
requireEqual(livePairing.replica?.operations, livePairing.host?.operationsAfterAppend, 'live pairing replica operations')
requireEqual(liveReadiness.ok, true, 'live readiness proof ok')
requireIncludes(quickstart, EXPECTED.pearLink, 'judge quickstart')
requireIncludes(quickstart, EXPECTED.catalog, 'judge quickstart')
requireIncludes(quickstart, EXPECTED.repo, 'judge quickstart')
requireIncludes(quickstart, 'npm run check:release', 'judge quickstart')

if (failures.length > 0) {
  for (const message of failures) console.error('FAIL:', message)
  process.exit(1)
}

console.log('Matchday Mesh judge handoff OK')
console.log('')
console.log('Run the released app:')
console.log(`  pear run ${EXPECTED.pearLink}`)
console.log('')
console.log('PearBrowser catalog:')
console.log(`  ${EXPECTED.catalog}`)
console.log('')
console.log('Source and local checks:')
console.log(`  ${EXPECTED.repo}`)
console.log('  npm ci')
console.log('  npm run check:release')
console.log('  npm run verify:preview-smoke')
console.log('  npm run verify:catalog-visual')
console.log('  npm run verify:launch')
console.log('  npm run verify:release-window')
console.log('  npm run verify:live-pairing')
console.log('  npm run verify:live-readiness')
console.log('')
console.log('Proof highlights:')
console.log(`  release ${releaseProof.release}, length ${releaseProof.length}, backend ${releaseProof.backendLabel}`)
console.log(`  preview smoke ops ${previewSmoke.scenario.operationCount}, latest ${previewSmoke.scenario.latestFeedCard.type}, total ${previewSmoke.scenario.poolTotal} USDt`)
console.log(`  demo ops ${demoProof.scenario.operationCount}, feed cards ${demoProof.scenario.feedCards}, latest ${demoProof.scenario.latestFeedCard.type}`)
console.log(`  live pairing ${livePairing.transport.shortTopic}, replica ops ${livePairing.replica.operations}, writable ${livePairing.replica.writable}`)
console.log(`  catalog peers ${catalogProof.pearBrowserRpc.peerCount}, HiveRelays ${catalogProof.pearBrowserRpc.hiveRelays}`)
console.log(`  catalog visual ${catalogVisualProof.visualProof.path}, ${catalogVisualProof.visualProof.bytes} bytes`)
