CREATE INDEX CONCURRENTLY idx_daily_reward_transfers_to_address_day
ON daily_reward_transfers (to_address_id, day DESC);
