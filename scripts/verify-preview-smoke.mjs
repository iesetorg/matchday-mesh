#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { listFeed, moduleStatus } from '../app/domain.js'
import {
  applyOperation,
  createDemoOperations,
  createOperation,
  OP_TYPES,
  parseOperationEnvelope,
  replayOperations,
  serializeOperations
} from '../app/ops.js'
import { confirmDemoPoolContribution, createPoolReceiveRequest, paymentModuleStatus } from '../app/payments.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const defaultProofPath = join(root, 'docs/proof/matchday-preview-smoke-2026-06-30.json')

const EXPECTED = {
  pearLink: 'pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy',
  catalogRef: 'hyperbee://0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f',
  sourceRepo: 'https://github.com/iesetorg/matchday-mesh',
  defaultPort: 4193
}

const args = parseArgs(process.argv.slice(2))

function parseArgs (argv) {
  const parsed = {
    port: EXPECTED.defaultPort,
    url: null,
    writePath: null,
    timeout: 5000
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--port') {
      parsed.port = Number(argv[++i])
    } else if (arg === '--url') {
      parsed.url = argv[++i]
    } else if (arg === '--timeout') {
      parsed.timeout = Number(argv[++i])
    } else if (arg === '--write') {
      const next = argv[i + 1]
      parsed.writePath = next && !next.startsWith('--')
        ? resolve(root, argv[++i])
        : defaultProofPath
    } else {
      usage(`unknown argument: ${arg}`)
    }
  }

  if (!Number.isInteger(parsed.port) || parsed.port < 1) usage('--port must be a positive integer')
  if (!Number.isInteger(parsed.timeout) || parsed.timeout < 1000) usage('--timeout must be at least 1000')
  return parsed
}

function usage (message) {
  if (message) console.error(`error: ${message}`)
  console.error('usage: node scripts/verify-preview-smoke.mjs [--write [path]] [--port n] [--url http://127.0.0.1:n/] [--timeout ms]')
  process.exit(2)
}

async function main () {
  const failures = []
  const checks = {}
  let server = null
  let previewUrl = args.url

  try {
    if (!previewUrl) {
      const started = await startPreviewServer(args.port, args.timeout)
      server = started.process
      previewUrl = started.url
    }

    const http = await verifyHttpSurface(previewUrl, failures, checks)
    const source = verifyFrontendContracts(failures, checks)
    const scenario = verifyDemoScenario(failures, checks)

    const proof = {
      ok: failures.length === 0,
      capturedAt: new Date().toISOString(),
      app: {
        pearLink: EXPECTED.pearLink,
        catalog: EXPECTED.catalogRef,
        sourceRepo: EXPECTED.sourceRepo
      },
      preview: {
        url: previewUrl,
        spawnedServer: Boolean(server)
      },
      checks,
      http,
      source,
      scenario,
      failures
    }

    if (args.writePath) {
      writeFileSync(args.writePath, `${JSON.stringify(proof, null, 2)}\n`)
    }

    if (!proof.ok) {
      for (const failure of failures) console.error('FAIL:', failure)
      if (args.writePath) console.error(`Wrote ${relative(root, args.writePath)}`)
      process.exitCode = 1
      return
    }

    console.log('Matchday Mesh preview smoke OK')
    console.log(`  preview: ${previewUrl}`)
    console.log(`  ops: ${scenario.operationCount}, feed cards: ${scenario.feedCards}`)
    console.log(`  latest: ${scenario.latestFeedCard.type}, total: ${scenario.poolTotal} USDt`)
    if (args.writePath) console.log(`  proof: ${relative(root, args.writePath)}`)
  } finally {
    if (server) server.kill()
  }
}

function startPreviewServer (port, timeout) {
  return new Promise((resolveStart, rejectStart) => {
    const child = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), '--port', String(port)], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let settled = false
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      rejectStart(new Error(`preview server did not start within ${timeout}ms${stderr ? `: ${stderr.trim()}` : ''}`))
    }, timeout)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
      const match = /Matchday Mesh preview:\s+(http:\/\/[^\s]+)/.exec(stdout)
      if (!match || settled) return
      settled = true
      clearTimeout(timer)
      resolveStart({ process: child, url: match[1] })
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      rejectStart(err)
    })

    child.on('exit', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      rejectStart(new Error(`preview server exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`))
    })
  })
}

