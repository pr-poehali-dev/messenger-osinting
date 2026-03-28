CREATE TABLE IF NOT EXISTS t_p59310248_messenger_osinting.chats (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type       TEXT NOT NULL CHECK (type IN ('personal','group')),
    name       TEXT NOT NULL DEFAULT '',
    avatar     TEXT NOT NULL DEFAULT '',
    color      TEXT NOT NULL DEFAULT 'from-purple-600 to-pink-500',
    created_by UUID REFERENCES t_p59310248_messenger_osinting.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p59310248_messenger_osinting.chat_members (
    chat_id   UUID NOT NULL REFERENCES t_p59310248_messenger_osinting.chats(id),
    user_id   UUID NOT NULL REFERENCES t_p59310248_messenger_osinting.users(id),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON t_p59310248_messenger_osinting.chat_members(user_id);