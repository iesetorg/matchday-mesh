#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const defaultProofPath = join(root, 'docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.json')
const defaultImagePath = join(root, 'docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.png')
const defaultSvgPath = join(root, 'docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.svg')

const EXPECTED = {
  pearLink: 'pear://9a5qzrbaccfqsnwmaktb6irpe1mrapq37m9uxt1wzfq3nh3d8xfy',
  catalogRef: 'hyperbee://0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f',
  catalogKey: '0ba0bb63d4787c42b218c3c22f693f6aae64626dbc72a7cc52739f8c7d72fd0f',
  sourceRepo: 'https://github.com/iesetorg/matchday-mesh',
  sourceProof: 'docs/proof/pearbrowser-desktop-catalog-rpc-2026-06-30.json'
}

const args = parseArgs(process.argv.slice(2))

function parseArgs (argv) {
  const parsed = {
    write: false,
    proofPath: defaultProofPath,
    imagePath: defaultImagePath,
    svgPath: defaultSvgPath
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--write') {
      parsed.write = true
    } else if (arg === '--proof') {
      parsed.proofPath = resolve(root, argv[++i])
    } else if (arg === '--image') {
      parsed.imagePath = resolve(root, argv[++i])
    } else if (arg === '--svg') {
      parsed.svgPath = resolve(root, argv[++i])
    } else {
      usage(`unknown argument: ${arg}`)
    }
  }
  return parsed
}

function usage (message) {
  if (message) console.error(`error: ${message}`)
  console.error('usage: node scripts/verify-pearbrowser-catalog-visual.mjs [--write] [--proof path] [--image path] [--svg path]')
  process.exit(2)
}

async function main () {
  if (args.write) {
    await mkdir(dirname(args.proofPath), { recursive: true })
    await mkdir(dirname(args.imagePath), { recursive: true })
    await mkdir(dirname(args.svgPath), { recursive: true })
    const sourceProof = readJson(join(root, EXPECTED.sourceProof))
    const catalogManifest = readJson(join(root, 'catalog/matchday-mesh.catalog.json'))
    const svg = renderSvg(sourceProof, catalogManifest)
    writeFileSync(args.svgPath, svg)
    convertSvgToPng(args.svgPath, args.imagePath)
    const proof = buildProof(sourceProof, catalogManifest, inspectImage(args.imagePath), args.svgPath, args.imagePath)
    proof.ok = proof.failures.length === 0
    writeFileSync(args.proofPath, `${JSON.stringify(proof, null, 2)}\n`)
  }

  const proof = readJson(args.proofPath)
  const failures = validateProof(proof, inspectImage(args.imagePath), existsSync(args.svgPath))
  if (failures.length > 0) {
    for (const failure of failures) console.error('FAIL:', failure)
    process.exit(1)
  }

  console.log('Matchday Mesh PearBrowser catalog visual proof OK')
  console.log(`  catalog: ${EXPECTED.catalogRef}`)
  console.log(`  app: ${EXPECTED.pearLink}`)
  console.log(`  visual: ${displayPath(args.imagePath)} (${statSync(args.imagePath).size} bytes)`)
  if (args.write) console.log(`  proof: ${displayPath(args.proofPath)}`)
}

function buildProof (sourceProof, catalogManifest, image, svgPath, imagePath) {
  const failures = validateSource(sourceProof, catalogManifest)
  if (!image.png || image.bytes < 10_000) failures.push('visual PNG should be a valid proof image larger than 10 KB')

  const cupCatalog = loadedCupCatalog(sourceProof)
  return {
    ok: false,
    capturedAt: new Date().toISOString(),
    mode: 'rpc-proof-card',
    sourceProof: EXPECTED.sourceProof,
    app: {
      name: 'Matchday Mesh',
      pearLink: EXPECTED.pearLink,
      catalog: EXPECTED.catalogRef,
      sourceRepo: EXPECTED.sourceRepo
    },
    catalog: {
      name: cupCatalog?.name || null,
      keyHex: cupCatalog?.keyHex || null,
      apps: cupCatalog?.apps || 0,
      aggregatedApps: sourceProof.aggregatedApps || 0
    },
    pearBrowserRpc: {
      dhtConnected: sourceProof.pearBrowserRpc?.dhtConnected === true,
      peerCount: sourceProof.pearBrowserRpc?.peerCount || 0,
      hiveRelays: sourceProof.pearBrowserRpc?.hiveRelays || 0,
      storagePercent: sourceProof.pearBrowserRpc?.storagePercent ?? null
    },
    matchdayMesh: sourceProof.matchdayMesh || null,
    visualProof: {
      path: displayPath(imagePath),
      svgPath: displayPath(svgPath),
      bytes: image.bytes,
      png: image.png,
      note: 'Generated from live desktop PearBrowser diagnostic RPC proof; this is not an OS window screenshot.'
    },
    failures
  }
}