async function verifyHttpSurface (previewUrl, failures, checks) {
  const assets = {}
  const index = await fetchAsset(previewUrl, '/', args.timeout)
  assets.index = summarizeAsset(index, ['Matchday Mesh', './ui/styles.css', './app/boot-renderer.js', './ui/app.js'])
  record(checks, failures, 'previewIndex', assets.index.ok, assets.index.message)

  const ui = await fetchAsset(previewUrl, '/ui/app.js', args.timeout)
  assets.ui = summarizeAsset(ui, ['PearBrowser launch build', 'Scan Pass', 'Open Pool', 'Add', 'P2P Invite', 'data-testid="tester-output"', 'data-action="import-log"'])
  record(checks, failures, 'previewUiAsset', assets.ui.ok, assets.ui.message)

  const styles = await fetchAsset(previewUrl, '/ui/styles.css', args.timeout)
  assets.styles = summarizeAsset(styles, ['.feed-card', '.pool-meter', '.invite-panel', '.tester-output', '.tester-output-form', '@media'])
  record(checks, failures, 'previewStyleAsset', assets.styles.ok, assets.styles.message)

  const boot = await fetchAsset(previewUrl, '/app/boot-renderer.js', args.timeout)
  assets.boot = summarizeAsset(boot, ['matchdayMeshRuntime', 'matchdayAPI'])
  record(checks, failures, 'previewBootAsset', assets.boot.ok, assets.boot.message)

  return assets
}

async function fetchAsset (baseUrl, path, timeout) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(new URL(path, baseUrl), { signal: controller.signal })
    const text = await response.text()
    return {
      path,
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type') || '',
      bytes: Buffer.byteLength(text),
      text
    }
  } finally {
    clearTimeout(timer)
  }
}

function summarizeAsset (asset, requiredStrings) {
  const missing = requiredStrings.filter((value) => !asset.text.includes(value))
  return {
    path: asset.path,
    status: asset.status,
    contentType: asset.contentType,
    bytes: asset.bytes,
    ok: asset.ok && missing.length === 0,
    missing,
    message: !asset.ok
      ? `${asset.path} returned HTTP ${asset.status}`
      : missing.length > 0
          ? `${asset.path} is missing: ${missing.join(', ')}`
          : `${asset.path} served expected launch UI content`
  }
}

function verifyFrontendContracts (failures, checks) {
  const uiApp = readFileSync(join(root, 'ui/app.js'), 'utf8')
  const domain = readFileSync(join(root, 'app/domain.js'), 'utf8')
  const payments = readFileSync(join(root, 'app/payments.js'), 'utf8')
  const index = readFileSync(join(root, 'index.html'), 'utf8')
  const manifest = JSON.parse(readFileSync(join(root, 'scripts/app-manifest.json'), 'utf8'))
  const uiContracts = {
    launchCopy: hasAll(uiApp, ['PearBrowser launch build', 'Match Hubs', 'USDt Pool', 'P2P Invite', 'Module Status']),
    demoActions: hasAll(uiApp, ['data-action="scan-pass"', 'data-form="open-pool"', 'data-form="contribute"', 'data-action="export-invite"', 'data-action="join-replica"']),
    testerOutput: hasAll(uiApp, [
      'data-testid="tester-output"',
      'data-testid="tester-output-text"',
      'data-action="copy-output"',
      'data-action="clear-output"',
      'data-action="import-log"',
      'data-form="tester-output"',
      'Apply Import',
      'setTesterOutput',
      'parseOperationEnvelope',
      'operation-log-imported',
      'serializeOperations(operations)',
      'exportProofPack(state)'
    ]),
    honestTrackState: hasAll(uiApp, ['Corestore host', 'Preview']) &&
      domain.includes('disabled-until-local-sdk-proof') &&
      payments.includes('WDK-shaped demo receive path'),
    qrRender: uiApp.includes('Array.from({ length: 49 }'),
    indexModules: hasAll(index, ['./app/boot-renderer.js', './ui/app.js', './ui/styles.css']),
    manifestLinks: manifest.links?.pearRuntime === EXPECTED.pearLink &&
      manifest.links?.pearBrowserCatalog === EXPECTED.catalogRef &&
      manifest.links?.sourceRepo === EXPECTED.sourceRepo
  }

  for (const [key, value] of Object.entries(uiContracts)) {
    record(checks, failures, key, value === true, `frontend contract failed: ${key}`)
  }
  return uiContracts
}

