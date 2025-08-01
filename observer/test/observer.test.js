import assert from 'node:assert'
import { beforeEach, describe, it } from 'mocha'
import { getPgPools } from '@filecoin-station/spark-stats-db'

import { observeTransferEvents, observeRetrievalResultCodes, observeYesterdayDesktopUsers } from '../lib/observer.js'

describe('observer', () => {
  let pgPools
  const getLocalDayAsISOString = (d) => {
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-')
  }
  const today = () => getLocalDayAsISOString(new Date())
  const yesterday = () => getLocalDayAsISOString(new Date(Date.now() - 24 * 60 * 60 * 1000))

  before(async () => {
    pgPools = await getPgPools()
  })

  after(async () => {
    await pgPools.end()
  })

  describe('observeTransferEvents', () => {
    let ieContractMock
    let providerMock

    beforeEach(async () => {
      await pgPools.stats.query('DELETE FROM daily_reward_transfers')

      ieContractMock = {
        filters: {
          Transfer: () => 'TransferEventFilter'
        },
        queryFilter: async () => []
      }
      providerMock = {
        getBlockNumber: async () => 2000
      }
    })

    it('should correctly observe and update transfer events', async () => {
      ieContractMock.queryFilter = async (eventName, fromBlock) => {
        const events = [
          { args: { to: 'address1', amount: 100 }, blockNumber: 2000 },
          { args: { to: 'address1', amount: 200 }, blockNumber: 2000 }
        ]
        return events.filter((event) => event.blockNumber >= fromBlock)
      }

      await observeTransferEvents(pgPools.stats, ieContractMock, providerMock)

      const { rows } = await pgPools.stats.query(`
        SELECT day::TEXT, to_address, amount, last_checked_block FROM daily_reward_transfers
      `)
      assert.strictEqual(rows.length, 1)
      assert.deepStrictEqual(rows, [{
        day: today(), to_address: 'address1', amount: '300', last_checked_block: 2000
      }])
    })

    it('should handle multiple addresses in transfer events', async () => {
      ieContractMock.queryFilter = async (eventName, fromBlock) => {
        const events = [
          { args: { to: 'address1', amount: 50 }, blockNumber: 2000 },
          { args: { to: 'address2', amount: 150 }, blockNumber: 2000 }
        ]
        return events.filter((event) => event.blockNumber >= fromBlock)
      }

      await observeTransferEvents(pgPools.stats, ieContractMock, providerMock)

      const { rows } = await pgPools.stats.query(`
        SELECT day::TEXT, to_address, amount, last_checked_block FROM daily_reward_transfers
        ORDER BY to_address
      `)
      assert.strictEqual(rows.length, 2)
      assert.deepStrictEqual(rows, [
        { day: today(), to_address: 'address1', amount: '50', last_checked_block: 2000 },
        { day: today(), to_address: 'address2', amount: '150', last_checked_block: 2000 }
      ])
    })

    it('should not duplicate transfer events', async () => {
      ieContractMock.queryFilter = async (eventName, fromBlock) => {
        const events = [
          { args: { to: 'address1', amount: 50 }, blockNumber: 2000 },
          { args: { to: 'address1', amount: 50 }, blockNumber: 2000 }
        ]
        return events.filter((event) => event.blockNumber >= fromBlock)
      }

      const numEvents1 = await observeTransferEvents(pgPools.stats, ieContractMock, providerMock)
      assert.strictEqual(numEvents1, 2)

      const numEvents2 = await observeTransferEvents(pgPools.stats, ieContractMock, providerMock)
      assert.strictEqual(numEvents2, 0)

      const { rows } = await pgPools.stats.query(`
        SELECT day::TEXT, to_address, amount, last_checked_block FROM daily_reward_transfers
      `)
      assert.strictEqual(rows.length, 1)
      assert.deepStrictEqual(rows, [{
        day: today(), to_address: 'address1', amount: '100', last_checked_block: 2000
      }])
    })

    it('should avoid querying too old blocks', async () => {
      providerMock.getBlockNumber = async () => 2500
      ieContractMock.queryFilter = async (eventName, fromBlock) => {
        const events = [
          { args: { to: 'address1', amount: 50 }, blockNumber: 400 },
          { args: { to: 'address2', amount: 150 }, blockNumber: 400 },
          { args: { to: 'address1', amount: 250 }, blockNumber: 2000 }
        ]
        return events.filter((event) => event.blockNumber >= fromBlock)
      }

      await observeTransferEvents(pgPools.stats, ieContractMock, providerMock)

      const { rows } = await pgPools.stats.query(`
        SELECT day::TEXT, to_address, amount, last_checked_block FROM daily_reward_transfers
        ORDER BY to_address
      `)
      assert.strictEqual(rows.length, 1)
      assert.deepStrictEqual(rows, [
        { day: today(), to_address: 'address1', amount: '250', last_checked_block: 2500 }
      ])
    })
  })

  describe('observeRetrievalResultCodes', () => {
    beforeEach(async () => {
      await pgPools.stats.query('DELETE FROM daily_retrieval_result_codes')
    })

    it('observes retrieval result codes', async () => {
      await observeRetrievalResultCodes(pgPools.stats, {
        collectRows: async () => [
          { _time: today(), _field: 'OK', _value: 0.5 },
          { _time: today(), _field: 'CAR_TOO_LARGE', _value: 0.5 }
        ]
      })
      const { rows } = await pgPools.stats.query(`
        SELECT day::TEXT, code, rate
        FROM daily_retrieval_result_codes
      `)
      assert.deepStrictEqual(rows, [
        { day: today(), code: 'OK', rate: '0.5' },
        { day: today(), code: 'CAR_TOO_LARGE', rate: '0.5' }
      ])
    })
  })

  describe('observeDailyDesktopUsers', () => {
    beforeEach(async () => {
      await pgPools.stats.query('DELETE FROM daily_desktop_users')
    })

    it('observes desktop users count', async () => {
      await observeYesterdayDesktopUsers(pgPools.stats, {
        collectRows: async () => [
          { count: 18 }
        ]
      })

      const { rows } = await pgPools.stats.query(`
        SELECT day::TEXT, user_count
        FROM daily_desktop_users
        ORDER BY user_count DESC
      `)
      assert.deepStrictEqual(rows, [
        { day: yesterday(), user_count: 18 }
      ])

      await observeYesterdayDesktopUsers(pgPools.stats, {
        collectRows: async () => [
          { count: 25 },
          { count: 11 }
        ]
      })

      const { rows: updatedRows } = await pgPools.stats.query(`
        SELECT day::TEXT, user_count
        FROM daily_desktop_users
        ORDER BY user_count DESC
      `)
      assert.deepStrictEqual(updatedRows, [
        { day: yesterday(), user_count: 36 }
      ])
    })
  })
})
