-- rekaman jalannya Orchestra AI (chat live maupun simulasi) per pengguna, untuk ditinjau ulang seperti percakapan
CREATE TABLE IF NOT EXISTS orchestra_runs (
    id         TEXT PRIMARY KEY,
    owner      TEXT NOT NULL,
    source     TEXT NOT NULL CHECK (source IN ('live', 'simulation')),
    scenario   TEXT NOT NULL DEFAULT '',
    prompt     TEXT NOT NULL DEFAULT '',
    steps      JSONB NOT NULL DEFAULT '[]',
    total_ms   INTEGER NOT NULL DEFAULT 0,
    tokens     INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS orchestra_runs_owner_idx ON orchestra_runs (owner, created_at DESC);
