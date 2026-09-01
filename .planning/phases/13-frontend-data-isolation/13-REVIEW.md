# Phase 13 Code Review — Frontend Data Isolation

**Reviewer**: code-reviewer agent
**Date**: 2026-09-01
**Scope**:
- `public/js/chart-state.js`
- `public/js/records-state.js`
- `public/js/datetime-helpers.js`
- `e2e/charts.spec.ts`
- `e2e/records.spec.ts`
- (context read: `public/js/charts.js`, `public/js/records.js`, `public/js/datetime.js`, `src/public/chart-state.test.ts`, `src/public/records-state.test.ts`, `.planning/phases/13-frontend-data-isolation/PLAN.md`, `SUMMARY.md`)

## Headline Finding

**Phase 13's stated goal — "refactor frontend state management from global variables to isolated, testable module instances" — has not actually been achieved in the shipped code.** The three new modules exist and have (partial) unit test coverage, but **none of them are imported or used by the production app**. `public/js/charts.js` and `public/js/records.js` — the only files actually loaded by `index.html`/`charts.html` — still use module-level `let` globals and still contain their own hand-duplicated datetime-picker helpers. `SUMMARY.md` marks the phase "✅ COMPLETE" and checks off success criteria ("Zero global variables in charts module", "window.__charts is undefined", "charts.js 和 records.js 都導入 datetime-helpers.js") that are demonstrably false against the current source. See CRITICAL-1 below.

---

## CRITICAL

### CRITICAL-1: New state/helper modules are dead code — never wired into the app
**Files**: `public/js/chart-state.js`, `public/js/records-state.js`, `public/js/datetime-helpers.js`
**Evidence**:
- `grep` for `chart-state`, `records-state`, `datetime-helpers` across the repo shows the only references are the modules' own unit tests (`src/public/chart-state.test.ts`, `src/public/records-state.test.ts`). `datetime-helpers.js` has **zero** references anywhere, including its own test — it is entirely untested and entirely unused.
- `public/js/charts.js:15-17` still declares module-level globals:
  ```js
  let btcChart = null, ethChart = null, btcSeries = null, ethSeries = null;
  let sync = null, unsubBtc = null, unsubEth = null;
  let activeController = null;
  ```
  and `charts.js:165` still does `window.__charts = { btcChart, ethChart, btcSeries, ethSeries };` — the exact global-pollution pattern PLAN.md 13-01 §2 says was supposed to be removed ("TDD GREEN: 刪除 window.__charts 賦值 ✅").
- `charts.js` also still defines its own local `fillSelect`/`rebuildDays`/`setPickerFromEpoch`/`pickerEpoch` (lines 56-93), duplicated almost verbatim in `records.js` (lines 106-153) — the exact duplication `datetime-helpers.js` was created to eliminate (PLAN.md 13-02 §3, 13-03 §1). Neither file imports `datetime-helpers.js`; both instead import option-builders (`dayOptions`, `daysInMonth`, `yearOptions`, ...) from a *third*, older module, `public/js/datetime.js`.
- `records.js:15-18` still declares `let recordsCache = []; let editingId = null; let deleteId = null; let latestRequestToken = 0;` at module scope instead of using `createRecordsManager()`.

**Impact**: The refactor's actual purpose (eliminate global mutable state, eliminate helper duplication) is unmet. Net effect of the phase as merged is **more** duplication (a 4th datetime implementation was added alongside the 2 pre-existing duplicated ones and the shared `datetime.js`), not less. `chart-state.js`/`records-state.js` provide no runtime benefit today — they are unreachable code that only exists to satisfy their own unit tests.

**Fix**: Either (a) complete the integration — import `createChartState()`/`createRecordsManager()`/`datetime-helpers.js` into `charts.js`/`records.js` and delete the local globals/duplicated helpers, per PLAN.md's stated tasks — or (b) if integration is intentionally deferred, do not mark the phase "COMPLETE" / do not claim the success criteria are met in `SUMMARY.md`. Recommend blocking merge until at least one of the two consumer files is actually migrated, since unintegrated "isolation" modules add maintenance cost with zero present benefit.

