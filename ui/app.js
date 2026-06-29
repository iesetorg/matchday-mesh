import {
  exportProofPack,
  listFeed,
  moduleStatus,
} from '../app/domain.js'
import {
  applyOperation,
  createDemoOperations,
  createOperation,
  OP_TYPES,
  replayOperations,
  serializeOperations
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

const OPS_STORAGE_KEY = 'matchday-mesh:ops:v1'
const root = document.querySelector('#app')
const backend = await createOperationBackend()
let backendStatus = await backend.status()
let operations = await backend.loadOperations()
let state = replaySafe(operations)
let selectedHubId = Object.keys(state.hubs)[0] || null
let selectedPassId = Object.keys(state.passes)[0] || null
let inviteDraft = ''
let inviteInspection = null

if (!selectedHubId) await seedDemo()
render()
await writeRuntimeProof('ui-ready')

async function seedDemo () {
  operations = createDemoOperations()
  await backend.resetOperations(operations)
  operations = await backend.loadOperations()
  state = replaySafe(operations)
  selectedHubId = 'hub_final_night'
  selectedPassId = 'pass_ada'
  await refreshBackendStatus()
  await writeRuntimeProof('demo-seeded')
}

function render () {
  const hub = selectedHubId ? state.hubs[selectedHubId] : null
  root.innerHTML = `
    <header class="topbar">
      <div>
        <p class="eyebrow">PearBrowser launch build</p>
        <h1>Matchday Mesh</h1>
      </div>
      <div class="status-strip">
        ${statusBadge('Pears', backendStatus.source === 'pears-store' ? 'corestore' : 'preview')}
        ${statusBadge('WDK', moduleStatus(state).wdk === 'demo-ledger-active' ? 'demo' : 'idle')}
        ${statusBadge('QVAC', 'gated')}
      </div>
    </header>

    <main class="workspace">
      <aside class="sidebar">
        ${renderHubList()}
        ${renderCreateHub()}
      </aside>

      <section class="stage">
        ${hub ? renderHub(hub) : '<section class="empty">Create a match hub to begin.</section>'}
      </section>
    </main>
  `
  bindActions()
}

function renderHubList () {
  const hubs = Object.values(state.hubs)
  return `
    <section class="panel">
      <div class="panel-heading">
        <h2>Match Hubs</h2>
        <button class="icon-button" data-action="reset" title="Reset demo">Reset</button>
      </div>
      <div class="hub-list">
        ${hubs.map((hub) => `
          <button class="hub-row ${hub.id === selectedHubId ? 'active' : ''}" data-action="select-hub" data-hub-id="${escapeAttr(hub.id)}">
            <span>${escapeHtml(hub.title)}</span>
            <small>${escapeHtml(hub.homeTeam)} vs ${escapeHtml(hub.awayTeam)}</small>
          </button>
        `).join('')}
      </div>
    </section>
  `
}

function renderCreateHub () {
  return `
    <section class="panel">
      <h2>Create Hub</h2>
      <form data-form="create-hub" class="stack-form">
        <label>Title <input name="title" value="Semi-Final Watch Room"></label>
        <label>Home <input name="homeTeam" value="Pear FC"></label>
        <label>Away <input name="awayTeam" value="Mesh City"></label>
        <label>Venue <input name="venue" value="Cafe 64"></label>
        <button type="submit">Create</button>
      </form>
    </section>
  `
}

function renderHub (hub) {
  return `
    <section class="match-hero">
      <div>
        <p class="eyebrow">Invite ${escapeHtml(hub.inviteCode)}</p>
        <h2>${escapeHtml(hub.title)}</h2>
        <p>${escapeHtml(hub.homeTeam)} vs ${escapeHtml(hub.awayTeam)} at ${escapeHtml(hub.venue)}</p>
      </div>
      <div class="hero-actions">
        <button data-action="export-log">Export Log</button>
        <button data-action="proof">Proof</button>
      </div>
    </section>

    <div class="grid">
      <section class="panel">
        <h2>Fan Pass</h2>
        ${renderPassPanel(hub)}
      </section>
      <section class="panel">
        <h2>Door Scan</h2>
        ${renderScanPanel(hub)}
      </section>
      <section class="panel wide">
        <h2>Watch-Party Feed</h2>
        ${renderFeedComposer(hub)}
        ${renderFeed(hub)}
      </section>
      <section class="panel">
        <h2>USDt Pool</h2>
        ${renderPool(hub)}
      </section>
      <section class="panel">
        <h2>P2P Invite</h2>
        ${renderP2PInvite()}
      </section>
      <section class="panel">
        <h2>Module Status</h2>
        ${renderStatusPanel()}
      </section>
    </div>
  `
}

function renderPassPanel (hub) {
  const passes = Object.values(state.passes).filter((pass) => pass.hubId === hub.id)
  const pass = selectedPassId && state.passes[selectedPassId]?.hubId === hub.id
    ? state.passes[selectedPassId]
    : passes[0]
  if (pass && pass.id !== selectedPassId) selectedPassId = pass.id

  return `
    <form data-form="claim-pass" class="inline-form">
      <input name="displayName" placeholder="Fan name" value="Sam">
      <button type="submit">Claim</button>
    </form>
    ${pass ? `
      <div class="pass-preview">
        <div>
          <p class="eyebrow">Fan pass</p>
          <strong>${escapeHtml(pass.displayName)}</strong>
          <small>${pass.checkedInAt ? 'Checked in' : 'Not checked in'}</small>
        </div>
        ${renderQr(pass.qrPayload)}
      </div>
      <select data-action="select-pass">
        ${passes.map((candidate) => `
          <option value="${escapeAttr(candidate.id)}" ${candidate.id === pass.id ? 'selected' : ''}>${escapeHtml(candidate.displayName)}</option>
        `).join('')}
      </select>
    ` : '<p class="muted">No passes yet.</p>'}
  `
}

function renderScanPanel () {
  const pass = selectedPassId ? state.passes[selectedPassId] : null
  return `
    ${pass ? `
      <div class="scan-target">
        <span>${escapeHtml(pass.displayName)}</span>
        <strong>${pass.checkedInAt ? 'Accepted' : 'Ready'}</strong>
      </div>
      <button data-action="scan-pass" ${pass.checkedInAt ? 'disabled' : ''}>Scan Pass</button>
    ` : '<p class="muted">Claim a pass first.</p>'}
  `
}

function renderFeedComposer (hub) {
  return `
    <div class="composer-grid">
      <form data-form="prediction" class="stack-form compact">
        <div class="score-row">
          <input name="actorName" placeholder="Fan" value="Sam">
          <input name="homeScore" type="number" min="0" max="99" value="2">
          <input name="awayScore" type="number" min="0" max="99" value="1">
        </div>
        <button type="submit">Post Prediction</button>
      </form>
      <form data-form="reaction" class="stack-form compact">
        <input name="actorName" placeholder="Fan" value="Mina">
        <input name="body" placeholder="Feed note" value="${escapeAttr(`${hub.homeTeam} pressing high early.`)}">
        <button type="submit">Post Note</button>
      </form>
    </div>
  `
}

function renderFeed (hub) {
  const feed = listFeed(state, hub.id).slice().reverse()
  return `
    <div class="feed-list">
      ${feed.map((card) => `
        <article class="feed-card">
          <span>${escapeHtml(card.type.replace('feed:', ''))}</span>
          <strong>${escapeHtml(card.actorName)}</strong>
          <p>${escapeHtml(card.body)}</p>
          <small>${new Date(card.createdAt).toLocaleString()}</small>
        </article>
      `).join('')}
    </div>
  `
}

function renderPool (hub) {
  const pool = Object.values(state.pools).find((candidate) => candidate.hubId === hub.id)
  if (!pool) {
    return `
      <form data-form="open-pool" class="stack-form">
        <label>Pool <input name="title" value="Host snacks pool"></label>
        <label>Target <input name="targetAmount" type="number" min="1" value="50"></label>
        <button type="submit">Open Pool</button>
      </form>
    `
  }
  const contributions = Object.values(state.payments).filter((payment) => payment.poolId === pool.id)
  const total = contributions.reduce((sum, payment) => sum + payment.amount, 0)
  return `
    <div class="pool-meter">
      <p class="eyebrow">${escapeHtml(pool.paymentMode)}</p>
      <strong>${escapeHtml(pool.title)}</strong>
      <span>${total.toFixed(2)} ${escapeHtml(pool.asset)}${pool.targetAmount ? ` / ${pool.targetAmount}` : ''}</span>
      <small>${escapeHtml(pool.receiveAddress || 'receive request pending')}</small>
      ${pool.receiveAddress ? renderQr(pool.receiveAddress) : ''}
    </div>
    <form data-form="contribute" class="inline-form">
      <input name="actorName" value="Ada" placeholder="Fan">
      <input name="amount" type="number" min="1" step="0.5" value="5">
      <button type="submit">Add</button>
    </form>
  `
}

function renderStatusPanel () {
  const status = moduleStatus(state)
  const paymentStatus = paymentModuleStatus(state)
  return `
    <dl class="status-list">
      <div><dt>backend</dt><dd>${escapeHtml(backendStatus.label)}</dd></div>
      <div><dt>backendOps</dt><dd>${escapeHtml(String(backendStatus.operations))}</dd></div>
      <div><dt>backendKey</dt><dd>${escapeHtml(shortValue(backendStatus.key || 'preview'))}</dd></div>
      ${Object.entries(status).map(([key, value]) => `
        <div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd></div>
      `).join('')}
      <div><dt>paymentClaim</dt><dd>${escapeHtml(paymentStatus.claim)}</dd></div>
    </dl>
  `
}

function renderP2PInvite () {
  const isPear = backendStatus.source === 'pears-store'
  return `
    <div class="invite-panel">
      <div class="invite-row">
        <span>Mode</span>
        <strong>${escapeHtml(isPear ? 'Corestore host' : 'Preview')}</strong>
      </div>
      <div class="invite-row">
        <span>Core</span>
        <code title="${escapeAttr(backendStatus.key || '')}">${escapeHtml(shortValue(backendStatus.key || 'Launch in Pear'))}</code>
      </div>
      <div class="invite-row">
        <span>Ops</span>
        <strong>${escapeHtml(String(backendStatus.operations))}</strong>
      </div>
      <button data-action="export-invite" ${isPear ? '' : 'disabled'}>Export Invite</button>
      <form data-form="inspect-invite" class="invite-inspector">
        <textarea name="invite" rows="5" placeholder="Invite JSON">${escapeHtml(inviteDraft)}</textarea>
        <button type="submit">Inspect Invite</button>
      </form>
      ${renderInviteInspection()}
    </div>
  `
}

function renderInviteInspection () {
  if (!inviteInspection) return ''
  if (inviteInspection.error) {
    return `<div class="invite-result error">${escapeHtml(inviteInspection.error)}</div>`
  }
  const summary = inviteInspection.summary
  const pairing = inviteInspection.pairing
  return `
    ${inviteInspection.message ? `<div class="invite-result">${escapeHtml(inviteInspection.message)}</div>` : ''}
    <dl class="invite-summary">
      <div><dt>type</dt><dd>${escapeHtml(summary.type)}</dd></div>
      <div><dt>core</dt><dd title="${escapeAttr(summary.key)}">${escapeHtml(summary.shortKey)}</dd></div>
      <div><dt>discovery</dt><dd title="${escapeAttr(summary.discoveryKey)}">${escapeHtml(summary.shortDiscoveryKey)}</dd></div>
      <div><dt>ops</dt><dd>${escapeHtml(String(summary.operations))}</dd></div>
      <div><dt>mode</dt><dd>${summary.writable ? 'writable' : 'read-only'}</dd></div>
    </dl>
    ${pairing ? `
      <dl class="invite-summary pairing-summary">
        <div><dt>pairing</dt><dd title="${escapeAttr(pairing.topic)}">${escapeHtml(pairing.shortTopic || shortValue(pairing.topic))}</dd></div>
        <div><dt>transport</dt><dd>${escapeHtml(pairing.transport)}</dd></div>
        <div><dt>replica</dt><dd>${escapeHtml(pairing.mode)}</dd></div>
      </dl>
    ` : ''}
  `
}

function renderQr (payload) {
  const cells = Array.from({ length: 49 }, (_, index) => {
    const code = payload.charCodeAt(index % payload.length)
    return `<i class="${(code + index) % 3 === 0 ? 'on' : ''}"></i>`
  }).join('')
  return `<div class="qr" title="${escapeAttr(payload)}">${cells}</div>`
}

function bindActions () {
  root.querySelectorAll('[data-action="select-hub"]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedHubId = button.dataset.hubId
      selectedPassId = Object.values(state.passes).find((pass) => pass.hubId === selectedHubId)?.id || null
      render()
    })
  })

  root.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
    runAction(async () => {
      await seedDemo()
    })
  })

  root.querySelector('[data-action="scan-pass"]')?.addEventListener('click', () => {
    runAction(async () => {
      await dispatch(OP_TYPES.SCAN_PASS, { passId: selectedPassId, scannerName: 'Door 1' }, { actorId: 'scanner_door_1' })
    })
  })

  root.querySelector('[data-action="select-pass"]')?.addEventListener('change', (event) => {
    selectedPassId = event.target.value
    render()
  })

  root.querySelector('[data-action="proof"]')?.addEventListener('click', () => {
    window.alert(JSON.stringify(exportProofPack(state), null, 2))
  })

  root.querySelector('[data-action="export-log"]')?.addEventListener('click', () => {
    window.alert(serializeOperations(operations))
  })

  root.querySelector('[data-action="export-invite"]')?.addEventListener('click', () => {
    runAction(async () => {
      const invite = await backend.invite()
      inviteDraft = JSON.stringify(invite, null, 2)
      inviteInspection = await inspectInvite(invite, 'Invite ready to share.')
    })
  })

  bindForm('inspect-invite', async (form) => {
    const data = formData(form)
    inviteDraft = data.invite || ''
    try {
      inviteInspection = await inspectInvite(inviteDraft)
    } catch (err) {
      inviteInspection = { error: err.message }
    }
  })

  bindForm('create-hub', async (form) => {
    const data = formData(form)
    const hub = await dispatch(OP_TYPES.CREATE_MATCH, data, { actorId: data.hostName || 'host' })
    selectedHubId = hub.id
    selectedPassId = null
  })

  bindForm('claim-pass', async (form) => {
    const data = formData(form)
    const pass = await dispatch(OP_TYPES.CLAIM_PASS, { hubId: selectedHubId, ...data }, { actorId: data.displayName })
    selectedPassId = pass.id
  })

  bindForm('prediction', async (form) => {
    const data = formData(form)
    await dispatch(OP_TYPES.POST_PREDICTION, {
      hubId: selectedHubId,
      actorName: data.actorName,
      writerId: data.actorName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      homeScore: data.homeScore,
      awayScore: data.awayScore
    })
  })

  bindForm('reaction', async (form) => {
    const data = formData(form)
    await dispatch(OP_TYPES.POST_REACTION, { hubId: selectedHubId, ...data }, { actorId: data.actorName })
  })

  bindForm('open-pool', async (form) => {
    const data = formData(form)
    const receive = createPoolReceiveRequest({ hubId: selectedHubId, ...data })
    await dispatch(OP_TYPES.CREATE_POOL, {
      hubId: selectedHubId,
      actorName: 'Mina',
      ...data,
      paymentMode: receive.mode,
      receiveRequestId: receive.id,
      receiveAddress: receive.receiveAddress
    }, { actorId: 'host_mina' })
  })

  bindForm('contribute', async (form) => {
    const pool = Object.values(state.pools).find((candidate) => candidate.hubId === selectedHubId)
    const data = formData(form)
    const receipt = confirmDemoPoolContribution(pool, data)
    await dispatch(OP_TYPES.RECORD_POOL_CONTRIBUTION, {
      poolId: pool.id,
      actorName: receipt.actorName,
      amount: receipt.amount,
      status: receipt.status,
      receipt: receipt.receipt
    }, { actorId: data.actorName, entityId: receipt.id })
  })
}

