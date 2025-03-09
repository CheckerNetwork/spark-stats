-- Create a stable address mapping table
CREATE TABLE address_mapping (
    participant_id SERIAL PRIMARY KEY,            -- Auto-incremented stable ID
    participant_address TEXT UNIQUE NOT NULL      -- Ensures each address has only one ID
);
