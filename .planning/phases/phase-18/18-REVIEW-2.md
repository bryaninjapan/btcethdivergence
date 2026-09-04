---
status: issues_found
files_reviewed: 13
critical: 0
high: 0
medium: 2
low: 5
total: 7
iteration: 2
max_iterations: 3
---

# Phase 18 Code Review Report
**Date**: 2026-09-04
**Reviewer**: gsd-code-reviewer (standard depth, iteration 2/3)
**Commit range reviewed**: `015c07e..1501019` (local HEAD). Iteration 1 reviewed `015c07e..9e99b42`; iteration 2 additionally covers the fix commit `1501019` ("apply all code review fixes") and re-verifies every iteration-1 finding against the current working tree. Note: the fix commit `1501019` is the current local HEAD but is **NOT pushed** to origin (origin is at `cb5daa8`) — see MEDIUM-2.

## Summary
0 CRITICAL, 0 HIGH, 2 MEDIUM, 5 LOW

Phase 18 remains a pure preparation/documentation phase — **zero `src/` changes**, only `public/demo-klinechart.html`, `package.json`/`package-lock.json`, `.gitignore`, and planning docs. No security-sensitive surface was touched: no new endpoints, no auth changes, no secrets committed (scanned the full diff: zero matches), no injection sinks, no SQL. The demo uses `textContent` (not `innerHTML`) for all dynamic output → no XSS path. `klinecharts@^10.0.3` is a devDependency only and never enters the Worker bundle. All 4 CDN URLs return HTTP 200 (verified live). The gzip measurement claim (62,244 bytes / 60.8 KB) reproduces exactly via `curl | gzip | wc -c`. The ms pass-through contract is correct (v10 requires ms under `timestamp`; Binance provides ms).

**The iteration-1 MEDIUM (nonexistent `setPriceScale` log-scale API) is resolved**: the checklist now documents the real v10 API `chart.overrideYAxis({ createRange: ... })`, and I verified both symbols exist in `node_modules/klinecharts/dist/index.d.ts` (`overrideYAxis` at line 1171, `AxisOverride.createRange` at line 658). Residual doc defects around it are now LOW (see LOW-1).

**Iteration-1 LOWs**: untracked-artifacts LOW is mostly resolved (`.gitignore` now covers `.planning/soldier-logs/`, and the PLAN-CHECK/REVIEW-2.1 files were committed in `1501019`). The console.assert LOW and the demo-ships-to-prod LOW remain. The chart-manager path LOW was "fixed" but to another wrong path (see LOW-2).

**Two new MEDIUMs** found this round, both verification/operational integrity, not production code:
1. The plan's own Task 2.1 automated verify gate now **FAILS** against the committed baseline, contradicting the SUMMARY's claim that "All plan automated acceptance criteria PASS".
2. The code-review fix commit `1501019` is **not pushed** to origin, so the remote branch is behind local HEAD and the R18-08 / Task 3.1 push gate fails.

## Issues

### CRITICAL
None.

### HIGH
None.

### MEDIUM

- **`.planning/phases/phase-18/18-BASELINE-LIGHTWEIGHT.md` (committed state) vs `18-PLAN.md:353` automated verify** — The plan's Task 2.1 verify gate requires `[ "$(grep -cE "^\\| Safari iOS" ...)" -ge 3 ]` and `! grep -qE "180ms|11MB|50KB|58fps|250ms|8MB|50fps"`. Against the current committed baseline both fail: (a) there are **0** rows starting `| Safari iOS` (the honest fix relabeled them to "Chrome Mobile Emulation"), and (b) line 222 literally contains the placeholder tokens ("No placeholder values (180ms, 11MB, 50KB, 58fps, 250ms, 8MB removed)"), so `grep -qE` matches and the `!` negation fails. I ran the exact gate command: **FAIL**. This directly contradicts `18-SUMMARY.md:60` ("All plan automated acceptance criteria PASS (verified after each commit and at close)") — that claim is now false at HEAD. If gsd-core re-runs the phase gate it will fail and block Phase 19 for a reason unrelated to the (honest) content. *fix_hint: update the Task 2.1 `<automated>` verify in `18-PLAN.md` to match the honest deliverable — check for "Chrome Mobile Emulation" rows instead of "Safari iOS" (or drop the row-count check), and make the placeholder grep exclude the self-referential checklist line (e.g. grep the table rows only), then re-run the gate and record the result. Do this before Phase 19 planning so the gate is truthful.*

