# Cloudflare Access: klines Public API Decision

**Date**: 2026-09-01  
**Context**: v1.0 Audit Review — Design/Implementation Alignment  
**Outcome**: Intentional design decision to keep klines public

---

## The Misalignment

### What Design Said
ROADMAP.md Phase 9 Success Criteria (original):
```
Data API routes (`/api/records`, `/api/klines`) require owner email (email OTP, Policy 1)
```

REQUIREMENTS.md INFRA-04 (original):
```
UI and data APIs (`/`, `/charts.html`, `/calculator.html`, `/api/records`, `/api/klines`) 
→ email OTP (single owner email allow-listed)
```

### What Code Actually Did
**src/routes/klines.ts**: No authentication check — routes directly to database
```typescript
klines.get('/api/klines', async (c) => {
  // No auth validation
  const rows = await queryKlines(c.env.DB, symbol, startSec, endSec);
  return jsonOk(rows);  // ← public response, no login required
});
```

**Real deployed behavior**: 
```bash
curl https://btcethdivergence.bryanlab.cc/api/klines?symbol=BTCUSDT&start=...&end=...
→ HTTP 200 + JSON data (no credentials needed)
```

---

## Why This Happened

### 1. Initial Intent (Phase 9 Planning)
The roadmap was written with **symmetric access control**: 
- Same Cloudflare Access policy protects both UI AND data APIs
- Rationale: "Everything is private until you authenticate"
- This is textbook Zero Trust (default-deny, explicit allow)

### 2. Implementation Reality (Phase 9 Execution)
The `/api/klines` endpoint was built without authentication because:
- K-line data originates from **Binance public API** (no API key, fully public)
- D1 stores it unchanged (no transformation, no secret data)
- Frontend charts call it via `fetch()` immediately after login
- **Implicit assumption**: If frontend is authenticated (logged in via Email OTP), data access is implicitly OK

**But that assumption was unstated in code** — the route didn't enforce it.

### 3. Cloudflare Access Behavior
This is where the trap lies. CF Access is a **perimeter gate**, not per-route middleware:

```
[Internet] → [CF Access checks: Email OTP?] → [Worker routes]
                      ↓
                   If YES → forward to Worker
                   If NO → redirect to login page
```

When you configure a CF Access Policy for `/api/klines`, the **gate applies before the Worker sees the request**. The Worker code itself never runs — CF Access blocks it at the edge.

**But we didn't configure a CF Access Policy for klines**, so:
- Unauthenticated requests reach the Worker
- Worker has no auth code to check
- Worker returns the data

---

## The Learning: Three Different Scopes of "Gating"

