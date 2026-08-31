# Phase 9 Context — Locked Decisions

**Date**: 2026-08-31

## Locked Decisions

### D-09-01: Owner Email for Cloudflare Access

**Decision**: The BTC/ETH Divergence Tracker app is owner-gated via Cloudflare Access using email OTP authentication. The single owner is:

```
gn01968711@gmail.com
```

**Rationale**: 
- Email matches the Cloudflare account name (`gn01968711`) used for the Worker subdomain
- Confirmed as the sole authorized user for this internal tracking tool
- Used for Cloudflare Access allow-list policy in Phase 9-02

**Scope**: Cloudflare Access authentication policy (SC3 of Phase 9)

---

### D-09-02: Custom Domain for Cloudflare Access

**Decision**: The app is deployed to a custom domain with CNAME routing:

```
Host:        btcethdivergence.bryanlab.cc
Target:      btcethdivergence.gn01968711.workers.dev
Type:        CNAME (Proxied via Cloudflare)
```

**Rationale**:
- `bryanlab.cc` is the authoritative zone in Cloudflare
- Workers route configured via `wrangler.jsonc` routes field
- Enables Cloudflare Access to gate the live application

**Scope**: All public URLs for Phase 9 and beyond (SC2 of Phase 9)

---

### D-09-03: Access Application Type

**Decision**: Cloudflare Access application is configured as **Self-hosted**, not SaaS.

**Rationale**:
- Application runs on `*.workers.dev` subdomain (Cloudflare Workers)
- Self-hosted type is correct for first-party worker deployments
- SaaS type is for third-party SaaS applications only

**Scope**: Cloudflare Access setup procedures in Phase 9-02

---

### D-09-04: Data Endpoint Access Policy

**Decision**: Data endpoints `/api/records` and `/api/klines` are **gated by Cloudflare Access** (Policy 1: Owner Email OTP).

**Rationale**:
- `/api/records` is NOT read-only — it exposes `POST` (create), `PUT` (edit), `DELETE` (remove) endpoints
- `/api/klines` is read-only but returns market data tied to the owner's analysis
- Both are sensitive internal data; public access would allow anyone to:
  - Forge/modify trading records (POST/PUT)
  - Delete the owner's record history (DELETE)
  - Extract price data for analysis/scraping (GET)
- **Security boundary**: All API routes are protected by Access
  - `/api/records`, `/api/klines` → Cloudflare Access email OTP (Policy 1)
  - `/api/admin/*` → Cloudflare Access Service Token (Policy 2) + INGEST_TOKEN

**Scope**: All public URLs (UI + APIs) are fully gated behind Cloudflare Access per SC2/INFRA-04

