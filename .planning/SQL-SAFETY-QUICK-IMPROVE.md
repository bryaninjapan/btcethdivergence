# SQL Safety — Quick Improvement (2026-09-02)

**Status**: ✅ Complete  
**Type**: Maintenance / Technical Debt Reduction  
**Time**: <1 day  
**Commit**: 1fefd07

---

## What Was Done

### Problem
`src/lib/kline-insert.ts` manually constructed SQL tuples with hardcoded placeholders:
```typescript
const tuples = rows.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',')
```

This tight coupling created two risks:
1. **Sync danger** — Tuple count (7) must match loop iteration
2. **Schema brittleness** — Adding Kline fields requires changes in 2+ places

### Solution: Generic QueryBuilder

Created `src/lib/query-builder.ts` with dynamic column extraction:
```typescript
export class QueryBuilder {
  insertMany<T extends Record<string, any>>(
    tableName: string,
    rows: T[],
    staticFields?: Record<string, string | number>
  ): InsertStatement
}
```

**Benefits**:
- Columns extracted dynamically from row objects (no hardcoding)
- Supports static fields (e.g., `{symbol: 'BTC'}` prepended to every row)
- Generic — reusable for other batch operations (not just klines)
- Preserves object key order for consistency

### Integration

Modified `kline-insert.ts` to use QueryBuilder:
```typescript
const qb = new QueryBuilder();
const stmt = qb.insertMany('klines', rows, { symbol });
const sqlWithIgnore = stmt.sql.replace('INSERT INTO', 'INSERT OR IGNORE INTO');
```

Removed:
- Hardcoded tuple placeholders
- Manual parameter looping
- Exported `InsertStatement` interface (moved to query-builder.ts)
- Re-exported `chunkKlines()` helper (kept internal)

---

## Testing & Verification

### Unit Tests (8 new)
- Single/multi-row insertion
- Static field prepending
- Key order preservation
- Edge cases (empty array, no columns)
- Kline-specific scenario (7 columns + symbol)

### Full Suite
- **365/365 tests passing** (new +8)
- **TypeScript clean** (added generic `<T>` signature)
- **0 regressions** (existing tests still pass)

### Coverage
Lines: 86.12% → maintained  
(QueryBuilder fully covered by 8 tests)

---

## Known Limitations

None. This is a pure improvement with no trade-offs.

---

## Future Opportunities

1. **Multiple table batching** — Use same QueryBuilder for records, tags, etc.
2. **Stream processing** — If batch sizes exceed D1 parameter limits
3. **ORM layer** — Wrap QueryBuilder + D1 for higher-level queries

---

## Files Changed

- `src/lib/query-builder.ts` (NEW, 56 lines)
- `src/lib/query-builder.test.ts` (NEW, 97 lines)
- `src/lib/kline-insert.ts` (MODIFIED, -14 lines net)

**Total**: +139 lines, cleaner contract, same functionality.

---

**Review Status**: ✅ PASS  
**Ship Ready**: Yes