### CRITICAL-2: E2E tests reference globals that don't exist, producing false-positive/false-negative results
**File**: `e2e/charts.spec.ts`
**Evidence**: `charts.js` only ever exposes `window.__charts = { btcChart, ethChart, btcSeries, ethSeries }` (see CRITICAL-1). It never sets `window.btcChart`, `window.ethChart`, or `window.btcSeries` directly. But the E2E spec reads those non-existent top-level globals:
```ts
const timeScale = (window as any).btcChart?.timeScale();   // line 31 — btcChart is undefined
```
Consequences per test:
- `'should sync time range across BTC/ETH charts'` (line 28): both `btcRangeStart` and `ethRangeStart` resolve to `undefined` via optional chaining. `expect(undefined).toBe(undefined)` **passes trivially**, regardless of whether chart sync actually works. This test currently provides zero real coverage of the sync feature it claims to verify.
- `'should sync zoom level across charts'` (line 44): same undefined-global problem means the simulated zoom (lines 52-62) is a no-op (`if (timeScale && ...)` short-circuits). The final assertion `expect(ethRangeAfter).toBeGreaterThan(0)` compares `undefined` to `0` and will **fail** — this test is currently broken and will fail in CI once actually run, unless it happens not to be run (no CI evidence reviewed).
- `'should load K-line data from API'` (line 94): reads `window.btcSeries` (undefined) → `klineCount = 0` → `expect(0).toBeGreaterThan(0)` **fails**.
- `'should support log scale toggle'` (line 76): locator `page.locator('button:has-text("Log")')` will never match — the actual control is `<input type="checkbox" id="log-scale">` inside a `<label>` with Chinese text "對數縮放" (`public/charts.html:24-27`), not a `<button>` containing "Log". `.isVisible()` on a zero-match locator returns `false`, so the entire test body inside the `if` never executes and the test passes without asserting anything.

**Impact**: The suite currently mixes tests that always pass without testing anything (false confidence) with tests that will hard-fail regardless of app correctness (false alarms), and does not actually validate the chart-sync/log-scale behavior it claims to. This must be fixed before the suite can be trusted as a regression gate.

**Fix**: Point assertions at `window.__charts.btcChart` / `.ethChart` / `.btcSeries` (or, better, expose a stable, documented test hook instead of relying on the ad-hoc `__charts` global), and update the log-scale locator to target `#log-scale` (e.g. `page.locator('#log-scale')` + `.check()`/`.click()`), not `button:has-text("Log")`.

---

## HIGH

### HIGH-1: `records-state.js` `getState()` leaks a mutable reference despite claiming to be a "read-only snapshot"
**File**: `public/js/records-state.js:39-41`
```js
getState() {
  return Object.freeze({ ...state });
},
```
`Object.freeze` is shallow. The returned object's `recordsCache` property is the *same array reference* as the internal `state.recordsCache`, so `manager.getState().recordsCache.push(x)` (or `.length = 0`, `.sort()`, etc.) silently mutates the manager's internal cache, completely bypassing `setRecords()`. This directly contradicts the method's JSDoc ("read-only snapshot") and the project's immutability convention (see `~/.claude/rules/common/coding-style.md` — "ALWAYS create new objects, NEVER mutate existing ones").

Notably, the same file's `getRecords()` (line 46-48) *does* it correctly: `return [...state.recordsCache];` — the developer was clearly aware of the need to clone but did not apply it consistently to `getState()`. The existing unit test (`records-state.test.ts:92-102`) only checks that *reassigning* `snapshot.recordsCache = []` throws (blocked by the outer freeze); it does not check array mutation-in-place, so this gap has no test coverage.

**Fix**: Deep-clone (or at minimum clone `recordsCache`) inside `getState()`, e.g. `Object.freeze({ ...state, recordsCache: [...state.recordsCache] })`, and add a regression test asserting that mutating the array on the snapshot does not affect subsequent `getRecords()` calls.

