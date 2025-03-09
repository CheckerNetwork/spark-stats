-- Foreign Keys
ALTER TABLE daily_scheduled_rewards
ADD FOREIGN KEY (participant_id) REFERENCES address_mapping(participant_id);

ALTER TABLE daily_reward_transfers
ADD FOREIGN KEY (participant_id) REFERENCES address_mapping(participant_id);

-- Create indexes for better performance
CREATE INDEX idx_daily_scheduled_rewards_pid_day ON daily_scheduled_rewards (participant_id, day DESC);
CREATE INDEX idx_daily_reward_transfers_pid_day ON daily_reward_transfers (participant_id, day);