function bindForm (name, handler) {
  root.querySelector(`[data-form="${name}"]`)?.addEventListener('submit', async (event) => {
    event.preventDefault()
    try {
      await handler(event.currentTarget)
      render()
    } catch (err) {
      window.alert(err.message)
    }
  })
}

async function runAction (handler) {
  try {
    await handler()
    render()
  } catch (err) {
    window.alert(err.message)
  }
}

function formData (form) {
  return Object.fromEntries(new FormData(form).entries())
}

function statusBadge (label, value) {
  return `<span class="badge"><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</span>`
}

async function dispatch (type, payload, opts = {}) {
  const op = createOperation(type, payload, opts)
  const previousOperations = operations.slice()
  const result = applyOperation(state, op)
  operations.push(op)
  try {
    await backend.appendOperation(op, operations)
    await refreshBackendStatus()
    await writeRuntimeProof('operation-appended', { lastOperationType: op.type, lastOperationId: op.id })
  } catch (err) {
    operations = previousOperations
    state = replaySafe(operations)
    throw err
  }
  return result
}

async function createOperationBackend () {
  const runtimeApi = await resolveRuntimeApi()
  if (runtimeApi) {
    return {
      source: 'pears-store',
      async loadOperations () {
        return runtimeApi.listOperations()
      },
      async appendOperation (op) {
        await runtimeApi.appendOperation(op)
      },
      async resetOperations (ops) {
        await runtimeApi.resetOperations(ops)
      },
      async invite () {
        if (typeof runtimeApi.invite === 'function') return runtimeApi.invite()
        const info = await runtimeApi.info()
        return createMatchdayInvite(info)
      },
      async summarizeInvite (invite) {
        if (typeof runtimeApi.summarizeInvite === 'function') return runtimeApi.summarizeInvite(invite)
        return summarizeMatchdayInvite(invite)
      },
      async pairingDescriptor (invite) {
        if (typeof runtimeApi.pairingDescriptor !== 'function') return null
        return runtimeApi.pairingDescriptor(invite)
      },
      async status () {
        const info = await runtimeApi.info()
        return {
          source: 'pears-store',
          label: 'Corestore/Hyperbee',
          operations: info.operations,
          key: info.key,
          writable: info.writable,
          storagePath: info.storagePath
        }
      }
    }
  }

  return createLocalOperationBackend()
}

