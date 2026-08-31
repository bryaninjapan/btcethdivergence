# Phase 9 UAT — Access & Launch Hardening

**Date**: 2026-08-31 to 2026-09-01  
**Status**: ✅ COMPLETE  

---

## Test Results Summary

| Test | Scenario | Expected | Actual | Status |
|------|----------|----------|--------|--------|
| 1 | Frontend UI access | 302 redirect to Email OTP | 302 redirect ✓ | ✅ PASS |
| 2 | Data API access | 302 redirect to Email OTP | 302 redirect ✓ | ✅ PASS |
| 3 | Admin API (no token) | 403 Forbidden | 403 Forbidden ✓ | ✅ PASS |
| 4 | Admin API (Service Token only) | 401 Unauthorized | 401 Unauthorized ✓ | ✅ PASS |
| 5 | Admin API (both tokens) | 200 OK + JSON data | 200 OK ✓ | ✅ PASS |
| 6 | Email OTP login | Successful login + Charts load | Success ✓ | ✅ PASS |

---

## Test Details

### Test 1: Frontend UI Protection
```
curl -i https://btcethdivergence.bryanlab.cc/
→ HTTP/2 302 (Cloudflare Access Email OTP redirect)
✅ PASS: Unauthenticated requests redirected to login
```

### Test 2: Data API Protection  
```
curl -i https://btcethdivergence.bryanlab.cc/api/records
→ HTTP/2 302 (Cloudflare Access Email OTP redirect)
✅ PASS: Data APIs protected by Email OTP
```

### Test 3: Admin API (No Authentication)
```
curl -i https://btcethdivergence.bryanlab.cc/api/admin/backfill-cursor
→ HTTP/2 403 Forbidden (Cloudflare Access error)
✅ PASS: Cloudflare Access correctly identifies Admin API, denies unauthenticated access
```

### Test 4: Admin API (Service Token Only)
```
curl -i -H "CF-Access-Client-Id: $CF_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_CLIENT_SECRET" \
     https://btcethdivergence.bryanlab.cc/api/admin/backfill-cursor
→ HTTP/2 401 Unauthorized: {"ok":false,"error":"Unauthorized"}
✅ PASS: Layer 1 (Cloudflare Access Service Token) passed
         Layer 2 (INGEST_TOKEN) failed (as expected without token)
```

### Test 5: Admin API (Service Token + INGEST_TOKEN)
```
curl -i -H "CF-Access-Client-Id: $CF_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_CLIENT_SECRET" \
     -H "Authorization: Bearer $INGEST_TOKEN" \
     https://btcethdivergence.bryanlab.cc/api/admin/backfill-cursor
→ HTTP/2 200 OK
   {"ok":true,"data":{"symbol":"BTCUSDT","cursor":1788184800,"default":1609459200}}
✅ PASS: Dual-layer authentication successful
         - Layer 1: Service Token auth ✓
         - Layer 2: INGEST_TOKEN auth ✓
```

### Test 6: Email OTP Login + Charts Page
**Steps**:
1. Navigate to `https://btcethdivergence.bryanlab.cc/`
2. Redirected to Cloudflare Access Email OTP login
3. Enter email: `gn01968711@gmail.com`
4. Receive and enter OTP code
5. Successfully logged in, navigate to Charts page
6. K-line candlestick charts display normally
7. Data loaded successfully via `/api/klines` with credentials

✅ PASS: Complete user flow working
- Email OTP authentication ✓
- Session cookie properly set ✓
- CORS credentials included in fetch requests ✓
- K-line data accessible after login ✓
- Charts page fully functional ✓

---

## Key Fixes Applied

### 1. API Fetch Credentials (public/js/api.js)
```javascript
// BEFORE: No credentials
fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options })

// AFTER: Include credentials for Cookie-based auth
fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options })
```
**Impact**: Enables browser to send Cloudflare Access cookies with cross-origin API requests

### 2. CORS Middleware (src/index.ts)
```typescript
// Added CORS middleware
app.use('*', cors({ credentials: true }));
```
**Impact**: Allows requests with credentials and sets proper CORS headers

### 3. Dual-Layer Authentication Architecture
- **Layer 1**: Cloudflare Access (Service Token for cron, Email OTP for UI/data)
- **Layer 2**: Application-level INGEST_TOKEN validation

---

## Cloudflare Configuration

### Applications
| Name | Path | Policy |
|------|------|--------|
| Frontend UI | `/`, `/charts.html`, `/calculator.html` | Owner Email OTP |
| Data APIs | `/api/records*` | Owner Email OTP |
| Admin APIs | `/api/admin*` | Service Token Auth |

### Service Token
- Name: `btcethdivergence-cron-2026-08`
- Duration: 1 year
- Status: Active ✓

---

## Deployment Verification

### Commit History
- `ae0dd1d`: fix: add credentials: include to fetch for Cloudflare Access Cookie auth
- `4fe22ef`: fix: add CORS credentials support for Cookie-based authentication

### Deployed Version
- Current: `3b168898-52f8-40d1-a352-dc8f354914a1`
- Domain: `btcethdivergence.bryanlab.cc`
- Status: ✅ Live

---

## Test Coverage

✅ 6/6 tests passed (100%)

**Coverage**:
- ✅ Frontend UI access control
- ✅ Data API access control  
- ✅ Admin API access control
- ✅ Service Token authentication
- ✅ INGEST_TOKEN validation
- ✅ Email OTP user flow
- ✅ CORS credentials handling
- ✅ Charts page functionality

---

## Known Behaviors

1. **Unauthenticated requests return 302**: This is correct. Cloudflare Access redirects to login.
2. **Cookies required for API access**: Browser automatically includes Cloudflare Access cookies after login.
3. **Service Token headers must match case**: `CF-Access-Client-Id` (not `Cf-Access-Client-Id`)
4. **Dual-layer auth is required for Admin APIs**: Both Cloudflare Access + INGEST_TOKEN must pass

---

## Conclusion

Phase 9 (Access & Launch Hardening) is **complete and verified**. 

All authentication layers are working correctly:
- ✅ Cloudflare Zero Trust Access properly gates public routes
- ✅ Service Token authentication works for cron/automation
- ✅ Email OTP authentication works for end users
- ✅ CORS configuration enables secure cross-origin requests
- ✅ K-line data loads successfully after authentication

**Ready for production.**

---

**Session**: 2026-08-31 to 2026-09-01  
**Tested by**: User + TDD Workflow  
**Status**: ✅ COMPLETE