- **Unpushed fix commit / remote behind local (R18-08, Task 3.1 push gate)** — `git ls-remote origin feature/klinechart-migration` = `cb5daa8`, local HEAD = `1501019`. The entire code-review fix commit (honest baseline labels, log-scale API doc, `.gitignore` entry) is **not on origin**. Task 3.1's verify gate `git ls-remote origin ... | grep -q "$(git rev-parse HEAD)"` therefore **FAILS** at HEAD, and R18-08 ("開發分支已建立並推送") is not satisfied for the final state. A Phase 19 executor pulling from origin gets the pre-fix docs. *fix_hint: `git push origin feature/klinechart-migration` to move origin to `1501019`, then re-verify with `git ls-remote origin feature/klinechart-migration` matching local HEAD.*

### LOW

- **`.planning/phases/phase-18/18-MIGRATION-CHECKLIST-VERIFIED.md:113-114`** — Residual log-scale doc defects (iteration-1 MEDIUM is resolved; these remain). Line 113 still hedges "Alternatively: `chart.setPriceScale()` if available in your v10 build; verify with `node_modules/klinecharts/dist/index.d.ts` line 1171" — `setPriceScale` **does not exist** in v10 (verified: zero matches), and line 1171 is actually `overrideYAxis`, so the cited line doesn't verify the hedged API. Line 114 points to "18-RESEARCH.md §2" for AxisOverride/createRange details, but that section contains **no** log-scale/overrideYAxis/createRange content (verified by grep). A Phase 19 executor may still attempt `setPriceScale()` and get a runtime error. *fix_hint: delete the `setPriceScale` hedge (it's not "if available" — it never exists), and point the reference to the checklist's own lines 111-112 or add the AxisOverride snippet to RESEARCH.md §2.*

- **`.planning/phases/phase-18/18-MIGRATION-CHECKLIST-VERIFIED.md:30`** — The iteration-1 path LOW was "fixed" from `src/chart-manager.ts` to `src/public/chart-manager.ts`, but **no such file exists** (`ls` confirms only `src/public/chart-manager.test.ts`). The actual chart-manager implementation is `public/js/managers/ChartManager.js`. The fix moved the executor from one wrong path to another. *fix_hint: change to `public/js/managers/ChartManager.js`.*

- **`public/demo-klinechart.html:427-430`** — The "regression guard" for ms pass-through is still a bare `console.assert` (does not throw) and `chartSuccess` is set true afterwards, so a pass-through regression would only print to console and the status still shows "Rendered" as OK. Carried from iteration 1, unfixed. Cosmetic for a demo, but the page labels it a guard. *fix_hint: `if (bars[0].timestamp !== firstOpenTime) throw new Error(...)`.*

- **`public/demo-klinechart.html` (whole file)** — Still ships to production as a static asset (`public/` is the Worker `assets.directory`). Harmless (public Binance data + CDN scripts only, no secrets, no internal endpoints), and presumably behind Cloudflare Access like the rest of the site. Carried from iteration 1. *fix_hint: confirm the Access application covers `/demo-klinechart.html`, or remove/rename it during Phase 22 hardening.*

- **`.planning/REQUIREMENTS.md` R18-01..R18-10 statuses** — All ten Phase-18 requirements still show `⬜` in the Status column even though the phase is marked COMPLETE in ROADMAP.md and `STATE.md` records `completed_requirements: 10`. Minor doc inconsistency that could confuse the phase gate. *fix_hint: flip R18-01..R18-10 to `✅`.*

## Recommendation

**Mergeable — no CRITICAL/HIGH issues.** This is a documentation/demo phase with no production code, and the one substantive technical MEDIUM from iteration 1 (log-scale API) is genuinely fixed and verified against the v10 types.

Fix the two MEDIUMs before Phase 19 begins — they are process/verification integrity, cheap to resolve, and would otherwise trip gsd-core's gate:
1. Push `1501019` to origin (remote is behind; R18-08 gate fails).
2. Update the Task 2.1 `<automated>` verify in `18-PLAN.md` to match the honest baseline (Chrome Mobile Emulation rows, placeholder-check that doesn't trip on its own checklist line), then re-run and record PASS.

The LOWs (setPriceScale hedge, chart-manager path, console.assert guard, R18 statuses) can be folded into Phase 19/22 work; none blocks merge. Nothing found here should affect production.

No CRITICAL/HIGH issues — ready to merge.