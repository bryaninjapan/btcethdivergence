# Roadmap: BTC/ETH Divergence Tracker

## Milestones

- ✅ **v1.0 MVP** — Phases 1-13 (shipped 2026-08-30)
- ✅ **v2.0 Architecture Deepening** — Phases 14-17 (shipped 2026-09-03)
- 🚧 **v3.0 Future** — Phase 18+ (planning)

---

## Active Development

### v2.0 Complete ✅

<details open>
<summary>✅ v2.0: Architecture Deepening (Phases 14-17) — SHIPPED 2026-09-03</summary>

**Timeline**: 2 days (2026-09-02 → 2026-09-03)

#### Phase 14: Architecture Foundations (Temporal + Divergence)
- Centralized temporal API (`TemporalConverter`)
- Unified divergence type definitions
- 30+ unit tests, zero HIGH issues

#### Phase 15: Frontend State Refactoring (ChartManager)
- Merged 4 chart modules into unified state machine
- Re-entrancy guards for race-condition-free sync
- 62 tests (49 unit + 13 integration), 81/81 E2E pass

#### Phase 16A: Structured Logging System
- Custom lightweight logger (no dependencies, preserves no-build)
- ChartManager/charts/records instrumented
- Workers Logs enabled, 100% head sampling

#### Phase 16: Backend Service Deepening (RecordsRepository)
- Extracted all records SQL into rich service
- `findByTimeRange()` with overlap semantics
- `listWithStats()` with JS-computed aggregates
- Routes simplified to ≤10 LOC

#### Phase 17: Future-Proofing (Calculator Validation)
- Zod schemas for calculator input/output
- API endpoint stubs (POST /validate, /compute → 501)
- Frontend mirror + parity tests
- 57 tests (42 unit + 15 contract), 100% coverage on new code

**Quality Summary**:
- ✅ 628 tests (42 files), 88.42% coverage (≥85%)
- ✅ TypeScript clean, zero regressions
- ✅ 0 new technical debt
- ✅ All v1 requirements (41/41) still met

</details>

---

## Historical Milestones

<details>
<summary>✅ v1.0: MVP (Phases 1-13) — SHIPPED 2026-08-30</summary>

**Delivered:**
- Worker + D1 infrastructure (Phase 1)
- Binance kline ingestion + daily cron (Phases 2-3)
- Records CRUD + filtering (Phases 4-5)
- Dual chart rendering + time sync (Phases 6-7)
- Leverage calculator (Phase 8)
- CF Access gating + navigation (Phase 9)
- Timestamp abstraction (Phase 10)
- Structured error handling (Phase 11)
- Service layer pattern (Phase 12)
- Frontend state isolation (Phase 13)

**Coverage**: 41/41 v1 requirements ✅

</details>

---

## What's Next

### v3.0 Planning: Phase 18+

User-driven features:
- **Phase 18**: Analytics Dashboard
  - Aggregate stats (records per type, avg duration, frequency over time)
  - CSV export
  
- Enhanced Charts
  - Divergence record markers (vertical lines)
  - Click-to-record linking

- Automated Detection (optional)
  - ML-based pattern recognition
  - Real-time alerts (deferred, depends on detection)

---

## Archive

Full phase details, requirements traceability, and quality metrics for each milestone are archived in `.planning/milestones/`:

- `v1.0-ROADMAP.md` — Phase 1-13 details
- `v1.0-REQUIREMENTS.md` — 41 completed v1 requirements
- `v2.0-ROADMAP.md` — Phase 14-17 details, decisions, metrics
- `v2.0-REQUIREMENTS.md` — v1 completion summary + v2 backlog

---

## Quick Reference

| Milestone | Phases | Status | Date | Tests | Coverage |
|-----------|--------|--------|------|-------|----------|
| v1.0 MVP | 1-13 | ✅ Shipped | 2026-08-30 | 571 | 86.12% |
| v2.0 Architecture | 14-17 | ✅ Shipped | 2026-09-03 | 628 | 88.42% |
| v3.0 Future | 18+ | 🚧 Planning | TBD | — | — |

---

*For detailed phase plans, quality gates, and technical decisions, see archived milestones in `.planning/milestones/`*
