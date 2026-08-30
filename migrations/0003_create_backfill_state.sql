CREATE TABLE backfill_state (
  symbol TEXT PRIMARY KEY,
  cursor_open_time INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);