-- Backfill existing participant addresses from daily_scheduled_rewards
INSERT INTO participants (participant_address)
SELECT DISTINCT participant_address FROM daily_scheduled_rewards
ON CONFLICT (participant_address) DO NOTHING;

-- Backfill existing participant addresses from daily_reward_transfers
INSERT INTO participants (participant_address)
SELECT DISTINCT to_address FROM daily_reward_transfers
ON CONFLICT (participant_address) DO NOTHING;