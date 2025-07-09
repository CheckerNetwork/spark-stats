import { updateDailyTransferStats } from './platform-stats.js'

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
  for (const event of events.filter(isEventLog)) {
    const transferEvent = {
      toAddress: event.args.to,
      amount: event.args.amount
    }
    console.log('Transfer event:', transferEvent)
    await updateDailyTransferStats(pgPoolStats, transferEvent, currentBlockNumber)
  }

  return events.length
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
