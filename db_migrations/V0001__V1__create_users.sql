CREATE TABLE IF NOT EXISTS t_p59310248_messenger_osinting.users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT UNIQUE NOT NULL,
    name          TEXT NOT NULL,
    bio           TEXT NOT NULL DEFAULT '',
    avatar        TEXT NOT NULL DEFAULT '',
    color         TEXT NOT NULL DEFAULT 'from-purple-600 to-pink-500',
    password_hash TEXT NOT NULL,
    online        BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);