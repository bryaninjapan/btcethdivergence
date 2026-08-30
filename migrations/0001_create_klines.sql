CREATE TABLE klines (
  symbol TEXT NOT NULL,
  open_time INTEGER NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  PRIMARY KEY (symbol, open_time)
);

CREATE INDEX idx_klines_time ON klines (open_time);