# Phase 9 Plan — Access & Launch Hardening

**Version**: 1.0  
**Date**: 2026-08-31  
**Status**: Planning

---

## Phase Goal & Success Criteria

### Goal
The finished app is navigable as one cohesive site via a shared navigation bar, and fully gated behind the owner's own Cloudflare Access login (email OTP) before anyone else can reach it.

### Dependencies
- Phase 5 (Records Filtering & Time-Entry UX) ✅
- Phase 7 (Chart Navigation & Record Deep Link) ✅
- Phase 8 (Leverage Calculator) ✅

### Success Criteria (what must be TRUE)

1. **Shared Navigation Bar**: 
   - User can switch between Records, Charts, and Calculator pages via a unified navigation bar that appears on all three pages
   - Navigation is consistent in layout and styling across all pages
   - Current page is visually indicated (e.g., active link highlighting)
   - Navigation works on both desktop and mobile viewports

2. **Cloudflare Access Integration**:
   - An unauthenticated request to the site (e.g., direct URL access) is blocked and redirected to a Cloudflare Access login challenge
   - Unauthenticated requests to `/api/*` routes are also blocked with appropriate HTTP error (401 or redirect)
   - Email OTP authentication is configured as the login method
   - Only the owner's email (gn01968711@gmail.com) is allow-listed and can complete the login
   - After successful login, user can freely navigate all three pages without re-authentication

3. **User Experience**:
   - Page transitions via navigation are fast and responsive
   - No console errors or warnings logged during navigation
   - Mobile layout remains responsive after navigation changes
   - All calculations, filters, and chart data persist correctly during page navigation

---

## Architecture & Design

### Shared Navigation Bar Strategy

**Design Decision**: Create a reusable HTML component that can be included in all three pages via:
- **Option A (Recommended)**: Extract to a shared CSS class + HTML snippet, manually include in each page
- **Option B**: JavaScript injection at load time from a shared module
- **Option C**: Server-side template rendering (not applicable here; static assets)

**Recommendation**: Use **Option A** (manual inclusion with shared CSS/HTML) because:
- No build step required (aligns with project's "Google AI Studio friendly" constraint)
- Explicit and easy to verify across pages
- No runtime dependency on JavaScript for navigation to work

### Navigation Bar Markup

```html
<!-- Shared across all pages, placed in <header> -->
<nav class="top-nav">
  <h1>BTC/ETH Divergence Tracker</h1>
  <ul class="nav-links">
    <li><a href="/" class="nav-link" data-page="records">記錄表</a></li>
    <li><a href="/charts.html" class="nav-link" data-page="charts">K線圖</a></li>
    <li><a href="/calculator.html" class="nav-link" data-page="calculator">槓桿計算</a></li>
  </ul>
</nav>
```

### Navigation Bar Styling

Use existing CSS variables from `public/css/style.css` for consistency:

```css
.top-nav {
  background-color: var(--panel);        /* Light background, matches existing */
  color: var(--text);                     /* Dark text, matches existing */
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
}

.top-nav h1 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--text);
}

.nav-links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 2rem;
}

.nav-link {
  color: var(--text);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.nav-link:hover {
  color: var(--accent);
}

.nav-link.active {
  color: var(--accent);
  border-bottom: 2px solid var(--accent);
  padding-bottom: 0.25rem;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .top-nav {
    flex-direction: column;
    gap: 1rem;
  }

  .nav-links {
    gap: 1rem;
  }

  .top-nav h1 {
    font-size: 1.2rem;
  }

  .nav-link {
    font-size: 0.9rem;
  }
}
```

### Active Page Indicator

Add a simple client-side script to highlight the current page's navigation link:

```javascript
// In each page's <body>, add at the end:
<script>
  const currentPage = window.location.pathname === '/' ? 'records' : 
                      window.location.pathname === '/charts.html' ? 'charts' :
                      window.location.pathname === '/calculator.html' ? 'calculator' : '';
  
  if (currentPage) {
    const activeLink = document.querySelector(`[data-page="${currentPage}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
    }
  }
</script>
```

### Cloudflare Access Integration

**Deployment Host** (locked decision D-09-02 in CONTEXT.md):
- Domain: `btcethdivergence.bryanlab.cc`
- CNAME target: `btcethdivergence.gn01968711.workers.dev`
- Status: Deployed, DNS propagating

**Setup Steps** (outside the codebase, in Cloudflare dashboard):

1. **Create an Access Application**:
   - Application name: "BTC/ETH Divergence Tracker"
   - Application domain: `https://btcethdivergence.bryanlab.cc`
   - Application type: **Self-hosted** (Workers deployment, not SaaS)