### HIGH-2: E2E records suite is not isolated — will produce Playwright strict-mode failures and DB pollution
**File**: `e2e/records.spec.ts`, `playwright.config.ts`
**Evidence**:
- `playwright.config.ts` runs `fullyParallel: true` across three browser projects (chromium, firefox, webkit), all pointed at the same `baseURL: 'http://localhost:8787'` real dev server/backend, with `webServer.reuseExistingServer: !process.env.CI`. There is no mock/stub backend and no per-test database reset.
- Every test in `records.spec.ts` creates a new record via the real API and **never deletes it** (only the dedicated `'should delete a record'` test cleans up its own record). Records accumulate across test runs and across the 3 parallel browser projects.
- Several selectors are not scoped to a specific row, e.g. `page.click('button:has-text("編輯")')` (line 45) and `page.click('button:has-text("刪除")')` (line 66). Playwright's default click uses strict mode: if the locator matches more than one element, the call throws. Once more than one row exists in `#records-table` (which happens almost immediately, since prior tests/prior runs leave data behind and all rows render "編輯"/"刪除" buttons), these tests will intermittently fail with a strict-mode violation rather than a meaningful assertion failure.
- `'should filter records by type'` / `'by tag'` similarly assume the newly created record is uniquely identifiable in a growing, un-cleaned table.

**Impact**: This suite will be flaky-to-broken on second and subsequent runs, and pollutes whatever database backs the local dev server with permanent test records ("E2E test record", "Persistent record", etc.).

**Fix**: Scope all row-level actions to the specific row (e.g. `page.locator('tr[data-id="..."] button[data-action="edit"]')`, or filter via `.filter({ hasText })` and `.first()`), delete every record created by a test in that test (or in `afterEach`), and consider seeding/resetting the DB (or running against an isolated per-worker environment) before each test file to remove cross-run/cross-browser interference.

### HIGH-3: `datetime-helpers.js` has 0% test coverage
**File**: `public/js/datetime-helpers.js`
No test file imports or exercises `fillSelect`, `rebuildDays`, `setPickerFromEpoch`, or `pickerEpoch` from this module anywhere in the repo. This violates both the phase's own stated target ("目標: 100% recordsManager 覆蓋率" / 85% global coverage threshold in `package.json`'s `test:coverage` script) and the org-wide 80% minimum coverage rule. Combined with CRITICAL-1 (module unused in production), this is currently the least-verified new code in the phase.

**Fix**: Add a `datetime-helpers.test.ts` covering: `fillSelect` DOM population, `rebuildDays` month-length edge cases (Feb non-leap/leap, 30 vs 31 day months, day clamping when switching from day 31 to a shorter month), `setPickerFromEpoch` round-tripping through `pickerEpoch`, and the thrown-`Error` paths when required `[data-part]` selects are missing.

---

## MEDIUM

### MEDIUM-1: `rebuildDays()` mixes local-time and UTC date math
**File**: `public/js/datetime-helpers.js:36`
```js
const daysInCurrentMonth = new Date(year, month, 0).getDate();
```
This uses the **local-timezone** `Date` constructor, whereas `setPickerFromEpoch`/`pickerEpoch` in the same file (and `Timestamp`, and the pre-existing `datetime.js#daysInMonth` which uses `new Date(Date.UTC(year, month, 0)).getUTCDate()`) are all UTC-based. Calendar month-length is timezone-independent so this does not currently produce an incorrect day count, but it is inconsistent with the project's explicit "everything is UTC" convention (picker labels literally say "(UTC)" in `charts.html`/records UI) and is a latent trap for future edits that assume `rebuildDays` is UTC-safe.

**Fix**: Use `new Date(Date.UTC(year, month, 0)).getUTCDate()` for consistency with `datetime.js` and `Timestamp`.

### MEDIUM-2: `chart-state.js` and `records-state.js` duplicate ~25 lines of identical `get`/`set`/`getState` boilerplate
**Files**: `public/js/chart-state.js:16-44`, `public/js/records-state.js:14-41`
Both factories implement byte-for-byte identical `get(key)`, `set(key, value)`, and `getState()` logic (including the same error message text `Unknown state key: ${key}`). Given the phase's explicit goal of removing duplication, this is a missed opportunity — a shared `createKeyedState(initial)` utility (returning `{ get, set, getState }` closed over a private object) would remove the duplication and give both factories a single source of truth for the read/write/freeze contract.