async function resolveRuntimeApi () {
  try {
    if (window.matchdayAPI) return window.matchdayAPI
    if (window.matchdayMeshRuntime && typeof window.matchdayMeshRuntime.then === 'function') {
      return await window.matchdayMeshRuntime
    }
  } catch (err) {
    console.warn('Matchday Mesh runtime API unavailable:', err.message)
  }
  return null
}

function createLocalOperationBackend () {
  return {
    source: 'local-storage',
    async loadOperations () {
      return loadLocalOperations()
    },
    async appendOperation (_op, nextOperations) {
      saveLocalOperations(nextOperations)
    },
    async resetOperations (ops) {
      saveLocalOperations(ops)
    },
    async invite () {
      return {
        type: 'matchday-mesh-preview-invite-v1',
        app: 'matchday-mesh',
        backend: 'local-storage',
        key: null,
        operations: loadLocalOperations().length,
        unavailable: true
      }
    },
    async summarizeInvite (invite) {
      return summarizeMatchdayInvite(invite)
    },
    async pairingDescriptor () {
      return null
    },
    async status () {
      return {
        source: 'local-storage',
        label: 'Browser preview',
        operations: loadLocalOperations().length,
        key: null,
        writable: true,
        storagePath: OPS_STORAGE_KEY
      }
    }
  }
}

