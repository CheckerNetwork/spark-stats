import { mapParticipantsToIds } from '@filecoin-station/spark-evaluate/lib/platform-stats.js'

/**
 * @param {import('./typings.js').Queryable} pgPool
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
 * @param {string} platform
 * @param {number} count
 */
export const givenDailyDesktopUsers = async (pgPool, day, platform, count) => {
  await pgPool.query(`
    INSERT INTO daily_desktop_users (day, platform, user_count)
    VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING
  `, [
    day,
    platform,
    count
  ])
}
