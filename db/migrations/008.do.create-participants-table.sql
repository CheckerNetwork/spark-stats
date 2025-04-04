CREATE TABLE participants (
    id SERIAL PRIMARY KEY,
    participant_address TEXT NOT NULL UNIQUE
);
