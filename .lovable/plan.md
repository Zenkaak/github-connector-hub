# Multi-Tenant SACCO White-Label System

Build a tenant layer **inside the existing Dasnet app** — no separate deployments, no breaking changes. Each SACCO becomes a "tenant" with its own admin, branded chama portal, isolated paybill, and optional custom domain. Main Dasnet keeps working exactly as it does today.

## What you'll be able to do after this ships

1. From **Main Admin → Tenants**, click **Create SACCO** → enter name, logo, admin name, phone, email, custom paybill (optional).
2. System auto-generates a username + random password, sends **SMS + email** to the new SACCO admin with login link.
3. SACCO admin logs in → lands **directly on `/sacco/:slug/admin`** (chama + MGR system only — no wallet, no harambee, no Dasnet branding).
4. Their members pay loans/contributions to **the SACCO's own paybill** using **ID number as account reference**.
5. M-Pesa callbacks for that paybill hit a **tenant-aware** confirmation URL (`/functions/v1/mpesa-callback?tenant=xyz`) — fully isolated from your Dasnet paybill.
6. Optionally connect a **custom domain** (e.g. `chama.saccoabc.co.ke`) that points at the same Dasnet app but auto-loads that tenant's branding/portal.
7. **"Push update to tenants"** toggle on main admin — every code change you make in Dasnet automatically reaches all tenants (since it's one app). The toggle controls whether **new features** (e.g. emergency fund, MGR v2) are enabled per-tenant.

## Architecture (no separate hosting — one app, many tenants)

```text
                      ┌──────────────────────────┐
   dasnet.lovable.app │  MAIN DASNET (unchanged) │
   /dashboard/admin   │  wallet, harambee, etc.  │
                      └──────────────────────────┘
                                  │ same app
                      ┌──────────────────────────┐
   sacco-a.co.ke      │  TENANT A — chama+mgr    │
   /sacco/sacco-a/*   │  own paybill, own logo   │
                      └──────────────────────────┘
                      ┌──────────────────────────┐
   sacco-b.co.ke      │  TENANT B — chama+mgr    │
   /sacco/sacco-b/*   │  own paybill, own logo   │
                      └──────────────────────────┘
```

## Build steps

### 1. Database (additive — nothing renamed/dropped)
- `tenants` table: id, slug, name, logo_url, primary_color, custom_domain, paybill_shortcode, paybill_passkey_secret_ref, callback_token, features_enabled jsonb, created_at.
- `tenant_admins` table: tenant_id, user_id, role.
- Add nullable `tenant_id` to: `chama_groups`, `chama_loans`, `chama_members`, `stk_transactions`, `mgr_cycles`. Existing rows stay NULL → treated as "Dasnet main" → zero behaviour change.
- RLS helper `is_tenant_admin(_tenant, _user)` and `current_tenant_id()` (reads from JWT claim or URL).

### 2. Main admin UI (new tab)
- `AdminTenantsModule` added to existing `AdminDashboardPage` tab map.
- List, create, edit, suspend SACCOs.
- Create dialog: name, slug, logo upload, admin (name/phone/email), paybill shortcode, paybill consumer key/secret (stored in vault), feature toggles (chama on/off, mgr on/off).
- On create → calls `create-tenant` edge function → creates auth user, hashes random password, fires SMS via existing Africa's Talking integration + email via existing branded template.

### 3. Tenant portal routing
- New routes: `/sacco/:slug/login`, `/sacco/:slug/admin`, `/sacco/:slug/chama/:groupId`, `/sacco/:slug/mgr`.
- `TenantLayout` wraps these — loads tenant by slug, applies logo + primary color via CSS variables, hides Dasnet nav.
- Tenant admins land on `/sacco/:slug/admin` after login (existing admin redirect logic extended).
- Reuse existing `ChamaGroupDetailPage`, `ChamaMerryGoRound`, etc. — they just receive `tenant_id` from context.

### 4. Isolated M-Pesa
- New edge function `mpesa-tenant-callback` — reads `?tenant=<callback_token>` from URL, looks up tenant, credits the right loan/contribution scoped by `tenant_id` + ID-number reference.
- Existing `mpesa-callback` stays untouched (Dasnet paybill).
- Main admin UI shows the confirmation/validation URLs to paste into Safaricom portal per tenant.

### 5. Custom domain (optional, per tenant)
- Tenant record stores `custom_domain`.
- Add middleware in `App.tsx` that reads `window.location.hostname` → if it matches a tenant's custom_domain, auto-routes to `/sacco/:slug/*`.
- User points their DNS at Lovable (existing custom-domain flow) — no extra hosting.

### 6. "Push updates" control
- Since it's one codebase, every Dasnet code change automatically reaches tenants on next deploy.
- The admin toggle controls **feature flags** per tenant (`features_enabled` jsonb): which modules are visible. So you can ship a new module to Dasnet first, then enable it per SACCO when ready.

## Safety guarantees
- Every new column is **nullable**; existing queries with no `tenant_id` filter behave identically.
- No existing route, component, edge function, or RLS policy is renamed or removed.
- Main Dasnet admin, wallet, harambee, loans, MGR all unchanged.
- New tenant code lives under `/sacco/*` routes and `src/components/tenant/*` — fully isolated.
- Rollback = drop the new tables + delete the new routes. Zero impact on Dasnet.

## Scope for this first build
I'll ship steps **1–4** in this turn (DB + main admin "Create SACCO" + SMS/email invite + tenant login + tenant chama/MGR portal + isolated paybill callback). Custom domains (step 5) and feature-flag toggles (step 6) come next once you confirm step 1–4 works end-to-end with a test SACCO.

Approve and I'll start with the migration.
