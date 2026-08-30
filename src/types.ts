export interface Env {
  DB: D1Database;
  INGEST_TOKEN: string;
}

export interface Kline {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type BinanceKlineTuple = readonly [
  openTime: number,
  open: string,
  high: string,
  low: string,
  close: string,
  volume: string,
  ...rest: unknown[],
];

export interface DivergenceRecord {
  id: number;
  start_time: number;
  end_time: number;
  type: string;
  notes: string;
  tags: string;
  created_at: number;
  updated_at: number;
}