async function inspectInvite (invite, message = '') {
  const summary = await backend.summarizeInvite(invite)
  const pairing = typeof backend.pairingDescriptor === 'function'
    ? await backend.pairingDescriptor(invite)
    : null
  return {
    ...(message ? { message } : {}),
    summary,
    pairing
  }
}

async function refreshBackendStatus () {
  backendStatus = await backend.status()
}

async function writeRuntimeProof (stage, details = {}) {
  if (typeof window.matchdayMeshWriteProof !== 'function') return
  try {
    const invite = backendStatus.source === 'pears-store' && typeof backend.invite === 'function'
      ? await backend.invite()
      : null
    const pairing = invite && typeof backend.pairingDescriptor === 'function'
      ? await backend.pairingDescriptor(invite)
      : null
    await window.matchdayMeshWriteProof(stage, {
      selectedHubId,
      selectedPassId,
      invite,
      pairing,
      operationCount: operations.length,
      backendStatus,
      stateCounts: {
        hubs: Object.keys(state.hubs).length,
        passes: Object.keys(state.passes).length,
        feedCards: state.feed.length,
        payments: Object.keys(state.payments).length
      },
      ...details
    })
  } catch (err) {
    console.warn('Matchday Mesh proof write failed:', err.message)
  }
}

function loadLocalOperations () {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(OPS_STORAGE_KEY))
    if (Array.isArray(parsed)) return parsed
    if (parsed?.version === 1 && Array.isArray(parsed.ops)) return parsed.ops
  } catch {}
  return []
}

function replaySafe (ops) {
  try {
    return replayOperations(ops)
  } catch (err) {
    operations = []
    console.warn('Matchday Mesh reset invalid operation log:', err.message)
    return replayOperations([])
  }
}

function saveLocalOperations (nextOperations) {
  window.localStorage.setItem(OPS_STORAGE_KEY, JSON.stringify({ version: 1, ops: nextOperations }))
}

function escapeHtml (value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char])
}

function escapeAttr (value) {
  return escapeHtml(value)
}

function shortValue (value) {
  const text = String(value || '')
  if (text.length <= 16) return text
  return `${text.slice(0, 8)}...${text.slice(-6)}`
}
