## Sample SACCO tenant (timjeru835@gmail.com / 0702536866)

The `create-tenant` function requires an **admin JWT** (it verifies `is_admin` on the caller). I cannot trigger it from the server without your login session. After this plan is approved, please:

1. Open **/dashboard/admin/tenants**
2. Click **Create SACCO**
3. Fill: Name = "Sample SACCO", Admin = "Tim Jeru", Phone = `0702536866`, Email = `timjeru835@gmail.com`
4. Submit — SMS goes through Africa's Talking and email through the verified `notify.dasnett.site` queue (both confirmed working last test).

If either fails, I'll inspect the `email_send_log` + edge function logs and patch the specific failure.

---

## Redesign 1 — Admin Dashboard (full reimagining)

Goal: move from "polished sidebar shell" to a **command-center workspace** that feels like Linear meets a Bloomberg terminal, in the DASNET dark-navy / emerald / gold language.

### Shell (`AdminLayout.tsx`)
- Replace the static sidebar with **`shadcn Sidebar` (`collapsible="icon"`)** so desktop users can collapse to a 56px icon rail.
- New three-zone top bar: **breadcrumb + workspace switcher** (left) · **global search ⌘K** (centre) · **alerts + profile menu** (right).
- Persistent **status strip** under the top bar: M-Pesa queue depth · pending KYC · open withdrawals · system health dot. Live, click-through to the relevant module.
- Dark-navy chrome with a single accent (gold) for active state; emerald reserved for "healthy" status dots only.

### Overview module (`AdminOverviewModule.tsx`)
- **Hero KPI band** — 4 oversized tiles (AUM, 24h Transfer Volume, Active Loans, MoM Growth) with embedded sparklines (Recharts) and delta chips.
- **Operations row** — three cards side-by-side:
  - *Action Queue* (KYC, unmapped M-Pesa, withdrawal approvals, removal requests) as a tabbed list with one-click resolve.
  - *Live Activity* (real-time feed of transactions / signups via Supabase realtime channel).
  - *Tenants Pulse* (mini bar chart of contributions per SACCO, top 5).
- **Analytics row** — full-width revenue area chart + portfolio donut.
- All cards use the same token system: `rounded-2xl`, `border-border/60`, soft inner gradient, no harsh shadows.

### Module pages
- Standardise every module on a new `AdminPageHeader` component (title, description, primary action, filter bar) so Users / Loans / Tenants / M-Pesa all share the same skeleton.
- Replace ad-hoc filter rows with a single `AdminToolbar` variant.

---

## Redesign 2 — ChamaGroupDetailPage (full reimagining, recommended style)

Recommended direction = **professional Kenyan banking workspace**: dark-navy hero with the group's balance front-and-centre, gold accents, emerald for positive deltas, sidebar-driven section navigation on desktop, bottom nav on mobile. Matches DASNET brand and pairs visually with the new admin shell.

### New layout
```text
┌────────────────────────────────────────────────────────────────┐
│  Sticky compact header: ← Back · GroupName · Share · Settings  │
├──────────────┬─────────────────────────────────────────────────┤
│              │  HERO                                           │
│  Section     │  ┌───────────────────────────────────────────┐  │
│  rail        │  │ avatar  Group name + chips                │  │
│  (desktop)   │  │ ────────────────────────────────────────  │  │
│   Money      │  │ Group pool KES 0   ▲ 12%   sparkline      │  │
│   People     │  │ My savings · Deposits · Members           │  │
│   Manage     │  └───────────────────────────────────────────┘  │
│              │  Quick actions row (Contribute · Loan · …)      │
│              │  Section content (renders ChamaSavings etc.)    │
└──────────────┴─────────────────────────────────────────────────┘
```

### Concrete changes
- Extract the existing section list into a new **`ChamaSectionRail`** sidebar (desktop) + keep the current `MobileBottomNav` pattern below 1024px.
- Rebuild the home hero as a single dark-navy card with:
  - 30-day group-pool sparkline behind the balance number
  - emerald/red delta chip vs previous period
  - role chip, members chip, contribution-rate chip in a single line
  - gold "Contribute" CTA as the primary action
- Replace the "secondary stats strip" with a **dense ribbon** (joining fees · platform fees · arrears count · next meeting) — single row, no boxes.
- Section catalog grid (Money/People/Manage) becomes a **compact 2-column list with descriptions** on desktop, current 4-col grid on mobile.
- Each individual section page (savings, loans, etc.) gets the same `ChamaSectionHeader` (icon + title + description + close-to-home button) — already roughly in place, just tighten typography and remove the breadcrumb (sidebar makes it redundant on desktop).
- Preserve all existing functional components (`ChamaSavings`, `ChamaLoans`, `ChamaChat`, dialogs, profile-pic upload, broadcast, member add/remove, role updates) — only the shell around them changes.

---

## Technical notes

- New files: `src/components/admin/AdminPageHeader.tsx`, `src/components/admin/AdminStatusStrip.tsx`, `src/components/chama/ChamaSectionRail.tsx`, `src/components/chama/ChamaHeroBalance.tsx`.
- `AdminLayout.tsx` rewritten to use `SidebarProvider` + `Sidebar` from shadcn.
- `AdminOverviewModule.tsx` restructured; existing chart data hooks retained.
- `ChamaGroupDetailPage.tsx` shell rewritten; all child component imports and data hooks unchanged.
- No database migrations needed. No edge-function changes.
- Risk: the sidebar rewrite touches every admin route header. Mitigation: keep the old `AdminBottomNav` for mobile so existing mobile nav UX is untouched.

## Out of scope (would need a follow-up)
- Per-module redesign beyond the shared header/toolbar (Users, Loans, M-Pesa internals stay as-is).
- Per-section redesign inside the chama (ChamaSavings, ChamaLoans, etc. internals stay as-is).
- Any backend / RLS / edge function changes.
