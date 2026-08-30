import type { Kline } from '../types';

export function chunkKlines<T>(rows: T[], rowsPerStmt = 14): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += rowsPerStmt) {
    chunks.push(rows.slice(i, i + rowsPerStmt));
  }
  return chunks;
}

export interface InsertStatement {
  sql: string;
  params: (string | number)[];
}

export interface InsertChunks {
  groups: InsertStatement[][];
  totalStmts: number;
}

const STATEMENTS_PER_BATCH = 40;

export function buildKlineInsertChunks(symbol: string, klines: Kline[]): InsertChunks {
  const rowChunks = chunkKlines(klines);
  const statements = rowChunks.map((rows) => {
    const tuples = rows.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',');
    const sql = `INSERT OR IGNORE INTO klines (symbol, open_time, open, high, low, close, volume) VALUES ${tuples}`;
    const params: (string | number)[] = [];
    for (const row of rows) {
      params.push(symbol, row.open_time, row.open, row.high, row.low, row.close, row.volume);
    }
    return { sql, params };
  });

  const groups: InsertStatement[][] = [];
  for (let i = 0; i < statements.length; i += STATEMENTS_PER_BATCH) {
    groups.push(statements.slice(i, i + STATEMENTS_PER_BATCH));
  }
  return { groups, totalStmts: statements.length };
}