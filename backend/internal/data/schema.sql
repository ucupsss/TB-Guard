-- Skema TB-Guard. Idempoten: dijalankan setiap start (CREATE ... IF NOT EXISTS).
-- Waktu disimpan sebagai epoch milidetik (BIGINT) agar identik dengan yang dipakai frontend.

CREATE TABLE IF NOT EXISTS devices (
    seq        BIGSERIAL,
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    type       TEXT NOT NULL DEFAULT 'cough',
    status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'broken')),
    location   TEXT NOT NULL DEFAULT '',
    zone       TEXT NOT NULL DEFAULT '',
    city       TEXT NOT NULL DEFAULT '',
    mics       INTEGER NOT NULL DEFAULT 4,
    mic_array  TEXT NOT NULL DEFAULT '',
    camera     TEXT NOT NULL DEFAULT '',
    fw         TEXT NOT NULL DEFAULT '',
    installed  TEXT NOT NULL DEFAULT '',
    last_seen  BIGINT NOT NULL DEFAULT 0,
    lat        DOUBLE PRECISION NOT NULL DEFAULT 0,
    lng        DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS detections (
    uuid       TEXT PRIMARY KEY,
    device_id  INTEGER NOT NULL,
    time       BIGINT NOT NULL,
    type       TEXT NOT NULL DEFAULT 'Batuk',
    result     TEXT NOT NULL CHECK (result IN ('TB', 'NEG')),
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
    name       TEXT NOT NULL DEFAULT '',
    gender     TEXT NOT NULL DEFAULT '',
    age        JSONB NOT NULL DEFAULT '""',
    doa        JSONB NOT NULL DEFAULT '{}',
    person     JSONB NOT NULL DEFAULT '{}',
    reviewed   BOOLEAN NOT NULL DEFAULT FALSE,
    coughs     INTEGER NOT NULL DEFAULT 1,
    verified   TEXT CHECK (verified IN ('TB', 'NEG'))
);
CREATE INDEX IF NOT EXISTS detections_time_idx ON detections (time DESC);
CREATE INDEX IF NOT EXISTS detections_device_idx ON detections (device_id, time DESC);

CREATE TABLE IF NOT EXISTS patients (
    seq        BIGSERIAL,
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    gender     TEXT NOT NULL DEFAULT 'L',
    age        JSONB NOT NULL DEFAULT '""',
    nik        TEXT NOT NULL DEFAULT '',
    phone      TEXT,
    facility   TEXT NOT NULL DEFAULT '',
    stage      INTEGER NOT NULL DEFAULT 0 CHECK (stage BETWEEN 0 AND 4),
    start_ts   BIGINT NOT NULL DEFAULT 0,
    days_in    INTEGER NOT NULL DEFAULT 0,
    uuid       TEXT NOT NULL DEFAULT '',
    device_id  INTEGER,
    adherence  DOUBLE PRECISION,
    next_visit BIGINT,
    pic        TEXT NOT NULL DEFAULT '',
    events     JSONB NOT NULL DEFAULT '[]'
);

-- dataset penelitian (webform / offline / primer): baris disimpan apa adanya sebagai JSONB
CREATE TABLE IF NOT EXISTS dataset_rows (
    seq  BIGSERIAL,
    kind TEXT NOT NULL CHECK (kind IN ('webform', 'offline', 'primer')),
    id   TEXT NOT NULL,
    time BIGINT NOT NULL,
    data JSONB NOT NULL,
    PRIMARY KEY (kind, id)
);

-- penanda seed awal agar data contoh tidak muncul lagi setelah pengguna menghapusnya
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY);
