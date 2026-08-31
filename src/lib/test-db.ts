import type { DivergenceRecord, Kline } from '../types';

/**
 * In-memory mock of the D1Database interface for service unit tests.
 *
 * The mock parses the exact SQL shapes emitted by `src/lib/db.ts` and
 * applies the same semantics over in-memory rows:
 *   - `SELECT ... FROM <table> WHERE type = ? AND tags LIKE ? ESCAPE ? ...`
 *     filters rows (type equality + escape-aware LIKE matching)
 *   - `WHERE symbol = ?` / `WHERE id = ?` / `open_time BETWEEN ? AND ?`
 *   - `ORDER BY <col> DESC`
 *   - `INSERT ... RETURNING *` returns the inserted row via `first()`
 *   - `UPDATE ... SET <cols> ... WHERE id = ?` merges and persists
 *   - `DELETE ... WHERE id = ?` removes and reports `meta.changes`
 *   - `INSERT OR IGNORE INTO klines` skips rows whose (symbol, open_time)
 *     primary key already exists
 *   - `INSERT INTO backfill_state ... ON CONFLICT(symbol) DO UPDATE` upserts
 *   - `batch(statements)` accepts an array of prepared-statement objects
 *     (as `insertKlinesBatch` passes them) and executes each in order
 *
 * Tracking: `prepares` records every SQL string, `calls` records every
 * bind() param array, and `failNext()` forces the next statement
 * execution (all/first/run/batch) to throw so services' error translation
 * can be exercised.
 */

type TableName = 'divergence_records' | 'klines' | 'backfill_state';

interface Row {
  [key: string]: unknown;
}

interface BoundStatement {
  sql: string;
  params: unknown[];
  run(): Promise<D1Result>;
  first<T>(colName?: string): Promise<T | null>;
  all<T>(): Promise<D1Result<T>>;
  raw<T>(): Promise<T[]>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: {
    duration: number;
    changes: number;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
  };
}

