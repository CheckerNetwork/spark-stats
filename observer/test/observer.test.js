import assert from 'node:assert'
import { beforeEach, describe, it } from 'mocha'
import { getPgPools } from '@filecoin-station/spark-stats-db'

import { observeTransferEvents, observeScheduledRewards, observeRetrievalResultCodes, observeYesterdayDesktopUsers } from '../lib/observer.js'
import { givenDailyParticipants } from '@filecoin-station/spark-stats-db/test-helpers.js'

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
      await pgPools.stats.query('DELETE FROM participants')
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
    it('should create a new participant if not found in the participants table', async () => {
      // 1) Make the contract return an event for a new address 'address3'
      ieContractMock.queryFilter = async (eventName, fromBlock) => {
        return [
          { args: { to: 'address3', amount: 400 }, blockNumber: 2000 }
        ]
      }

      // 2) Run the observer function
      const numEvents = await observeTransferEvents(pgPools.stats, ieContractMock, providerMock)

      // Should have processed 1 new event
      assert.strictEqual(numEvents, 1)

      // 3) Check that a new participant row got created for 'address3'
      const { rows: participantRows } = await pgPools.stats.query(`
        SELECT id, participant_address
        FROM participants
        WHERE participant_address = 'address3'
      `)
      assert.strictEqual(participantRows.length, 1, 'Should have created a new participant for address3')

      // 4) Check daily_reward_transfers references that new participant
      const { rows: transferRows } = await pgPools.stats.query(`
        SELECT to_address_id, amount, last_checked_block
        FROM daily_reward_transfers
      `)
      assert.strictEqual(transferRows.length, 1, 'Should have inserted a new record in daily_reward_transfers')
      assert.strictEqual(transferRows[0].amount, '400')
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
        SELECT day::TEXT, participant_address as to_address, amount, last_checked_block
        FROM daily_reward_transfers
        LEFT JOIN participants ON daily_reward_transfers.to_address_id = participants.id
        ORDER BY to_address_id
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
        SELECT day::TEXT, participant_address as to_address, amount, last_checked_block
        FROM daily_reward_transfers
        LEFT JOIN participants ON daily_reward_transfers.to_address_id = participants.id
        ORDER BY to_address_id
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
          { args: { to: 'address2', amount: 150 }, blockNumber: 2000 }
        ]
        return events.filter((event) => event.blockNumber >= fromBlock)
      }

      const numEvents1 = await observeTransferEvents(pgPools.stats, ieContractMock, providerMock)
      assert.strictEqual(numEvents1, 2)

      const numEvents2 = await observeTransferEvents(pgPools.stats, ieContractMock, providerMock)
      assert.strictEqual(numEvents2, 0)

      const { rows } = await pgPools.stats.query(`
        SELECT day::TEXT, participant_address as to_address, amount, last_checked_block
        FROM daily_reward_transfers
        LEFT JOIN participants ON daily_reward_transfers.to_address_id = participants.id
        ORDER BY to_address_id
      `)
      assert.strictEqual(rows.length, 2)
      assert.deepStrictEqual(rows, [
        { day: today(), to_address: 'address1', amount: '50', last_checked_block: 2000 },
        { day: today(), to_address: 'address2', amount: '150', last_checked_block: 2000 }
      ])
    })

    it('should avoid querying too old blocks', async () => {
      providerMock.getBlockNumber = async () => 2000
      ieContractMock.queryFilter = async (eventName, fromBlock) => {
        const events = [
          { args: { to: 'address1', amount: 50 }, blockNumber: 400 },
          { args: { to: 'address2', amount: 150 }, blockNumber: 400 },
          { args: { to: 'address1', amount: 150 }, blockNumber: 2000 }
        ]
        return events.filter((event) => event.blockNumber >= fromBlock)
      }

      await observeTransferEvents(pgPools.stats, ieContractMock, providerMock)

      const { rows } = await pgPools.stats.query(`
        SELECT day::TEXT, participant_address as to_address, amount, last_checked_block
        FROM daily_reward_transfers
        LEFT JOIN participants ON daily_reward_transfers.to_address_id = participants.id
        ORDER BY to_address_id
      `)
      assert.strictEqual(rows.length, 2)
      assert.deepStrictEqual(rows, [
        { day: today(), to_address: 'address1', amount: '200', last_checked_block: 2000 },
        { day: today(), to_address: 'address2', amount: '150', last_checked_block: 2000 }
      ])
    })
  })

  // 2) Insert participant for scheduled rewards test
  describe('observeScheduledRewards', () => {
    beforeEach(async () => {
      await pgPools.evaluate.query('DELETE FROM recent_station_details')
      await pgPools.evaluate.query('DELETE FROM recent_participant_subnets')
      await pgPools.evaluate.query('DELETE FROM daily_participants')
      await pgPools.evaluate.query('DELETE FROM participants')
      await pgPools.stats.query('DELETE FROM daily_scheduled_rewards')

      // NOTE: these participants are defined in the spark_evaluate database!
      await givenDailyParticipants(pgPools.evaluate, today(), ['0xCURRENT'])
      await givenDailyParticipants(pgPools.evaluate, '2000-01-01', ['0xOLD'])
    })

    it('observes scheduled rewards', async () => {
      /** @type {any} */
      const ieContract = {
        rewardsScheduledFor: async (address) => {
          assert.strictEqual(address, '0xCURRENT')
          return 100n
        }
      }

      const fetchMock = async url => {
        assert.strictEqual(url, 'https://spark-rewards.fly.dev/scheduled-rewards/0xCURRENT')
        return new Response(JSON.stringify('10'))
      }

      await observeScheduledRewards(pgPools, ieContract, fetchMock)

      const { rows } = await pgPools.stats.query(`
        SELECT participant_address, scheduled_rewards
        FROM daily_scheduled_rewards
        LEFT JOIN participants ON daily_scheduled_rewards.participant_id = participants.id
      `)

      const formattedRows = rows.map(row => ({
        participantAddress: row.participant_address,
        scheduledRewards: row.scheduled_rewards
      }))

      assert.deepStrictEqual(formattedRows, [{
        participantAddress: '0xCURRENT',
        scheduledRewards: '110'
      }])
    })

    it('updates scheduled rewards', async () => {
      /** @type {any} */
      const ieContract = {
        rewardsScheduledFor: async (address) => {
          console.log('rewardsScheduledFor(%s)', address)
          if (address === '0xCURRENT') {
            return 200n
          } else {
            throw new Error(`Unexpected address queried: ${address}`)
          }
        }
      }

      const fetchMock = async url => {
        assert.strictEqual(url, 'https://spark-rewards.fly.dev/scheduled-rewards/0xCURRENT')
        return new Response(JSON.stringify('0'))
      }

      await observeScheduledRewards(pgPools, ieContract, fetchMock)

      const { rows } = await pgPools.stats.query(`
        SELECT participant_address, scheduled_rewards
        FROM daily_scheduled_rewards
        LEFT JOIN participants ON daily_scheduled_rewards.participant_id = participants.id
      `)

      const formattedRows = rows.map(row => ({
        participantAddress: row.participant_address,
        scheduledRewards: row.scheduled_rewards
      }))

      assert.deepStrictEqual(formattedRows, [{
        participantAddress: '0xCURRENT',
        scheduledRewards: '200'
      }])
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