function validateSource (sourceProof, catalogManifest) {
  const failures = []
  const cupCatalog = loadedCupCatalog(sourceProof)
  const appRow = Array.isArray(catalogManifest.apps)
    ? catalogManifest.apps.find((entry) => entry?.id === 'matchday-mesh')
    : null

  if (sourceProof.ok !== true) failures.push('source PearBrowser RPC proof should be ok')
  if (sourceProof.pearBrowserRpc?.dhtConnected !== true) failures.push('PearBrowser RPC should be DHT-connected')
  if ((sourceProof.pearBrowserRpc?.peerCount || 0) < 1) failures.push('PearBrowser RPC proof should have peers')
  if ((sourceProof.pearBrowserRpc?.hiveRelays || 0) < 1) failures.push('PearBrowser RPC proof should have HiveRelays')
  if (!cupCatalog) failures.push('source proof should load the Tether Developers Cup catalog')
  if (cupCatalog && cupCatalog.apps < 1) failures.push('Tether Developers Cup catalog should include at least one app')
  if (sourceProof.matchdayMesh?.catalogKey !== EXPECTED.catalogKey) failures.push('source proof Matchday catalog key is stale')
  if (sourceProof.matchdayMesh?.pearLink !== EXPECTED.pearLink) failures.push('source proof Matchday pear link is stale')
  if (sourceProof.matchdayMesh?.sourceRepo !== EXPECTED.sourceRepo) failures.push('source proof Matchday source repo is stale')
  if (catalogManifest.name !== 'Tether Developers Cup Apps') failures.push('catalog manifest name is stale')
  if (appRow?.link !== EXPECTED.pearLink) failures.push('catalog manifest app link is stale')
  if (appRow?.sourceUrl !== EXPECTED.sourceRepo) failures.push('catalog manifest app source repo is stale')
  return failures
}

function validateProof (proof, image, hasSvg) {
  const failures = []
  if (proof.ok !== true) failures.push('visual proof should be ok')
  if (proof.mode !== 'rpc-proof-card') failures.push('visual proof mode should be rpc-proof-card')
  if (proof.sourceProof !== EXPECTED.sourceProof) failures.push('visual proof source proof is stale')
  if (proof.app?.pearLink !== EXPECTED.pearLink) failures.push('visual proof pear link is stale')
  if (proof.app?.catalog !== EXPECTED.catalogRef) failures.push('visual proof catalog ref is stale')
  if (proof.app?.sourceRepo !== EXPECTED.sourceRepo) failures.push('visual proof source repo is stale')
  if (proof.catalog?.keyHex !== EXPECTED.catalogKey) failures.push('visual proof catalog key is stale')
  if (proof.catalog?.name !== 'Tether Developers Cup Apps') failures.push('visual proof catalog name is stale')
  if ((proof.catalog?.apps || 0) < 1) failures.push('visual proof catalog should include an app')
  if (proof.pearBrowserRpc?.dhtConnected !== true) failures.push('visual proof should preserve DHT-connected state')
  if ((proof.pearBrowserRpc?.peerCount || 0) < 1) failures.push('visual proof should preserve peer count')
  if ((proof.pearBrowserRpc?.hiveRelays || 0) < 1) failures.push('visual proof should preserve HiveRelay count')
  if (proof.matchdayMesh?.pearLink !== EXPECTED.pearLink) failures.push('visual proof Matchday row pear link is stale')
  if (proof.visualProof?.path !== 'docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.png') {
    failures.push('visual proof PNG path is stale')
  }
  if (proof.visualProof?.svgPath !== 'docs/proof/pearbrowser-catalog-visual-proof-2026-06-30.svg') {
    failures.push('visual proof SVG path is stale')
  }
  if (!hasSvg) failures.push('visual proof SVG source is missing')
  if (!image.png) failures.push('visual proof PNG is invalid')
  if (image.bytes < 10_000) failures.push('visual proof PNG is unexpectedly small')
  if (proof.visualProof?.bytes !== image.bytes) failures.push('visual proof PNG byte count is stale')
  return failures
}

function loadedCupCatalog (sourceProof) {
  return Array.isArray(sourceProof.loadedCatalogues)
    ? sourceProof.loadedCatalogues.find((entry) => entry?.keyHex === EXPECTED.catalogKey)
    : null
}

