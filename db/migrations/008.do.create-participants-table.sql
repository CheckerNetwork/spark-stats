CREATE TABLE participants (
    id SERIAL PRIMARY KEY,
    participant_address TEXT NOT NULL UNIQUE
);

-- Add an index for fast lookups
CREATE INDEX idx_participant_address ON participants (participant_address);