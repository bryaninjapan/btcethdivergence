# Phase 5 Plan Check — Goal-Backward Verification Report

**Checker:** gsd-plan-checker (adversarial, goal-backward)
**Date:** 2026-08-31
**Phase:** 5 — Records Filtering & Time-Entry UX
**Plan(s) verified:** 05-01-PLAN.md, 05-02-PLAN.md
**Status:** ISSUES FOUND — 0 blocker(s), 3 warning(s), 4 info

Ground truth: ROADMAP Phase 5 section (REC-05/06/07/08, SC1–SC4). No CONTEXT.md or *-RESEARCH.md exist in the phase dir (steps 2/5 of read order N/A). Verified plan claims against actual source: src/lib/db.ts, src/lib/validate.ts, src/routes/records.ts, src/routes/records.test.ts, public/index.html, public/js/records.js, public/js/api.js, public/js/api.test.ts, package.json, tsconfig.json, wrangler.jsonc, migrations/0002, .planning/research/ARCHITECTURE.md, and Phase 4 docs.

## 1. Coverage Summary

| Requirement | Delivering plan(s) | Concrete task(s) | Coverage |
|-------------|--------------------|-------------------|----------|
| REC-05 (filter by divergence type) | 05-01 | T1: `listRecords` `type = ?` + `listRecordsQuerySchema` enum + invalid-type 400; T2: `#type-filter` select re-fetching `?type=` | ✅ Full |
| REC-06 (search/filter by tag, partial match) | 05-01 | T1: `tags LIKE ?` bound `%tag%`; T2: `#tag-filter` debounced input re-fetching `?tag=` | ✅ Full |
| REC-07 (dropdown time pickers, year 2021-2026, month, day, hour) | 05-02 | T1: pure `datetime.js` (year/month/day/hour options, leap-aware `daysInMonth`); T2: dropdown groups replace free-text inputs, day-clamp, edit pre-fill | ✅ Full |
| REC-08 (time inputs explicitly labeled UTC) | 05-02 | T2: `開始時間 (UTC)` / `結束時間 (UTC)` form labels, UTC-labeled table headers, page-level `所有時間皆為 UTC` note; T1 asserts UTC-only conversions (`Date.UTC`, `getUTC*`) | ✅ Full |

## 2. Success Criteria Traceability

| Success criterion | Delivering task(s) | Verified via |
|-------------------|--------------------|--------------|
| SC1: filter table to one divergence type at a time | 05-01 T1 (server `type = ?`) + T2 (`#type-filter` select, re-fetch) | vitest filter cases 1/3/4; live curl `?type=structural`; browser checkpoint |
| SC2: search/filter by partial tag match | 05-01 T1 (server `tags LIKE '%…%'`) + T2 (`#tag-filter` debounced) | vitest filter cases 2/3; live curl `?tag=btc`; browser checkpoint |
| SC3: select start/end via year/month/day/hour dropdowns, no free text | 05-02 T1 (option helpers + UTC epoch) + T2 (form restructure, `pickerEpoch` save, edit pre-fill, free-text removal) | datetime vitest 7/7; must-never-appear greps (`parseEpoch`, `placeholder=YYYY-MM-DDTHH:MM:SSZ`, `id=start_time|end_time`); browser checkpoint |
| SC4: every time input explicitly labeled UTC | 05-02 T2 | `curl … \| grep -c 'UTC'` ≥ 4 on deployed page; browser checkpoint |

All four success criteria have named, wired covering tasks. ✅

## 3. Dimension Results

| # | Dimension | Result | Notes |
|---|-----------|--------|-------|
| 1 | Requirement Coverage | ✅ PASS | All 4 requirement IDs (REC-05/06/07/08) map to concrete tasks; none zero-coverage |
| 2 | Task Completeness | ✅ PASS | All 4 tasks (2 per plan) have concrete `<files>`, specific `<action>`, `<verify>`, `<done>` |
| 3 | Dependency Correctness | ✅ PASS | 04-02 → 05-01 → 05-02 acyclic; 05-02's dependency on 05-01 is explicit (shared-file conflict, no hidden functional assumption); in-plan T1 → T2 ordered correctly |
| 4 | Key Links / Wiring | ✅ PASS | route→`listRecords`/`listRecordsQuerySchema`; `loadRecords`→`api()`→`/api/records?type=&tag=`; `records.js` imports `datetime.js`, reads `[data-part]` selects; UTC labels on inputs + headers + note |
| 5 | Scope Sanity | ✅ PASS | 2 tasks per plan (target 2-3); no split problem |
| 6 | Success-Criteria Traceability | ✅ PASS | See §2 — every SC has a named covering task |
| 7 | Locked Decision Compliance | ✅ PASS | Single Worker + Static Assets, no build step, plain JS, D1 via `db.ts` (ARCHITECTURE Pattern 2), L4 pagination excluded — all honored; no CONTEXT.md D-XX to contradict |
| 8 | Scope Reduction Detection | ✅ PASS | No v1/placeholder/stub/"for now" on in-scope work; minute-snap on edit is a documented inherent consequence of locked REC-07, not a reduction |
| 9 | Verification Plan Quality | ✅ PASS | Automated: `npm run typecheck`, `vitest run` (backend contract + datetime helpers), live curl checks (filter, 400 rejection, no-params regression, UTC count), must-never-appear greps; interactive-only checks are correctly limited to browser checkpoints |
| 10 | Fact-check load-bearing claims | ⚠️ 2 MISMATCHES | (a) quoted "locked API contract in PLAN.md" text not found in any PLAN.md; (b) "existing 11 cases" is actually 12. All other claims verified against source |