2. **Configure Authentication Policy**:
   - Policy name: "Owner Email Only"
   - Rule: Allow if user's email matches `gn01968711@gmail.com` (D-09-01 in CONTEXT.md)
   - Fallback: Block all other requests

3. **Configure Login Method**:
   - Use Email OTP (One-Time Passcode)
   - No additional identity providers needed for this single-owner tool

4. **Setup Page Routes**:
   - Application URL: `https://btcethdivergence.bryanlab.cc`
   - Covers all paths: `/`, `/charts.html`, `/calculator.html`, `/api/*`

5. **Test Access**:
   - Unauthenticated user visits site → redirected to Cloudflare Access login
   - User enters email → OTP sent to inbox
   - User enters OTP → authenticated, redirect to original request
   - Subsequent requests use authenticated session cookie

**No Code Changes Required**: Cloudflare Access operates at the network layer (before the Worker code runs), so no backend modifications are needed.

---

## Task Breakdown

### Task 09-01: Unified Navigation Bar Across All Pages

**Objective**: Add a consistent, shared navigation component to all three pages (Records, Charts, Calculator) with automated active-page detection.

**Files Modified**:
- `public/index.html` (update header, add nav script include)
- `public/charts.html` (update header, add nav script include)
- `public/calculator.html` (update header, add nav script include)
- `public/css/style.css` (add `.top-nav` and `.nav-links` styles)
- `public/js/nav.js` (new, extracted active-page detection logic)
- `public/js/nav.test.ts` (new, vitest tests for nav.js)

**Deliverables**:

1. **Shared Navigation HTML**
   - Replace each page's current `<header>` section with unified navigation structure
   - Include all three page links (Records, Charts, Calculator)
   - Keep existing page-specific actions (e.g., "+ 新增" button on records page) outside the nav

2. **Navigation Styling**
   - Add `.top-nav`, `.nav-links`, `.nav-link`, `.nav-link.active` CSS rules
   - Ensure mobile responsiveness (stack vertically on < 768px)
   - Use consistent color scheme matching existing pages

3. **Active Page Indicator** (extracted to public/js/nav.js)
   - Extract active-page detection logic to `public/js/nav.js`
   - Create `public/js/nav.test.ts` with vitest tests
   - Include script in each page's footer to initialize active-page marking
   - Active state: underline or color highlight (use `.active` class)

**Checkpoints**:
- All three pages render with identical top navigation bar
- Navigation links are clickable and switch between pages
- Current page's link is visually highlighted
- Mobile viewport (375px) shows properly stacked navigation
- No console errors when navigating between pages
- **Automated**: `npm run test -- public/js/nav.test.ts` passes (active-page logic tested)
- **Static verification** — All three pages include nav code:
  ```bash
  for page in public/index.html public/charts.html public/calculator.html; do
    if grep -q 'class="nav-link"' "$page" && grep -q 'src="/js/nav.js"' "$page"; then
      echo "✓ $page has nav"
    else
      echo "✗ $page missing nav"
      exit 1
    fi
  done
  ```
- **Deploy to live** (W2 verification):
  ```bash
  npm run deploy
  # Verify output reports: "✓ Route btcethdivergence.bryanlab.cc/* deployed"
  
  # Verify nav appears on live site
  for page in / /charts.html /calculator.html; do
    if curl -s https://btcethdivergence.bryanlab.cc$page | grep -q 'nav-link'; then
      echo "✓ Live page $page has nav"
    else
      echo "✗ Live page $page missing nav"
      exit 1
    fi
  done
  ```

---

### Task 09-02: Cloudflare Access Configuration & Service Token Authentication

**Objective**: Gate the entire app behind Cloudflare Access authentication (owner email + Service Token for `/api/admin/*`), ensuring launchd cron continues to function.

**Critical Dependency**: The existing Phase 3 cron (launchd runners + GitHub Actions) must continue working after deploying Access. This task uses **TDD to verify the Service Token approach works before full implementation**.

**Files Modified**:
- `wrangler.jsonc` (no code changes; routes already configured)
- `scripts/backfill-fetcher.mts` (add Service Token header)
- `~/.config/btcethdivergence/backfill-runner.sh` (update environment)
- `.planning/phases/09-access-launch/ACCESS-CONFIG.md` (new, documents setup + testing)

