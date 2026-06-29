import { openMatchdayPearsStore } from './pears-store.js'

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
      return {
        type: 'matchday-mesh-core-invite-v1',
        app: 'matchday-mesh',
        coreName: info.coreName,
        key: info.key,
        discoveryKey: info.discoveryKey,
        writable: false,
        operations: info.operations,
        createdAt: new Date().toISOString()
      }
    },

    async close () {
      await store.close()
    }
  }
}
