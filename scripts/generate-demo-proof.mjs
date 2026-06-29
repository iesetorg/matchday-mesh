#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  exportProofPack,
  moduleStatus
} from '../app/domain.js'
import {
  applyOperation,
  createDemoOperations,
  createOperation,
  OP_TYPES,
  replayOperations
} from '../app/ops.js'
import {
  confirmDemoPoolContribution,
  createPoolReceiveRequest,
  paymentModuleStatus
} from '../app/payments.js'
import {
  createMatchdayInvite,
  summarizeMatchdayInvite
} from '../app/invite.js'
import {
  createMatchdayPairingDescriptor
} from '../app/pears-sync.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const proofPath = join(root, 'docs/proof/matchday-demo-flow-proof-2026-06-30.json')
const checkMode = process.argv.includes('--check')
const generatedAt = '2026-06-30T00:00:00.000Z'
const baseNow = '2026-06-29T20:00:00.000Z'

function readJson (relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'))
}

function minute (offset) {
  return new Date(Date.parse(baseNow) + offset * 60 * 1000).toISOString()
}

function buildProof () {
  const manifest = readJson('scripts/app-manifest.json')
  const releaseProof = readJson('docs/proof/pear-release-renderer-proof-2026-06-30.json')
  const catalog = readJson('catalog/matchday-mesh.catalog.json')
  const ops = createDemoOperations({ baseNow })
  const state = replayOperations(ops)

  const append = (type, payload, opts = {}) => {
    const op = createOperation(type, payload, opts)
    ops.push(op)
    return applyOperation(state, op)
  }

  append(OP_TYPES.SCAN_PASS, {
    passId: 'pass_ada',
    scannerName: 'Door Lead'
  }, {
    opId: 'op_demo_scan_ada',
    actorId: 'door_lead',
    now: minute(3)
  })

  append(OP_TYPES.POST_PREDICTION, {
    hubId: 'hub_final_night',
    actorName: 'Sam',
    writerId: 'fan_sam',
    homeScore: 2,
    awayScore: 1,
    winner: 'Pear FC',
    note: 'Fast first half decides it.'
  }, {
    opId: 'op_demo_prediction_sam',
    entityId: 'pred_demo_sam',
    actorId: 'fan_sam',
    feedId: 'feed_demo_prediction_sam',
    now: minute(4)
  })

  append(OP_TYPES.POST_REACTION, {
    hubId: 'hub_final_night',
    actorName: 'Mina',
    writerId: 'host_mina',
    body: 'Pressure is rising. Keep the line moving at gate A.'
  }, {
    opId: 'op_demo_reaction_press',
    actorId: 'host_mina',
    feedId: 'feed_demo_reaction_press',
    now: minute(5)
  })

  const receiveRequest = createPoolReceiveRequest({
    hubId: 'hub_final_night',
    title: 'Host snacks pool',
    asset: 'USDt',
    targetAmount: 50
  }, {
    id: 'recv_demo_host_snacks',
    now: minute(6)
  })

  const pool = append(OP_TYPES.CREATE_POOL, {
    hubId: 'hub_final_night',
    title: 'Host snacks pool',
    actorName: 'Mina',
    asset: receiveRequest.asset,
    targetAmount: receiveRequest.targetAmount,
    paymentMode: receiveRequest.mode,
    receiveRequestId: receiveRequest.id,
    receiveAddress: receiveRequest.receiveAddress
  }, {
    opId: 'op_demo_pool_open',
    entityId: 'pool_demo_host_snacks',
    actorId: 'host_mina',
    feedId: 'feed_demo_pool_open',
    now: minute(6)
  })

  const receipt = confirmDemoPoolContribution(pool, {
    actorName: 'Ada',
    amount: 5
  }, {
    id: 'demo_pay_ada_5',
    now: minute(7)
  })

  append(OP_TYPES.RECORD_POOL_CONTRIBUTION, {
    poolId: pool.id,
    actorName: receipt.actorName,
    amount: receipt.amount,
    status: receipt.status,
    receipt: receipt.receipt
  }, {
    opId: 'op_demo_pool_ada_5',
    entityId: receipt.id,
    actorId: 'fan_ada',
    feedId: 'feed_demo_pool_ada_5',
    now: minute(7)
  })

  const replayed = replayOperations(ops)
  const status = moduleStatus(replayed)
  const payments = paymentModuleStatus(replayed)
  const proofPack = exportProofPack(replayed)
  proofPack.generatedAt = generatedAt

  const invite = createMatchdayInvite({
    coreName: releaseProof.coreName,
    key: releaseProof.key,
    discoveryKey: releaseProof.discoveryKey,
    operations: releaseProof.operationCount
  }, {
    createdAt: '2026-06-29T22:31:26.391Z'
  })
  const inviteSummary = summarizeMatchdayInvite(invite)
  const pairing = createMatchdayPairingDescriptor(invite)
  const latestFeedCard = replayed.feed[replayed.feed.length - 1]
  const passAda = replayed.passes.pass_ada
  const poolValues = Object.values(replayed.pools)
  const paymentValues = Object.values(replayed.payments)
  const catalogApp = Array.isArray(catalog.apps)
    ? catalog.apps.find((entry) => entry?.id === 'matchday-mesh')
    : null

  const checks = {
    hasPearsStackOps: status.pearsStack === 'op-log-ready' && status.opLog === ops.length,
    hasInviteHandoff: inviteSummary.type === 'matchday-mesh-core-invite-v1' &&
      inviteSummary.writable === false &&
      inviteSummary.operations === releaseProof.operationCount,
    hasPairingTopic: pairing.type === 'matchday-mesh-pairing-v1' &&
      pairing.transport === 'hyperswarm-topic' &&
      /^[0-9a-f]{64}$/.test(pairing.topic),
    hasUsdTPool: poolValues.some((entry) => entry.asset === 'USDt' &&
      entry.targetAmount === 50 &&
      entry.paymentMode === 'demo-ledger') &&
      payments.demoPools === 1,
    hasDoorCheckin: Boolean(passAda?.checkedInAt && passAda.checkedInBy === 'Door Lead'),
    hasFeedContribution: replayed.feed.some((card) => card.type === 'feed:pool-contribution' &&
      card.body === 'Ada contributed 5 USDt.')
  }

  return {
    generatedAt,
    app: {
      id: manifest.appId,
      name: manifest.name,
      version: manifest.version,
      pearLink: manifest.links?.pearRuntime,
      catalog: manifest.links?.pearBrowserCatalog,
      sourceRepo: manifest.links?.sourceRepo
    },
    scenario: {
      name: 'Final Night Fan Zone',
      baseNow,
      operationCount: ops.length,
      feedCards: replayed.feed.length,
      hubIds: Object.keys(replayed.hubs),
      latestFeedCard: {
        type: latestFeedCard?.type,
        body: latestFeedCard?.body,
        refs: latestFeedCard?.refs
      },
      checkedInPasses: Object.values(replayed.passes).filter((entry) => entry.checkedInAt).length,
      poolCount: poolValues.length,
      paymentCount: paymentValues.length
    },
    status,
    payments,
    invite: inviteSummary,
    pairing,
    release: {
      pearRelease: releaseProof.release,
      pearLength: releaseProof.length,
      backendLabel: releaseProof.backendLabel,
      coreName: releaseProof.coreName,
      operationCount: releaseProof.operationCount
    },
    catalog: {
      name: catalog.name,
      appCount: Array.isArray(catalog.apps) ? catalog.apps.length : 0,
      includesMatchdayMesh: Boolean(catalogApp),
      sourceUrl: catalogApp?.sourceUrl || null
    },
    proofPack,
    checks
  }
}

function render () {
  return `${JSON.stringify(buildProof(), null, 2)}\n`
}

if (checkMode) {
  if (!existsSync(proofPath)) {
    console.error(`Demo proof is missing: ${relative(root, proofPath)}`)
    process.exit(1)
  }
  const expected = render()
  const current = readFileSync(proofPath, 'utf8')
  if (current !== expected) {
    console.error(`Demo proof is stale: ${relative(root, proofPath)}`)
    console.error('Run: npm run generate:demo-proof')
    process.exit(1)
  }
  console.log(`Demo flow proof OK: ${relative(root, proofPath)}`)
} else {
  writeFileSync(proofPath, render())
  console.log(`Wrote ${relative(root, proofPath)}`)
}
