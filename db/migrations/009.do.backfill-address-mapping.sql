-- Migration to backfill existing participant addresses into address_mapping table
INSERT INTO address_mapping (participant_address)
SELECT DISTINCT participant_address FROM daily_scheduled_rewards
ON CONFLICT (participant_address) DO NOTHING;
