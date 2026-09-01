import type { Kline } from '../types';
import { QueryBuilder, type InsertStatement } from './query-builder';

export interface InsertChunks {
  groups: InsertStatement[][];
  totalStmts: number;
}

const STATEMENTS_PER_BATCH = 40;
const ROWS_PER_STATEMENT = 14;

export function chunkKlines<T>(rows: T[], rowsPerStmt = 14): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += rowsPerStmt) {
    chunks.push(rows.slice(i, i + rowsPerStmt));
  }
  return chunks;
}

export function buildKlineInsertChunks(symbol: string, klines: Kline[]): InsertChunks {
  const qb = new QueryBuilder();

  // Split klines into chunks to avoid SQL parameter limits
  const rowChunks: Kline[][] = [];
  for (let i = 0; i < klines.length; i += ROWS_PER_STATEMENT) {
    rowChunks.push(klines.slice(i, i + ROWS_PER_STATEMENT));
  }

  // Build INSERT statements using QueryBuilder
  const statements = rowChunks.map((rows) => {
    const stmt = qb.insertMany('klines', rows, { symbol });
    // Modify SQL to add INSERT OR IGNORE directive
    const sqlWithIgnore = stmt.sql.replace('INSERT INTO', 'INSERT OR IGNORE INTO');
    return { sql: sqlWithIgnore, params: stmt.params };
  });

  // Group statements into batches
  const groups: InsertStatement[][] = [];
  for (let i = 0; i < statements.length; i += STATEMENTS_PER_BATCH) {
    groups.push(statements.slice(i, i + STATEMENTS_PER_BATCH));
  }

  return { groups, totalStmts: statements.length };
}