### Scope 1: Cloudflare Access (Perimeter)
```
Policy 1: Email OTP for `/api/records*`, `/charts.html`, `/`
Policy 2: Service Token for `/api/admin/*`
(missing): No policy for `/api/klines*`
```
**Effect**: Only `/api/records` and UI routes require authentication before reaching the Worker.

### Scope 2: Application Code (Worker-level)
```typescript
// Inside src/routes/records.ts
if (!isAuthorized(c.req.header('Authorization'))) {
  return jsonError('Unauthorized', 401);
}
// Then serve data
```
**Effect**: Even if someone got past CF Access, the route validates credentials.

### Scope 3: Data Sensitivity
```
/api/records    ← User-created, private (divergence observations)
/api/klines     ← Binance public, not secret (open market data)
```
**Effect**: Different data sensitivity → different protection level.

---

## The Decision: Keep klines Public

After audit review, we chose **intentional asymmetry**:

| Route | CF Access | App Auth | Rationale |
|-------|-----------|----------|-----------|
| `/api/records` | ✅ Email OTP | ✅ INGEST_TOKEN | User data is private |
| `/api/klines` | ❌ Public | ❌ None | Binance already public |
| `/api/admin/*` | ✅ Service Token | ✅ INGEST_TOKEN | Admin operations only |

### Why This Is Correct

**Reason 1: Data Sensitivity**
- K-lines are OHLCV prices from Binance (same data anyone can fetch directly)
- No user identifying information in klines
- No risk if someone knows your klines data (it's global market data)
- **vs.** User's divergence records are observations only they care about

**Reason 2: Architectural Simplicity**
- CF Access is a binary gate (on/off per path)
- If klines were protected, every chart request would require:
  1. User logs in via Email OTP
  2. Browser gets session cookie
  3. Chart calls `fetch('/api/klines', { credentials: 'include' })`
  4. CF Access validates cookie before forwarding
  5. Worker returns data
- This works, but adds latency and complexity
- **vs.** Public klines: `fetch('/api/klines')` → instant, no auth layer

**Reason 3: Real-World Analogies**
- API.anthropic.com: Some routes require auth (models you own), some don't (public docs)
- github.com/public-repo: Anyone can read the code (no auth), writes require auth
- archive.org: Public access to archive (no auth), account needed for list/bookmarks
- **Pattern**: Protect user data and mutations, expose immutable public data

---

## The Pitfall: Design → Code Sync

### How This Breaks
1. **Planner writes rules without coordination with executor**
   - "Phase 9: klines requires auth"
   - Executor implements charts feature without reading Phase 9 plan details

2. **No code review of access control**
   - Routes written without checking ROADMAP.md requirements
   - Auth validation skipped as "nice to have"

3. **Testing gap**
   - Phase 9 UAT didn't explicitly test `/api/klines` (only tested `/api/records`)
   - Assumption: "if records are protected, klines must be too"

### How We Fixed It
1. **Audit catches the drift** — design said one thing, code did another
2. **Explicit decision** — choose which one is correct
3. **Align all documents** — ROADMAP, REQUIREMENTS, PITFALLS, milestones all updated
4. **Commit as learning** — this file documents why

---

## Cloudflare Access: Three Key Lessons

### Lesson 1: Perimeter vs. Application Auth Are Independent

```
CF Access = "can the HTTP request reach the Worker?"
App Auth   = "is this request allowed by the app?"
```

You can have:
- ✅ CF Access allow (cookies valid) + App deny (token invalid) → 403 Forbidden
- ✅ CF Access deny (no cookies) + App allow (no check) → 302 Redirect (CF Access gate)
- ❌ CF Access deny + App deny = Redundant (CF gate wins, app code never runs)

**Design lesson**: Be explicit about which layer(s) enforce which rules.

### Lesson 2: "Public Data Behind Login" Is Still Ambiguous

If you say "klines are behind CF Access login," it's unclear:
- Does it mean users must log in to *view* klines? (Yes, CF Access)
- Does it mean klines are somehow secret? (No — data is public)
- Does it mean klines are different from `/api/records` auth? (Unclear without docs)

**Design lesson**: Don't protect data just because other data is protected. Explain the reasoning.

### Lesson 3: Unauthenticated Routes Must Be Intentional

```
// This is a statement (reader must decide what it means)
klines.get('/api/klines', async (c) => { ... })

// This is explicit (design + code aligned)
/**
 * Public endpoint - no authentication required.
 * Serves Binance public kline data cached in D1.
 * Design: /api/klines intentionally public (data sensitivity < /api/records)
 */
klines.get('/api/klines', async (c) => { ... })
```

**Code lesson**: Comment public routes to signal they're not "forgot to add auth."

---

## How to Avoid This in v2

### Design Phase
- [ ] Explicitly categorize each endpoint: **public**, **authenticated**, **admin**
- [ ] Justify each category in the roadmap
- [ ] Link categories to Cloudflare Access policies

### Implementation Phase
- [ ] Add JSDoc comments to every route explaining auth level
- [ ] Map code routes to design categories in code review
- [ ] Test both authenticated AND unauthenticated paths for each route

### Testing Phase
- [ ] UAT includes explicit tests for public routes
  - Example: `curl /api/klines` should return 200 (not 302)
  - Example: `curl /api/records` should return 302 (not 200)

### Documentation Phase
- [ ] Create a matrix: Route → CF Policy → App Auth → Data Sensitivity
- [ ] Link all archives (ROADMAP, REQUIREMENTS, milestones) to the matrix

---

## Final Decision: v1.0 Klines Public API

**Status**: ✅ INTENTIONAL  
**Decision Date**: 2026-09-01  
**Approved By**: Audit Review  

**Access Rules**:
- `/api/klines` → HTTP 200 (no auth required, Binance public data)
- `/api/records` → HTTP 302 redirect to Email OTP login (user private data)
- `/api/admin/*` → HTTP 403 → 401 (Service Token + INGEST_TOKEN required)

**Rationale**: K-line data is inherently public; protecting it adds complexity without security benefit. User-created records (divergence observations) are private and protected.

**Design Files Updated**: 
- ROADMAP.md Phase 9
- REQUIREMENTS.md INFRA-04
- PITFALLS.md (test checklist)
- milestones/v1.0-ROADMAP.md
- milestones/v1.0-REQUIREMENTS.md

---

## References

- **Cloudflare Access Zero Trust Model**: https://developers.cloudflare.com/cloudflare-one/
- **CF Access + Workers Integration**: Architecture pattern of perimeter gate (CF Access) + application layer (Worker routes)
- **This Project**: Single-owner private tool, but with public read-only data (klines from Binance)
- **Similar Pattern**: GitHub public repos (anyone can read code) + private repos (auth required)

---

**Summary**: v1.0 chose intentional asymmetry — public klines (Binance data), authenticated records (user data). Design documents have been updated to reflect this decision. Future versions should make access categories explicit at design time.
