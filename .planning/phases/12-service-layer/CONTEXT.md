---
phase: 12
title: "Service Layer Pattern — Architectural Improvement"
date_created: 2026-09-01
status: planning
depends_on: "Phases 1-11 (v1.0), Quick Tasks #2, #3, #5, Technical Debt Cleanup"
---

# Phase 12: Service Layer Pattern

## Context

**Why Now:**
- v1.0 is production-ready (all 11 phases complete, technical debt cleared)
- Routes are mixing HTTP concerns with business logic
- Tests need to isolate business logic from HTTP layer
- Foundation stable enough to refactor confidently

**Current State:**
- Routes handle: validation → business logic → HTTP response
- Example: `records.ts` POST route does: parse body → validate → insert DB → format response
- Problem: Business logic tightly coupled to route handlers, hard to test independently

## Business Context

**Stakeholder:** Developer experience, testability, code maintainability
**Priority:** Medium (infrastructure improvement, not user-facing)
**Timeline:** v1.1 (after v1.0 is production-stable)

## Technical Problem

### Before (Current)
```typescript
// records.ts — route handler mixing concerns
records.post('/api/records', async (c) => {
  const body = await c.req.json();
  const parsed = createRecordSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError(...);
  
  const row = await createRecord(c.env.DB, parsed.data); // DB call mixed in
  return c.json({ ok: true, data: row });
});
```

**Issues:**
- Business logic (`createRecord`) tightly coupled to HTTP handler
- Can't test `createRecord` logic without mocking Hono context
- Validation mixed with business logic
- Response formatting coupled to handler

### After (Target)
```typescript
// services/records.ts — pure business logic
export async function createRecordService(db: D1Database, input: CreateRecordInput) {
  validateRecordInput(input);
  return await insertRecordDB(db, input);
}

// routes/records.ts — thin HTTP layer
records.post('/api/records', async (c) => {
  const body = await c.req.json();
  const parsed = createRecordSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError(...);
  
  const row = await recordService.createRecord(c.env.DB, parsed.data);
  return c.json({ ok: true, data: row });
});
```

**Benefits:**
- Business logic fully testable independently
- Validation layer separated
- Easy to reuse logic across routes (e.g., CLI, batch operations)
- Route handlers thin, focused on HTTP

## Architectural Decisions

### Decision 1: Service vs Repository Pattern

**Chosen:** Service layer (services/) wrapping repository operations

**Rationale:**
- Services handle business logic (validation, orchestration)
- Repositories handle data access (DB queries)
- Clear separation: HTTP → Service → Repository → DB
- Existing DB functions already act as repositories (queryKlines, insertKlinesBatch)

### Decision 2: Service File Organization

**Chosen:** `src/services/` directory with one file per domain

```
src/
├── services/
│   ├── records.service.ts    (createRecord, updateRecord, listRecords, etc.)
│   ├── klines.service.ts     (queryKlines, fetchKlines, etc.)
│   └── admin.service.ts      (backfill, cursor management, etc.)
├── lib/                        (utilities, middleware, types)
├── routes/                     (thin HTTP handlers)
```

**Rationale:**
- Organized by domain (records, klines, admin)
- Clear naming: `*.service.ts`
- Services close to routes they serve
- Same structure as current DB functions

### Decision 3: Input Validation in Services

**Chosen:** Services accept **already-validated input**

```typescript
// routes/records.ts
const parsed = createRecordSchema.safeParse(body);
if (!parsed.success) throw ValidationError(...);

// Pass validated data to service
const row = await recordService.createRecord(parsed.data);

// services/records.service.ts
export async function createRecord(db: D1Database, input: CreateRecordInput) {
  // input is guaranteed valid (via Zod schema in route)
  return await db.prepare(...).bind(input).run();
}
```

**Rationale:**
- Zod validation already at HTTP boundary (validates external input)
- Services trust input is valid
- Avoids double-validation
- Clear responsibility: routes validate, services execute

## Scope & Boundaries

**In Scope:**
- Extract business logic from 3 route files (klines, records, admin)
- Create service layer for each domain
- Update tests to test services independently
- Verify routes still work (integration tests)

**Out of Scope:**
- Refactor DB functions (they already act as repositories)
- Change API contracts
- Change database schema
- Frontend changes

## Success Criteria

1. **Extraction:** All business logic extracted to services/
2. **Testing:** Services have unit tests (no mocking Hono context)
3. **Integration:** Routes use services, still pass integration tests
4. **Code Quality:** Routes reduced to 10-20 lines each (thin layer)
5. **Clarity:** Service responsibilities documented

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Extraction creates bugs | HIGH | Comprehensive tests before/after, route integration tests |
| Over-extraction (too many services) | MEDIUM | Keep services coarse-grained, one per domain |
| Circular dependencies | MEDIUM | Enforce hierarchy: routes → services → repositories |

## Related Requirements

- CODE-04: Route handlers follow service layer pattern
- Implicit: Better testability, code reuse

## Timeline Estimate

- Planning: 0.5 day (this context + PLAN.md)
- Execution: 2-3 days (extraction + testing)
- Review: 0.5 day (code review)
- **Total: 3-4 days**

---

**Next Steps:**
1. Write PLAN.md (task breakdown)
2. Plan check (validate task list)
3. Execute (extract services, test)
4. Code review
5. Verify

---

*Created 2026-09-01 as part of post-v1.0 architecture improvements*
