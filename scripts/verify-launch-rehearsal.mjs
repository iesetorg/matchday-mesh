#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const defaultProofPath = join(root, 'docs/proof/matchday-launch-rehearsal-2026-06-30.json')

const EXPECTED = {
  pearLink: 'pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy',
  catalogRef: 'hyperbee://0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f',
  sourceRepo: 'https://github.com/iesetorg/matchday-mesh'
}

const args = parseArgs(process.argv.slice(2))

function parseArgs (argv) {
  const parsed = {
    writePath: null,
    liveTimeout: 60000,
    commandTimeout: 120000
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--write') {
      const next = argv[i + 1]
      parsed.writePath = next && !next.startsWith('--')
        ? resolve(root, argv[++i])
        : defaultProofPath
    } else if (arg === '--live-timeout') {
      parsed.liveTimeout = parsePositiveInt(argv[++i], '--live-timeout')
    } else if (arg === '--command-timeout') {
      parsed.commandTimeout = parsePositiveInt(argv[++i], '--command-timeout')
    } else {
      usage(`unknown argument: ${arg}`)
    }
  }
  return parsed
}

function parsePositiveInt (value, name) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1000) usage(`${name} must be an integer >= 1000`)
  return parsed
}

function usage (message) {
  if (message) console.error(`error: ${message}`)
  console.error('usage: node scripts/verify-launch-rehearsal.mjs [--write [path]] [--live-timeout ms] [--command-timeout ms]')
  process.exit(2)
}

async function main () {
  const commandPlan = [
    {
      name: 'dorahacksReadiness',
      command: 'npm',
      args: ['run', 'verify:dorahacks'],
      timeout: args.commandTimeout
    },
    {
      name: 'releaseWindow',
      command: 'npm',
      args: ['run', 'verify:release-window'],
      timeout: args.commandTimeout
    },
    {
      name: 'judgeGate',
      command: 'npm',
      args: ['run', 'check:judge'],
      timeout: args.commandTimeout
    },
    {
      name: 'livePairing',
      command: 'npm',
      args: ['run', 'verify:live-pairing', '--', '--timeout', String(args.liveTimeout)],
      timeout: args.liveTimeout + 15000
    },
    {
      name: 'liveReadiness',
      command: 'npm',
      args: ['run', 'verify:live-readiness'],
      timeout: args.commandTimeout
    }
  ]

  const commandResults = []
  for (const command of commandPlan) {
    const result = await runCommand(command)
    commandResults.push(result)
    if (!result.ok) break
  }

  const proofFiles = readProofFiles()
  const checks = {
    dorahacksReadinessCommand: commandResults.find((result) => result.name === 'dorahacksReadiness')?.ok === true,
    releaseWindowCommand: commandResults.find((result) => result.name === 'releaseWindow')?.ok === true,
    judgeGate: commandResults.find((result) => result.name === 'judgeGate')?.ok === true,
    livePairingCommand: commandResults.find((result) => result.name === 'livePairing')?.ok === true,
    liveReadinessCommand: commandResults.find((result) => result.name === 'liveReadiness')?.ok === true,
    releasedPearProof: proofFiles.releaseProof?.ok === true &&
      proofFiles.releaseProof?.release === 2394 &&
      proofFiles.releaseProof?.backendLabel === 'Corestore/Hyperbee',
    livePairingProof: proofFiles.livePairing?.ok === true &&
      proofFiles.livePairing?.replica?.writable === false &&
      proofFiles.livePairing?.replica?.operations === proofFiles.livePairing?.host?.operationsAfterAppend,
    liveReadinessProof: proofFiles.liveReadiness?.ok === true,
    pearBrowserCatalogProof: proofFiles.catalogProof?.ok === true &&
      proofFiles.catalogProof?.matchdayMesh?.pearLink === EXPECTED.pearLink,
    pearBrowserCatalogVisualProof: proofFiles.catalogVisualProof?.ok === true &&
      proofFiles.catalogVisualProof?.mode === 'rpc-proof-card' &&
      proofFiles.catalogVisualProof?.app?.pearLink === EXPECTED.pearLink &&
      proofFiles.catalogVisualProof?.visualProof?.path === 'docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.png',
    previewSmokeProof: proofFiles.previewSmoke?.ok === true &&
      proofFiles.previewSmoke?.scenario?.operationCount === 6 &&
      proofFiles.previewSmoke?.scenario?.accepted === true &&
      proofFiles.previewSmoke?.scenario?.poolTotal === 5 &&
      proofFiles.previewSmoke?.scenario?.latestFeedCard?.type === 'feed:pool-contribution',
    deterministicDemoProof: proofFiles.demoProof?.app?.pearLink === EXPECTED.pearLink &&
      proofFiles.demoProof?.checks &&
      Object.values(proofFiles.demoProof.checks).every((value) => value === true)
  }

  const failures = []
  for (const [name, passed] of Object.entries(checks)) {
    if (passed !== true) failures.push(`${name}: failed`)
  }

  const proof = {
    ok: failures.length === 0,
    capturedAt: new Date().toISOString(),
    app: {
      pearLink: EXPECTED.pearLink,
      catalog: EXPECTED.catalogRef,
      sourceRepo: EXPECTED.sourceRepo
    },
    commands: commandResults.map((result) => ({
      name: result.name,
      command: result.displayCommand,
      ok: result.ok,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      stdoutTail: tail(result.stdout),
      stderrTail: tail(result.stderr)
    })),
    proofs: {
      release: summarizeReleaseProof(proofFiles.releaseProof),
      livePairing: summarizeLivePairingProof(proofFiles.livePairing),
      liveReadiness: summarizeLiveReadinessProof(proofFiles.liveReadiness),
      catalog: summarizeCatalogProof(proofFiles.catalogProof),
      catalogVisual: summarizeCatalogVisualProof(proofFiles.catalogVisualProof),
      previewSmoke: summarizePreviewSmokeProof(proofFiles.previewSmoke),
      demo: summarizeDemoProof(proofFiles.demoProof)
    },
    checks,
    failures
  }

  if (args.writePath) {
    await writeFile(args.writePath, `${JSON.stringify(proof, null, 2)}\n`)
  }

  if (!proof.ok) {
    for (const message of failures) console.error('FAIL:', message)
    if (args.writePath) console.error(`Wrote ${relative(root, args.writePath)}`)
    process.exit(1)
  }

  console.log('Matchday Mesh launch rehearsal OK')
  console.log(`  pear: ${EXPECTED.pearLink}`)
  console.log(`  catalog: ${EXPECTED.catalogRef}`)
  console.log(`  commands: ${commandResults.length}/${commandPlan.length}`)
  if (proof.proofs.livePairing?.shortTopic) {
    console.log(`  live pairing proof: ${proof.proofs.livePairing.shortTopic}, replica ops ${proof.proofs.livePairing.replicaOperations}`)
  }
  if (args.writePath) console.log(`  proof: ${relative(root, args.writePath)}`)
}

