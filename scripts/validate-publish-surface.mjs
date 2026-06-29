#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const failures = []
const warnings = []
const strictRelease = process.argv.includes('--strict-release')

function fail (message) { failures.push(message) }
function warn (message) { warnings.push(message) }

function hasPath (relativePath) {
  return existsSync(join(root, relativePath))
}

function readJson (relativePath) {
  try {
    return JSON.parse(readFileSync(join(root, relativePath), 'utf8'))
  } catch (err) {
    fail(`${relativePath} is not valid JSON: ${err.message}`)
    return null
  }
}

function readText (relativePath) {
  try {
    return readFileSync(join(root, relativePath), 'utf8')
  } catch (err) {
    fail(`${relativePath} is not readable: ${err.message}`)
    return ''
  }
}

function isPearLink (value) {
  return typeof value === 'string' && /^pear:\/\/[a-z0-9]+/i.test(value)
}

const pkg = readJson('package.json')
const lock = readJson('package-lock.json')
const manifest = readJson('manifest.json')
const catalog = readJson('scripts/app-manifest.json')
const pearBrowserCatalog = readJson('catalog/matchday-mesh.catalog.json')
const readme = readText('README.md')
const submission = readText('SUBMISSION.md')
const priorWork = readText('PRIOR_WORK.md')

for (const filePath of [
  'index.html',
  'index.cjs',
  'package-lock.json',
  'ui/app.js',
  'ui/styles.css',
  'app/boot-renderer.js',
  'app/domain.js',
  'app/invite.js',
  'app/ops.js',
  'app/payments.js',
  'app/pears-store.js',
  'app/pears-sync.js',
  'app/runtime-api.js',
  'assets/icon.svg',
  'catalog/matchday-mesh.catalog.json',
  'docs/ARCHITECTURE.md',
  'docs/DEMO_SCRIPT.md',
  'docs/RISK_LEDGER.md',
  'LICENSE'
]) {
  if (!hasPath(filePath)) fail(`publish surface missing ${filePath}`)
}

if (pkg) {
  if (pkg.name !== 'matchday-mesh') fail('package.json name must be matchday-mesh')
  if (pkg.license !== 'MIT') fail('package.json license must be MIT')
  if (pkg.main !== 'index.cjs') fail('package.json main must be index.cjs for current Pear runtime')
  if (pkg.pear?.pre !== 'pear-electron/pre') fail('package.json pear.pre must be pear-electron/pre')
  if (pkg.pear?.gui?.main !== 'index.html') fail('package.json pear.gui.main must be index.html')
  if (!pkg.dependencies?.['pear-electron']) fail('package.json must depend on pear-electron')
  if (!pkg.dependencies?.['pear-bridge']) fail('package.json must depend on pear-bridge')
  if (!pkg.dependencies?.corestore) fail('package.json must depend on corestore')
  if (!pkg.dependencies?.hyperbee) fail('package.json must depend on hyperbee')
  if (!pkg.dependencies?.hyperswarm) fail('package.json must depend on hyperswarm')
  if (!pkg.dependencies?.b4a) fail('package.json must depend on b4a')
  const scripts = pkg.scripts || {}
  for (const scriptName of ['dev', 'preview', 'test', 'validate:publish', 'stage', 'release', 'seed']) {
    if (!scripts[scriptName]) fail(`package.json missing script: ${scriptName}`)
  }
  for (const scriptName of ['stage', 'release', 'seed']) {
    if (!String(scripts[scriptName]).includes('$PEAR_LINK')) {
      fail(`package.json ${scriptName} should use PEAR_LINK`)
    }
  }
}

if (lock) {
  if (lock.name !== 'matchday-mesh') fail('package-lock.json name must be matchday-mesh')
  if (pkg && lock.version !== pkg.version) fail('package-lock.json version must match package.json')
  if (lock.lockfileVersion !== 3) fail('package-lock.json must use lockfileVersion 3')
}

if (manifest) {
  if (manifest.name !== 'Matchday Mesh') fail('manifest.json name must be Matchday Mesh')
  if (manifest.entry !== '/index.html') fail('manifest.json entry must be /index.html')
  if (manifest.icon !== '/assets/icon.svg') fail('manifest.json icon must be /assets/icon.svg')
}

if (catalog) {
  if (catalog.appId !== 'matchday-mesh') fail('scripts/app-manifest.json appId must be matchday-mesh')
  if (!catalog.name || !catalog.version || !catalog.description) {
    fail('scripts/app-manifest.json needs name, version, and description')
  }
  if (catalog.icon !== '/assets/icon.svg') fail('catalog icon must be /assets/icon.svg')
  if (!catalog.runtimes?.['pear-browser']?.supported) {
    fail('catalog manifest must advertise PearBrowser support')
  }
  if (!Array.isArray(catalog.categories) || !catalog.categories.includes('football')) {
    fail('catalog manifest must include football category')
  }

  const runtimeLink = catalog.links?.pearRuntime
  if (strictRelease && !isPearLink(runtimeLink)) {
    fail('strict release requires links.pearRuntime to be a pear:// link')
  } else if (!runtimeLink) {
    warn('links.pearRuntime is not set yet; fill this after Pear release')
  }
  if (!catalog.links?.sourceRepo) {
    warn('links.sourceRepo is not set yet; fill this before DoraHacks submission')
  }
  if (strictRelease && !/^hyperbee:\/\/[0-9a-f]{64}$/i.test(catalog.links?.pearBrowserCatalog || '')) {
    fail('strict release requires links.pearBrowserCatalog to be a hyperbee:// catalog key')
  }
}

if (pearBrowserCatalog) {
  const apps = Array.isArray(pearBrowserCatalog.apps) ? pearBrowserCatalog.apps : []
  const app = apps.find(entry => entry && entry.id === 'matchday-mesh')
  if (!app) fail('catalog/matchday-mesh.catalog.json must include matchday-mesh')
  if (app && !isPearLink(app.link)) fail('PearBrowser catalog entry must link to the released pear:// app')
  if (app && app.sourceUrl !== 'https://github.com/iesetorg/matchday-mesh') {
    fail('PearBrowser catalog entry must include the public source repo URL')
  }
}

if (!readme.includes('PearBrowser') || !readme.includes('Pears Stack')) {
  fail('README.md should explain PearBrowser and Pears Stack readiness')
}
const indexHtml = readText('index.html')
if (!indexHtml.includes('./app/boot-renderer.js') || !indexHtml.includes('./ui/app.js')) {
  fail('index.html should load the Pear runtime boot script before the UI module')
}
if (!submission.includes('Pears Stack') || !submission.includes('football')) {
  fail('SUBMISSION.md should state the football theme and Pears Stack track')
}
if (!priorWork.includes('Pear Tickets') || !priorWork.includes('Pear POS')) {
  fail('PRIOR_WORK.md should disclose Pear Tickets and Pear POS reuse plan')
}

for (const message of warnings) console.warn('WARN:', message)
if (failures.length > 0) {
  for (const message of failures) console.error('FAIL:', message)
  process.exit(1)
}

console.log(`Matchday Mesh publish surface OK (${warnings.length} warning${warnings.length === 1 ? '' : 's'})`)
