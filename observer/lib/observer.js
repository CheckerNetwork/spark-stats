import { updateDailyTransferStats } from './platform-stats.js'
import * as Sentry from '@sentry/node'
import assert from 'node:assert'
import { mapParticipantsToIds } from './map-participants-to-ids.js'

/**
 * Observe the transfer events on the Filecoin blockchain
 * @param {import('@filecoin-station/spark-stats-db').Queryable} pgPoolStats
 * @param {import('ethers').Contract} ieContract
 * @param {import('ethers').Provider} provider
 */
export const observeTransferEvents = async (pgPoolStats, ieContract, provider) => {
  const { rows } = await pgPoolStats.query(
    'SELECT MAX(last_checked_block) AS last_checked_block FROM daily_reward_transfers'
  )
  let queryFromBlock = rows[0].last_checked_block + 1
  const currentBlockNumber = await provider.getBlockNumber()

  if (!queryFromBlock || queryFromBlock < currentBlockNumber - 1900) {
    queryFromBlock = currentBlockNumber - 1900
    console.log('Block number too old, GLIF only provides last 2000 blocks, querying from -1900')
  }

  console.log('Querying impact evaluator Transfer events after block', queryFromBlock)
  const events = await ieContract.queryFilter(ieContract.filters.Transfer(), queryFromBlock)

  console.log(`Found ${events.length} Transfer events`)

  const filteredEvents = events.filter(isEventLog)

  // gather addresses
  const addresses = new Set()
  for (const event of filteredEvents) {
    addresses.add(event.args.to)
  }

  const addressMap = await mapParticipantsToIds(pgPoolStats, addresses)

  // handle events now that every toAddress is guaranteed an ID
  for (const event of events.filter(isEventLog)) {
    const toAddress = event.args.to
    const toAddressId = addressMap.get(toAddress)
    if (!toAddressId) {
      console.warn('Could not find or create participant for address:', toAddress)
      continue
    }

    const transferEvent = {
      to_address_id: toAddressId,
      amount: event.args.amount
    }

    // 2) Update call to accommodate `to_address_id`
    await updateDailyTransferStats(pgPoolStats, transferEvent, currentBlockNumber)
  }

  return events.length
}

const getScheduledRewards = async (address, ieContract, fetch) => {
  const [fromContract, fromSparkRewards] = await Promise.all([
    ieContract.rewardsScheduledFor(address),
    (async () => {
      const res = await fetch(
        `https://spark-rewards.fly.dev/scheduled-rewards/${address}`
      )
      const json = await res.json()
      assert(typeof json === 'string')
      return BigInt(json)
    })()
  ])
  return fromContract + fromSparkRewards
}

/**
 * Observe scheduled rewards from blockchain and `spark-rewards`
 * @param {import('@filecoin-station/spark-stats-db').PgPools} pgPools
 * @param {import('ethers').Contract} ieContract
 * @param {typeof globalThis.fetch} [fetch]
 */
export const observeScheduledRewards = async (pgPools, ieContract, fetch = globalThis.fetch) => {
  console.log('Querying scheduled rewards from impact evaluator')
  // 3) Fetch participant_id along with address to use in insert
  const { rows } = await pgPools.evaluate.query(`
    SELECT p.id AS participant_id, p.participant_address
    FROM participants p
    JOIN daily_participants d ON p.id = d.participant_id
    WHERE d.day >= now() - interval '3 days'
  `)
  for (const { participant_address: address, participant_id: participantId } of rows) {
    let scheduledRewards
    try {
      scheduledRewards = await getScheduledRewards(address, ieContract, fetch)
    } catch (err) {
      Sentry.captureException(err)
      console.error(
        'Error querying scheduled rewards for',
        address,
        { cause: err }
      )
      continue
    }
    console.log('Scheduled rewards for', address, scheduledRewards)
    // 4) Use participant_id foreign key in insert
    await pgPools.stats.query(`
      INSERT INTO daily_scheduled_rewards
      (day, participant_id, scheduled_rewards)
      VALUES (now(), $1, $2)
      ON CONFLICT (day, participant_id) DO UPDATE SET
        scheduled_rewards = EXCLUDED.scheduled_rewards
    `, [participantId, scheduledRewards])
  }
}

