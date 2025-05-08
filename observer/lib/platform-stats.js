/**
 *
 * @param {import('@filecoin-station/spark-stats-db').Queryable} pgClient
 * @param {Object} transferEvent
 * @param {BigInt | number | string} transferEvent.amount
 * @param {number} transferEvent.toAddressId
 * @param {number} currentBlockNumber
 */
export const updateDailyTransferStats = async (pgClient, transferEvent, currentBlockNumber) => {
  await pgClient.query(`
    INSERT INTO daily_reward_transfers
    (day, to_address_id, amount, last_checked_block)
    VALUES (now(), $1, $2, $3)
    ON CONFLICT (day, to_address_id) DO UPDATE SET
      amount = daily_reward_transfers.amount + EXCLUDED.amount,
      last_checked_block = EXCLUDED.last_checked_block
  `, [transferEvent.toAddressId, transferEvent.amount, currentBlockNumber])
}
