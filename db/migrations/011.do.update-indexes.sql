-- Step 1: Drop old indexes referencing participant_address
DROP INDEX IF EXISTS daily_reward_transfers_to_address_day;
DROP INDEX IF EXISTS idx_daily_scheduled_rewards_participant_address;

-- Step 2: Create new indexes for better performance (AFTER dropping old ones)
CREATE INDEX idx_daily_scheduled_rewards_pid_day 
ON daily_scheduled_rewards (participant_id, day DESC);

CREATE INDEX idx_daily_reward_transfers_to_address_day 
ON daily_reward_transfers (to_address_id, day DESC);