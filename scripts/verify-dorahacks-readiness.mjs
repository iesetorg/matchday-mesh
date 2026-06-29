#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const defaultProofPath = join(root, 'docs/proof/dorahacks-readiness-2026-06-30.json')

const EXPECTED = {
  pearLink: 'pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy',
  catalogRef: 'hyperbee://0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f',
  sourceRepo: 'https://github.com/iesetorg/matchday-mesh',
  primaryTrack: 'Pears Stack'
}

const args = parseArgs(process.argv.slice(2))

function parseArgs (argv) {
  const parsed = { writePath: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--write') {
      const next = argv[i + 1]
      parsed.writePath = next && !next.startsWith('--')
        ? resolve(root, argv[++i])
        : defaultProofPath
    } else {
      usage(`unknown argument: ${arg}`)
    }
  }
  return parsed
}

function usage (message) {
  if (message) console.error(`error: ${message}`)
  console.error('usage: node scripts/verify-dorahacks-readiness.mjs [--write [path]]')
  process.exit(2)
}

async function main () {
  const failures = []
  const checks = {}

  const packageJson = readJson('package.json', failures)
  const manifest = readJson('scripts/app-manifest.json', failures)
  const catalog = readJson('catalog/matchday-mesh.catalog.json', failures)
  const releaseProof = readJson('docs/proof/pear-release-renderer-proof-2026-06-30.json', failures)
  const visualProof = imageInfo('docs/proof/pear-release-window-2026-06-30.png', failures)
  const catalogProof = readJson('docs/proof/pearbrowser-desktop-catalog-rpc-2026-06-30.json', failures)
  const demoProof = readJson('docs/proof/matchday-demo-flow-proof-2026-06-30.json', failures)
  const livePairing = readJson('docs/proof/matchday-live-pairing-2026-06-30.json', failures)
  const launchRehearsal = readJson('docs/proof/matchday-launch-rehearsal-2026-06-30.json', failures)
  const readiness = readJson('docs/proof/matchday-live-readiness-2026-06-30.json', failures)

  const readme = readText('README.md', failures)
  const submission = readText('SUBMISSION.md', failures)
  const doraCopy = readText('docs/DORAHACKS_PROJECT_COPY.md', failures)
  const quickstart = readText('docs/JUDGE_QUICKSTART.md', failures)
  const demoScript = readText('docs/DEMO_SCRIPT.md', failures)
  const priorWork = readText('PRIOR_WORK.md', failures)
  const license = readText('LICENSE', failures)
  const proofIndex = readText('docs/proof/README.md', failures)

  checks.openSource = passFail(failures, packageJson?.license === 'MIT' &&
    manifest?.license === 'MIT' &&
    license.includes('MIT License'), 'openSource', 'MIT license is missing or inconsistent')

  checks.primaryTrack = passFail(failures,
    submission.includes('Primary track: Pears Stack') &&
    doraCopy.includes('Primary: Pears Stack') &&
    doraCopy.includes('not claimed as primary tracks'),
    'primaryTrack',
    'primary Pears Stack track or non-overclaim wording is missing')

  checks.footballTheme = passFail(failures,
    hasAll(doraCopy, ['football', 'match hub', 'fan', 'predictions']) &&
    hasAll(readme, ['football', 'watch-party', 'fan pass']),
    'footballTheme',
    'football/watch-party theme is not explicit enough')

  checks.publicLinks = passFail(failures,
    hasAll(readme, [EXPECTED.pearLink, EXPECTED.catalogRef, EXPECTED.sourceRepo]) &&
    hasAll(submission, [EXPECTED.pearLink, EXPECTED.catalogRef, EXPECTED.sourceRepo]) &&
    manifest?.links?.pearRuntime === EXPECTED.pearLink &&
    manifest?.links?.pearBrowserCatalog === EXPECTED.catalogRef &&
    manifest?.links?.sourceRepo === EXPECTED.sourceRepo,
    'publicLinks',
    'public Pear/catalog/source links are missing or stale')

  checks.setupInstructions = passFail(failures,
    hasAll(readme, ['npm ci', 'npm test', 'npm run verify:submission', 'pear run --dev .']) &&
    hasAll(quickstart, ['npm ci', 'npm run check:release', 'npm run verify:launch', EXPECTED.pearLink]),
    'setupInstructions',
    'judge setup instructions are incomplete')

  checks.releaseApp = passFail(failures,
    releaseProof?.ok === true &&
    releaseProof?.release === 2394 &&
    releaseProof?.length === 2394 &&
    releaseProof?.app?.pearLink === EXPECTED.pearLink &&
    releaseProof?.backendLabel === 'Corestore/Hyperbee' &&
    releaseProof?.inviteType === 'matchday-mesh-core-invite-v1' &&
    releaseProof?.pairingType === 'matchday-mesh-pairing-v1',
    'releaseApp',
    'released Pear renderer proof is missing or stale')

  checks.visualProof = passFail(failures,
    visualProof.ok &&
    releaseProof?.visualProof?.ok === true &&
    releaseProof?.visualProof?.path === 'docs/proof/pear-release-window-2026-06-30.png',
    'visualProof',
    'released Pear visual proof is missing or stale')

  checks.catalogProof = passFail(failures,
    catalog?.apps?.some((entry) => entry?.id === 'matchday-mesh' && entry?.link === EXPECTED.pearLink) &&
    catalogProof?.ok === true &&
    catalogProof?.matchdayMesh?.pearLink === EXPECTED.pearLink,
    'catalogProof',
    'PearBrowser catalog proof is missing or stale')

  checks.liveP2P = passFail(failures,
    livePairing?.ok === true &&
    livePairing?.replica?.writable === false &&
    livePairing?.replica?.operations === livePairing?.host?.operationsAfterAppend,
    'liveP2P',
    'live Hyperswarm pairing proof is missing or stale')

  checks.launchRehearsal = passFail(failures,
    launchRehearsal?.ok === true &&
    launchRehearsal?.checks?.dorahacksReadinessCommand === true &&
    launchRehearsal?.checks?.releaseWindowCommand === true &&
    launchRehearsal?.checks?.judgeGate === true &&
    launchRehearsal?.checks?.livePairingCommand === true &&
    launchRehearsal?.checks?.liveReadinessCommand === true,
    'launchRehearsal',
    'launch rehearsal proof is missing or incomplete')

  checks.demoProof = passFail(failures,
    demoProof?.checks &&
    Object.values(demoProof.checks).every((value) => value === true) &&
    demoProof?.release?.pearRelease === 2394 &&
    demoProof?.scenario?.operationCount === 8,
    'demoProof',
    'deterministic demo proof is missing or stale')

  checks.liveReadiness = passFail(failures,
    readiness?.ok === true &&
    readiness?.app?.release === 2394 &&
    Object.values(readiness?.checks || {}).every((value) => value === true),
    'liveReadiness',
    'live-readiness proof is missing or stale')

  checks.priorWorkDisclosure = passFail(failures,
    hasAll(priorWork, ['Pear Tickets', 'Pear POS', 'PearBrowser', 'Not Yet Claimed']) &&
    doraCopy.includes('PRIOR_WORK.md'),
    'priorWorkDisclosure',
    'prior-work disclosure is incomplete')

  checks.demoVideoPlan = passFail(failures,
    demoScript.includes('Target length: 3 minutes') &&
    hasAll(demoScript, ['PearBrowser catalog', 'P2P invite', 'USDt pool demo', 'Proof pack']) &&
    doraCopy.includes('Demo Video Outline'),
    'demoVideoPlan',
    '3-minute demo video plan is missing')

  checks.noPlatformOverclaim = passFail(failures,
    manifest?.runtimes?.qvac?.supported === false &&
    manifest?.runtimes?.wdk?.supported === 'demo' &&
    hasAll(submission, ['WDK', 'QVAC', 'gated', 'demo-ledger']) &&
    hasAll(doraCopy, ['not claimed as primary tracks', 'production-money claim']),
    'noPlatformOverclaim',
    'WDK/QVAC scope is not honestly gated')

  checks.proofIndex = passFail(failures,
    hasAll(proofIndex, [
      'pear-release-renderer-proof-2026-06-30.json',
      'pear-release-window-2026-06-30.png',
      'matchday-live-pairing-2026-06-30.json',
      'matchday-launch-rehearsal-2026-06-30.json'
    ]),
    'proofIndex',
    'proof index is missing key launch proof files')

  const manualActions = [
    'Register or update the DoraHacks project page with the paste-ready copy from docs/DORAHACKS_PROJECT_COPY.md.',
    'Record and upload a 3-minute-or-shorter unlisted YouTube demo video before the final DoraHacks deadline.',
    'Add the YouTube demo link to the DoraHacks submission page once recorded.',
    'If a second machine is available, capture a two-device Pear Runtime pairing screenshot for extra polish.'
  ]

  const proof = {
    ok: failures.length === 0,
    capturedAt: new Date().toISOString(),
    app: {
      id: manifest?.appId || null,
      name: manifest?.name || null,
      primaryTrack: EXPECTED.primaryTrack,
      pearLink: EXPECTED.pearLink,
      catalog: EXPECTED.catalogRef,
      sourceRepo: EXPECTED.sourceRepo,
      license: packageJson?.license || null,
      release: releaseProof?.release || null,
      length: releaseProof?.length || null
    },
    checks,
    proofHighlights: {
      release: {
        ok: releaseProof?.ok === true,
        release: releaseProof?.release || null,
        length: releaseProof?.length || null,
        backend: releaseProof?.backendLabel || null,
        visualMode: releaseProof?.visualProof?.mode || null
      },
      catalog: {
        ok: catalogProof?.ok === true,
        peerCount: catalogProof?.pearBrowserRpc?.peerCount || 0,
        hiveRelays: catalogProof?.pearBrowserRpc?.hiveRelays || 0
      },
      livePairing: {
        ok: livePairing?.ok === true,
        topic: livePairing?.transport?.shortTopic || null,
        replicaOperations: livePairing?.replica?.operations || 0
      },
      launchRehearsal: {
        ok: launchRehearsal?.ok === true,
        commandCount: Array.isArray(launchRehearsal?.commands) ? launchRehearsal.commands.length : 0
      },
      visualProof: visualProof.ok
        ? {
            path: 'docs/proof/pear-release-window-2026-06-30.png',
            bytes: visualProof.bytes,
            mode: releaseProof?.visualProof?.mode || null
          }
        : null
    },
    manualActions,
    failures
  }

  if (args.writePath) {
    await writeFile(args.writePath, `${JSON.stringify(proof, null, 2)}\n`)
  }

  if (!proof.ok) {
    for (const failure of failures) console.error('FAIL:', failure)
    if (args.writePath) console.error(`Wrote ${relative(root, args.writePath)}`)
    process.exit(1)
  }

  console.log('Matchday Mesh DoraHacks readiness OK')
  console.log(`  pear: ${EXPECTED.pearLink}`)
  console.log(`  catalog: ${EXPECTED.catalogRef}`)
  console.log(`  release: ${releaseProof?.release}, visual: ${releaseProof?.visualProof?.mode}`)
  console.log(`  manual actions: ${manualActions.length}`)
  if (args.writePath) console.log(`  proof: ${relative(root, args.writePath)}`)
}

function passFail (failures, passed, name, message) {
  if (!passed) failures.push(`${name}: ${message}`)
  return passed === true
}

function readText (relativePath, failures) {
  const abs = join(root, relativePath)
  try {
    return readFileSync(abs, 'utf8')
  } catch (err) {
    failures.push(`${relativePath}: ${err.message}`)
    return ''
  }
}

function readJson (relativePath, failures) {
  try {
    return JSON.parse(readText(relativePath, failures))
  } catch (err) {
    failures.push(`${relativePath}: invalid JSON: ${err.message}`)
    return null
  }
}

function imageInfo (relativePath, failures) {
  const abs = join(root, relativePath)
  if (!existsSync(abs)) {
    failures.push(`${relativePath}: missing image`)
    return { ok: false, bytes: 0 }
  }
  const bytes = readFileSync(abs)
  const png = bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  const size = statSync(abs).size
  return { ok: png && size >= 10_000, bytes: size, png }
}

function hasAll (text, values) {
  return values.every((value) => text.includes(value))
}

main().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
