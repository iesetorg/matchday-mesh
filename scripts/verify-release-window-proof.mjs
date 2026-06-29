#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const defaultProofPath = join(root, 'docs/proof/pear-release-renderer-proof-2026-06-30.json')
const defaultImagePath = join(root, 'docs/proof/pear-release-window-2026-06-30.png')

const EXPECTED = {
  pearLink: 'pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy',
  catalogRef: 'hyperbee://0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f',
  sourceRepo: 'https://github.com/iesetorg/matchday-mesh'
}

const args = parseArgs(process.argv.slice(2))

function parseArgs (argv) {
  const runId = `${process.pid}-${Date.now()}`
  const parsed = {
    write: false,
    dev: false,
    link: EXPECTED.pearLink,
    timeout: 60000,
    proofPath: join(tmpdir(), `matchday-release-window-proof-${runId}.json`),
    imagePath: join(tmpdir(), `matchday-release-window-proof-${runId}.png`),
    rawPath: join(tmpdir(), `matchday-release-window-raw-${runId}.json`)
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--write') {
      parsed.write = true
      parsed.proofPath = defaultProofPath
      parsed.imagePath = defaultImagePath
    } else if (arg === '--proof') {
      parsed.proofPath = resolve(root, argv[++i])
    } else if (arg === '--image') {
      parsed.imagePath = resolve(root, argv[++i])
    } else if (arg === '--link') {
      parsed.link = argv[++i]
    } else if (arg === '--dev') {
      parsed.dev = true
    } else if (arg === '--timeout') {
      parsed.timeout = parsePositiveInt(argv[++i], '--timeout')
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
  console.error('usage: node scripts/verify-release-window-proof.mjs [--write] [--proof path] [--image path] [--link pear://...] [--dev] [--timeout ms]')
  process.exit(2)
}

async function main () {
  await mkdir(dirname(args.proofPath), { recursive: true })
  await mkdir(dirname(args.imagePath), { recursive: true })
  await rm(args.rawPath, { force: true })
  await rm(args.imagePath, { force: true })

  const runResult = await runPearWithProof()
  const rawProof = readJson(args.rawPath)
  const image = inspectImage(args.imagePath)
  const pearInfo = args.dev ? null : readPearInfo(args.link)
  const proof = normalizeProof(rawProof, image, pearInfo, runResult)
  const failures = validateProof(proof)

  proof.ok = failures.length === 0
  proof.failures = failures

  await writeFile(args.proofPath, `${JSON.stringify(proof, null, 2)}\n`)

  if (!proof.ok) {
    for (const message of failures) console.error('FAIL:', message)
    console.error(`Wrote ${displayPath(args.proofPath)}`)
    process.exit(1)
  }

  console.log('Matchday Mesh released window proof OK')
  console.log(`  pear: ${args.link}`)
  if (proof.release) console.log(`  release: ${proof.release}, length ${proof.length}`)
  console.log(`  backend: ${proof.backendLabel}`)
  console.log(`  visual: ${displayPath(args.imagePath)} (${image.bytes} bytes)`)
  console.log(`  proof: ${displayPath(args.proofPath)}`)
}

async function runPearWithProof () {
  const pearArgs = ['run']
  if (args.dev) pearArgs.push('--dev')
  pearArgs.push(args.link)

  const env = {
    ...process.env,
    MATCHDAY_MESH_BOOT_PROOF_PATH: args.rawPath,
    MATCHDAY_MESH_VISUAL_PROOF_PATH: args.imagePath,
    MATCHDAY_MESH_VISUAL_PROOF_DELAY_MS: process.env.MATCHDAY_MESH_VISUAL_PROOF_DELAY_MS || '900',
    MATCHDAY_MESH_VISUAL_PROOF_TIMEOUT_MS: process.env.MATCHDAY_MESH_VISUAL_PROOF_TIMEOUT_MS || '2500'
  }
  const child = spawn('pear', pearArgs, {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let stdout = ''
  let stderr = ''
  let exitCode = null
  let signal = null
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  child.on('close', (code, closeSignal) => {
    exitCode = code
    signal = closeSignal
  })

  const started = Date.now()
  let lastError = null
  while (Date.now() - started < args.timeout) {
    try {
      const rawProof = readJson(args.rawPath)
      const image = inspectImage(args.imagePath)
      if (rawProof?.ok === true && rawProof?.visualProof?.ok === true && image.png) {
        await stopChild(child)
        return {
          command: formatCommand(env, pearArgs),
          exitCode,
          signal,
          durationMs: Date.now() - started,
          stdout,
          stderr
        }
      }
      lastError = new Error(rawProof?.visualProof?.error || 'proof files are not ready')
    } catch (err) {
      lastError = err
    }
    if (exitCode !== null && !existsSync(args.rawPath)) break
    await delay(250)
  }

  await stopChild(child)
  throw new Error(`Timed out waiting for released window proof: ${lastError?.message || 'no proof files'}`)
}

async function stopChild (child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  const closed = await Promise.race([
    new Promise((resolve) => child.once('close', resolve)),
    delay(3000).then(() => false)
  ])
  if (closed === false && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
}

function normalizeProof (rawProof, image, pearInfo, runResult) {
  const info = rawProof.info || {}
  const backendStatus = rawProof.backendStatus || {}
  const invite = rawProof.invite || {}
  const pairing = rawProof.pairing || {}
  const warning = runResult.stderr.includes('pear/bin')
    ? "Pear printed the PATH shim warning because /Users/localllm/Library/Application Support/pear/bin does not exist on this host."
    : null

  return {
    ok: false,
    capturedAt: new Date().toISOString(),
    release: pearInfo?.release || null,
    length: pearInfo?.length || null,
    command: runResult.command,
    warning,
    stage: rawProof.stage,
    hasPear: rawProof.hasPear,
    hasMatchdayAPI: rawProof.hasMatchdayAPI,
    runtimeError: rawProof.runtimeError || null,
    backend: backendStatus.source || info.backend || null,
    backendLabel: backendStatus.label || (info.backend === 'pears-store' ? 'Corestore/Hyperbee' : null),
    storagePath: backendStatus.storagePath || info.storagePath || null,
    coreName: info.coreName || invite.coreName || null,
    key: info.key || invite.key || null,
    discoveryKey: info.discoveryKey || invite.discoveryKey || null,
    inviteType: invite.type || null,
    pairingType: pairing.type || null,
    pairingTransport: pairing.transport || null,
    pairingTopic: pairing.topic || null,
    pairingShortTopic: pairing.shortTopic || null,
    operationCount: rawProof.operationCount || backendStatus.operations || info.operations || 0,
    stateCounts: rawProof.stateCounts || null,
    visualProof: {
      ok: rawProof.visualProof?.ok === true && image.png,
      path: displayPath(args.imagePath),
      bytes: image.bytes,
      png: image.png,
      mode: rawProof.visualProof?.mode || null,
      screenshot: rawProof.visualProof?.screenshot === true,
      sourceId: rawProof.visualProof?.sourceId || null,
      sourceName: rawProof.visualProof?.sourceName || null,
      fallbackReason: rawProof.visualProof?.fallbackReason || null,
      stage: rawProof.visualProof?.stage || null,
      capturedAt: rawProof.visualProof?.capturedAt || null
    },
    app: {
      pearLink: args.link,
      catalog: EXPECTED.catalogRef,
      sourceRepo: EXPECTED.sourceRepo
    }
  }
}

function validateProof (proof) {
  const failures = []
  if (proof.hasPear !== true) failures.push('released window proof should have Pear')
  if (proof.hasMatchdayAPI !== true) failures.push('released window proof should have matchdayAPI')
  if (proof.runtimeError) failures.push(`released window proof runtime error: ${proof.runtimeError}`)
  if (proof.backendLabel !== 'Corestore/Hyperbee') failures.push('released window proof should use Corestore/Hyperbee')
  if (proof.inviteType !== 'matchday-mesh-core-invite-v1') failures.push('released window proof should export the invite type')
  if (proof.pairingType !== 'matchday-mesh-pairing-v1') failures.push('released window proof should export the pairing type')
  if (proof.pairingTransport !== 'hyperswarm-topic') failures.push('released window proof should export the pairing transport')
  if (!/^[0-9a-f]{64}$/.test(proof.pairingTopic || '')) failures.push('released window proof should export a 32-byte pairing topic')
  if ((proof.operationCount || 0) < 3) failures.push('released window proof should have seeded operations')
  if (proof.visualProof?.ok !== true) failures.push('released window proof should include a valid window PNG')
  if (!['desktop-capture', 'renderer-proof-card'].includes(proof.visualProof?.mode)) {
    failures.push('released window proof should declare the visual proof mode')
  }
  if ((proof.visualProof?.bytes || 0) < 10_000) failures.push('released window PNG is unexpectedly small')
  if (!args.dev && (!Number.isSafeInteger(proof.release) || !Number.isSafeInteger(proof.length))) {
    failures.push('released window proof should include Pear release metadata')
  }
  return failures
}

function readJson (path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function inspectImage (path) {
  const bytes = readFileSync(path)
  const png = bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  return {
    png,
    bytes: statSync(path).size
  }
}

function readPearInfo (link) {
  try {
    const output = execFileSync('pear', ['info', link], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
    return {
      release: numberFromLine(output, 'release'),
      length: numberFromLine(output, 'length')
    }
  } catch {
    return null
  }
}

function numberFromLine (output, label) {
  const match = new RegExp(`^\\s*${label}\\s+(\\d+)`, 'm').exec(stripAnsi(output))
  return match ? Number(match[1]) : null
}

function stripAnsi (value) {
  return String(value || '').replace(/\x1b\[[0-9;]*m/g, '')
}

function formatCommand (env, pearArgs) {
  return [
    `MATCHDAY_MESH_BOOT_PROOF_PATH=${env.MATCHDAY_MESH_BOOT_PROOF_PATH}`,
    `MATCHDAY_MESH_VISUAL_PROOF_PATH=${env.MATCHDAY_MESH_VISUAL_PROOF_PATH}`,
    'pear',
    ...pearArgs
  ].join(' ')
}

function displayPath (path) {
  const rel = relative(root, path)
  return rel && !rel.startsWith('..') && !rel.startsWith('/')
    ? rel
    : path
}

function delay (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
