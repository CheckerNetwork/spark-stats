// This is a copy of the code from spark-evaluate:
// https://github.com/CheckerNetwork/spark-evaluate/blob/7548057f3c9609c4bc52baf896b0a85d7a7f8197/lib/platform-stats.js#L154-L219

import assert from 'node:assert'
import createDebug from 'debug'
const debug = createDebug('spark:observer:map-participants-to-ids')

/**
 * @param {import('@filecoin-station/spark-stats-db').Queryable} pgClient
 * @param {Set<string>} participantsSet
 * @returns {Promise<Map<string, number>>} A map of participant addresses to ids.
 */
export const mapParticipantsToIds = async (pgClient, participantsSet) => {
  debug('Mapping participants to id, count=%s', participantsSet.size)

  /** @type {Map<string, number>} */
  const participantsMap = new Map()

  // TODO: We can further optimise performance of this function by using
  // an in-memory LRU cache. Our network has currently ~2k participants,
  // we need ~50 bytes for each (address, id) pair, that's only ~100KB of data.

  // TODO: passing the entire list of participants as a single query parameter
  // will probably not scale beyond several thousands of addresses. We will
  // need to rework the queries to split large arrays into smaller batches.

  // In most rounds, we have already seen most of the participant addresses
  // If we use "INSERT...ON CONFLICT", then PG increments id counter even for
  // existing addresses where we end up skipping the insert. This could quickly
  // exhaust the space of all 32bit integers.
  // Solution: query the table for know records before running the insert.
  //
  // Caveat: In my testing, this query was not able to leverage the (unique)
  // index on participants.participant_address and performed a full table scan
  // after the array grew past ~10 items. If this becomes a problem, we can
  // introduce the LRU cache mentioned above.
  const { rows: found } = await pgClient.query(
    'SELECT * FROM participants WHERE participant_address = ANY($1::TEXT[])',
    [Array.from(participantsSet.values())]
  )
  debug('Known participants count=%s', found.length)

  // eslint-disable-next-line camelcase
  for (const { id, participant_address } of found) {
    participantsMap.set(participant_address, id)
    participantsSet.delete(participant_address)
  }

  debug('New participant addresses count=%s', participantsSet.size)

  // Register the new addresses. Use "INSERT...ON CONFLICT" to handle the race condition
  // where another client may have registered these addresses between our previous
  // SELECT query and the next INSERT query.
  const newAddresses = Array.from(participantsSet.values())
  debug('Registering new participant addresses, count=%s', newAddresses.length)
  const { rows: created } = await pgClient.query(`
    INSERT INTO participants (participant_address)
    SELECT UNNEST($1::TEXT[]) AS participant_address
    ON CONFLICT(participant_address) DO UPDATE
      -- this no-op update is needed to populate "RETURNING id, participant_address"
      SET participant_address = EXCLUDED.participant_address
    RETURNING id, participant_address
  `, [
    newAddresses
  ])

  assert.strictEqual(created.length, newAddresses.length)
  for (const { id, participant_address: participantAddress } of created) {
    participantsMap.set(participantAddress, id)
  }

  return participantsMap
}