/**
 * @param {import('ethers').Log | import('ethers').EventLog} logOrEventLog
 * @returns {logOrEventLog is import('ethers').EventLog}
 */
function isEventLog (logOrEventLog) {
  return 'args' in logOrEventLog
}

export const observeRetrievalResultCodes = async (pgPoolStats, influxQueryApi) => {
  // TODO: The `mean` aggregation will produce slightly wrong numbers, since
  // the query is aggregating over relative numbers - with varying measurement
  // counts, the relative numbers should be weighted differently. Since the
  // measurement count per round should be relatively stable, this should be
  // good enough for now. Please pick up and improve this.
  // Ref: https://github.com/filecoin-station/spark-stats/pull/244#discussion_r1824808007
  // Note: Having a bucket retention policy is important for this query not to
  // time out.
  /** @type {{_time: string; _field: string; _value: number}[]} */
  const rows = await influxQueryApi.collectRows(`
    import "strings"
    from(bucket: "spark-evaluate")
      |> range(start: 0)
      |> filter(fn: (r) => r["_measurement"] == "retrieval_stats_honest")
      |> filter(fn: (r) => strings.hasPrefix(v: r._field, prefix: "result_rate_"))
      |> aggregateWindow(every: 1d, fn: mean, createEmpty: false, timeSrc: "_start")
      |> keep(columns: ["_value", "_time", "_field"])
      |> map(fn: (r) => ({ r with _field: strings.replace(v: r._field, t: "result_rate_", u: "", i: 1) }))
  `)
  console.log('Inserting %s rows to daily_retrieval_result_codes ', rows.length)

  await pgPoolStats.query(`
    INSERT INTO daily_retrieval_result_codes
    (day, code, rate)
    VALUES (unnest($1::DATE[]), unnest($2::TEXT[]), unnest($3::NUMERIC[]))
    ON CONFLICT (day, code) DO UPDATE SET rate = EXCLUDED.rate
  `, [
    rows.map(r => r._time),
    rows.map(r => r._field),
    rows.map(r => r._value)
  ])
}

export const observeYesterdayDesktopUsers = async (pgPoolStats, influxQueryApi) => {
  // TODO: Replace with Flux boundaries.yesterday() once it becomes part of stable API
  const yesterday = getYesterdayBoundaries()
  const rows = await influxQueryApi.collectRows(`
    from(bucket: "station")
      |> range(start: ${yesterday.start}, stop: ${yesterday.stop})
      |> filter(fn: (r) => r._measurement == "ping" and r.deployment_type == "station-desktop")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> group()
      |> unique(column: "station_id")
      |> count(column: "station_id")
      |> rename(columns: {station_id: "count"})
      |> group()
  `)

  const count = rows.reduce((acc, v) => acc + v.count, 0)
  await pgPoolStats.query(`
    INSERT INTO daily_desktop_users
    (day, user_count)
    VALUES (NOW() - INTERVAL '1 day', $1)
    ON CONFLICT (day) DO UPDATE SET user_count = EXCLUDED.user_count
  `, [count])
}

/**
 * Returns the start and end timestamps for yesterday's date in UTC
 * @returns {Object} Object containing start and stop timestamps
 */
function getYesterdayBoundaries () {
  // Get current date
  const now = new Date()

  // Create start of yesterday
  const start = new Date(now)
  start.setDate(start.getDate() - 1) // Move to yesterday
  start.setUTCHours(0, 0, 0, 0) // Set to start of day

  // Create end of yesterday
  const stop = new Date(now)
  stop.setUTCHours(0, 0, 0, 0) // Set to end of day

  return {
    start: start.toISOString(),
    stop: stop.toISOString()
  }
}