function renderSvg (sourceProof, catalogManifest) {
  const cupCatalog = loadedCupCatalog(sourceProof) || {}
  const app = Array.isArray(catalogManifest.apps)
    ? catalogManifest.apps.find((entry) => entry?.id === 'matchday-mesh') || {}
    : {}
  const description = app.description || 'Serverless football watch parties with P2P fan passes, check-ins, predictions, and USDt pool cards.'
  const descriptionLines = wrapText(description, 58).slice(0, 2)
  const badges = [
    ['DHT', sourceProof.pearBrowserRpc?.dhtConnected ? 'connected' : 'offline'],
    ['Peers', String(sourceProof.pearBrowserRpc?.peerCount || 0)],
    ['HiveRelays', String(sourceProof.pearBrowserRpc?.hiveRelays || 0)],
    ['Catalog apps', String(cupCatalog.apps || 0)],
    ['All apps', String(sourceProof.aggregatedApps || 0)]
  ]

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#101211"/>
      <stop offset="55%" stop-color="#151a18"/>
      <stop offset="100%" stop-color="#0c0f0e"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="1440" height="900" fill="url(#bg)"/>
  <rect x="48" y="48" width="1344" height="804" rx="28" fill="#151b18" stroke="#344437" stroke-width="2"/>
  <text x="88" y="112" fill="#e7c35a" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" letter-spacing="4">PEARBROWSER CATALOG PROOF</text>
  <text x="88" y="168" fill="#f2f5ef" font-family="Inter, Arial, sans-serif" font-size="58" font-weight="850">Matchday Mesh is listed</text>
  <text x="88" y="212" fill="#aeb9ae" font-family="Inter, Arial, sans-serif" font-size="24">Generated from live desktop PearBrowser diagnostic RPC, not an OS screenshot.</text>

  <g filter="url(#shadow)">
    <rect x="88" y="270" width="820" height="336" rx="22" fill="#202820" stroke="#39c56b" stroke-width="2"/>
    <text x="128" y="326" fill="#b8f3c4" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="800">${escapeXml(cupCatalog.name || 'Tether Developers Cup Apps')}</text>
    <text x="128" y="386" fill="#f2f5ef" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="850">Matchday Mesh</text>
    ${descriptionLines.map((line, index) => `<text x="128" y="${434 + (index * 32)}" fill="#dbe6db" font-family="Inter, Arial, sans-serif" font-size="23">${escapeXml(line)}</text>`).join('\n    ')}
    <text x="128" y="512" fill="#aeb9ae" font-family="Menlo, Consolas, monospace" font-size="19">${escapeXml(EXPECTED.pearLink)}</text>
    <text x="128" y="552" fill="#aeb9ae" font-family="Menlo, Consolas, monospace" font-size="19">${escapeXml(EXPECTED.sourceRepo)}</text>
    <rect x="128" y="558" width="166" height="38" rx="19" fill="#39c56b"/>
    <text x="153" y="583" fill="#07110a" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="850">Pears Stack</text>
    <rect x="312" y="558" width="164" height="38" rx="19" fill="#e7c35a"/>
    <text x="337" y="583" fill="#11120c" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="850">Football</text>
    <rect x="494" y="558" width="154" height="38" rx="19" fill="#ff7a59"/>
    <text x="518" y="583" fill="#120906" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="850">USDt demo</text>
  </g>

  <g filter="url(#shadow)">
    <rect x="956" y="270" width="348" height="336" rx="22" fill="#111613" stroke="#314035" stroke-width="2"/>
    ${badges.map(([label, value], index) => badgeSvg(label, value, 996, 322 + (index * 54))).join('\n    ')}
  </g>

  <text x="88" y="684" fill="#e7c35a" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="800">Catalog</text>
  <text x="88" y="724" fill="#aeb9ae" font-family="Menlo, Consolas, monospace" font-size="20">${escapeXml(EXPECTED.catalogRef)}</text>
  <text x="88" y="780" fill="#e7c35a" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="800">Source proof</text>
  <text x="88" y="820" fill="#aeb9ae" font-family="Menlo, Consolas, monospace" font-size="20">${escapeXml(EXPECTED.sourceProof)}</text>
  <text x="1038" y="820" fill="#aeb9ae" font-family="Inter, Arial, sans-serif" font-size="18">Captured ${escapeXml(sourceProof.capturedAt || '')}</text>
</svg>
`
}

function badgeSvg (label, value, x, y) {
  return `<g>
      <text x="${x}" y="${y}" fill="#aeb9ae" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700">${escapeXml(label)}</text>
      <text x="${x + 160}" y="${y}" fill="#f2f5ef" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="850">${escapeXml(value)}</text>
      <line x1="${x}" y1="${y + 18}" x2="${x + 268}" y2="${y + 18}" stroke="#314035" stroke-width="1"/>
    </g>`
}

function convertSvgToPng (svgPath, imagePath) {
  try {
    execFileSync('sips', ['-s', 'format', 'png', svgPath, '--out', imagePath], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (err) {
    const message = err.stderr?.toString()?.trim() || err.message
    const tempSvg = join(tmpdir(), `matchday-catalog-visual-${process.pid}.svg`)
    writeFileSync(tempSvg, readFileSync(svgPath))
    throw new Error(`Could not convert SVG to PNG with sips: ${message}. SVG copy: ${tempSvg}`)
  }
}

function inspectImage (path) {
  if (!existsSync(path)) return { png: false, bytes: 0 }
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
  return { png, bytes: statSync(path).size }
}

function readJson (path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function escapeXml (value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function wrapText (value, limit) {
  const words = String(value || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > limit && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function displayPath (path) {
  const rel = relative(root, path)
  return rel && !rel.startsWith('..') && !rel.startsWith('/')
    ? rel
    : path
}

main().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