export interface MockD1Database {
  prepare(sql: string): { bind(...params: unknown[]): BoundStatement };
  batch<T = unknown>(statements: BoundStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
  dump(): Promise<ArrayBuffer>;
  // Tracking / test helpers (not part of the D1 interface)
  prepares: string[];
  calls: unknown[][];
  failNext(method: 'all' | 'first' | 'run' | 'batch'): void;
  rowsOf(table: TableName): Row[];
  setRows(table: TableName, rows: unknown[]): void;
}

function emptyMeta(changes = 0): D1Result['meta'] {
  return {
    duration: 0,
    changes,
    last_row_id: 0,
    rows_read: 0,
    rows_written: changes,
  };
}

function success(changes = 0): D1Result {
  return { success: true, meta: emptyMeta(changes) };
}

/**
 * Escape-aware `LIKE` matching used by `tags LIKE ? ESCAPE '\'`.
 * Mirrors SQLite: `%` matches any sequence, `_` matches one char,
 * an escaped char (`\x`) matches the literal char x.
 */
function likeMatch(pattern: string, text: string, escapeChar: string): boolean {
  let patIdx = 0;
  let textIdx = 0;
  while (patIdx < pattern.length && textIdx < text.length) {
    if (pattern[patIdx] === escapeChar && patIdx + 1 < pattern.length) {
      if (pattern[patIdx + 1] !== text[textIdx]) return false;
      patIdx += 2;
      textIdx += 1;
    } else if (pattern[patIdx] === '%') {
      if (patIdx === pattern.length - 1) return true;
      const nextPat = pattern.slice(patIdx + 1);
      let nextCharIdx = -1;
      if (nextPat[0] === escapeChar && nextPat.length > 1) {
        nextCharIdx = text.indexOf(nextPat[1], textIdx);
      } else if (nextPat[0] !== '%' && nextPat[0] !== '_') {
        nextCharIdx = text.indexOf(nextPat[0], textIdx);
      }
      if (nextCharIdx === -1) {
        return likeMatch(nextPat, text.slice(textIdx), escapeChar);
      }
      if (likeMatch(nextPat, text.slice(nextCharIdx), escapeChar)) return true;
      textIdx += 1;
    } else if (pattern[patIdx] === '_') {
      patIdx += 1;
      textIdx += 1;
    } else {
      if (pattern[patIdx] !== text[textIdx]) return false;
      patIdx += 1;
      textIdx += 1;
    }
  }
  if (patIdx === pattern.length) return textIdx === text.length;
  return pattern[patIdx] === '%';
}

function tableOf(sql: string): TableName | null {
  const into = /INTO\s+(\w+)/i.exec(sql)?.[1];
  if (into) return into as TableName;
  const from = /FROM\s+(\w+)/i.exec(sql)?.[1];
  if (from) return from as TableName;
  const update = /^UPDATE\s+(\w+)/i.exec(sql)?.[1];
  if (update) return update as TableName;
  const del = /^DELETE\s+FROM\s+(\w+)/i.exec(sql)?.[1];
  if (del) return del as TableName;
  return null;
}

/**
 * Applies the WHERE conditions found in `sql` to `rows`, consuming
 * bound params in the order the conditions appear in the SQL text.
 */
function applyWhere(sql: string, params: unknown[], rows: Row[]): Row[] {
  let filtered = rows;
  const param = (i: number): unknown => params[i];

  // Strip the SELECT column list (e.g. "SELECT cursor_open_time FROM ...")
  const condSql = sql.replace(/^SELECT\s+.*?\s+FROM\s+\w+/i, '');

  const typeIdx = condSql.indexOf('type = ?');
  const likeIdx = condSql.indexOf('tags LIKE ? ESCAPE ?');
  const symbolIdx = condSql.indexOf('symbol = ?');
  const betweenIdx = condSql.indexOf('open_time BETWEEN ? AND ?');
  const idIdx = condSql.indexOf('id = ?');

  // Conditions are applied in the order their params appear in the SQL.
  const steps: { idx: number; kind: 'type' | 'like' | 'symbol' | 'between' | 'id' }[] = [];
  if (typeIdx !== -1) steps.push({ idx: typeIdx, kind: 'type' });
  if (likeIdx !== -1) steps.push({ idx: likeIdx, kind: 'like' });
  if (symbolIdx !== -1) steps.push({ idx: symbolIdx, kind: 'symbol' });
  if (betweenIdx !== -1) steps.push({ idx: betweenIdx, kind: 'between' });
  if (idIdx !== -1) steps.push({ idx: idIdx, kind: 'id' });
  steps.sort((a, b) => a.idx - b.idx);

  let paramCursor = 0;
  for (const step of steps) {
    switch (step.kind) {
      case 'type': {
        const type = param(paramCursor);
        paramCursor += 1;
        filtered = filtered.filter((r) => r.type === type);
        break;
      }
      case 'like': {
        const pattern = String(param(paramCursor));
        const escapeChar = String(param(paramCursor + 1));
        paramCursor += 2;
        filtered = filtered.filter((r) => likeMatch(pattern, String(r.tags ?? ''), escapeChar));
        break;
      }
      case 'symbol': {
        const symbol = param(paramCursor);
        paramCursor += 1;
        filtered = filtered.filter((r) => r.symbol === symbol);
        break;
      }
      case 'between': {
        const start = Number(param(paramCursor));
        const end = Number(param(paramCursor + 1));
        paramCursor += 2;
        filtered = filtered.filter((r) => {
          const t = Number(r.open_time);
          return t >= start && t <= end;
        });
        break;
      }
      case 'id': {
        const id = Number(param(paramCursor));
        paramCursor += 1;
        filtered = filtered.filter((r) => Number(r.id) === id);
        break;
      }
    }
  }
  return filtered;
}

function applyOrderBy(sql: string, rows: Row[]): Row[] {
  const m = /ORDER BY\s+(\w+)(\s+(ASC|DESC))?/i.exec(sql);
  if (!m) return rows;
  const col = m[1];
  const desc = /DESC/i.test(m[2] ?? '');
  return [...rows].sort((a, b) => {
    const av = a[col] ?? 0;
    const bv = b[col] ?? 0;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return desc ? -cmp : cmp;
  });
}

function selectRows(sql: string, params: unknown[], tables: Record<string, Row[]>): Row[] {
  const table = tableOf(sql);
  const rows = (table ? tables[table] ?? [] : []) as Row[];
  return applyOrderBy(sql, applyWhere(sql, params, rows));
}

function insertColumns(sql: string): string[] {
  const m = /\((.*?)\)\s*(?:VALUES|SELECT)/is.exec(sql);
  return m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
}

function nextId(rows: Row[]): number {
  return rows.reduce((max, r) => Math.max(max, Number(r.id) ?? 0), 0) + 1;
}

export function createMockD1Database(): MockD1Database {
  const tables: Record<string, Row[]> = {
    divergence_records: [],
    klines: [],
    backfill_state: [],
  };
  const prepares: string[] = [];
  const calls: unknown[][] = [];
  const failures: string[] = [];

  function nextFailure(method: 'all' | 'first' | 'run' | 'batch'): string | null {
    if (failures.length === 0) return null;
    const idx = failures.indexOf(method);
    if (idx === -1) return null;
    failures.splice(idx, 1);
    return method;
  }

  function mutate(sql: string, params: unknown[], tables: Record<string, Row[]>): number {
    const table = tableOf(sql);
    if (!table) throw new Error(`test-db: cannot resolve table for "${sql}"`);
    const rows = tables[table];

    if (/^INSERT\s+OR\s+IGNORE/i.test(sql.trim())) {
      // klines bulk insert: skip rows whose (symbol, open_time) PK exists
      const cols = insertColumns(sql);
      let inserted = 0;
      for (let i = 0; i + cols.length <= params.length; i += cols.length) {
        const row: Row = {};
        cols.forEach((col, j) => {
          row[col] = params[i + j];
        });
        const exists = rows.some(
          (r) => r.symbol === row.symbol && r.open_time === row.open_time,
        );
        if (!exists) {
          rows.push(row);
          inserted += 1;
        }
      }
      return inserted;
    }

    if (/^INSERT/i.test(sql.trim())) {
      const cols = insertColumns(sql);
      const row: Row = {};
      cols.forEach((col, j) => {
        row[col] = params[j];
      });
      // backfill_state upsert: ON CONFLICT(symbol) DO UPDATE ... — update the
      // existing row in place instead of inserting a duplicate.
      if (/ON\s+CONFLICT\s*\(\s*symbol\s*\)/i.test(sql) && table === 'backfill_state') {
        const existing = rows.find((r) => r.symbol === row.symbol);
        if (existing) {
          cols.forEach((col) => {
            if (col !== 'symbol') existing[col] = row[col];
          });
          return 1;
        }
        rows.push(row);
        return 1;
      }
      // divergence_records rows get an auto-increment id when the INSERT
      // omits it (RETURNING * includes the assigned id).
      if (table === 'divergence_records' && !('id' in row)) {
        row.id = nextId(rows);
      }
      if ('created_at' in cols && row.created_at === undefined) {
        row.created_at = nextId(rows) - 1;
      }
      if ('updated_at' in cols && row.updated_at === undefined) {
        row.updated_at = row.created_at;
      }
      rows.push(row);
      return 1;
    }

    if (/^UPDATE/i.test(sql.trim())) {
      const setMatch = /SET\s+(.*?)\s+WHERE/i.exec(sql);
      const whereMatch = /WHERE\s+(.*?)$/i.exec(sql);
      if (!setMatch) throw new Error(`test-db: cannot parse UPDATE "${sql}"`);
      const setCols = setMatch[1].split(',').map((s) => {
        const col = /^\s*(\w+)\s*=\s*\?/.exec(s)?.[1];
        if (!col) throw new Error(`test-db: cannot parse SET column in "${sql}"`);
        return col;
      });
      const setValues = params.slice(0, setCols.length);
      const idParam = params[setCols.length];
      const idCol = whereMatch?.[1].includes('id = ?') ? 'id' : null;
      const target = idCol !== null ? Number(idParam) : undefined;
      let changes = 0;
      for (const row of rows) {
        const match = target !== undefined ? Number(row.id) === target : true;
        if (!match) continue;
        setCols.forEach((col, j) => {
          row[col] = setValues[j];
        });
        changes += 1;
      }
      return changes;
    }

    if (/^DELETE/i.test(sql.trim())) {
      const filtered = applyWhere(sql, params, rows);
      for (const row of filtered) {
        const idx = rows.indexOf(row);
        if (idx !== -1) rows.splice(idx, 1);
      }
      return filtered.length;
    }

    throw new Error(`test-db: unsupported statement "${sql}"`);
  }

  function buildBound(sql: string, params: unknown[]): BoundStatement {
    const throwIfFailed = (method: 'all' | 'first' | 'run') => {
      const failed = nextFailure(method);
      if (failed !== null) {
        throw new Error(`test-db: simulated ${failed} failure`);
      }
    };

    return {
      sql,
      params,
      run: async () => {
        throwIfFailed('run');
        const changes = mutate(sql, params, tables);
        return success(changes);
      },
      first: async <T>(colName?: string) => {
        throwIfFailed('first');
        // INSERT ... RETURNING *: apply the mutation, then serve the
        // just-inserted row (D1's .first() on a RETURNING INSERT).
        if (/^INSERT/i.test(sql.trim())) {
          const changes = mutate(sql, params, tables);
          if (changes === 0) return null;
          const table = tableOf(sql);
          const rows = table ? tables[table] : [];
          const row = rows[rows.length - 1];
          if (colName !== undefined) return (row[colName] as T) ?? null;
          return row as T;
        }
        const rows = selectRows(sql, params, tables);
        const firstRow = rows[0];
        if (!firstRow) return null;
        if (colName !== undefined) {
          return (firstRow[colName] as T) ?? null;
        }
        return firstRow as T;
      },
      all: async <T>() => {
        throwIfFailed('all');
        const rows = selectRows(sql, params, tables);
        return { success: true, results: rows as T[], meta: emptyMeta() };
      },
      raw: async <T>() => {
        throwIfFailed('all');
        const rows = selectRows(sql, params, tables);
        return rows.map((r) => Object.values(r)) as T[];
      },
    };
  }

  return {
    prepare(sql: string) {
      prepares.push(sql);
      return {
        bind(...params: unknown[]) {
          calls.push(params);
          return buildBound(sql, params);
        },
      };
    },
    batch: async <T>(statements: BoundStatement[]) => {
      const failed = nextFailure('batch');
      if (failed !== null) {
        throw new Error('test-db: simulated batch failure');
      }
      const results: D1Result<T>[] = [];
      for (const stmt of statements) {
        const changes = mutate(stmt.sql, stmt.params, tables);
        results.push({ success: true, meta: emptyMeta(changes) } as D1Result<T>);
      }
      return results;
    },
    exec: async () => success(),
    dump: async () => new ArrayBuffer(0),
    prepares,
    calls,
    failNext(method) {
      failures.push(method);
    },
    rowsOf(table) {
      return tables[table];
    },
    setRows(table, rows) {
      // Clone rows so mutations (UPDATE/DELETE) never leak into the caller's
      // fixtures or shared across tests.
      tables[table] = rows.map((r) => ({ ...(r as Row) }));
    },
  };
}

/**
 * Returns a fresh mock pre-populated with the given rows, keyed by table.
 * Convenience wrapper around createMockD1Database().
 */
export function createMockD1WithData(initialData: {
  divergence_records?: DivergenceRecord[];
  klines?: (Kline & { symbol?: string })[];
  backfill_state?: { symbol: string; cursor_open_time: number; updated_at: number }[];
}): MockD1Database {
  const db = createMockD1Database();
  if (initialData.divergence_records) {
    db.setRows('divergence_records', initialData.divergence_records);
  }
  if (initialData.klines) {
    db.setRows('klines', initialData.klines);
  }
  if (initialData.backfill_state) {
    db.setRows('backfill_state', initialData.backfill_state);
  }
  return db;
}