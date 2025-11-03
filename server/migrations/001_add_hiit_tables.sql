-- /server/migrations/001_add_hiit_tables.sql
CREATE TABLE IF NOT EXISTS hiit_exercise (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  category      TEXT,
  equipment     TEXT,
  default_work_sec INTEGER,
  default_reps  INTEGER,
  notes         TEXT,
  is_bilateral  INTEGER DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hiit_workout (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  tags_json     TEXT,
  warmup_sec    INTEGER DEFAULT 0,
  cooldown_sec  INTEGER DEFAULT 0,
  version       INTEGER DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hiit_step (
  id               TEXT PRIMARY KEY,
  workout_id       TEXT NOT NULL REFERENCES hiit_workout(id) ON DELETE CASCADE,
  "order"          INTEGER NOT NULL,
  exercise_id      TEXT REFERENCES hiit_exercise(id),
  mode             TEXT CHECK (mode IN ('time','reps')) NOT NULL DEFAULT 'time',
  work_sec         INTEGER,
  reps             INTEGER,
  rest_sec         INTEGER DEFAULT 0,
  rounds           INTEGER DEFAULT 1,
  sets             INTEGER DEFAULT 1,
  inter_set_rest_sec INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hiit_session (
  id            TEXT PRIMARY KEY,
  workout_id    TEXT NOT NULL REFERENCES hiit_workout(id),
  start_at      DATETIME,
  end_at        DATETIME,
  rpe           INTEGER,
  notes         TEXT
);

CREATE TABLE IF NOT EXISTS hiit_session_detail (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES hiit_session(id) ON DELETE CASCADE,
  step_id       TEXT REFERENCES hiit_step(id),
  "set"         INTEGER,
  "round"       INTEGER,
  actual_work_ms INTEGER,
  actual_rest_ms INTEGER,
  skipped       INTEGER DEFAULT 0
);