### MEDIUM-3: Factory methods rely on implicit `this`, which is fragile to destructuring
**Files**: `public/js/chart-state.js`, `public/js/records-state.js`
Methods such as `initCharts()` call `this.set(...)` internally, and every mutator does `return this`. This works for the common call pattern `state.initCharts(...)`, but if a consumer destructures methods off the returned object (`const { set } = createChartState()`), `set(...)` will throw (`this` is `undefined` in strict ES modules) the moment any method that internally calls `this.xxx()` is invoked that way. Since one of the appeals of the factory pattern is often exactly this kind of destructured/functional usage, consider closing over `state` directly inside each method (not using `this`) so the returned methods are safely detachable.

---

## LOW

### LOW-1: `datetime-helpers.js` docstring overstates what the module actually consolidates
**File**: `public/js/datetime-helpers.js:1-4`
> "Shared datetime picker helpers — single source of truth for date/time selection. Previously duplicated in charts.js and records.js"

This module only covers `fillSelect`/`rebuildDays`/`setPickerFromEpoch`/`pickerEpoch`. The year/month/hour option builders (`yearOptions`, `monthOptions`, `hourOptions`, `daysInMonth`) still live only in `datetime.js` and are not re-exported or referenced here, so this file is not actually a complete "single source of truth" even setting aside CRITICAL-1 (it being unused). Consider either merging the two modules or updating the docstring to accurately scope what it covers.

### LOW-2: "should not pollute global window object" unit tests are low-value/tautological
**Files**: `src/public/chart-state.test.ts:92-99`, `src/public/records-state.test.ts:104-111`
```js
const keysBefore = Object.keys(window);
createChartState();
const keysAfter = Object.keys(window);
expect(keysBefore.length).toBe(keysAfter.length);
```
Since neither factory function touches `window` under any implementation, this assertion is true almost by construction and would not catch the actual global-pollution regression that exists today in `charts.js` (`window.__charts = ...`, see CRITICAL-1) — that assignment lives in a different, untested file. This test gives false confidence that "no global pollution" has been verified end-to-end when it has only been verified for a module that itself never touches `window`.

### LOW-3: `SUMMARY.md` self-reported status does not match the shipped code
**File**: `.planning/phases/13-frontend-data-isolation/SUMMARY.md`
Lines such as "✅ Removed global variable pollution", "✅ Updated both charts.js and records.js to import helpers", "✅ Removed code duplication", and the overall "**COMPLETE**" status are not supported by the current source (see CRITICAL-1). Recommend correcting this doc (or re-opening the phase) so future readers don't rely on inaccurate completion claims.

---

## Security Review

No XSS, injection, path-traversal, or credential-handling issues found in the three reviewed files. DOM writes consistently use `textContent`/`replaceChildren`/`createElement` (never `innerHTML`), and none of the modules touch network requests, cookies, or storage. `get`/`set` reject unknown keys (`if (!(key in state)) throw ...`), which is a reasonable guard against typos but is not a security boundary (these are client-side, non-trust-boundary modules).

---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 2     | fail   |
| HIGH     | 3     | fail   |
| MEDIUM   | 3     | warn   |
| LOW      | 3     | note   |

**Verdict: BLOCK.** The phase's stated deliverable — replacing global frontend state with isolated factories and de-duplicating datetime-picker code — is not actually integrated into the running application (`charts.js`/`records.js` are unchanged in behavior), and the accompanying E2E tests reference nonexistent globals/selectors, making them unreliable as a regression gate (some pass trivially, some will fail regardless of app correctness). Recommend: (1) complete the integration of `chart-state.js`/`records-state.js`/`datetime-helpers.js` into `charts.js` and `records.js` (or explicitly re-scope the phase if integration is deferred), (2) fix the `window.__charts`-vs-`window.btcChart` and log-scale-selector mismatches in `e2e/charts.spec.ts`, (3) fix the shallow-freeze mutation leak in `records-state.js#getState()`, and (4) add row-scoped selectors + cleanup to `e2e/records.spec.ts` before relying on it in CI.
