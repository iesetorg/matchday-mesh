#!/usr/bin/env node
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(join(here, '..'))
const args = parseArgs(process.argv.slice(2))
const requestedPort = Number(args.port || process.env.PORT || 4173)
const host = args.host || '127.0.0.1'

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png'
}

async function main () {
  const server = createServer((req, res) => {
    const safePath = safeRequestPath(req.url || '/')
    const filePath = resolve(join(root, safePath))
    if (!filePath.startsWith(root)) return send(res, 403, 'Forbidden')

    const candidate = existsSync(filePath) && statSync(filePath).isDirectory()
      ? join(filePath, 'index.html')
      : filePath

    if (!existsSync(candidate)) return send(res, 404, 'Not found')
    res.writeHead(200, {
      'content-type': mime[extname(candidate)] || 'application/octet-stream',
      'cache-control': 'no-store'
    })
    createReadStream(candidate).pipe(res)
  })

  const port = await listenWithRetry(server, requestedPort, host)
  console.log(`Matchday Mesh preview: http://${host}:${port}/`)
}

function send (res, status, body) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(body)
}

function safeRequestPath (url) {
  const parsed = new URL(url, 'http://local')
  const pathname = decodeURIComponent(parsed.pathname)
  return normalize(pathname === '/' ? '/index.html' : pathname).replace(/^(\.\.[/\\])+/, '')
}

function listenWithRetry (server, port, host) {
  return new Promise((resolveListen, rejectListen) => {
    let candidate = port
    const tryListen = () => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && candidate < port + 20) {
          candidate += 1
          tryListen()
          return
        }
        rejectListen(err)
      })
      server.listen(candidate, host, () => resolveListen(candidate))
    }
    tryListen()
  })
}

function parseArgs (argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const [rawKey, rawValue] = arg.slice(2).split('=')
    if (rawValue !== undefined) {
      out[rawKey] = rawValue
      continue
    }
    out[rawKey] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
  }
  return out
}

main().catch((err) => {
  console.error(`preview failed: ${err.message}`)
  process.exit(1)
})