## 4. Issues

### Blockers
None.

### Warnings

- **W1 — Fabricated "locked contract" citation (05-01, must_haves/truths).**
  The plan asserts the design "matches the locked API contract in PLAN.md ('GET /api/records — Query params: type = Filter by divergence type, tag = Filter by tag (partial match)')". That exact contract text exists in no PLAN.md in this repo (grep across `.planning/` returns zero hits outside 05-01 itself). Phase 4 explicitly deferred REC-05/06 without documenting a query-param contract. The design itself is sound and consistent with ARCHITECTURE.md Pattern 2 and REC-05/06, so this does not break the build — but the citation is false and frames an un-agreed design as pre-locked.
  *fix_hint:* Rewrite the citation to reference the actual sources (REC-05/REC-06 in REQUIREMENTS.md + ARCHITECTURE.md Pattern 2 example, which already sketches `type`/`tag` filter params) and drop the word "locked", or first record the contract in 04-02/ROADMAP as a locked decision.

- **W2 — Stale test-count claim (05-01 Task 1 verify).**
  Plan states "existing 11 cases + 5 new filter cases". The current `src/routes/records.test.ts` contains **12** `it(` cases (verified by `rg -c "^\s*it\("` → 12). The command itself is correct and green either way, but the stated count is wrong and would mislead anyone reading the verification output.
  *fix_hint:* Change "11 cases" to "12 existing cases" (12 + 5 new = 17 total).

- **W3 — Out-of-range record year silently corrupted on edit (05-02 T2, edit path).**
  Phase 4 free-text entry allowed epochs up to `MAX_UNIX_EPOCH` = 4102444800 = **2100-01-01** (public/js/records.js:10). A record holding a year > 2026 (2027–2100) is outside the REC-07 locked picker range (2021–2026). `setPickerFromEpoch` would set `select.value` to a non-existent option; the select falls back to the first option (2021), and `pickerEpoch` on save silently rewrites the record's timestamp year to 2021 — data mutation with no warning. Unlikely for real 2021–present divergence data, but unreachable-by-typing data from Phase 4 makes it possible.
  *fix_hint:* In `setPickerFromEpoch` (or `submitForm`), detect when the record's epoch year is outside `YEAR_RANGE` and either (a) block save with a clear message like "記錄年份超出 2021–2026 範圍", or (b) clamp to the range only with an explicit on-screen warning before submit. Add one datetime-test asserting the guard.

### Info

- **I1 — Stale REC→phase mapping in REQUIREMENTS.md.** The traceability table (REQUIREMENTS.md:104-107) still maps REC-05/06/07/08 to "Phase 2"; ROADMAP (ground truth) assigns them to Phase 5. Not a plan defect — both plans correctly follow ROADMAP. *fix_hint:* update REQUIREMENTS.md mapping to Phase 5.
- **I2 — ROADMAP Phase 5 "Plans" list still says `05-01: TBD`** and the progress table shows `0/TBD`. Plan files exist; the ROADMAP was not updated when plans were generated. *fix_hint:* backfill plan names in ROADMAP §Phase 5.
- **I3 — Minute-snap on edit.** Editing a record with non-zero minutes/seconds silently snaps it to `:00` on save. Documented as intended in 05-02 Objective, and consistent with REC-07's hour-only granularity, but it is a silent data change worth an explicit UAT note so the owner is not surprised.
- **I4 — datetime.test.ts `./datetime.js` import is unproven in this repo.** `public/js/api.test.ts` (the only existing public/js vitest precedent) does **not** import a `.js` module — it re-implements `api()` inline. 05-02 already includes a documented fallback (switch to extensionless `./datetime` if vitest chokes), so risk is handled. *fix_hint:* if the `.js` import fails, prefer the fallback; do not add a build step.

## 5. Recommendation

The plan is execution-ready. Every requirement (REC-05/06/07/08) and every success criterion (SC1–SC4) has concrete, wired, verify-backed tasks; dependencies are acyclic; locked decisions and the no-build constraint are honored; verification is predominantly automated with a defensible minimum of human browser checkpoints.

No blockers. Apply the three warnings before/while executing:
- **W1** — correct the false "locked PLAN.md contract" citation in 05-01 (documentation integrity only; no code impact).
- **W2** — fix the "11 cases" → "12 cases" count in 05-01 T1 verify.
- **W3** — add the out-of-range-year guard to 05-02 T2 before it ships, so a Phase 4 record with a timestamp beyond 2026 cannot be silently rewritten to 2021 on edit.

Each fix is a small, local edit to the plan text or one defensive branch in records.js; none changes scope, ordering, or the success-criteria coverage.