---
date: 2026-09-01
goal: Unify divergence type definitions across backend (validate.ts) and frontend (records.js)
estimate: 35 minutes
---

# Candidate #5: Shared Enum Definition

## Problem
- `validate.ts` defines DIVERGENCE_TYPES enum twice (lines 3 & 33) — duplication
- `records.js` hardcodes TYPE_LABELS without backend reference
- Changing a type requires updates in 3 places (validate.ts 2x, records.js 1x)

## Solution
Create shared constant definitions:
1. **Backend**: `src/domains/divergence.ts` — define DIVERGENCE_TYPES + TYPE_LABELS
2. **Frontend**: `public/js/divergence.js` — mirror same constants
3. **Refactor**: `validate.ts` imports DIVERGENCE_TYPES, eliminates duplication
4. **Refactor**: `records.js` imports TYPE_LABELS

## Tasks

### T1: Create backend constant file (src/domains/divergence.ts)
- [ ] Create `src/domains/` directory if not exists
- [ ] Define `DIVERGENCE_TYPES` as const array: `['time_lag', 'structural', 'opposite']`
- [ ] Define `TYPE_LABELS` mapping: `{ time_lag: '時間差', structural: '結構背離', opposite: '完全反向' }`
- [ ] Export both constants

### T2: Create frontend constant file (public/js/divergence.js)
- [ ] Create `public/js/divergence.js`
- [ ] Mirror same `DIVERGENCE_TYPES` constant
- [ ] Mirror same `TYPE_LABELS` mapping
- [ ] Use ES6 module export

### T3: Refactor validate.ts
- [ ] Import DIVERGENCE_TYPES from `../domains/divergence`
- [ ] Replace hardcoded enum on line 3 with `z.enum(DIVERGENCE_TYPES)`
- [ ] Remove duplicate enum on line 33 in listRecordsQuerySchema
- [ ] Run type check to verify no regressions

### T4: Refactor records.js
- [ ] Import TYPE_LABELS from `./divergence.js`
- [ ] Remove hardcoded TYPE_LABELS constant (lines 14-18)
- [ ] Update typeLabel() function to use imported TYPE_LABELS
- [ ] Verify no TypeScript errors in tests

### T5: Verification
- [ ] Run `npm run typecheck`
- [ ] Run `npm test` (validate.ts tests + records.js tests)
- [ ] All tests pass

### T6: Commit
- [ ] Stage all files
- [ ] Commit with message: `refactor(#5): unify divergence type definitions across backend and frontend`

## Expected Benefits
✅ No more duplication in validate.ts (1 enum definition instead of 2)
✅ Single source of truth for type labels
✅ Type changes now affect 2 files instead of 3
✅ Frontend explicitly imports from backend schema

## Testing
TDD verification already passed all 5 tests:
- Constant array definition works ✓
- Zod accepts imported constants ✓
- TYPE_LABELS covers all types ✓
- Type inference correct ✓
