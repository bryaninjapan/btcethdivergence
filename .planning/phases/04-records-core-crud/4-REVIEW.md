# Phase 4 Code Review Report

**Date**: 2026-08-31
**Reviewer**: gsd-code-reviewer (opencode)
**Commit range reviewed**: `8fb7ccc..27f5534` — SUMMARY.md states `b171783..27f5534` (2 commits: `da38217`, `27f5534`). Extended back to `8fb7ccc` ("feat(phase-4): add deleteRecord repo fn + DELETE route") because the phase's shipped backend (records routes, `updateRecord`, validation) originates there and the phase's tests/deploys lock that exact contract. All findings verified against current working-tree file contents.

## Summary

0 CRITICAL, 1 HIGH, 2 MEDIUM, 5 LOW

## Issues

### CRITICAL

None.

### HIGH

- **`src/lib/validate.ts:9-11` + `src/lib/db.ts:66-67`** — A partial `PUT /api/records/:id` (the locked REC-02 "edit fields" contract) **silently wipes `notes` and `tags`**. `baseFields` declares `notes: z.string().max(1000).default('')` / `tags: z.string().max(200).default('')`, and in Zod a field-level `.default()` fires even when the key is absent from a `.partial()` object. Verified empirically with the project's zod v4.5.4: parsing `{start_time, end_time, type}` yields `{..., notes: "", tags: ""}`. `updateRecord` then runs `payload.notes ?? existing.notes` → `""` overwrites the stored value. The UI always sends full fields so the app path is safe today, but any client using the documented partial-update contract (curl, future Phase 5 UI) silently loses notes/tags — real data loss on a contract this phase explicitly locks ("PUT /api/records/1 with a valid partial update → 200"). The test suite does not cover the omit-notes/tags case. **Fix hint**: give the partial schema optional fields instead of defaults (e.g. `notes: z.string().max(1000)` with no `.default()`, wrapped by `.partial()`), or in `updateRecord` only apply `payload.notes` when the key was actually present in the request body.

### MEDIUM

- **`src/routes/records.ts:9-81` (all `/api/records` routes)** — No authentication on GET/POST/PUT/DELETE records, while `admin.ts` guards with `INGEST_TOKEN`. The Worker is **deployed and publicly reachable right now**: `curl https://btcethdivergence.gn01968711.workers.dev/api/records` → 200, no token. Anyone with the URL can read, create, edit, and delete the owner's records — a silent data-loss vector for as long as it stays live. Roadmap explicitly defers Cloudflare Access gating to Phase 9, so this is a known/accepted gap, but the interim window is unbounded (Phase 9 not started). **Fix hint**: either don't publish/keep the live URL until Phase 9, or gate `/api/records` behind the same `auth()` helper early. At minimum, note that D1 free-tier limits and record integrity depend on this not being reached by strangers.
- **`public/js/api.js:3`** — `await res.json()` throws a raw `SyntaxError` whenever the server returns a non-JSON body (HTML 404/500, Static Assets error page). The surfaced message is cryptic ("Unexpected token '<' ... in JSON") instead of the server's real error, and `loadRecords()` on initial page load is not wrapped — a transient failure leaves the table silently empty with only a console error. **Fix hint**: wrap `res.json()` in try/catch and fall back to `body.error ?? res.statusText`, and/or wrap the initial `loadRecords()` call.

### LOW

- **`src/routes/records.ts:40,67`** — `Number(c.req.param('id'))` lets non-decimal forms through the guard: `0x10` → 16, `1e3` → 1000, `' 5 '` → 5. Not exploitable (ids are just integers) but the "Invalid record id" 400 is bypassable by formatting; prefer `/^\d+$/`.
- **`public/js/records.js:70`** — `parseEpoch` accepts timezone-less ISO strings (e.g. `2024-01-15T12:00:00`), which `Date.parse` interprets as local time, silently storing a different instant than the owner intends. The `Z` placeholder and `openForm` pre-fill mitigate it; Phase 5's dropdowns replace free text. Consider rejecting strings without an explicit offset.
- **`public/js/records.js:107-113`** — Payload is built outside the `try/catch`; `input[name="type"]:checked` would throw uncaught if no radio were checked (cannot happen via the UI today — one is always checked, including after `form.reset()`). Defensive only.
- **`src/lib/db.ts:4-9` / `src/routes/records.ts:9`** — `GET /api/records` is unbounded (no pagination). Fine at single-owner scale today; note for when records grow.
- **`src/routes/records.test.ts`** — The FakeD1 `first()` ignores bound params, so the create/update tests assert SQL text but never the bound values (only the DELETE test does, test 6). Also no test asserts "PUT omitting notes/tags preserves them" — the exact regression behind the HIGH issue above.

## Recommendation

**Merge-blocked until the HIGH issue is fixed.** The partial-PUT notes/tags wipe is silent data loss on the exact contract this phase advertises and test-locks; remove the `.default('')` from the update schema (or gate `updateRecord` on key presence) and add a regression test asserting notes/tags survive a partial PUT.

Fix priority:
1. HIGH: partial-update wipe (`validate.ts` defaults / `db.ts` merge logic) + regression test.
2. MEDIUM: decide the interim auth stance for the already-live deployment (early gate vs. accept risk until Phase 9) — it is live now.
3. MEDIUM: `api.js` non-JSON handling (cheap, improves every future error message).

Everything else is clean and can ship with the fixes: tests 9/9 green, `npm run typecheck` exit 0, all SQL is bound-parameterized (no inline SQL in route handlers), DOM rendering uses `textContent` (no `innerHTML` anywhere in `public/`), all UI networking flows through the `api()` chokepoint, no secrets tracked (`.dev.vars`/`.wrangler/` ignored and absent from the index), fixture rows cleaned up (remote table count 0), and the code respects the locked Phase-1 architecture (single Worker + Static Assets, no build step) and Phase-5 boundaries (free-text ISO times, no dropdowns/filters yet).