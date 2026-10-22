CREATE TABLE IF NOT EXISTS users (
    email         TEXT PRIMARY KEY,
    name          TEXT NOT NULL DEFAULT '',
    picture       TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL DEFAULT 'Petugas' CHECK (role IN ('Admin', 'Petugas')),
    disabled      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    BIGINT NOT NULL,
    last_login_at BIGINT NOT NULL,
    login_count   INTEGER NOT NULL DEFAULT 0
);

-- jejak aktivitas pengguna: siapa melakukan apa pada data apa
CREATE TABLE IF NOT EXISTS audit_log (
    id        BIGSERIAL PRIMARY KEY,
    at        BIGINT NOT NULL,
    actor     TEXT NOT NULL,
    action    TEXT NOT NULL,
    entity    TEXT NOT NULL,
    entity_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_log_at_idx ON audit_log (at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log (actor, at DESC);