**Deliverables**:

### Sub-Task 09-02-TDD: Test-Driven Verification of Service Token Approach

**Objective**: Verify that Cloudflare Access Service Tokens work with the launchd cron workflow before implementing the full Access configuration.

**TDD Tests** (execute in order):

**Test 1: Service Token passes Cloudflare Access (RED → GREEN)**
```bash
# Retrieve Service Token credentials from Cloudflare dashboard
# Format: CF_CLIENT_ID and CF_CLIENT_SECRET

# RED: Before creating Service Token policy
curl -i -H "Cf-Access-Client-Id: <CF_CLIENT_ID>" \
        -H "Cf-Access-Client-Secret: <CF_CLIENT_SECRET>" \
     https://btcethdivergence.bryanlab.cc/api/admin/backfill-cursor
# Expected: HTTP 401 with header "Cf-Access-Denied: true" 
# (proves Cloudflare Access blocked it because no policy exists yet)

# Configure Service Token policy in Cloudflare Access dashboard
# GREEN: After policy configuration
curl -i -H "Cf-Access-Client-Id: <CF_CLIENT_ID>" \
        -H "Cf-Access-Client-Secret: <CF_CLIENT_SECRET>" \
     https://btcethdivergence.bryanlab.cc/api/admin/backfill-cursor
# Expected: HTTP 401 WITHOUT "Cf-Access-Denied" header
# (proves Access LET the request through; app rejected it for missing INGEST_TOKEN)
```

**Test 2: Dual-layer authentication works (RED → GREEN)**
```bash
# Verify both Cloudflare Access (Service Token) AND app-level (INGEST_TOKEN) work together
curl -H "Cf-Access-Client-Id: <CF_CLIENT_ID>" \
     -H "Cf-Access-Client-Secret: <CF_CLIENT_SECRET>" \
     -H "Authorization: Bearer <INGEST_TOKEN>" \
     https://btcethdivergence.bryanlab.cc/api/admin/backfill-cursor
# Expected: 200 OK (both layers authenticated, API returns success)
```

**Test 3: launchd cron can use Service Token (REAL WORLD TEST)**
```bash
# Update scripts/backfill-fetcher.mts to include Service Token
# Run launchd job manually
# Expected: Cron executes successfully, data syncs correctly
```

**Fallback Decision**:
- If any test fails → Use conservative approach (Bypass internal IP or exclude `/api/admin/*` from Access)
- If all tests pass → Proceed with full Service Token implementation

---

1. **Access Application Setup** (manual, in Cloudflare dashboard)
   - Create "BTC/ETH Divergence Tracker" application
   - Set application domain to `https://btcethdivergence.bryanlab.cc`
   - Set application include to **entire domain** (`/`) to gate all paths (UI + API)
   - Configure email OTP login method
   - Add owner email to allow-list

