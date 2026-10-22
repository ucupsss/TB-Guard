-- riwayat chat agen AI per pengguna; seluruh isi percakapan disimpan sebagai JSONB
CREATE TABLE IF NOT EXISTS agent_chats (
    id         TEXT PRIMARY KEY,
    owner      TEXT NOT NULL,
    title      TEXT NOT NULL DEFAULT '',
    pinned     BOOLEAN NOT NULL DEFAULT FALSE,
    model      TEXT NOT NULL DEFAULT '',
    turns      JSONB NOT NULL DEFAULT '[]',
    history    JSONB NOT NULL DEFAULT '[]',
    tokens     BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_chats_owner_idx ON agent_chats (owner, updated_at DESC);
