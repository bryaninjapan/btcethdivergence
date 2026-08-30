# Phase 4 Summary — Records Core CRUD

**Phase**: 4 — Records Core CRUD
**Executed**: 2026-08-31
**Plans**: 04-01 (backend DELETE verify + contract tests), 04-02 (records UI)
**Commit range**: `b171783..27f5534` (2 commits)

## What Was Built

| File | Purpose |
|------|---------|
| `src/routes/records.test.ts` | Vitest route-contract suite (9/9) locking GET/POST/PUT/DELETE `/api/records` + the SC5 start<end 400-no-write rejection; untracked before this phase, now committed. |
| `public/js/api.js` | Single network chokepoint: `api(path, options)` fetches, checks `body.ok`, throws `Error(body.error)` on failure; the only place `fetch()` is called in the UI. |
| `public/index.html` | Records page shell: header + `+ 新增`, `#records-table`, `#record-dialog` (create/edit form: start/end, type radios, notes, tags, `#form-error`), `#delete-dialog` (summary + `#delete-error`). |
| `public/js/records.js` | Full CRUD UI: `renderTable` (DOM APIs + `textContent`, no innerHTML), `loadRecords`, `parseEpoch` (ISO-8601 UTC or unix-seconds → seconds), `openForm`/`submitForm` (POST/PUT + immediate re-render), `confirmDelete`/`confirmDeleteAction` (dialog gate + DELETE). |
| `public/css/style.css` | Minimal readable table/form/dialog styling (dark-theme polish is Phase 5/9 scope). |

Backend code (`deleteRecord` in `src/lib/db.ts`, `DELETE /api/records/:id` in `src/routes/records.ts`, validation in `src/lib/validate.ts`) pre-existed from commit `8fb7ccc`; this phase verified it live, deployed it, and locked the contract with tests.

## Tasks Completed (5/5)

- **04-01 T1** — Verified `deleteRecord` + DELETE route, deployed, curl-verified: fixture POST→201, DELETE `abc`→400, DELETE missing→404 `"Record not found"`, DELETE fixture→200 `{ok:true,data:{id}}`, row gone from `GET /api/records` (SC3 backend half), remote D1 count 0. ✅
- **04-01 T2** — Committed `src/routes/records.test.ts`; 9/9 pass, typecheck exit 0. ✅
- **04-02 T1** — `api.js`, page shell, styles, `renderTable`/`loadRecords`; deployed; curl markers pass; fixture row served by `GET /api/records`. ✅
- **04-02 T2** — `parseEpoch`/`openForm`/`submitForm` + wiring; deployed; markers + `Date.parse.*1000` grep pass; SC5 live 400 `"start_time must be before end_time"`; API-level SC1/SC2 round-trip (POST→list, PUT→list) verified. ✅
- **04-02 T3** — Delete dialog + `confirmDelete`/DELETE wiring; deployed; `confirmDelete` + `'DELETE'` markers pass; API-level SC3 (create→delete→gone) verified; UI committed (WARNING-01 fix). ✅

**Security/code-quality scans (Section A)**: no `DEV_*` flags, no hardcoded secrets, no dead code, no type/lint errors found in any touched code. No `[security]`/`[cleanup]` commits required.

## Success Criteria Status

| SC | Status | Evidence |
|----|--------|----------|
| SC1 create → appears in list | ✅ | API round-trip (POST id=5 → visible in GET) + live 201 route |
| SC2 edit → reflected immediately | ✅ | API round-trip (PUT type+notes → reflected in GET); UI re-renders via `loadRecords()` after save, no reload |
| SC3 delete after confirm dialog | ✅ | Dialog gate (`deleteId` set only on 確認刪除); DELETE 200 verified, row gone from GET |
| SC4 newest-first table | ✅ | `listRecords` orders `start_time DESC` (db.ts:6); table renders via `renderTable` |
| SC5 start≥end rejected with clear message | ✅ | Zod refine 400 + test-locked string; UI client guard `開始時間必須早於結束時間` + inline server message |

## Blocked / Checkpoints

No task is blocked. The three **browser checkpoints** (visual confirmation of create/edit/delete/reversed-time flows) could not be exercised automatically — no Playwright/Puppeteer in the project and the Pencil browser app was not connected. All the exact API calls those flows make were verified at the HTTP level (above). **Owner action requested**: open `https://btcethdivergence.gn01968711.workers.dev/` and run the three interactive flows to confirm visual behavior (see "Verify End-to-End").

## Deviations from Plan

1. **Row buttons wired via event delegation** (04-02 T2/T3) instead of per-button listeners in `renderTable`. `renderTable` sets `tr.dataset.id` and `data-action` buttons; one tbody click handler dispatches to `openForm`/`confirmDelete`. Functionally identical to the plan's "row 編輯/刪除 button → handler(record)" wiring and keeps each task's deployed state non-broken between commits.
2. **`parseEpoch` digit-only clamp** (INFO-02 hardening, per 4-PLAN-CHECK): digit-only input is accepted only within `[2021-01-01, 2100-01-01]` unix range; out-of-range returns `null` → inline error. Prevents a value like `20240115` silently becoming a 1970 timestamp. Keeps the required `Date.parse.../1000` seconds conversion.
3. **Added `#delete-error` element** to `#delete-dialog` so DELETE failures surface inside the dialog (plan specified showing the message "in #delete-dialog" but no element existed).
4. Minor: `formatTime` displays full ISO-8601 UTC (plan's SC4 checkpoint just requires UTC display).

No `[CONFLICT]` or `[PLAN-GATE]` decisions pending.

## Verify Phase Goal End-to-End

Automated (all pass as of execution):

```bash
npx vitest run src/routes/records.test.ts        # 9/9 CRUD + SC5 contract
npm run typecheck                                # exit 0
curl -sf https://btcethdivergence.gn01968711.workers.dev/ | grep 'records-table'
curl -sf https://btcethdivergence.gn01968711.workers.dev/js/records.js | grep -qE 'renderTable|openForm|confirmDelete'
curl -sf https://btcethdivergence.gn01968711.workers.dev/js/api.js | grep -q 'body.ok'
# SC5 — must return HTTP 400 + "start_time must be before end_time":
curl -s -X POST https://btcethdivergence.gn01968711.workers.dev/api/records \
  -H 'Content-Type: application/json' \
  -d '{"start_time":1705420800,"end_time":1705334400,"type":"time_lag"}'
# XSS + chokepoint discipline (must print 0):
rg -n "innerHTML" public/ | wc -l
rg -n "fetch\(" public/js/records.js | wc -l
rg -n "db\.prepare\(" src/routes/records.ts | wc -l
```

**Owner browser walkthrough** (the non-automatable SC1/2/3/5 visual gates):
1. Open `https://btcethdivergence.gn01968711.workers.dev/`.
2. `+ 新增` → fill ISO-8601 UTC start/end (e.g. `2024-01-15T12:00:00Z`), pick type, notes, tags → 儲存 → row appears at top with matching times (SC1).
3. Enter a start time after the end time → inline message `開始時間必須早於結束時間`, nothing saved (SC5).
4. 編輯 a row → change type/notes → 儲存 → row updates in place (SC2).
5. 刪除 a row → confirm dialog with summary → 取消 keeps it → 確認刪除 removes it (SC3).