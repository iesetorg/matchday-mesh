import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createMatchdayInvite,
  MATCHDAY_INVITE_TYPE,
  normalizeMatchdayInvite,
  summarizeMatchdayInvite
} from '../app/invite.js'

const INFO = {
  coreName: 'matchday-mesh-ops',
  key: 'a'.repeat(64),
  discoveryKey: 'b'.repeat(64),
  operations: 3
}

test('creates and normalizes read-only Matchday Mesh invites', () => {
  const invite = createMatchdayInvite(INFO, { createdAt: '2026-06-30T00:00:00.000Z' })

  assert.equal(invite.type, MATCHDAY_INVITE_TYPE)
  assert.equal(invite.app, 'matchday-mesh')
  assert.equal(invite.key, INFO.key)
  assert.equal(invite.discoveryKey, INFO.discoveryKey)
  assert.equal(invite.writable, false)
  assert.equal(invite.operations, 3)

  const normalized = normalizeMatchdayInvite(JSON.stringify({ ...invite, writable: true }))
  assert.equal(normalized.writable, false)
  assert.deepEqual(normalized, invite)

  const summary = summarizeMatchdayInvite(invite)
  assert.equal(summary.shortKey, 'aaaaaaaa...aaaaaa')
  assert.equal(summary.shortDiscoveryKey, 'bbbbbbbb...bbbbbb')
})

test('rejects malformed Matchday Mesh invites', () => {
  assert.throws(() => normalizeMatchdayInvite('not json'), { code: 'INVALID_INVITE_JSON' })
  assert.throws(() => normalizeMatchdayInvite({ ...INFO, type: 'other', app: 'matchday-mesh' }), { code: 'INVALID_INVITE_TYPE' })
  assert.throws(() => normalizeMatchdayInvite({ ...INFO, type: MATCHDAY_INVITE_TYPE, app: 'other' }), { code: 'INVALID_INVITE_APP' })
  assert.throws(() => normalizeMatchdayInvite({
    ...INFO,
    type: MATCHDAY_INVITE_TYPE,
    app: 'matchday-mesh',
    key: 'bad'
  }), { code: 'INVALID_INVITE_KEY' })
  assert.throws(() => normalizeMatchdayInvite({
    ...INFO,
    type: MATCHDAY_INVITE_TYPE,
    app: 'matchday-mesh',
    operations: -1
  }), { code: 'INVALID_INVITE_OPERATIONS' })
})
