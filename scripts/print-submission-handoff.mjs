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

function requireIncludes (text, expected, label) {
  if (!text.includes(expected)) fail(`${label} should include ${expected}`)
}

function requireTrue (value, label) {
  if (value !== true) fail(`${label} should be true`)
}

const pkg = readJson('package.json')
const manifest = readJson('scripts/app-manifest.json')
const releaseProof = readJson('docs/proof/pear-release-renderer-proof-2026-06-30.json')
const readiness = readJson('docs/proof/dorahacks-readiness-2026-06-30.json')
const previewSmoke = readJson('docs/proof/matchday-preview-smoke-2026-06-30.json')
const demoProof = readJson('docs/proof/matchday-demo-flow-proof-2026-06-30.json')
const livePairing = readJson('docs/proof/matchday-live-pairing-2026-06-30.json')
const catalogVisualProof = readJson('docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.json')
const runbook = readText('docs/FINAL_SUBMISSION_RUNBOOK.md')
const doraCopy = readText('docs/DORAHACKS_PROJECT_COPY.md')

const releaseLine = Number.isSafeInteger(releaseProof.release) && Number.isSafeInteger(releaseProof.length)
  ? `Pear release: \`${releaseProof.release}\`, length \`${releaseProof.length}\``
  : null

requireEqual(pkg.license, 'MIT', 'package license')
requireEqual(manifest.links?.pearRuntime, EXPECTED.pearLink, 'manifest pear link')
requireEqual(manifest.links?.pearBrowserCatalog, EXPECTED.catalog, 'manifest catalog')
requireEqual(manifest.links?.sourceRepo, EXPECTED.repo, 'manifest source repo')
requireTrue(releaseProof.ok, 'release proof ok')
requireEqual(releaseProof.app?.pearLink, EXPECTED.pearLink, 'release proof pear link')
requireEqual(releaseProof.backendLabel, 'Corestore/Hyperbee', 'release proof backend')
requireTrue(readiness.ok, 'DoraHacks readiness proof ok')
requireTrue(readiness.checks?.finalSubmissionRunbook, 'final submission runbook readiness check')
requireTrue(previewSmoke.checks?.previewImportLogRoundTrip, 'preview import log round trip')
requireTrue(demoProof.checks?.hasUsdTPool, 'demo proof USDt pool')
requireTrue(livePairing.ok, 'live pairing proof ok')
requireEqual(livePairing.replica?.writable, false, 'live pairing replica writable')
requireTrue(catalogVisualProof.ok, 'catalog visual proof ok')
requireEqual(catalogVisualProof.app?.pearLink, EXPECTED.pearLink, 'catalog visual pear link')
if (releaseLine) requireIncludes(runbook, releaseLine, 'final submission runbook')
else fail('release proof does not expose safe release/length integers')
requireIncludes(runbook, 'Target length: 2:45 to 3:00', 'final submission runbook')
requireIncludes(runbook, 'Proof', 'final submission runbook')
requireIncludes(runbook, 'Export Log', 'final submission runbook')
requireIncludes(runbook, 'Import Log', 'final submission runbook')
requireIncludes(runbook, 'Autobase multiwriter is not claimed', 'final submission runbook')
requireIncludes(doraCopy, 'Use `docs/FINAL_SUBMISSION_RUNBOOK.md` as the recording checklist.', 'DoraHacks copy')

if (failures.length > 0) {
  for (const message of failures) console.error('FAIL:', message)
  process.exit(1)
}

console.log('Matchday Mesh final submission handoff OK')
console.log('')
console.log('DoraHacks fields:')
console.log('  Title: Matchday Mesh')
console.log('  Track: Pears Stack')
console.log('  License: MIT')
console.log(`  Repo: ${EXPECTED.repo}`)
console.log(`  Pear app: ${EXPECTED.pearLink}`)
console.log(`  PearBrowser catalog: ${EXPECTED.catalog}`)
console.log(`  Release: ${releaseProof.release}, length ${releaseProof.length}`)
console.log('')
console.log('Pre-recording commands:')
console.log('  npm ci')
console.log('  npm run check:final')
console.log('  npm run handoff:submission')
console.log('')
console.log('Demo beats:')
console.log('  0:00 app link/catalog/status strip')
console.log('  0:40 scan Ada to Accepted')
console.log('  1:15 open USDt demo pool and add 5 USDt')
console.log('  1:40 export P2P invite and host pairing topic')
console.log('  2:10 show Proof, Export Log, and Import Log')
console.log('  2:35 close on repo, docs/proof, and release gates')
console.log('')
console.log('Proof highlights:')
console.log(`  preview smoke ops ${previewSmoke.scenario.operationCount}, import round trip ${previewSmoke.checks.previewImportLogRoundTrip}`)
console.log(`  demo ops ${demoProof.scenario.operationCount}, latest ${demoProof.scenario.latestFeedCard.type}`)
console.log(`  live pairing ${livePairing.transport.shortTopic}, replica ops ${livePairing.replica.operations}`)
console.log(`  catalog visual ${catalogVisualProof.visualProof.path}, ${catalogVisualProof.visualProof.bytes} bytes`)
console.log('')
console.log('Manual actions:')
for (const action of readiness.manualActions) console.log(`  - ${action}`)