2. **Policy Configuration** (after TDD verification)
   - **Policy 1 (User Routes + Data APIs)**: "Owner Email Only"
     - Match type: Hostnames + Paths
     - Paths include: `/`, `/charts.html`, `/calculator.html`, `/api/records*`, `/api/klines*`
     - Condition: user email == `gn01968711@gmail.com` (D-09-01)
     - Action: Allow
   
   - **Policy 2 (Admin APIs)**: "Service Token for Admin APIs"
     - Match type: Hostnames + Paths  
     - Paths include: `/api/admin/*`
     - Condition: Cloudflare Access Service Token (with CF_CLIENT_ID/SECRET)
     - Action: Allow
   
   - **Default action**: Block (deny all routes not explicitly Allow'd by a policy)

**How Access policies work** (clarification for B2):
- The application **include** (`/`) gates all traffic at the network layer
- Each **policy** matches paths and conditions; policies are evaluated in order
- Policy 1 allows `/api/records*` + `/api/klines*` only for owner email
- Policy 2 allows `/api/admin/*` only for Service Token
- Default block denies all other paths (including unauthenticated attempts to `/api/records` or `/api/admin/*`)
- Result: All `/api/*` routes are protected; each requires different credentials

3. **Service Token Implementation** (if TDD passes)
   - Create a Cloudflare Access Service Token in the dashboard:
     - Generate new token with 90-day expiration
     - Copy `CF_CLIENT_ID` and `CF_CLIENT_SECRET` values
   
   - **Update launchd runners**:
     - `~/.config/btcethdivergence/backfill-runner.sh`: 
       ```bash
       export WORKER_URL="https://btcethdivergence.bryanlab.cc"
       export CF_CLIENT_ID="<token-client-id>"
       export CF_CLIENT_SECRET="<token-client-secret>"
       ```
     - `~/.config/btcethdivergence/backfill-runner-eth.sh`: Same env vars
   
   - **Update GitHub Actions CI** (`.github/workflows/fetch-binance.yml`):
     - Update `WORKER_URL` secret to point to `https://btcethdivergence.bryanlab.cc`
     - Add `CF_CLIENT_ID` secret with token client ID
     - Add `CF_CLIENT_SECRET` secret with token client secret
   
   - **Update `scripts/backfill-fetcher.mts`** to add Cloudflare Access headers:
     ```typescript
     // Add Service Token headers for Cloudflare Access
     headers: {
       'Cf-Access-Client-Id': process.env.CF_CLIENT_ID || '',
       'Cf-Access-Client-Secret': process.env.CF_CLIENT_SECRET || '',
       'Authorization': `Bearer ${process.env.INGEST_TOKEN}`,
     }
     ```
   
   - **Type-check the modified script**:
     ```bash
     npm run typecheck -- scripts/backfill-fetcher.mts
     # Verify: no TypeScript errors
     ```
   
   - **Verify one live sync run**:
     ```bash
     launchctl kickstart -k gui/$(id -u)/com.btcethdivergence.backfill
     # Check logs for success: { inserted: N, skipped: M, cursor: X }
     ```

4. **Route Coverage** (All routes fully gated per SC2/INFRA-04)
   - **UI Routes** (Policy 1 — Owner Email OTP):
     - `/` (Records) — gated by email OTP
     - `/charts.html` (Charts) — gated by email OTP
     - `/calculator.html` (Calculator) — gated by email OTP
   
   - **Data API Routes** (Policy 1 — Owner Email OTP per D-09-04):
     - `/api/records` — gated by email OTP (POST/PUT/DELETE write operations protected)
     - `/api/klines` — gated by email OTP (read-only market data protected)
   
   - **Admin API Routes** (Policy 2 — Service Token + INGEST_TOKEN):
     - `/api/admin/backfill-cursor`, `/api/admin/ingest` — gated by Service Token (dual-layer auth)

5. **Documentation** — Create `ACCESS-CONFIG.md` with:
   - Step-by-step setup instructions (for future reference or if config needs to be recreated)
   - Screenshot references showing key configuration screens
   - Fallback procedure if Access needs to be disabled

**Checkpoints**:
- Unauthenticated user attempting to access the site is redirected to Cloudflare Access login
- Login page shows email OTP option
- Owner email successfully logs in with OTP
- Non-owner email is blocked with "access denied" message
- After login, user can access all three pages and API endpoints
- Session persists across page navigation (no re-login required)
- Logout functionality available (standard Cloudflare Access feature)
- **Automated verification** (post-deploy):
  ```bash
  # Unauthenticated requests to HTML pages should redirect (HTTP 302)
  # Browser requests get redirected to login
  curl -s -o /dev/null -w "%{http_code}\n" https://btcethdivergence.bryanlab.cc/
  curl -s -o /dev/null -w "%{http_code}\n" https://btcethdivergence.bryanlab.cc/charts.html
  curl -s -o /dev/null -w "%{http_code}\n" https://btcethdivergence.bryanlab.cc/calculator.html
  # Expected: HTTP 302 (with Location: *.cloudflareaccess.com header)
  
  # Unauthenticated requests to ALL /api/* should return 401 with Cf-Access-Denied
  # Access blocks non-browser (API) requests; no redirect for API clients
  curl -i https://btcethdivergence.bryanlab.cc/api/records 2>&1 | grep -E "HTTP|Cf-Access-Denied"
  curl -i https://btcethdivergence.bryanlab.cc/api/klines 2>&1 | grep -E "HTTP|Cf-Access-Denied"
  curl -i https://btcethdivergence.bryanlab.cc/api/admin/backfill-cursor 2>&1 | grep -E "HTTP|Cf-Access-Denied"
  curl -i https://btcethdivergence.bryanlab.cc/api/admin/ingest 2>&1 | grep -E "HTTP|Cf-Access-Denied"
  # Expected: HTTP 401 with header "Cf-Access-Denied: true" — proves Policy 1/2 are working
  ```

---

## Risk & Mitigation

### Risk 1: Navigation Breaking Existing Functionality

**Risk**: Modifying headers might accidentally break page-specific features (e.g., "+ 新增" button position, form layouts).

**Mitigation**:
- Keep page-specific actions (buttons, dropdowns) separate from the main navigation
- Use semantic HTML (`<nav>` for nav, `<header>` can contain both nav and page-specific controls)
- Test all page features after each navigation change
- Mobile layout should stack navigation above page-specific controls

### Risk 2: Cloudflare Access Breaking Automated Cron Jobs

**Risk**: If Access is enabled before launchd runners and GitHub Actions are re-wired with Service Tokens, the daily kline sync will fail, causing chart data to go stale.

**Mitigation**:
- **TDD Verification** (Sub-Task 09-02-TDD): Validate Service Token approach passes all three tests before full deployment
- Update both launchd runners **and** GitHub Actions CI with Service Token configuration before deploying Access
- **Checkpoint before deployment**: Run one live launchd job manually and verify it succeeds (log output shows `{ inserted: N, skipped: M, cursor }`）
- If Service Token TDD fails, use conservative fallback: either exclude `/api/admin/*` from Access gating or use a static IP bypass for CI runners
- **Document the automation impact** in `ACCESS-CONFIG.md` so future maintainers know the sync dependency

### Risk 3: OTP Delivery Delays or Email Filtering

**Risk**: Owner's email might not receive OTP, or OTP expires before use.

**Mitigation**:
- Cloudflare Access OTP is sent via standard email; verify the email address has reliable inbox access
- OTP is typically valid for 1 hour (Cloudflare default)
- Test OTP flow before declaring Phase 9 complete
- If issues arise, can fall back to other Access login methods (Google SSO, Microsoft, etc.)

### Risk 4: Scope Creep: Adding More Authentication Features

**Risk**: Temptation to add roles, permissions, user management, etc.

**Mitigation**:
- Phase 9 scope is explicitly: **one user (owner) only**, email-based gating
- No RBAC (Role-Based Access Control) needed
- Cloudflare Access handles all authentication; no custom auth code
- Keep implementation simple and avoid feature expansion

---

## Success Criteria Verification

After Phase 9 is complete, verify each success criterion:

| SC | Requirement | Verification | Status |
|---|---|---|---|
| Nav-1 | User can switch between Records, Charts, Calculator via nav bar | Deploy live, click nav links, verify pages load | [ ] |
| Nav-2 | Navigation is consistent across all pages | Check styling, layout, link order on all three pages | [ ] |
| Nav-3 | Current page is highlighted in nav | Navigate to each page, verify active link is highlighted | [ ] |
| Nav-4 | Navigation works on mobile (375px) | Resize to mobile, check nav stacks vertically | [ ] |
| Access-1 | Unauthenticated request redirects to Access login | Open private/incognito browser, visit site URL | [ ] |
| Access-2 | API routes are protected | Attempt API call without auth, verify 401 or redirect | [ ] |
| Access-3 | Email OTP login works | Use owner email, receive OTP, enter OTP, verify login | [ ] |
| Access-4 | Non-owner email is blocked | Try different email, verify access denied | [ ] |
| Access-5 | Session persists across navigation | Log in, navigate between pages, verify no re-login | [ ] |

---

## Timeline Estimate

Based on Phase 1–8 velocity (~15–25 min per task):
- **09-01** (Shared navigation): 10 min
- **09-02** (Cloudflare Access config): 15 min (mostly manual dashboard work)
- **Total Phase 9**: ~25 min (excluding Cloudflare dashboard time, which happens in parallel)

---

## Dependencies

- **Depends on**: Phase 5, Phase 7, Phase 8 (all complete ✅)
- **No new D1 tables or API endpoints** — purely UI and infrastructure gating
- **No external packages** — uses only Cloudflare Access (existing service)

---

## Notes

- **Cloudflare Access is a Cloudflare product feature**, not a third-party integration — configuration happens in the Cloudflare dashboard, not the codebase
- **No build step, no custom auth code** — aligns with project's simplicity principle
- **Static assets continue to be served by the Worker** — Access gates the entire domain, not individual routes within the Worker
- **After Phase 9, the app is production-ready and owner-gated** — ready to potentially move to a public repo if desired, since Cloudflare Access controls access

---

## Next Phase

After Phase 9 completes:
- App is fully deployed, navigable, and access-controlled
- All features (Records CRUD, Charts, Calculator) are live
- Ready for day-to-day owner use
- Potential future work: mobile app, data export, analytics, etc. (out of scope for Phase 9)

