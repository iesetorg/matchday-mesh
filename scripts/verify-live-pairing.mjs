#!/usr/bin/env node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createDemoOperations, createOperation, OP_TYPES } from '../app/ops.js'
import { createMatchdayApi } from '../app/runtime-api.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const defaultProofPath = join(root, 'docs/proof/matchday-live-pairing-2026-06-30.json')

const EXPECTED = {
  pearLink: 'pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy',
  catalogRef: 'hyperbee://0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f',
  sourceRepo: 'https://github.com/iesetorg/matchday-mesh'
}

const args = parseArgs(process.argv.slice(2))

function parseArgs (argv) {
  const parsed = {
    writePath: null,
    timeout: 45000
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--write') {
      const next = argv[i + 1]
      parsed.writePath = next && !next.startsWith('--')
        ? resolve(root, argv[++i])
        : defaultProofPath
    } else if (arg === '--timeout') {
      const value = Number(argv[++i])
      if (!Number.isSafeInteger(value) || value < 1000) usage('--timeout must be an integer >= 1000')
      parsed.timeout = value
    } else {
      usage(`unknown argument: ${arg}`)
    }
  }
  return parsed
}

function usage (message) {
  if (message) console.error(`error: ${message}`)
  console.error('usage: node scripts/verify-live-pairing.mjs [--write [path]] [--timeout ms]')
  process.exit(2)
}

async function main () {
  const hostDir = await mkdtemp(join(tmpdir(), 'matchday-mesh-live-host-'))
  const guestDir = await mkdtemp(join(tmpdir(), 'matchday-mesh-live-guest-'))
  const failures = []
  let hostApi
  let guestApi
  let proof = null

  try {
    hostApi = await createMatchdayApi(hostDir)
    guestApi = await createMatchdayApi(guestDir)

    await hostApi.resetOperations(createDemoOperations({ baseNow: '2026-06-29T20:00:00.000Z' }))
    const initialInvite = await hostApi.invite()
    const hostPairing = await hostApi.startPairingHost()
    const joined = await guestApi.joinReplica(initialInvite, { timeout: args.timeout })

    const liveOp = createOperation(OP_TYPES.POST_REACTION, {
      hubId: 'hub_final_night',
      actorName: 'Live Peer',
      body: 'Live Hyperswarm pairing carried this update.'
    }, {
      opId: 'op_live_hyperswarm_pairing',
      entityId: 'feed_live_hyperswarm_pairing',
      now: '2026-06-29T20:09:00.000Z'
    })
    await hostApi.appendOperation(liveOp)

    const refreshedInvite = await hostApi.invite()
    const refreshed = await guestApi.joinReplica(refreshedInvite, { timeout: args.timeout })

    const checks = {
      hostedTopic: hostPairing.status === 'hosting' &&
        hostPairing.descriptor?.topic === joined.descriptor?.topic,
      joinedReadOnlyReplica: joined.status === 'joined' &&
        joined.writable === false &&
        joined.operations === initialInvite.operations,
      liveAppendReplicated: refreshed.operations === refreshedInvite.operations &&
        refreshed.latestFeedCard?.body === liveOp.payload.body,
      pairingDescriptor: hostPairing.descriptor?.type === 'matchday-mesh-pairing-v1' &&
        hostPairing.descriptor?.transport === 'hyperswarm-topic' &&
        /^[0-9a-f]{64}$/.test(hostPairing.descriptor?.topic || '')
    }

    for (const [key, value] of Object.entries(checks)) {
      if (value !== true) failures.push(`${key}: failed`)
    }

    proof = {
      ok: failures.length === 0,
      capturedAt: new Date().toISOString(),
      app: {
        pearLink: EXPECTED.pearLink,
        catalog: EXPECTED.catalogRef,
        sourceRepo: EXPECTED.sourceRepo
      },
      transport: {
        type: 'hyperswarm',
        topic: hostPairing.descriptor.topic,
        shortTopic: hostPairing.descriptor.shortTopic,
        mode: hostPairing.descriptor.mode
      },
      host: {
        status: hostPairing.status,
        operationsBeforeAppend: initialInvite.operations,
        operationsAfterAppend: refreshedInvite.operations
      },
      replica: {
        status: refreshed.status,
        writable: refreshed.writable,
        operations: refreshed.operations,
        stateCounts: refreshed.stateCounts,
        latestFeedCard: refreshed.latestFeedCard
          ? {
              type: refreshed.latestFeedCard.type,
              body: refreshed.latestFeedCard.body,
              actorName: refreshed.latestFeedCard.actorName
            }
          : null
      },
      checks,
      failures
    }
  } catch (err) {
    failures.push(err.message)
    proof = {
      ok: false,
      capturedAt: new Date().toISOString(),
      app: {
        pearLink: EXPECTED.pearLink,
        catalog: EXPECTED.catalogRef,
        sourceRepo: EXPECTED.sourceRepo
      },
      error: err.message,
      failures
    }
  } finally {
    try { await guestApi?.close() } catch {}
    try { await hostApi?.close() } catch {}
    await rm(hostDir, { recursive: true, force: true })
    await rm(guestDir, { recursive: true, force: true })
  }

  if (args.writePath) {
    await writeFile(args.writePath, `${JSON.stringify(proof, null, 2)}\n`)
  }

  if (!proof.ok) {
    for (const message of proof.failures || []) console.error('FAIL:', message)
    if (args.writePath) console.error(`Wrote ${relative(root, args.writePath)}`)
    process.exit(1)
  }

  console.log('Matchday Mesh live pairing OK')
  console.log(`  topic: ${proof.transport.shortTopic}`)
  console.log(`  replica ops: ${proof.replica.operations}`)
  if (args.writePath) console.log(`  proof: ${relative(root, args.writePath)}`)
}

main().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
