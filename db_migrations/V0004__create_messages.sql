CREATE TABLE IF NOT EXISTS t_p59310248_messenger_osinting.messages (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id        UUID NOT NULL REFERENCES t_p59310248_messenger_osinting.chats(id),
    sender_id      UUID NOT NULL REFERENCES t_p59310248_messenger_osinting.users(id),
    msg_type       TEXT NOT NULL DEFAULT 'text',
    text           TEXT,
    image_url      TEXT,
    voice_duration INTEGER,
    file_name      TEXT,
    deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p59310248_messenger_osinting.message_reads (
    message_id UUID NOT NULL REFERENCES t_p59310248_messenger_osinting.messages(id),
    user_id    UUID NOT NULL REFERENCES t_p59310248_messenger_osinting.users(id),
    read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS t_p59310248_messenger_osinting.typing_indicators (
    chat_id    UUID NOT NULL REFERENCES t_p59310248_messenger_osinting.chats(id),
    user_id    UUID NOT NULL REFERENCES t_p59310248_messenger_osinting.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON t_p59310248_messenger_osinting.messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender       ON t_p59310248_messenger_osinting.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token        ON t_p59310248_messenger_osinting.sessions(token);
CREATE INDEX IF NOT EXISTS idx_typing_updated        ON t_p59310248_messenger_osinting.typing_indicators(updated_at);
