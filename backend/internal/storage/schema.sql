CREATE TABLE IF NOT EXISTS uploads (
    id           TEXT PRIMARY KEY,
    key          TEXT NOT NULL UNIQUE,
    owner        TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size         BIGINT NOT NULL,
    detection    TEXT,
    created_at   BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS uploads_owner_day_idx ON uploads (owner, created_at DESC);
