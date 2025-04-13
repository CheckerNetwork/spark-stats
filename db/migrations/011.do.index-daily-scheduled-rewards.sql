CREATE INDEX CONCURRENTLY idx_daily_scheduled_rewards_pid_day
ON daily_scheduled_rewards (participant_id, day DESC);
