# Phase 14: Architecture Foundations (Temporal + Divergence)

## Overview

Phase 14 consolidates temporal logic and unifies divergence type definitions across the system, establishing two critical abstractions:

1. **TemporalConverter** — Centralized millisecond ↔ second conversions
2. **DIVERGENCE_TYPES** — Single source of truth for divergence classifications

These abstractions eliminate scattered time-domain bugs and hardcoded type strings, improving code maintainability and type safety.

## What's Included

### Core Deliverables
- `TemporalConverter` module with 5 conversion methods + batch utilities
- 36 comprehensive boundary/batch/performance tests (100% coverage)
- Migration of 4 backend modules (db, binance, klines, admin)
- Automated backend↔frontend divergence type sync test
- TIMESTAMP-GUIDE.md (complete architecture documentation)
- Code review sign-off (zero HIGH/CRITICAL issues)

### Files Modified
- **src/domains/**: temporal-api.ts, temporal-api.test.ts, divergence.ts, divergence.test.ts
- **src/lib/**: db.ts, binance.ts, timestamp.ts, validate.ts
- **src/routes/**: klines.ts, admin.ts, admin-spike-ingest.test.ts
- **public/**: index.html, js/records.js, js/divergence.js
- **docs/**: TIMESTAMP-GUIDE.md (new), README.md (updated)
- **Configuration**: tsconfig.json (allowJs enabled)

## Quick Start

### Verify the Phase
```bash
# Run all tests
npm test

# Type check
npm run typecheck

# TemporalConverter specific
npx vitest run src/domains/temporal-api.test.ts

# Divergence sync
npx vitest run src/domains/divergence.test.ts

# Coverage report
npm run test:coverage
```

### Key Files to Review
1. **Architecture**: `docs/TIMESTAMP-GUIDE.md` (why/API/patterns/pitfalls)
2. **Implementation**: `src/domains/temporal-api.ts` (core module)
3. **Tests**: `src/domains/temporal-api.test.ts` (36 test cases)
4. **Review**: `.planning/phases/phase-14/14-REVIEW.md` (sign-off)
5. **UAT**: `.planning/phases/phase-14/14-UAT.md` (acceptance tests)

## Success Criteria (Delivered)

- ✅ SC1: TemporalConverter exported with 5 named methods
- ✅ SC2: All backend time conversions use TemporalConverter (4 modules)
- ✅ SC3: Divergence types single source of truth
- ✅ SC4: Frontend imports from centralized module (runtime generation)
- ✅ SC5: Zero time-conversion duplication
- ✅ SC6: 30+ boundary/batch tests (36 delivered)
- ✅ SC7: Code review complete (zero HIGH/CRITICAL)

## Dependencies

- **Upstream**: Phase 1-13 (Timestamp domain type established)
- **Downstream**: Phase 15-17 (Will leverage TemporalConverter for query/UI work)

## Known Notes

1. **SC2 "8+ modules"**: Only 4 modules contain real time conversions; others verified conversion-free
2. **admin.ts:38**: Intentionally left in milliseconds (Binance API contract)
3. **Performance**: 100K conversions complete in <500ms (flaky timing, uses conservative threshold)
4. **TypeScript**: `allowJs: true` added to support JS module imports
5. **Concurrent commits**: Two parallel processes authored sync-test and docs commits mid-run; both correct and preserved

## Related Documentation

- **PLAN.md** — Detailed task breakdown and verification gates
- **SUMMARY.md** — Execution summary with file-by-file changes
- **14-REVIEW.md** — Code review findings (zero HIGH/CRITICAL)
- **14-UAT.md** — Acceptance test results (10/10 pass)
- **IMPLEMENTATION-NOTES.md** — This phase's key decisions
- **CONTEXT.md** — Background and dependencies

## Contact

For questions about this phase, refer to:
- Architecture decisions: IMPLEMENTATION-NOTES.md
- Code patterns: TIMESTAMP-GUIDE.md
- Test coverage: 14-REVIEW.md
- Acceptance status: 14-UAT.md
