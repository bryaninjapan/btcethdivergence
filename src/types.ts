export interface Env {
  DB: D1Database;
}

export interface Kline {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

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