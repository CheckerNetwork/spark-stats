import { mapParticipantsToIds } from '@filecoin-station/spark-evaluate/lib/platform-stats.js'

/**
 * Populate daily participants in spark_evaluate database
 *
 * @param {import('./typings.js').PgPoolEvaluate} pgPool
 * @param {string} day
 * @param {string[]} participantAddresses
 */
export const givenDailyParticipants = async (pgPool, day, participantAddresses) => {
  const ids = await mapParticipantsToIds(pgPool, new Set(participantAddresses))

  await pgPool.query(`
    INSERT INTO daily_participants (day, participant_id)
    SELECT $1 as day, UNNEST($2::INT[]) AS participant_id
    ON CONFLICT DO NOTHING
  `, [
    day,
    Array.from(ids.values())
  ])
}

/**
 * @param {import('./typings.js').Queryable} pgPool
 * @param {string} day
 * @param {number} count
 */
export const givenDailyDesktopUsers = async (pgPool, day, count) => {
  await pgPool.query(`
    INSERT INTO daily_desktop_users (day, user_count)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
  `, [
    day,
    count
  ])
}
