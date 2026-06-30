#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const defaultProofPath = join(root, 'docs/proof/public-checkout-proof-2026-06-30.json')

const EXPECTED = {
  repo: 'https://github.com/iesetorg/matchday-mesh',
  branch: 'main',
  releaseGate: 'check:release'
}

const args = parseArgs(process.argv.slice(2))

function parseArgs (argv) {
  const parsed = {
    repo: EXPECTED.repo,
    branch: EXPECTED.branch,
    keep: false,
    skipHeadMatch: false,
    writePath: null,
    timeout: 180000
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--repo') {
      parsed.repo = argv[++i]
    } else if (arg === '--branch') {
      parsed.branch = argv[++i]
    } else if (arg === '--keep') {
      parsed.keep = true
    } else if (arg === '--skip-head-match') {
      parsed.skipHeadMatch = true
    } else if (arg === '--timeout') {
      parsed.timeout = parsePositiveInt(argv[++i], '--timeout')
    } else if (arg === '--write') {
      const next = argv[i + 1]
      parsed.writePath = next && !next.startsWith('--')
        ? resolve(root, argv[++i])
        : defaultProofPath
    } else {
      usage(`unknown argument: ${arg}`)
    }
  }
  if (!parsed.repo) usage('--repo requires a value')
  if (!parsed.branch) usage('--branch requires a value')
  return parsed
}

function parsePositiveInt (value, name) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1000) usage(`${name} must be an integer >= 1000`)
  return parsed
}

function usage (message) {
  if (message) console.error(`error: ${message}`)
  console.error('usage: node scripts/verify-public-checkout.mjs [--write [path]] [--repo url] [--branch name] [--timeout ms] [--skip-head-match] [--keep]')
  process.exit(2)
}

async function main () {
  const failures = []
  let cloneDir = null
  const commands = []

  try {
    const localHead = await runCommand('git', ['rev-parse', 'HEAD'], { cwd: root, timeout: 10000 })
    commands.push(commandSummary('localHead', localHead))
    const expectedHead = localHead.stdout.trim()

    const remoteHead = await runCommand('git', ['ls-remote', args.repo, `refs/heads/${args.branch}`], {
      cwd: root,
      timeout: args.timeout
    })
    commands.push(commandSummary('remoteHead', remoteHead))
    const remoteHeadSha = parseLsRemote(remoteHead.stdout)
    if (!remoteHeadSha) failures.push(`remote ${args.branch} head was not found`)
    if (!args.skipHeadMatch && remoteHeadSha && remoteHeadSha !== expectedHead) {
      failures.push(`remote ${args.branch} is ${remoteHeadSha}, local HEAD is ${expectedHead}`)
    }

    cloneDir = await mkdtemp(join(tmpdir(), 'matchday-mesh-public-checkout-'))
    const clone = await runCommand('git', ['clone', '--branch', args.branch, '--depth', '1', args.repo, cloneDir], {
      cwd: tmpdir(),
      timeout: args.timeout
    })
    commands.push(commandSummary('clone', clone))

    const cloneHead = await runCommand('git', ['rev-parse', 'HEAD'], { cwd: cloneDir, timeout: 10000 })
    commands.push(commandSummary('cloneHead', cloneHead))
    const cloneHeadSha = cloneHead.stdout.trim()
    if (remoteHeadSha && cloneHeadSha !== remoteHeadSha) {
      failures.push(`clone HEAD is ${cloneHeadSha}, remote ${args.branch} is ${remoteHeadSha}`)
    }

    const npmCi = await runCommand('npm', ['ci'], { cwd: cloneDir, timeout: args.timeout })
    commands.push(commandSummary('npmCi', npmCi))
    if (!/found 0 vulnerabilities/i.test(`${npmCi.stdout}\n${npmCi.stderr}`)) {
      failures.push('npm ci did not report 0 vulnerabilities')
    }

    const releaseGate = await runCommand('npm', ['run', EXPECTED.releaseGate], {
      cwd: cloneDir,
      timeout: args.timeout * 2
    })
    commands.push(commandSummary('releaseGate', releaseGate))
    if (!releaseGate.stdout.includes('Matchday Mesh submission pack OK')) {
      failures.push('release gate did not finish with submission pack OK')
    }

    const proof = {
      ok: failures.length === 0,
      capturedAt: new Date().toISOString(),
      repo: args.repo,
      branch: args.branch,
      expectedHead,
      remoteHead: remoteHeadSha,
      cloneHead: cloneHeadSha,
      clonePath: cloneDir,
      keptClone: args.keep,
      checks: {
        remoteMatchesLocal: args.skipHeadMatch ? 'skipped' : remoteHeadSha === expectedHead,
        cloneMatchesRemote: cloneHeadSha === remoteHeadSha,
        npmCi: npmCi.ok,
        zeroVulnerabilities: /found 0 vulnerabilities/i.test(`${npmCi.stdout}\n${npmCi.stderr}`),
        releaseGate: releaseGate.ok,
        submissionPack: releaseGate.stdout.includes('Matchday Mesh submission pack OK')
      },
      commands,
      failures
    }

    if (args.writePath) await writeFile(args.writePath, `${JSON.stringify(proof, null, 2)}\n`)
    if (!proof.ok) {
      for (const failure of failures) console.error('FAIL:', failure)
      if (args.writePath) console.error(`Wrote ${relative(root, args.writePath)}`)
      process.exit(1)
    }

    console.log('Matchday Mesh public checkout OK')
    console.log(`  repo: ${args.repo}`)
    console.log(`  branch: ${args.branch}`)
    console.log(`  commit: ${cloneHeadSha}`)
    console.log('  npm ci: ok, 0 vulnerabilities')
    console.log(`  npm run ${EXPECTED.releaseGate}: ok`)
    if (args.writePath) console.log(`  proof: ${relative(root, args.writePath)}`)
  } finally {
    if (cloneDir && !args.keep) await rm(cloneDir, { recursive: true, force: true })
  }
}

function parseLsRemote (stdout) {
  const [sha] = stdout.trim().split(/\s+/)
  return /^[0-9a-f]{40}$/i.test(sha || '') ? sha : null
}

function commandSummary (name, result) {
  return {
    name,
    command: [result.command, ...result.args].join(' '),
    ok: result.ok,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr)
  }
}

function runCommand (command, commandArgs, options) {
  const started = Date.now()
  return new Promise((resolveCommand) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timeout = setTimeout(() => {
      if (!settled) child.kill('SIGTERM')
    }, options.timeout)

    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolveCommand({
        command,
        args: commandArgs,
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
      clearTimeout(timeout)
      const timedOut = signal === 'SIGTERM'
      resolveCommand({
        command,
        args: commandArgs,
        ok: exitCode === 0 && !timedOut,
        exitCode,
        durationMs: Date.now() - started,
        stdout,
        stderr: timedOut ? `${stderr}Timed out after ${options.timeout}ms\n` : stderr
      })
    })
  })
}

function tail (value, maxLength = 1600) {
  if (!value) return ''
  return value.length <= maxLength ? value : value.slice(value.length - maxLength)
}

main().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
