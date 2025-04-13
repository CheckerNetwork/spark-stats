import { mapParticipantsToIds } from "@filecoin-station/spark-evaluate/lib/platform-stats.js";

/**
 * Populate daily participants in spark_evaluate database
 *
 * @param {import('./typings.js').PgPoolEvaluate} pgPool
 * @param {string} day
 * @param {string[]} participantAddresses
 */
export const givenDailyParticipants = async (
  pgPool,
  day,
  participantAddresses,
) => {
  const ids = await mapParticipantsToIds(pgPool, new Set(participantAddresses));

  await pgPool.query(
    `
    INSERT INTO daily_participants (day, participant_id)
    SELECT $1 as day, UNNEST($2::INT[]) AS participant_id
    ON CONFLICT DO NOTHING
  `,
    [day, Array.from(ids.values())],
  );
};

/**
 * @param {import('./typings.js').Queryable} pgPool
 * @param {string} day
 * @param {number} count
 */
export const givenDailyDesktopUsers = async (pgPool, day, count) => {
  await pgPool.query(
    `
    INSERT INTO daily_desktop_users (day, user_count)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
  `,
    [day, count],
  );
};

// Map addresses and insert into daily_scheduled_rewards
export const givenScheduledRewards = async (pgClient, day, rewardsMap) => {
  const addresses = Array.from(rewardsMap.keys());
  const addressMap = await mapParticipantsToIds(pgClient, new Set(addresses));

  for (const [address, rewards] of rewardsMap.entries()) {
    const id = addressMap.get(address);
    await pgClient.query(
      `
      INSERT INTO daily_scheduled_rewards (day, participant_id, scheduled_rewards)
      VALUES ($1, $2, $3)
    `,
      [day, id, rewards],
    );
  }
};

// Map address and insert into daily_reward_transfers
export const givenRewardTransfer = async (
  pgClient,
  day,
  address,
  amount,
  lastCheckedBlock = 0,
) => {
  const addressMap = await mapParticipantsToIds(pgClient, new Set([address]));
  const id = addressMap.get(address);

  await pgClient.query(
    `
    INSERT INTO daily_reward_transfers (day, to_address_id, amount, last_checked_block)
    VALUES ($1, $2, $3, $4)
  `,
    [day, id, amount, lastCheckedBlock],
  );
};
export { mapParticipantsToIds } from "../observer/lib/map-participants-to-ids.js";
