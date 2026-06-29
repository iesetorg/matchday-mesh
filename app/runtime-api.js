import { openMatchdayPearsStore } from './pears-store.js'
import { createMatchdayInvite, normalizeMatchdayInvite, summarizeMatchdayInvite } from './invite.js'

export async function createMatchdayApi (storagePath, opts = {}) {
  const store = await openMatchdayPearsStore(storagePath, opts)

  return {
    backend: 'pears-store',

    async listOperations () {
      return store.listOperations()
    },

    async appendOperation (op) {
      const result = await store.appendOperation(op)
      return {
        result,
        info: await store.info()
      }
    },

    async resetOperations (ops = []) {
      await store.clearOperations()
      const results = await store.appendOperations(ops)
      return {
        results,
        info: await store.info()
      }
    },

    async replayState () {
      return store.replayState()
    },

    async info () {
      return {
        backend: 'pears-store',
        ...(await store.info())
      }
    },

    async invite () {
      const info = await store.info()
      return createMatchdayInvite(info)
    },

    async normalizeInvite (invite) {
      return normalizeMatchdayInvite(invite)
    },

    async summarizeInvite (invite) {
      return summarizeMatchdayInvite(invite)
    },

    async close () {
      await store.close()
    }
  }
}
