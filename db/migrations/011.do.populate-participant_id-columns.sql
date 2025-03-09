-- Update daily_scheduled_rewards
UPDATE daily_scheduled_rewards dsr
SET participant_id = am.participant_id
FROM address_mapping am
WHERE dsr.participant_address = am.participant_address;

-- Update daily_reward_transfers
UPDATE daily_reward_transfers drt
SET participant_id = am.participant_id
FROM address_mapping am
WHERE drt.to_address = am.participant_address;