function readProofFiles () {
  return {
    releaseProof: readJson('docs/proof/pear-release-renderer-proof-2026-06-30.json'),
    livePairing: readJson('docs/proof/matchday-live-pairing-2026-06-30.json'),
    liveReadiness: readJson('docs/proof/matchday-live-readiness-2026-06-30.json'),
    catalogProof: readJson('docs/proof/pearbrowser-desktop-catalog-rpc-2026-06-30.json'),
    catalogVisualProof: readJson('docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.json'),
    previewSmoke: readJson('docs/proof/matchday-preview-smoke-2026-06-30.json'),
    demoProof: readJson('docs/proof/matchday-demo-flow-proof-2026-06-30.json')
  }
}

function readJson (relativePath) {
  const path = join(root, relativePath)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

function runCommand (entry) {
  const displayCommand = [entry.command, ...entry.args].join(' ')
  const started = Date.now()
  return new Promise((resolve) => {
    const child = spawn(entry.command, entry.args, {
      cwd: root,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      child.kill('SIGTERM')
    }, entry.timeout)

    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        name: entry.name,
        displayCommand,
        ok: false,
        exitCode: null,
        durationMs: Date.now() - started,
        stdout,
        stderr: `${stderr}${err.message}\n`
      })
    })
    child.on('close', (exitCode, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const timedOut = signal === 'SIGTERM' && Date.now() - started >= entry.timeout
      resolve({
        name: entry.name,
        displayCommand,
        ok: exitCode === 0 && !timedOut,
        exitCode,
        durationMs: Date.now() - started,
        stdout,
        stderr: timedOut ? `${stderr}Timed out after ${entry.timeout}ms\n` : stderr
      })
    })
  })
}

function summarizeReleaseProof (proof) {
  if (!proof) return null
  return {
    ok: proof.ok,
    release: proof.release,
    length: proof.length,
    backend: proof.backendLabel,
    inviteType: proof.inviteType,
    pairingType: proof.pairingType
  }
}

function summarizeLivePairingProof (proof) {
  if (!proof) return null
  return {
    ok: proof.ok,
    shortTopic: proof.transport?.shortTopic,
    hostStatus: proof.host?.status,
    hostOperationsAfterAppend: proof.host?.operationsAfterAppend,
    replicaStatus: proof.replica?.status,
    replicaWritable: proof.replica?.writable,
    replicaOperations: proof.replica?.operations,
    latestFeedCard: proof.replica?.latestFeedCard?.body || null
  }
}

function summarizeLiveReadinessProof (proof) {
  if (!proof) return null
  return {
    ok: proof.ok,
    release: proof.app?.release,
    length: proof.app?.length,
    preview: proof.preview?.url,
    checks: proof.checks
  }
}

function summarizeCatalogProof (proof) {
  if (!proof) return null
  return {
    ok: proof.ok,
    peerCount: proof.pearBrowserRpc?.peerCount,
    hiveRelays: proof.pearBrowserRpc?.hiveRelays,
    appLink: proof.matchdayMesh?.pearLink,
    aggregatedApps: proof.aggregatedApps
  }
}

function summarizeCatalogVisualProof (proof) {
  if (!proof) return null
  return {
    ok: proof.ok,
    mode: proof.mode,
    path: proof.visualProof?.path,
    bytes: proof.visualProof?.bytes,
    catalogApps: proof.catalog?.apps,
    peerCount: proof.pearBrowserRpc?.peerCount,
    hiveRelays: proof.pearBrowserRpc?.hiveRelays
  }
}

function summarizePreviewSmokeProof (proof) {
  if (!proof) return null
  return {
    ok: proof.ok,
    operationCount: proof.scenario?.operationCount,
    feedCards: proof.scenario?.feedCards,
    latestFeedCard: proof.scenario?.latestFeedCard?.type,
    accepted: proof.scenario?.accepted,
    poolTotal: proof.scenario?.poolTotal,
    receiveAddress: proof.scenario?.receiveAddress
  }
}

function summarizeDemoProof (proof) {
  if (!proof) return null
  return {
    operations: proof.scenario?.operationCount,
    feedCards: proof.scenario?.feedCards,
    latestFeedCard: proof.scenario?.latestFeedCard?.type,
    checks: proof.checks
  }
}

function tail (value, maxLength = 1600) {
  if (!value) return ''
  return value.length <= maxLength ? value : value.slice(value.length - maxLength)
}

main().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