function verifyDemoScenario (failures, checks) {
  const operations = createDemoOperations({ baseNow: '2026-06-30T00:00:00.000Z' })
  const state = replayOperations(operations)

  append(operations, state, OP_TYPES.SCAN_PASS, {
    passId: 'pass_ada',
    scannerName: 'Door 1'
  }, {
    opId: 'op_preview_smoke_scan_ada',
    actorId: 'scanner_door_1',
    now: '2026-06-30T00:03:00.000Z'
  })

  const receive = createPoolReceiveRequest({
    hubId: 'hub_final_night',
    title: 'Host snacks pool',
    targetAmount: 50
  }, {
    id: 'recv_preview_smoke_host_snacks',
    now: '2026-06-30T00:04:00.000Z'
  })

  const pool = append(operations, state, OP_TYPES.CREATE_POOL, {
    hubId: 'hub_final_night',
    actorName: 'Mina',
    title: 'Host snacks pool',
    targetAmount: 50,
    paymentMode: receive.mode,
    receiveRequestId: receive.id,
    receiveAddress: receive.receiveAddress
  }, {
    opId: 'op_preview_smoke_pool_open',
    actorId: 'host_mina',
    entityId: 'pool_preview_smoke_host_snacks',
    now: '2026-06-30T00:04:00.000Z'
  })

  const receipt = confirmDemoPoolContribution(pool, {
    actorName: 'Ada',
    amount: 5
  }, {
    id: 'demo_pay_preview_smoke_ada_5',
    now: '2026-06-30T00:05:00.000Z'
  })

  append(operations, state, OP_TYPES.RECORD_POOL_CONTRIBUTION, {
    poolId: pool.id,
    actorName: receipt.actorName,
    amount: receipt.amount,
    status: receipt.status,
    receipt: receipt.receipt
  }, {
    opId: 'op_preview_smoke_pool_ada_5',
    actorId: 'fan_ada',
    entityId: receipt.id,
    now: '2026-06-30T00:05:00.000Z'
  })

  const feed = listFeed(state, 'hub_final_night').slice().reverse()
  const status = moduleStatus(state)
  const paymentStatus = paymentModuleStatus(state)
  const poolTotal = Object.values(state.payments)
    .filter((payment) => payment.poolId === pool.id)
    .reduce((sum, payment) => sum + payment.amount, 0)
  const pass = state.passes.pass_ada
  const latestFeedCard = feed[0]
  const exportedLog = serializeOperations(operations)
  const importedOperations = parseOperationEnvelope(exportedLog)
  const importedState = replayOperations(importedOperations)
  const importedFeed = listFeed(importedState, 'hub_final_night').slice().reverse()

  const scenario = {
    operationCount: operations.length,
    feedCards: feed.length,
    latestFeedCard: {
      type: latestFeedCard?.type || null,
      actorName: latestFeedCard?.actorName || null,
      body: latestFeedCard?.body || null
    },
    accepted: Boolean(pass?.checkedInAt),
    poolTotal,
    poolTarget: pool.targetAmount,
    receiveAddress: pool.receiveAddress,
    status,
    paymentStatus,
    importLog: {
      operationCount: importedOperations.length,
      feedCards: importedFeed.length,
      latestFeedCard: importedFeed[0]?.type || null
    },
    visibleExpectations: {
      scanResult: pass?.checkedInAt ? 'Accepted' : 'Ready',
      poolMeter: `${poolTotal.toFixed(2)} ${pool.asset} / ${pool.targetAmount}`,
      paymentClaim: paymentStatus.claim,
      qrCells: 49
    }
  }

  record(checks, failures, 'previewScenarioOps', operations.length === 6, 'preview scenario should produce 6 operations')
  record(checks, failures, 'previewScenarioAccepted', scenario.accepted, 'Ada should be checked in')
  record(checks, failures, 'previewScenarioPoolTotal', poolTotal === 5, 'pool total should be 5 USDt')
  record(checks, failures, 'previewScenarioReceiveAddress', pool.receiveAddress.startsWith('demo-usdt://matchday-mesh/'), 'pool receive address should be demo-usdt URI')
  record(checks, failures, 'previewScenarioLatestFeed', latestFeedCard?.type === 'feed:pool-contribution' &&
    latestFeedCard?.body === 'Ada contributed 5 USDt.', 'latest feed card should be Ada pool contribution')
  record(checks, failures, 'previewScenarioStatus', status.pearsStack === 'op-log-ready' &&
    status.wdk === 'demo-ledger-active' &&
    status.qvac === 'disabled-until-local-sdk-proof' &&
    paymentStatus.claim === 'WDK-shaped demo receive path', 'module status should match launch claims')
  record(checks, failures, 'previewImportLogRoundTrip',
    importedOperations.length === operations.length &&
    importedFeed[0]?.type === 'feed:pool-contribution',
    'operation log export/import round trip should preserve latest feed card')

  return scenario
}

function append (operations, state, type, payload, opts) {
  const op = createOperation(type, payload, opts)
  const result = applyOperation(state, op)
  operations.push(op)
  return result
}

function hasAll (text, values) {
  return values.every((value) => text.includes(value))
}

function record (checks, failures, name, passed, message) {
  checks[name] = passed === true
  if (!checks[name]) failures.push(`${name}: ${message}`)
}

main().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
