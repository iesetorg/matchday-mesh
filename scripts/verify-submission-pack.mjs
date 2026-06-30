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
  'docs/FINAL_SUBMISSION_RUNBOOK.md',
  'docs/RISK_LEDGER.md',
  'docs/TEST_COMMAND_MATRIX_2026-06-29.md',
  'docs/proof/README.md',
  'docs/proof/dorahacks-readiness-2026-06-30.json',
  'docs/proof/matchday-preview-smoke-2026-06-30.json',
  'docs/proof/matchday-browser-preview-flow-2026-06-30.json',
  'docs/proof/matchday-browser-preview-flow-2026-06-30.jpg',
  'docs/proof/pearbrowser-desktop-catalog-rpc-2026-06-30.json',
  'docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.json',
  'docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.png',
  'docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.svg',
  'docs/proof/pear-release-renderer-proof-2026-06-30.json',
  'docs/proof/pear-release-window-2026-06-30.png',
  'docs/proof/matchday-demo-flow-proof-2026-06-30.json',
  'docs/proof/matchday-live-pairing-2026-06-30.json',
  'docs/proof/matchday-live-readiness-2026-06-30.json',
  'docs/proof/matchday-mesh-preview-2026-06-30.jpg',
  'docs/proof/matchday-mesh-preview-flow-2026-06-30.jpg',
  'docs/proof/matchday-mesh-invite-inspector-2026-06-30.jpg',
  'docs/proof/matchday-mesh-invite-export-panel-2026-06-30.jpg',
  'catalog/matchday-mesh.catalog.json',
  'scripts/app-manifest.json',
  'scripts/print-submission-handoff.mjs'
]) {
  requireFile(relativePath)
}

const readme = readText('README.md')
const submission = readText('SUBMISSION.md')
const doraCopy = readText('docs/DORAHACKS_PROJECT_COPY.md')
const demoScript = readText('docs/DEMO_SCRIPT.md')
const finalRunbook = readText('docs/FINAL_SUBMISSION_RUNBOOK.md')
const judgeQuickstart = readText('docs/JUDGE_QUICKSTART.md')
const priorWork = readText('PRIOR_WORK.md')
const proofReadme = readText('docs/proof/README.md')
const matrix = readText('docs/TEST_COMMAND_MATRIX_2026-06-29.md')
const releaseProof = readJson('docs/proof/pear-release-renderer-proof-2026-06-30.json')
const releaseLine = Number.isSafeInteger(releaseProof?.release) && Number.isSafeInteger(releaseProof?.length)
  ? `Pear release: \`${releaseProof.release}\`, length \`${releaseProof.length}\``
  : null

