import assert from 'node:assert'
import { beforeEach, describe, it, before, after, afterEach } from 'mocha'

import { getStatsPgPool, migrateStatsDB } from '@filecoin-station/spark-stats-db'
import { updateDailyTransferStats } from '../lib/platform-stats.js'
import { mapParticipantsToIds } from '../lib/map-participants-to-ids.js'

describe('platform-stats-generator', () => {
  /** @type {import('pg').PoolClient} */
  let pgClient

  before(async () => {
    const pgPool = await getStatsPgPool()
    pgClient = await pgPool.connect()
    await migrateStatsDB(pgPool)
  })

  let today
  let addressMap
  beforeEach(async () => {
    await pgClient.query('DELETE FROM daily_reward_transfers')
    await pgClient.query('DELETE FROM participants')
    // Run all tests inside a transaction to ensure `now()` always returns the same value
    // See https://dba.stackexchange.com/a/63549/125312
    // This avoids subtle race conditions when the tests are executed around midnight.

    // Insert participants via mapParticipantsToIds
    const addresses = new Set(['address1', 'address2'])
    addressMap = await mapParticipantsToIds(pgClient, addresses)

    // Run all tests inside a transaction to ensure consistency in `now()`
    await pgClient.query('BEGIN TRANSACTION')
    today = await getCurrentDate()
  })

  afterEach(async () => {
    await pgClient.query('END TRANSACTION')
  })

  after(async () => {
    await pgClient.release()
  })

  describe('updateDailyTransferStats', () => {
    it('should correctly update daily Transfer stats with new transfer events', async () => {
      await updateDailyTransferStats(pgClient, {
        to_address_id: addressMap.get('address1'),
        amount: 100
      }, 1)

      await updateDailyTransferStats(pgClient, {
        to_address_id: addressMap.get('address1'),
        amount: 200
      }, 2)

      const { rows } = await pgClient.query(`
        SELECT day::TEXT, to_address_id, amount, last_checked_block FROM daily_reward_transfers
      `)
      assert.strictEqual(rows.length, 1)
      assert.deepStrictEqual(rows, [{
        day: today,
        to_address_id: addressMap.get('address1'),
        amount: '300',
        last_checked_block: 2
      }])
    })

    it('should handle multiple addresses in daily Transfer stats', async () => {
      await updateDailyTransferStats(pgClient, {
        to_address_id: addressMap.get('address1'),
        amount: 50
      }, 1)

      await updateDailyTransferStats(pgClient, {
        to_address_id: addressMap.get('address2'),
        amount: 150
      }, 1)

      const { rows } = await pgClient.query(`
        SELECT day::TEXT, to_address_id, amount, last_checked_block FROM daily_reward_transfers
        ORDER BY to_address_id
      `)
      assert.strictEqual(rows.length, 2)

      assert.deepStrictEqual(rows, [
        {
          day: today,
          to_address_id: addressMap.get('address1'),
          amount: '50',
          last_checked_block: 1
        },
        {
          day: today,
          to_address_id: addressMap.get('address2'),
          amount: '150',
          last_checked_block: 1
        }
      ])
    })
  })

  const getCurrentDate = async () => {
    const { rows: [{ today }] } = await pgClient.query('SELECT now()::DATE::TEXT as today')
    return today
  }
})
