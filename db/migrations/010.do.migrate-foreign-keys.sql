-- Step 1: Add foreign key columns
ALTER TABLE daily_scheduled_rewards ADD COLUMN participant_id INT;
ALTER TABLE daily_reward_transfers ADD COLUMN to_address_id INT;

-- Step 2: Populate the new foreign key columns
UPDATE daily_scheduled_rewards dsr
SET participant_id = p.id
FROM participants p
WHERE dsr.participant_address = p.participant_address;

UPDATE daily_reward_transfers drt
SET to_address_id = p.id
FROM participants p
WHERE drt.to_address = p.participant_address;

-- Step 3: Replace Primary Keys
ALTER TABLE daily_scheduled_rewards
DROP CONSTRAINT daily_scheduled_rewards_pkey;
ALTER TABLE daily_scheduled_rewards
ADD PRIMARY KEY (day, participant_id);

ALTER TABLE daily_reward_transfers
DROP CONSTRAINT daily_reward_transfers_pkey;
ALTER TABLE daily_reward_transfers
ADD PRIMARY KEY (day, to_address_id);

-- Step 4: Add Foreign Key Constraints
ALTER TABLE daily_scheduled_rewards
ADD CONSTRAINT fk_dsr_participant FOREIGN KEY (participant_id)
REFERENCES participants(id) ON DELETE CASCADE;

ALTER TABLE daily_reward_transfers
ADD CONSTRAINT fk_drt_to_address FOREIGN KEY (to_address_id)
REFERENCES participants(id) ON DELETE CASCADE;

-- Step 5: Enforce NOT NULL Constraint
ALTER TABLE daily_scheduled_rewards ALTER COLUMN participant_id SET NOT NULL;
ALTER TABLE daily_reward_transfers ALTER COLUMN to_address_id SET NOT NULL;

-- Step 6: Drop old indexes referencing participant_address
DROP INDEX IF EXISTS daily_reward_transfers_to_address_day;
DROP INDEX IF EXISTS idx_daily_scheduled_rewards_participant_address;

-- Step 7: Drop Old participant_address Columns (if they exist)
ALTER TABLE daily_scheduled_rewards DROP COLUMN IF EXISTS participant_address;
ALTER TABLE daily_reward_transfers DROP COLUMN IF EXISTS to_address;