for (const [relativePath, text] of [
  ['README.md', readme],
  ['SUBMISSION.md', submission],
  ['docs/DORAHACKS_PROJECT_COPY.md', doraCopy],
  ['docs/FINAL_SUBMISSION_RUNBOOK.md', finalRunbook],
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
requireIncludes('docs/DORAHACKS_PROJECT_COPY.md', doraCopy, 'docs/FINAL_SUBMISSION_RUNBOOK.md')
requireIncludes('docs/DORAHACKS_PROJECT_COPY.md', doraCopy, 'Reviewer source checkout')
requireIncludes('docs/DORAHACKS_PROJECT_COPY.md', doraCopy, 'Final launch workstation gate')
requireIncludes('docs/DORAHACKS_PROJECT_COPY.md', doraCopy, 'npm run check:release')
requireIncludes('docs/DORAHACKS_PROJECT_COPY.md', doraCopy, 'npm run check:final')
requireIncludes('docs/DEMO_SCRIPT.md', demoScript, 'Target length: 3 minutes')
requireIncludes('docs/DEMO_SCRIPT.md', demoScript, 'npm run check:final')
requireIncludes('docs/DEMO_SCRIPT.md', demoScript, 'npm run handoff:submission')
if (releaseLine) {
  requireIncludes('docs/FINAL_SUBMISSION_RUNBOOK.md', finalRunbook, releaseLine)
} else {
  fail('docs/FINAL_SUBMISSION_RUNBOOK.md cannot be checked against stale release proof metadata')
}
requireIncludes('docs/FINAL_SUBMISSION_RUNBOOK.md', finalRunbook, 'Primary track: Pears Stack')
requireIncludes('docs/FINAL_SUBMISSION_RUNBOOK.md', finalRunbook, 'Target length: 2:45 to 3:00')
requireIncludes('docs/FINAL_SUBMISSION_RUNBOOK.md', finalRunbook, 'Proof')
requireIncludes('docs/FINAL_SUBMISSION_RUNBOOK.md', finalRunbook, 'Export Log')
requireIncludes('docs/FINAL_SUBMISSION_RUNBOOK.md', finalRunbook, 'Import Log')
requireIncludes('docs/FINAL_SUBMISSION_RUNBOOK.md', finalRunbook, 'WDK demo-ledger only')
requireIncludes('docs/FINAL_SUBMISSION_RUNBOOK.md', finalRunbook, 'QVAC gated')
requireIncludes('docs/FINAL_SUBMISSION_RUNBOOK.md', finalRunbook, 'Autobase multiwriter is not claimed')
requireIncludes('docs/FINAL_SUBMISSION_RUNBOOK.md', finalRunbook, 'npm run check:final')
requireIncludes('docs/FINAL_SUBMISSION_RUNBOOK.md', finalRunbook, 'npm run handoff:submission')
requireIncludes('docs/JUDGE_QUICKSTART.md', judgeQuickstart, 'npm run check:release')
requireIncludes('docs/JUDGE_QUICKSTART.md', judgeQuickstart, 'npm run handoff:judge')
requireIncludes('docs/JUDGE_QUICKSTART.md', judgeQuickstart, 'matchday-mesh-core-invite-v1')
requireIncludes('PRIOR_WORK.md', priorWork, 'Pear Tickets')
requireIncludes('PRIOR_WORK.md', priorWork, 'Pear POS')
requireIncludes('PRIOR_WORK.md', priorWork, 'PearBrowser')
requireIncludes('docs/proof/README.md', proofReadme, 'pearbrowser-desktop-catalog-rpc-2026-06-30.json')
requireIncludes('docs/proof/README.md', proofReadme, 'dorahacks-readiness-2026-06-30.json')
requireIncludes('docs/proof/README.md', proofReadme, 'pear-release-renderer-proof-2026-06-30.json')
requireIncludes('docs/proof/README.md', proofReadme, 'pear-release-window-2026-06-30.png')
requireIncludes('docs/proof/README.md', proofReadme, 'matchday-preview-smoke-2026-06-30.json')
requireIncludes('docs/proof/README.md', proofReadme, 'matchday-browser-preview-flow-2026-06-30.json')
requireIncludes('docs/proof/README.md', proofReadme, 'matchday-browser-preview-flow-2026-06-30.jpg')
requireIncludes('docs/proof/README.md', proofReadme, 'matchday-demo-flow-proof-2026-06-30.json')
requireIncludes('docs/proof/README.md', proofReadme, 'matchday-live-pairing-2026-06-30.json')
requireIncludes('docs/proof/README.md', proofReadme, 'matchday-live-readiness-2026-06-30.json')
requireIncludes('docs/proof/README.md', proofReadme, 'pearbrowser-catalog-visual-proof-2026-06-30.json')
requireIncludes('docs/proof/README.md', proofReadme, 'pearbrowser-catalog-visual-proof-2026-06-30.png')
requireIncludes('docs/proof/README.md', proofReadme, '../FINAL_SUBMISSION_RUNBOOK.md')

requireImage('docs/proof/matchday-mesh-preview-2026-06-30.jpg', 10_000)
requireImage('docs/proof/matchday-mesh-preview-flow-2026-06-30.jpg', 10_000)
requireImage('docs/proof/matchday-browser-preview-flow-2026-06-30.jpg', 10_000)
requireImage('docs/proof/matchday-mesh-invite-inspector-2026-06-30.jpg', 10_000)
requireImage('docs/proof/matchday-mesh-invite-export-panel-2026-06-30.jpg', 10_000)
requireImage('docs/proof/pear-release-window-2026-06-30.png', 10_000)
requireImage('docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.png', 10_000)

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

const packageJson = readJson('package.json')
if (packageJson) {
  if (packageJson.scripts?.['handoff:submission'] !== 'node scripts/print-submission-handoff.mjs') {
    fail('package.json should expose handoff:submission')
  }
  if (packageJson.scripts?.['check:final'] !== 'npm run verify:launch && npm run verify:dorahacks && npm run handoff:submission') {
    fail('package.json should expose check:final')
  }
  const ignored = packageJson.pear?.stage?.ignore || []
  if (!ignored.includes('/scripts/print-submission-handoff.mjs')) {
    fail('Pear stage ignore should exclude scripts/print-submission-handoff.mjs')
  }
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

const catalogVisualProof = readJson('docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.json')
if (catalogVisualProof) {
  if (catalogVisualProof.ok !== true) fail('PearBrowser catalog visual proof should be ok')
  if (catalogVisualProof.mode !== 'rpc-proof-card') fail('PearBrowser catalog visual proof mode is stale')
  if (catalogVisualProof.sourceProof !== 'docs/proof/pearbrowser-desktop-catalog-rpc-2026-06-30.json') {
    fail('PearBrowser catalog visual proof source proof is stale')
  }
  if (catalogVisualProof.app?.pearLink !== EXPECTED.pearLink) fail('PearBrowser catalog visual proof pear link is stale')
  if (catalogVisualProof.app?.catalog !== EXPECTED.catalogRef) fail('PearBrowser catalog visual proof catalog ref is stale')
  if (catalogVisualProof.app?.sourceRepo !== EXPECTED.sourceRepo) fail('PearBrowser catalog visual proof source repo is stale')
  if (catalogVisualProof.catalog?.keyHex !== EXPECTED.catalogKey) fail('PearBrowser catalog visual proof catalog key is stale')
  if (catalogVisualProof.catalog?.name !== 'Tether Developers Cup Apps') fail('PearBrowser catalog visual proof catalog name is stale')
  if ((catalogVisualProof.catalog?.apps || 0) < 1) fail('PearBrowser catalog visual proof should include at least one app')
  if (catalogVisualProof.pearBrowserRpc?.dhtConnected !== true) fail('PearBrowser catalog visual proof should preserve DHT connection')
  if ((catalogVisualProof.pearBrowserRpc?.peerCount || 0) < 1) fail('PearBrowser catalog visual proof should preserve peer count')
  if ((catalogVisualProof.pearBrowserRpc?.hiveRelays || 0) < 1) fail('PearBrowser catalog visual proof should preserve HiveRelays')
  if (catalogVisualProof.matchdayMesh?.pearLink !== EXPECTED.pearLink) fail('PearBrowser catalog visual proof Matchday row is stale')
  if (catalogVisualProof.visualProof?.path !== 'docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.png') {
    fail('PearBrowser catalog visual proof PNG path is stale')
  }
  if (catalogVisualProof.visualProof?.svgPath !== 'docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.svg') {
    fail('PearBrowser catalog visual proof SVG path is stale')
  }
  if (catalogVisualProof.visualProof?.png !== true) fail('PearBrowser catalog visual proof PNG metadata is stale')
  if ((catalogVisualProof.visualProof?.bytes || 0) < 10_000) fail('PearBrowser catalog visual proof PNG is unexpectedly small')
}

const dorahacksReadiness = readJson('docs/proof/dorahacks-readiness-2026-06-30.json')
if (dorahacksReadiness) {
  if (dorahacksReadiness.ok !== true) fail('DoraHacks readiness proof should be ok')
  if (dorahacksReadiness.app?.primaryTrack !== 'Pears Stack') fail('DoraHacks readiness proof should keep Pears Stack primary')
  if (dorahacksReadiness.app?.pearLink !== EXPECTED.pearLink) fail('DoraHacks readiness proof pear link is stale')
  if (dorahacksReadiness.app?.catalog !== EXPECTED.catalogRef) fail('DoraHacks readiness proof catalog is stale')
  if (dorahacksReadiness.app?.sourceRepo !== EXPECTED.sourceRepo) fail('DoraHacks readiness proof source repo is stale')
  if ((dorahacksReadiness.proofHighlights?.launchRehearsal?.commandCount || 0) < 5) {
    fail('DoraHacks readiness proof should include the expanded launch rehearsal gate')
  }
  if (!Array.isArray(dorahacksReadiness.manualActions) || dorahacksReadiness.manualActions.length < 3) {
    fail('DoraHacks readiness proof should list manual submission actions')
  }
  for (const [key, value] of Object.entries(dorahacksReadiness.checks || {})) {
    if (value !== true) fail(`DoraHacks readiness check should pass: ${key}`)
  }
}

const previewSmoke = readJson('docs/proof/matchday-preview-smoke-2026-06-30.json')
if (previewSmoke) {
  if (previewSmoke.ok !== true) fail('preview smoke proof should be ok')
  if (previewSmoke.app?.pearLink !== EXPECTED.pearLink) fail('preview smoke proof pear link is stale')
  if (previewSmoke.app?.catalog !== EXPECTED.catalogRef) fail('preview smoke proof catalog is stale')
  if (previewSmoke.app?.sourceRepo !== EXPECTED.sourceRepo) fail('preview smoke proof source repo is stale')
  if (previewSmoke.scenario?.operationCount !== 6) fail('preview smoke proof should replay the 6-op UI smoke path')
  if (previewSmoke.scenario?.accepted !== true) fail('preview smoke proof should check Ada in')
  if (previewSmoke.scenario?.poolTotal !== 5) fail('preview smoke proof should record 5 USDt')
  if (previewSmoke.scenario?.latestFeedCard?.type !== 'feed:pool-contribution') {
    fail('preview smoke proof should end on a pool contribution feed card')
  }
  for (const [key, value] of Object.entries(previewSmoke.checks || {})) {
    if (value !== true) fail(`preview smoke check should pass: ${key}`)
  }
}

const browserPreviewFlow = readJson('docs/proof/matchday-browser-preview-flow-2026-06-30.json')
if (browserPreviewFlow) {
  if (browserPreviewFlow.ok !== true) fail('browser preview flow proof should be ok')
  if (browserPreviewFlow.app?.pearLink !== EXPECTED.pearLink) fail('browser preview flow proof pear link is stale')
  if (browserPreviewFlow.app?.catalog !== EXPECTED.catalogRef) fail('browser preview flow proof catalog ref is stale')
  if (browserPreviewFlow.scenario?.exportedOperationCount !== 6) {
    fail('browser preview flow proof should export the 6-op preview path')
  }
  if (browserPreviewFlow.scenario?.testerHeading !== 'Import Applied') {
    fail('browser preview flow proof should end on the import-applied panel')
  }
  if ((browserPreviewFlow.screenshot?.bytes || 0) < 10_000) {
    fail('browser preview flow proof screenshot is unexpectedly small')
  }
  for (const [key, value] of Object.entries(browserPreviewFlow.checks || {})) {
    if (value !== true) fail(`browser preview flow proof check should pass: ${key}`)
  }
}

if (releaseProof) {
  if (releaseProof.ok !== true) fail('released link renderer proof should be ok')
  if (releaseProof.hasPear !== true) fail('released link renderer proof should have Pear')
  if (releaseProof.hasMatchdayAPI !== true) fail('released link renderer proof should have matchdayAPI')
  if (!Number.isSafeInteger(releaseProof.release) ||
    !Number.isSafeInteger(releaseProof.length) ||
    releaseProof.release < 1 ||
    releaseProof.length < releaseProof.release) {
    fail('released link renderer proof release metadata is stale')
  }
  if (releaseProof.backendLabel !== 'Corestore/Hyperbee') fail('released link renderer proof should use Corestore/Hyperbee')
  if (releaseProof.inviteType !== 'matchday-mesh-core-invite-v1') fail('released link renderer proof should export the invite type')
  if (releaseProof.pairingType !== 'matchday-mesh-pairing-v1') fail('released link renderer proof should export the pairing type')
  if (releaseProof.pairingTransport !== 'hyperswarm-topic') fail('released link renderer proof should export the pairing transport')
  if (!/^[0-9a-f]{64}$/.test(releaseProof.pairingTopic || '')) fail('released link renderer proof should export a 32-byte pairing topic')
  if ((releaseProof.operationCount || 0) < 3) fail('released link renderer proof should have seeded operations')
  if (releaseProof.visualProof?.ok !== true) fail('released link renderer proof should include visual proof metadata')
  if (releaseProof.visualProof?.path !== 'docs/proof/pear-release-window-2026-06-30.png') fail('released link renderer proof visual path is stale')
  if (!['desktop-capture', 'renderer-proof-card'].includes(releaseProof.visualProof?.mode)) {
    fail('released link renderer proof visual mode is invalid')
  }
  if ((releaseProof.visualProof?.bytes || 0) < 10_000) fail('released link renderer proof visual PNG is unexpectedly small')
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
  if (demoProof.pairing?.type !== 'matchday-mesh-pairing-v1') fail('demo flow proof should include the Matchday pairing descriptor')
  if (!/^[0-9a-f]{64}$/.test(demoProof.pairing?.topic || '')) fail('demo flow proof should include a 32-byte pairing topic')
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
    'pearBrowserCatalogVisualProof',
    'deterministicDemoProof',
    'previewProcess',
    'catalogServeProcess',
    'pearSeedProcess',
    'previewResponds'
  ]) {
    if (liveReadiness.checks?.[key] !== true) fail(`live readiness proof check should pass: ${key}`)
  }
}

const livePairing = readJson('docs/proof/matchday-live-pairing-2026-06-30.json')
if (livePairing) {
  if (livePairing.ok !== true) fail('live pairing proof should be ok')
  if (livePairing.app?.pearLink !== EXPECTED.pearLink) fail('live pairing proof pear link is stale')
  if (livePairing.app?.catalog !== EXPECTED.catalogRef) fail('live pairing proof catalog ref is stale')
  if (livePairing.app?.sourceRepo !== EXPECTED.sourceRepo) fail('live pairing proof source repo is stale')
  if (livePairing.transport?.type !== 'hyperswarm') fail('live pairing proof should use Hyperswarm')
  if (livePairing.transport?.mode !== 'read-only-replica') fail('live pairing proof should use read-only replica mode')
  if (!/^[0-9a-f]{64}$/.test(livePairing.transport?.topic || '')) fail('live pairing proof should include a 32-byte topic')
  if (livePairing.host?.status !== 'hosting') fail('live pairing proof host should be hosting')
  if ((livePairing.host?.operationsAfterAppend || 0) <= (livePairing.host?.operationsBeforeAppend || 0)) {
    fail('live pairing proof should append a new host operation')
  }
  if (livePairing.replica?.status !== 'joined') fail('live pairing proof replica should join')
  if (livePairing.replica?.writable !== false) fail('live pairing proof replica should be read-only')
  if ((livePairing.replica?.operations || 0) !== livePairing.host?.operationsAfterAppend) {
    fail('live pairing proof replica should catch the live append')
  }
  if (livePairing.replica?.latestFeedCard?.body !== 'Live Hyperswarm pairing carried this update.') {
    fail('live pairing proof should expose the live replicated feed card')
  }
  for (const [key, value] of Object.entries(livePairing.checks || {})) {
    if (value !== true) fail(`live pairing proof check should pass: ${key}`)
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
