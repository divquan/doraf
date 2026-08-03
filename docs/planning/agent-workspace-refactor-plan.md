# Agent workspace refactor plan

Status: Active (Phases 0-4 completed)
Last updated: 2026-08-03

This is an executable implementation plan for restructuring `apps/agent` from a
single-page feature dump (`/dashboard`) into a structured, navigable agent
workspace with intentional page responsibilities, progressive disclosure, and
separate agent and buyer experiences.

It is derived from the UX & product architecture audit and validated against the
current codebase and Next.js 16 framework conventions. It is **not** a redesign
of visual styling and **does not implement anything**. An implementation agent
should be able to execute it without reinterpreting the audit.

Companion documents:
- Audit (delivered in conversation): structural UX findings.
- [MVP scope](product/06-mvp-scope.md) — confirmed feature boundaries.
- [Agent portal](product/04-agent-portal.md) — intended agent surface.
- [Implementation progress](planning/implementation-progress.md) — current
  state and deferred items.

## Validated codebase facts (non-negotiable)

Confirmed by reading the code and the Next.js 16 docs bundled at
`node_modules/.pnpm/next@16.2.6.../dist/docs/`.

1. **`proxy.ts` is a single file at the app root** (`apps/agent/proxy.ts`).
   Next.js 16 docs: "only one `proxy.ts` file is supported per project... located
   at the same level as pages or app." It **cannot** live in a route group.
   Route protection is path-based via the `matcher` config.
2. **Route groups `(name)`** enable shared layouts **without affecting URLs**.
   Moving `buy/[webSalesId]` into `(storefront)` keeps the URL `/buy/[webSalesId]`;
   moving `dashboard` into `(workspace)` keeps `/dashboard`. Public URLs stable.
3. **`@workspace/ui` exports**: `alert`, `badge`, `button`, `card`, `empty`,
   `field`, `input`, `input-otp`, `label`, `native-select`, `separator`,
   `spinner`, `table`, `toggle`, `toggle-group`. There is **no** `nav`,
   `sidebar`, `menu`, `dialog`, `drawer`, `sheet`, or `breadcrumb` primitive.
   `cn` is at `@workspace/ui/lib/utils`. `@base-ui/react` is installed (a
   UI-package dependency) but not used directly in `apps/agent`.
4. **`PageProps<'/route'>` and `LayoutProps<'/route'>`** are global helpers
   (already used in `app/dashboard/page.tsx` and `app/buy/[webSalesId]/page.tsx`).
5. **Session cookies**: `doraf_agent_session`, `doraf_agent_registration`
   (`lib/agent-session.ts`).
6. **Current proxy behavior** (`proxy.ts`): no-session `/dashboard` → `/login`;
   has-session on `/login`|`/register` → `/dashboard`. Matcher:
   `["/dashboard/:path*", "/login", "/register"]`.
7. **No `not-found.tsx`, `loading.tsx`, or `error.tsx`** exist; error/loading is
   inline per page.
8. **Dashboard fetches 6 endpoints in parallel**: `/agent-auth/session`,
   `/agent-auth/prices`, `/agent-auth/sales-channel`, `/agent-wallet/summary`,
   `/agent-wallet/transactions?page=`, `/agent-wallet/withdrawals`.
9. **Duplicated helpers**: `readResponse` ×3 (`agent-auth-flow.tsx`,
   `buyer-recovery-flow.tsx`, `withdrawal-panel.tsx`); `money()` ×4 with **two
   signatures**; date formatters ×2 (`formatAccraDate`, `formatDate`).
10. **Sales URL** computed in `dashboard/page.tsx` from `channel.path` +
    `DORAF_AGENT_WEB_URL` env (default `http://localhost:3002`).

---

## 1. Scope and goals

### What this refactor will accomplish
- Decompose the single `/dashboard` page into a navigable workspace with
  dedicated routes: `/dashboard`, `/sales`, `/pricing`, `/wallet`,
  `/withdrawals`, `/settings`.
- Introduce a persistent authenticated workspace layout with primary navigation,
  a workspace header, and an account/sign-out area.
- Make `/dashboard` an **overview only** (summaries, alerts, recent activity,
  task entry points) — not the entire application.
- Separate the public buyer surface (storefront + recovery) from the agent
  workspace via route groups and audience-appropriate chrome, **without changing
  public URLs**.
- Apply progressive disclosure to the withdrawal request flow.
- Add a price-change confirmation step.
- Consolidate duplicated money/date/response utilities.
- Give missing confirmed features (orders, reporting metrics, notifications,
  exports) **deliberate homes** in the IA, represented by intentional empty
  states until scope is confirmed — never fake functionality.

### What this refactor will deliberately NOT accomplish
- It will not implement order history, reporting-period metrics, notifications,
  or CSV exports as working features. These are Category C (§15) and require
  product-owner scope confirmation.
- It will not change backend/API contracts. All BFF routes (`app/api/...`) stay
  unchanged.
- It will not redesign visual styling or the design system.
- It will not change public sales-link URLs or recovery URLs.
- It will not introduce new backend services.

### Expected user-facing outcome
- A signed-in agent sees persistent navigation and can go directly to Dashboard,
  Sales, Pricing, Wallet, Withdrawals, or Settings.
- The dashboard answers "how am I doing?" at a glance (within existing APIs) and
  links to detail pages.
- Each task has a focused page with a clear primary purpose.
- Withdrawals require an explicit intent click before the form appears.
- Price changes require confirmation before committing.
- Buyers see buyer-appropriate chrome on `/buy/...` and `/recover` (no "Agent"
  branding leak).
- Financial values are formatted consistently everywhere.

### Architectural outcome
- Three route groups: `(auth)`, `(workspace)`, `(storefront)`, each with its own
  layout.
- A single root `proxy.ts` with an expanded matcher covering all workspace
  routes.
- Reusable workspace primitives (nav, header, page header, summary tile) in
  `apps/agent/components/_workspace/`.
- Shared formatting utilities in `apps/agent/lib/format.ts` and a shared
  `readResponse` in `apps/agent/lib/api-client.ts`.
- Existing leaf components are **reused**, not rewritten, moving unchanged into
  their new pages where possible.


---

## 2. Current-to-target mapping

| Current section / component | Current file | Current route | Proposed route | Action | Behavior to preserve |
|---|---|---|---|---|---|
| Root layout | `app/layout.tsx` | all | all | Keep as root | Theme init, fonts, `<html>`/`<body>`, `D` hotkey |
| Auth shell | `components/auth-page-shell.tsx` | `/login`, `/register` | `(auth)` group | Reuse via `(auth)/layout.tsx` | Marketing split layout |
| Auth flow | `components/agent-auth-flow.tsx` | `/login`, `/register` | `(auth)/login`, `(auth)/register` | Reuse; later split (§6) | 3-step wizard, mode prop, redirects |
| Login page | `app/login/page.tsx` | `/login` | `(auth)/login/page.tsx` | Move (URL stable) | — |
| Register page | `app/register/page.tsx` | `/register` | `(auth)/register/page.tsx` | Move (URL stable) | — |
| Root redirect | `app/page.tsx` | `/` | `/` | Keep | cookie?→dashboard:login |
| Dashboard welcome + suspension | `app/dashboard/page.tsx` | `/dashboard` | `(workspace)/dashboard/page.tsx` | Keep; move rest out | First-name greeting, suspension banner |
| Wallet balance card | `components/wallet-balance-card.tsx` | `/dashboard` | `/dashboard` (compact) + `/wallet` (full) | Reuse in both | Negative-balance alert, 3 tiles, status badge |
| Withdrawal panel | `components/withdrawal-panel.tsx` | `/dashboard` | `/withdrawals` | Move; gate form (§5) | OTP step machine, fee/hold math, read-only, history |
| Transaction history | `components/transaction-history-table.tsx` | `/dashboard` (`?walletPage=`) | `/wallet` (`?walletPage=`) | Move; recent 5 on dashboard | Pagination, empty state, GMT date |
| Pricing grid | `components/pricing-grid.tsx` | `/dashboard` | `/pricing` | Move; add confirm (§5) | Range validation, profit calc, per-card save, read-only |
| Sales link card | `components/sales-link-card.tsx` | `/dashboard` | `/sales` | Move (primary home) | Copy + native share, suspension note |
| Security/account card | inline in `dashboard/page.tsx` | `/dashboard` | `/settings` | Extract to `account-summary-card.tsx` | Display-only sign-in method, masked phone, status badge |
| Logout button | `components/logout-button.tsx` | `/dashboard` header | workspace header (all) | Reuse in layout | Sign-out + redirect |
| Storefront | `app/buy/[webSalesId]/page.tsx` + `components/storefront-checkout.tsx` | `/buy/[webSalesId]` | `(storefront)/buy/[webSalesId]` | Move; buyer layout; split (§6) | Paystack inline, polling, status card, empty store |
| Recovery | `app/recover/page.tsx` + `components/buyer-recovery-flow.tsx` | `/recover` | `(storefront)/recover` | Move; buyer layout | 3-step wizard, anti-enumeration, voucher reveal |
| Brand mark | `components/doraf-mark.tsx` | all headers | all | Add `variant` prop | Logo; buyer variant hides "Agent" subtext |
| Money format | `lib/money-format.ts` + 4 inline `money()` | many | `lib/format.ts` | Consolidate (§8) | `pesewasToGhs` semantics |
| Date format | 2 inline formatters | 2 files | `lib/format.ts` | Consolidate (§8) | `Africa/Accra` tz |
| `readResponse` | 3 inline copies | 3 files | `lib/api-client.ts` | Consolidate (§8) | Error message extraction |
| BFF API routes (16) | `app/api/**` | `/api/...` | `/api/...` | Unchanged | All contracts |
| Proxy/middleware | `proxy.ts` | all | all | Expand matcher | Redirect logic |

### Items with no current implementation (Category C — §15)

| Feature | Proposed home | Treatment in refactor |
|---|---|---|
| Order history | `/sales` | Intentional empty state if confirmed not-in-scope; else implement after confirmation |
| Reporting-period metrics | `/dashboard` | KPI placeholders only if confirmed deferred; else implement (requires backend) |
| Notifications | `/settings` (prefs) + header bell | Reserve Settings section; no bell until implemented |
| CSV exports | `/settings` or `/wallet` | Reserve Settings section; "not yet available" state (deferred per impl-progress) |
| Account/profile management | `/settings` | Account summary moved here; full editing post-refactor |
| First-run onboarding | `/dashboard` | Post-refactor (Category C) |

---

## 3. Proposed route and layout tree

```
apps/agent/
  app/
    layout.tsx                       # ROOT (unchanged): fonts, ThemeProvider, theme script, metadata
    page.tsx                         # redirect: cookie? /dashboard : /login  (unchanged)
    favicon.ico
    (auth)/
      layout.tsx                     # NEW: renders <AuthPageShell>{children}</AuthPageShell>
      login/page.tsx                 # MOVED from app/login (URL /login stable)
      register/page.tsx              # MOVED from app/register (URL /register stable)
    (workspace)/
      layout.tsx                     # NEW (server): fetch /agent-auth/session; render WorkspaceHeader + WorkspaceNav + {children}
      dashboard/page.tsx             # MOVED + slimmed to overview
      sales/page.tsx                 # NEW: SalesLinkCard + (orders placeholder/empty state)
      pricing/page.tsx               # NEW: PricingGrid + confirm dialog
      wallet/page.tsx                # NEW: WalletBalanceCard + TransactionHistoryTable (paginated)
      withdrawals/page.tsx           # NEW: WithdrawalPanel (request gated) + history
      settings/page.tsx              # NEW: AccountSummaryCard + Appearance + Legal (+ reserved sections)
    (storefront)/
      layout.tsx                     # NEW: buyer header (DorafMark variant="buyer" + Recover link)
      buy/[webSalesId]/page.tsx      # MOVED (URL /buy/[webSalesId] stable)
      recover/page.tsx               # MOVED (URL /recover stable)
    api/                             # UNCHANGED — all 16 BFF route handlers stay in place
      agent-auth/...
      withdrawals/...
      checkout/...
      buyer-recovery/...
  components/
    _workspace/                      # NEW subfolder for workspace chrome + shared shells
      workspace-header.tsx           # NEW (client): brand + agent name/phone + sign out
      workspace-nav.tsx              # NEW (client): primary nav, usePathname active state
      page-header.tsx                # NEW (server): consistent page title + description
      summary-tile.tsx               # NEW: KPI/summary card for dashboard + wallet
      account-summary-card.tsx       # NEW: extracted from dashboard security card
    ... (existing components stay; some split per §6)
  lib/
    agent-api.ts                     # unchanged
    agent-session.ts                 # unchanged
    money-format.ts                  # kept for compat or replaced by format.ts (§8)
    format.ts                        # NEW: formatMoney, formatDateTime (consolidated)
    api-client.ts                    # NEW: readResponse (consolidated)
  proxy.ts                           # MODIFIED: expand matcher to all workspace routes (root-level, NOT in a group)
```

### Why route groups and not path prefixes
Route groups give each audience its own layout **without changing URLs**.
`/dashboard`, `/buy/[webSalesId]`, and `/recover` stay exactly where they are,
preserving existing sales links, recovery URLs, and the root redirect target. A
path prefix (e.g. `/portal/dashboard`) would break the existing `/dashboard`
redirect and any external links.

### Route protection strategy
`proxy.ts` stays at the app root (Next.js 16 permits only one proxy file, at the
project root — confirmed in the bundled docs). It **cannot** be scoped to a
route group. Protection remains **path-based via the matcher**:

```ts
// apps/agent/proxy.ts (proposed)
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/sales/:path*",
    "/pricing/:path*",
    "/wallet/:path*",
    "/withdrawals/:path*",
    "/settings/:path*",
    "/login",
    "/register",
  ],
}
```

The redirect logic stays identical in intent:
- No session cookie + workspace path → `/login`.
- Has session cookie + (`/login` or `/register`) → `/dashboard`.

Because `(workspace)` routes resolve to top-level paths (`/dashboard`, `/sales`,
...), the matcher lists each segment. This is the behavior-preserving choice.
(Alternative: introduce a real `/portal` prefix so the matcher is a single
`/portal/:path*` — but that changes `/dashboard` and is **not** recommended; see
§15 decision D6.)

As defense-in-depth, each workspace page's server-component data fetch already
returns 401 for a missing/expired token and calls `redirect("/login")` (the
current `dashboard/page.tsx` pattern). This stays.

### API routes that remain unchanged
All 16 handlers under `app/api/` (`agent-auth/*`, `withdrawals/*`,
`checkout/*`, `buyer-recovery/*`) stay in place, unchanged. No BFF contract
changes. New pages call the same BFF endpoints the dashboard calls today.

---

## 4. Navigation design

### Primary navigation items

| Label | Route | Icon (Hugeicons candidate) | Notes |
|---|---|---|---|
| Dashboard | `/dashboard` | `DashboardSquare02Icon` or `GridIcon` | Overview; default landing |
| Sales | `/sales` | `ShoppingBag01Icon` or `Store01Icon` | Sales link + orders (when in scope) |
| Pricing | `/pricing` | `Tag01Icon` or `Wallet01Icon` | Per-product price editor |
| Wallet | `/wallet` | `Wallet01Icon` | Balance + ledger |
| Withdrawals | `/withdrawals` | `MoneyReceiveCircleIcon` | Request + history |
| Settings | `/settings` | `Settings02Icon` | Account, security, appearance, legal |

Icons are optional and chosen from `@hugeicons/core-free-icons` (already in use
in the app). Selection is a visual detail, not structural; final names are
decided at implementation time.

### Desktop behavior
- A persistent left **side navigation** (or a sticky top bar with the nav items)
  rendered by `(workspace)/layout.tsx`. Recommended: vertical side rail on
  `lg+`, collapsing to a top bar on smaller screens.
- The workspace header sits above the nav/page area and contains: `DorafMark`
  (agent variant), agent name + masked phone (hidden on small screens), and
  `LogoutButton`. This is the existing dashboard header, generalized into the
  layout.

### Mobile behavior
- On screens below the `lg` breakpoint, the side nav collapses into a top
  header that exposes the current page and a disclosure control (a button that
  toggles the nav list). Because `@workspace/ui` has no Sheet/Drawer primitive,
  the mobile nav is a simple conditional list toggle inside a client component
  (built from `Button` + `Link` + `usePathname`). No new UI-package primitive is
  required for the MVP of this behavior.
- Active item is visually distinct (e.g., `bg-muted` + `text-foreground`) using
  `cn` to merge conditionals.

### Active-state behavior
- `workspace-nav.tsx` is a client component using `usePathname()`.
- An item is active when `pathname === item.route` (exact for leaf routes) or
  `pathname.startsWith(item.route + "/")` (for any future nested routes).
- `/dashboard` is active only on exact match (it is not a prefix of others).
- Active state is applied to the `<Link>` via `className` and `aria-current="page"`.

### Workspace header responsibilities
- Render `DorafMark` (agent variant).
- Render signed-in agent's name and masked phone (from session, passed from the
  server layout).
- Render `LogoutButton` (reused unchanged).
- Do **not** render page-specific content; that lives in each page.

### User/account menu responsibilities
- For the initial refactor, account access is the **Settings** nav item, not a
  dropdown menu. A separate account dropdown is optional polish and can be added
  later without changing the IA.
- Sign-out lives in the header (current behavior) **and** is reachable from
  Settings. Both call the existing `LogoutButton`.

### Sign-out location
- Primary: workspace header (all pages), via reused `LogoutButton`.
- Secondary: `/settings` page (optional, same component).

### Treatment of suspended accounts
- The workspace layout fetches the session and passes `agent.status` down.
- Each page receives a `readOnly` flag (derived from `status === "SUSPENDED"`)
  and threads it into its components exactly as the dashboard does today
  (`PricingGrid readOnly`, `WithdrawalPanel readOnly`, `SalesLinkCard readOnly`).
- The suspension alert currently on `/dashboard` stays on the **dashboard**
  (it is an overview-level alert). It is **not** repeated on every page; instead,
  disabled controls on each page communicate the read-only state inline (current
  behavior).
- Navigation remains fully available to suspended agents (they can view all
  pages read-only), matching `docs/product/04-agent-portal.md` "Suspended agent"
  section.

---

## 5. Page responsibility specifications

Each page below documents: primary intent, information shown, primary/secondary
actions, components, data required, loading/empty/error states, suspended
behavior, related links, and what must **not** appear.

### `/dashboard` — Overview

- **Primary user intent:** "How is my business doing, and what should I do next?"
- **Information shown (overview only):**
  - Welcome header (first name) + "Account ready" badge (kept from current).
  - Suspension alert (if suspended) — kept.
  - Wallet snapshot: ledger / withdrawable / holds (reuse `WalletBalanceCard`;
    compact is acceptable — same component, no new variant required for v1).
  - Recent transactions: the most recent 5 ledger entries (reuse
    `TransactionHistoryTable` with a sliced `items` prop and pagination hidden).
  - Sales link quick card OR a "Share your sales link" call-to-action linking to
    `/sales`.
  - Pricing quick summary: number of products with a set price, with a link to
    `/pricing`. (Derived from existing `prices` data; no new API.)
  - Quick-action links: Set prices → `/pricing`, Withdraw → `/withdrawals`,
    Share link → `/sales`.
- **Primary action:** None directly (it is an overview). CTAs route to detail
  pages.
- **Secondary actions:** Sign out (header); navigate via side nav.
- **Components:** `WalletBalanceCard`, `TransactionHistoryTable` (recent 5),
  `SalesLinkCard` (optional compact) or a CTA card, `SummaryTile` (new, for
  pricing-set count), `PageHeader` (new).
- **Data required:** `session`, `walletSummary`, recent `transactions` (first
  page, limit 5 via `?page=1` — reuse existing endpoint), `prices` (to count
  set prices), `channel` (for sales link CTA). Same endpoints the dashboard
  already calls; fetch fewer (no withdrawals list, no full transaction page).
- **Loading state:** Inline (current pattern). Optional: add `loading.tsx` later.
- **Empty state:** If no transactions, `TransactionHistoryTable` already shows
  its empty state. If no prices set, show a "Set your prices" CTA.
- **Error state:** If `sessionRes.status === 401` → `redirect("/login")` (kept).
  Other fetch errors: let `apiJson` throw → current inline error rendering.
- **Suspended/read-only behavior:** Suspension alert shown; no editable
  controls on this page (wallet card is display-only; CTAs to read-only pages
  remain, but the target pages enforce read-only).
- **Links to related pages:** `/pricing`, `/wallet`, `/withdrawals`, `/sales`.
- **Must NOT appear here:** the full pricing editor, the withdrawal request
  form, the full paginated transaction table, the security/account card, the
  full withdrawal history table. These now live on their own pages.

### `/sales` — Sales channel & orders

- **Primary user intent:** "Share my sales link and see what I've sold."
- **Information shown:**
  - `SalesLinkCard` (permanent link: copy + share) — primary content.
  - Orders section: **if order history is in scope** (decision D1, §15), an
    order history table (reference, date, channel, product, qty, total, profit,
    safe status, masked buyer). **If not yet in scope:** an intentional empty
    state: "Order history is coming. Your sales link and wallet ledger are
    available now." — no fake table.
- **Primary action:** Copy / share the sales link.
- **Secondary actions:** "View your store" (opens `/buy/[webSalesId]` in a new
  tab — Quick Win QW6, uses existing `salesUrl`); link to `/wallet` to see
  ledger.
- **Components:** `SalesLinkCard`, `PageHeader`, (orders table — new, only if
  in scope) or `Empty` (from `@workspace/ui/components/empty`).
- **Data required:** `session` (for auth + sales-channel), `channel` (for
  `salesUrl`). Orders require a new agent-facing orders endpoint (Category C).
- **Loading/empty/error:** Standard; 401 → redirect to `/login`.
- **Suspended behavior:** `SalesLinkCard readOnly` (link can't accept new
  purchases — current behavior). Orders (if present) remain viewable.
- **Links:** `/wallet` (ledger), `/dashboard`.
- **Must NOT appear:** pricing editor, withdrawal form, full ledger table.

### `/pricing` — Pricing

- **Primary user intent:** "Set or change what buyers pay for each checker."
- **Information shown:** `PricingGrid` (one card per product: base, max, current,
  profit, editable input).
- **Primary action:** Save a price (per card).
- **Secondary actions:** None (focused editor).
- **Components:** `PricingGrid`, `PageHeader`, a confirmation affordance (§5
  below).
- **Data required:** `session`, `prices` (`/agent-auth/prices`).
- **Loading/empty/error:** `PricingGrid` already handles the "pricing being
  prepared" empty state and per-card save errors. 401 → redirect.
- **Suspended behavior:** `PricingGrid readOnly` (inputs disabled, save
  disabled) — current behavior.
- **Links:** `/dashboard`, `/sales` (to see what buyers pay).
- **Must NOT appear:** wallet, transactions, withdrawals, sales link.
- **Price-change confirmation (UX improvement B):** Add a confirmation step
  before committing a price change. Because `@workspace/ui` has no dialog
  primitive, the v1 implementation uses an **inline confirm** within the card:
  after "Save new price" is clicked, show a small inline "Confirm GHS X.XX?
  [Confirm] [Cancel]" state before the POST. A true modal dialog is optional
  later (requires adding a dialog primitive to `@workspace/ui` — decision D7).
  The existing mutation behavior (`POST /api/agent-auth/prices/[productId]` +
  `router.refresh()`) is preserved; only the confirm gate is added.


### `/wallet` — Wallet & ledger

- **Primary user intent:** "See my balance and the money moving in and out."
- **Information shown:** `WalletBalanceCard` (full) + `TransactionHistoryTable`
  (full, paginated via `?walletPage=`).
- **Primary action:** None (view) — withdrawals live on `/withdrawals`.
- **Secondary actions:** Link to `/withdrawals` ("Withdraw funds"); link to
  `/dashboard`.
- **Components:** `WalletBalanceCard`, `TransactionHistoryTable`, `PageHeader`.
- **Data required:** `session`, `walletSummary` (`/agent-wallet/summary`),
  `transactions` (`/agent-wallet/transactions?page=`, with `?walletPage=`).
- **URL search params:** `?walletPage=` (preserved exactly — same parsing as
  current `getWalletPage` helper, which should move into the page or `lib`).
- **Loading/empty/error:** `TransactionHistoryTable` handles empty state;
  pagination preserved. 401 → redirect.
- **Suspended behavior:** View-only (no editable controls exist on this page).
- **Links:** `/withdrawals`, `/dashboard`.
- **Must NOT appear:** withdrawal request form, pricing editor, sales link.

### `/withdrawals` — Withdraw funds & history

- **Primary user intent:** "Request a payout and track my withdrawal requests."
- **Information shown:** Withdrawal history table (always) + the request flow
  (gated — see below).
- **Primary action:** "Request withdrawal" (gated entry point).
- **Secondary actions:** View history rows.
- **Components:** `WithdrawalPanel` (refactored to gate the form — §6), `PageHeader`.
- **Data required:** `session`, `walletSummary` (for `withdrawableMinor`),
  `withdrawals` (`/agent-wallet/withdrawals`).
- **Loading/empty/error:** `WithdrawalPanel` handles empty state for history and
  inline form errors. 401 → redirect.
- **Suspended behavior:** `readOnly` disables the request entry point; history
  remains visible — current behavior.
- **Links:** `/wallet` (balance), `/dashboard`.
- **Must NOT appear:** pricing editor, sales link, transaction ledger.
- **Progressive disclosure (UX improvement B):** The request form is **not**
  always visible. The page shows the history table and a "Request withdrawal"
  button. Clicking it reveals the request flow. The 3-step state machine
  (`details` → `otp` → `verified`) inside `WithdrawalPanel` is preserved. Two
  acceptable shapes (decision D8):
  1. **Inline reveal** (recommended v1): the form appears inline above the
     history when the button is clicked, and collapses on cancel/success. No new
     UI primitive needed.
  2. **Dialog/drawer**: requires adding a dialog/drawer primitive to
     `@workspace/ui` (since none exists). Higher effort; deferred unless chosen.
  The mutation behavior (`POST /api/withdrawals/otp`, `/verify`, `/`) and the
  OTP + token flow are preserved unchanged.

### `/settings` — Account, security, appearance, legal

- **Primary user intent:** "Manage my account details and preferences."
- **Information shown:**
  - **Account summary** (extracted from the current dashboard security card):
    sign-in method ("SMS one-time code"), masked phone, account status badge,
    registered name. Display-only for v1.
  - **Appearance:** theme selection (Light / Dark / System) as a control that
    writes `localStorage("theme")` and applies it — replacing the hidden `D`
    hotkey with a visible control (the hotkey can remain). Reuses the existing
    `ThemeProvider` mechanism.
  - **Legal:** links to terms and privacy (placeholder/external; acceptance is a
    compliance topic, decision D5).
  - **Reserved sections (intentional placeholders, not fake features):**
    Notifications preferences ("Coming soon") and Exports ("Not yet available —
    deferred"). These exist so the IA has a home; they clearly state
    unavailability.
- **Primary action:** Change theme (immediate). Account editing is post-refactor.
- **Secondary actions:** Sign out (secondary location).
- **Components:** `AccountSummaryCard` (new, extracted), a `ThemeSelector`
  (new, small client component), `PageHeader`, `Card`/`Separator` for sections.
- **Data required:** `session` (name, phoneMask, status).
- **Loading/empty/error:** Standard; 401 → redirect.
- **Suspended behavior:** All sections viewable; no editable fields that would
  require active status (theme is always editable).
- **Links:** `/dashboard`.
- **Must NOT appear:** pricing, wallet, withdrawals, sales link.

### Public storefront layout `(storefront)/layout.tsx`

- **Purpose:** Shared buyer chrome for `/buy/[webSalesId]` and `/recover`.
- **Contents:** A buyer header containing `DorafMark variant="buyer"` (no
  "Agent" subtext) and, on the storefront, a "Recover purchase" ghost link to
  `/recover`. The recovery page keeps its existing two-column marketing layout;
  the layout only wraps the header.
- **No auth:** These routes are public; `proxy.ts` does not match them.
- **Behavior preserved:** The storefront header currently renders `DorafMark` +
  "Recover purchase" + "Secure checkout" badge. That composition moves into the
  layout; the page keeps the hero + products + checkout. The recovery page's
  own header (currently just `DorafMark`) is replaced by the layout header.

### `(auth)/layout.tsx`

- **Purpose:** Shared auth chrome. Renders `<AuthPageShell>{children}</AuthPageShell>`.
- **Effect:** Removes the per-page `AuthPageShell` import from `login` and
  `register` pages (they become thin wrappers around `AgentAuthFlow`).
- **Behavior preserved:** The marketing split-screen and terms footer remain.

### Root `app/layout.tsx`

- **Unchanged.** Keeps fonts, `ThemeProvider`, theme script, metadata. No
  audience chrome here (that lives in route-group layouts).


---

## 6. Component refactoring plan

Principle: **move unchanged first; split only where state boundaries justify it.**
Route migration (Phase 2) happens before most splits (Phase 5) so the refactor
stays behavior-preserving and reviewable.

### Move unchanged (Phase 2)
These components relocate into their new pages with no internal changes:

- `WalletBalanceCard` → used on `/dashboard` and `/wallet`.
- `TransactionHistoryTable` → `/wallet` (full) + `/dashboard` (recent 5).
- `SalesLinkCard` → `/sales`.
- `AgentAuthFlow` → `(auth)/login`, `(auth)/register` (via layout).
- `BuyerRecoveryFlow` → `(storefront)/recover` (via layout).
- `LogoutButton` → workspace header (layout).
- `DorafMark` → everywhere, with a new `variant` prop (Phase 4).

### Assessed for split

#### `WithdrawalPanel` (539 lines)
- **Current:** request form (3-step state machine) + history table + 6 helpers,
  in one client component.
- **Justification to split:** The request form and the history table are
  independent concerns with independent data (form is interactive/mutating;
  history is display-only from props). They are co-rendered today only because
  they share a page.
- **Proposed split:**
  - `WithdrawalRequestFlow` (client): owns the `details`→`otp`→`verified` state
    machine, amount/network inputs, OTP, fee/hold math, mutations. Adds the
    gated entry ("Request withdrawal" button) per §5.
  - `WithdrawalHistory` (server or presentational): the history table + empty
    state. Pure function of `withdrawals` prop.
  - Keep helpers (`parseGhs`, `money`, `formatDate`, `networkLabel`,
    `statusLabel`, `StatusBadge`) — move shared ones to `lib/format.ts` and a
    local `lib/withdrawal-format.ts` if agent-specific.
- **State ownership:** `WithdrawalRequestFlow` owns all request state.
  `WithdrawalHistory` is stateless.
- **Data-flow boundary:** Page passes `phoneMask`, `withdrawableMinor`,
  `readOnly`, and `withdrawals` to the two children. The flow calls the same
  BFF routes and calls `router.refresh()` on success (unchanged).
- **When:** Split **after** route migration (Phase 5), so Phase 2 just moves the
  file into `/withdrawals`. The progressive-disclosure gate (Phase 3) can be
  done on the un-split component first if it's small, then the split.

#### `StorefrontCheckout` (517 lines)
- **Current:** product selection + contact collection + order creation +
  Paystack popup + status polling + 3 render states + helpers.
- **Justification to split:** Multiple responsibilities (form, payment status,
  polling) with distinct state and rendering.
- **Proposed split:**
  - `CheckoutForm` (client): product select, quantity, contact fields, order
    creation, opens Paystack.
  - `OrderStatusCard` (client or server): the awaiting/paid/failed status card
    with summary + actions.
  - `useOrderStatus` hook: the 3s polling effect + manual verify.
  - `StorefrontCheckout` becomes a thin orchestrator switching between
    `CheckoutForm` and `OrderStatusCard` based on `order` state.
- **State ownership:** Orchestrator owns `order`/`status`; `CheckoutForm` owns
  form fields; hook owns polling.
- **When:** Split in Phase 5, **after** the storefront is moved into
  `(storefront)` (Phase 4). The optional review/confirm step (decision D9) is
  added during or after the split.

#### `BuyerRecoveryFlow` (400 lines)
- **Current:** 3-step wizard + `Secret` subcomponent + helpers.
- **Verdict:** **Do not split now.** The wizard is cohesive; the steps share
  state and the `Secret` helper is already extracted. The only change is
  relocating it into `(storefront)/recover` (unchanged). The `readResponse`
  duplicate is removed in Phase 5. An `OtpStep` shared primitive (with auth +
  withdrawal) is a **long-term** item, not part of this refactor's required
  scope.

#### `AgentAuthFlow` (338 lines)
- **Current:** 3-step wizard handling both `login` and `register` modes; the
  register mode adds a `profile` (name) step.
- **Verdict:** **Do not split now.** The mode-conditional wizard is cohesive and
  the cross-linking between login/register is valuable. Relocate unchanged into
  `(auth)`. The `readResponse` duplicate is removed in Phase 5. Optionally
  extract the registration name-step later (long-term), but it's not required.

#### `PricingGrid` (215 lines)
- **Current:** grid + per-card form + validation + save.
- **Verdict:** **Move unchanged** into `/pricing` (Phase 2). Add the inline
  confirm gate (Phase 3) **inside `PriceCard`** (the internal component). No
  top-level split needed — the grid/card structure is already good. The local
  `money()` is replaced by `lib/format.ts` in Phase 5.

#### `TransactionHistoryTable` (231 lines)
- **Verdict:** **Move unchanged.** Reuse for both `/wallet` (full) and
  `/dashboard` (recent 5, pagination hidden by passing a sliced list and
  omitting the pagination block — the component already only renders pagination
  when `totalPages > 1`; for the dashboard slice, pass a synthetic
  `pagination` with `totalPages: 1`). Replace `formatAccraDate` with the shared
  formatter in Phase 5.

#### `WalletBalanceCard` (114 lines)
- **Verdict:** **Move unchanged.** Presentational; clean. Replace
  `pesewasToGhs` import with `lib/format.ts` in Phase 5 (keep
  `lib/money-format.ts` as a thin re-export or delete after migration).

#### `SalesLinkCard` (97 lines)
- **Verdict:** **Move unchanged** into `/sales`. Clean.

#### `DorafMark` (20 lines)
- **Change:** Add `variant?: "agent" | "buyer"` (default `"agent"`). Buyer
  variant omits the "Agent" subtext line. This is a Phase 4 change (buyer
  separation) and is the single source of the branding fix.


---

## 7. Data and API dependency map

"All endpoints" below are the existing BFF routes under `app/api/`, which proxy
to the Nest API at `DORAF_API_URL`. No BFF or backend contract changes in
Phases 1–5.

| Page | Server data fetches (existing) | Client mutations | URL params | Auth | Missing APIs (Category C) |
|---|---|---|---|---|---|
| `/dashboard` | `session`, `prices`, `channel`, `walletSummary`, `transactions?page=1` (recent) | none | none | session cookie; 401→`/login` | reporting-period metrics endpoint (today/7d/30d/lifetime) — D2 |
| `/sales` | `session`, `channel` (for salesUrl) | none (copy/share are client-side) | none | session; 401→`/login` | agent orders list endpoint — D1 |
| `/pricing` | `session`, `prices` | `POST /api/agent-auth/prices/[productId]` (+ `router.refresh`) | none | session; 401→`/login` | none |
| `/wallet` | `session`, `walletSummary`, `transactions?page=N` | none | `?walletPage=` | session; 401→`/login` | none |
| `/withdrawals` | `session`, `walletSummary` (withdrawable), `withdrawals` | `POST /api/withdrawals/otp`, `POST /api/withdrawals/verify`, `POST /api/withdrawals` (+ `router.refresh`) | none | session; 401→`/login` | none |
| `/settings` | `session` | theme (localStorage, client-only) | none | session; 401→`/login` | notifications prefs, exports — D3/D4 |
| `/buy/[webSalesId]` | `GET /sales-channels/web/:id` (via BFF `apiRequest`, no session) | `POST /api/checkout/[webSalesId]`, `GET/POST /api/checkout/[webSalesId]/[orderReference]` | none | **public** (no session) | none |
| `/recover` | none (client-driven) | `POST /api/buyer-recovery/request`, `POST /api/buyer-recovery/verify`, `GET /api/buyer-recovery/vouchers` (bearer token) | none | **public** | none |

### Classification

- **Route migration requiring no API changes:** all of Phase 1–2 and most of
  Phase 3–4. Pages call the same BFF routes the dashboard calls today; they
  just fetch subsets in different files.
- **UI improvements using existing APIs:** withdrawal gating, price confirm,
  theme selector, buyer branding, storefront preview, OTP resend — all use
  existing endpoints or client-only state. OTP resend (Quick Win QW5) re-calls
  the existing `.../otp` POST endpoint.
- **Features requiring new backend support:** order history (agent orders
  endpoint), reporting-period metrics (agent reporting endpoint), notifications
  (feed + prefs endpoints), CSV exports (export-request + generation). These are
  Category C and are **not** part of the structural refactor.

### Pagination
- `/wallet` preserves `?walletPage=` exactly. The `getWalletPage` helper
  (currently in `dashboard/page.tsx`) moves to `/wallet`'s page (or `lib`) with
  identical bounds (`MAX_WALLET_TRANSACTION_PAGE = 10_000`).
- `/dashboard` recent-5 calls `?page=1` and ignores further pagination.
- No other page paginates today.


---

## 8. Shared utility cleanup

Goal: one source of truth for formatting and response parsing, without leaking
agent-specific abstractions into `@workspace/ui`.

### Proposed files (all in `apps/agent/lib/`)

#### `lib/format.ts` (new)
- `formatMoney(minor: number | bigint | string, currency?: string): string`
  - Accepts integer minor units (pesewas). Handles `number`, `bigint`, and
    numeric `string` (the wallet API returns minor as string).
  - Produces consistent `GHS` formatting. Preferred implementation: keep the
    robust `BigInt`-based `pesewasToGhs` semantics (handles large values and
    negatives with the `−` sign) and extend it to accept `number`/`bigint` too.
    The four inline `money()` helpers (Intl-based, two signatures) are replaced
    by calls to this.
  - Currency defaults to `"GHS"`; pass-through for storefront product
    `currency`.
- `formatDateTime(iso: string): string` — `Africa/Accra`, medium date + short
  time (merges `formatAccraDate` and `formatDate` behaviors; pick one canonical
  format — recommended: the transaction table's `en-GB` 24-hour format, since
  it's the most complete).

#### `lib/api-client.ts` (new)
- `readResponse<T>(response: Response): Promise<T>` — the consolidated version.
  Handles `message` as `string | string[]` (join with `". "`), matching the
  most complete existing copy (`buyer-recovery-flow.tsx`).
- Re-export or re-use `apiRequest`/`apiJson`/`ApiError` from `agent-api.ts` if
  helpful, but do not duplicate them — `agent-api.ts` already centralizes those.

### Migration
- `lib/money-format.ts` (`pesewasToGhs`): keep as a thin re-export of
  `formatMoney` for one phase, then delete once all imports are updated. (Avoids
  a big-bang rename.)
- Replace inline `money()` in: `app/buy/[webSalesId]/page.tsx`,
  `components/storefront-checkout.tsx`, `components/pricing-grid.tsx`,
  `components/withdrawal-panel.tsx`.
- Replace inline `formatAccraDate`/`formatDate` in `transaction-history-table.tsx`
  and `withdrawal-panel.tsx`.
- Replace inline `readResponse` in `agent-auth-flow.tsx`,
  `buyer-recovery-flow.tsx`, `withdrawal-panel.tsx`. (`pricing-grid.tsx` uses an
  inline try/catch; convert to `readResponse` too.)

### Shared components (stay in-app, not in `@workspace/ui`)

These are agent-app-specific shells, not cross-app primitives, so they live in
`apps/agent/components/_workspace/` (and root `components/`), **not** in
`@workspace/ui`:

- `PageHeader` — title + description (server component).
- `SummaryTile` — KPI/value tile (used on dashboard + wallet).
- `AccountSummaryCard` — extracted security card.
- `WorkspaceHeader` / `WorkspaceNav` — workspace chrome.
- `ThemeSelector` — appearance control (client).

### Status badges & summary rows
- `StatusBadge` (withdrawal states) and `SummaryRow` (label/value) currently
  live inside `withdrawal-panel.tsx`. They are agent-specific. **Decision:** keep
  them local to the withdrawal feature for now (move to
  `components/_workspace/` only if reused by orders later). Do **not** promote
  to `@workspace/ui` — they're not cross-app.

### OTP UI pattern
- The OTP input pattern (6-slot `InputOTP` + "Sent to {mask}" + expiry note +
  "Use another" back link) repeats across `agent-auth-flow`, `buyer-recovery`,
  and `withdrawal-panel`. Extracting a shared `OtpStep` is a **long-term**
  improvement (not required for this refactor) because the three contexts differ
  in copy, post-verify behavior, and resend needs. It's noted here for
  completeness; Phase 5 only removes the `readResponse` duplication, not the
  OTP UI duplication.


---

## 9. Phased implementation sequence

Each phase is independently testable and produces reviewable steps. The sequence
prioritizes structural reorganization of existing functionality before UX
improvements and before any new features.

### Phase 0 — Baseline verification and safeguards

- **Objective:** Confirm current behavior is green and capture a baseline.
- **Changes:** None to source. Run checks; document the baseline.
- **Files:** none created/modified/removed.
- **Dependencies:** none. **Risks:** none (read-only).
- **Validation:** `pnpm --filter agent typecheck`, `lint`, `build`. Manually:
  register, login, view dashboard, set a price, request a withdrawal (sandbox),
  buy via a sales link, recover a purchase. Record happy paths.
- **Completion criteria:** All checks pass; manual happy paths documented.

### Phase 1 — Workspace shell and navigation

- **Objective:** Introduce the `(workspace)` route group, layout, persistent nav,
  and workspace header — **without** moving content yet. The existing
  `/dashboard` becomes a child of the group and renders inside the new shell.
- **Changes:**
  - Create `app/(workspace)/layout.tsx` (server): fetch `session`; render
    `WorkspaceHeader` + `WorkspaceNav` + `{children}`. On 401 → `redirect("/login")`.
  - Create `components/_workspace/workspace-header.tsx` (client): `DorafMark` +
    agent name/phone + `LogoutButton`.
  - Create `components/_workspace/workspace-nav.tsx` (client): nav list with
    `usePathname` active state; only Dashboard is a live link initially.
  - Create `components/_workspace/page-header.tsx` (server).
  - Move `app/dashboard/page.tsx` → `app/(workspace)/dashboard/page.tsx` (URL
    `/dashboard` unchanged). Keep full content for now.
  - Expand `proxy.ts` matcher to include future workspace paths.
- **Files created:** `(workspace)/layout.tsx`, `_workspace/workspace-header.tsx`,
  `_workspace/workspace-nav.tsx`, `_workspace/page-header.tsx`.
- **Files modified:** `proxy.ts`. `dashboard/page.tsx` moved (path only).
- **Files removed:** old `app/dashboard/page.tsx` (after move).
- **Dependencies:** Phase 0.
- **Risks:** Moving `dashboard` into the group must not change its URL or data
  fetching. The layout's session fetch adds one request per workspace navigation
  (the existing `/agent-auth/session`).
- **Validation:** `/dashboard` renders inside the shell with nav + header;
  unauthenticated → `/login`; authenticated on `/login` → `/dashboard`; nav
  shows Dashboard active; sign-out works; suspension alert still shows.
- **Completion criteria:** Workspace shell visible on `/dashboard`; all Phase 0
  checks pass; `/dashboard` URL unchanged.

### Phase 2 — Route decomposition of existing functionality

- **Objective:** Move existing dashboard sections into dedicated pages.
- **Changes (one page per task, in order):**
  1. Create `app/(workspace)/wallet/page.tsx`: fetch `session`, `walletSummary`,
     `transactions?page=N` (move `getWalletPage` here); render
     `WalletBalanceCard` + `TransactionHistoryTable`. Preserve `?walletPage=`.
  2. Create `app/(workspace)/withdrawals/page.tsx`: fetch `session`,
     `walletSummary`, `withdrawals`; render `WithdrawalPanel` (unchanged).
  3. Create `app/(workspace)/pricing/page.tsx`: fetch `session`, `prices`;
     render `PricingGrid` (unchanged).
  4. Create `app/(workspace)/sales/page.tsx`: fetch `session`, `channel`; render
     `SalesLinkCard` + orders empty state (intentional).
  5. Create `app/(workspace)/settings/page.tsx`: fetch `session`; render
     `AccountSummaryCard` (extracted) + reserved sections (placeholders) + legal
     placeholder. Appearance selector added in Phase 3.
  6. Slim `app/(workspace)/dashboard/page.tsx` to overview-only: wallet
     snapshot, recent 5 transactions, pricing-set count, sales CTA, quick-action
     links, suspension alert. Remove the moved sections.
  7. Add remaining nav links (Wallet, Withdrawals, Pricing, Sales, Settings) to
     `workspace-nav.tsx`.
- **Files created:** the 5 new page files;
  `components/_workspace/account-summary-card.tsx`.
- **Files modified:** `(workspace)/dashboard/page.tsx` (slimmed);
  `workspace-nav.tsx`.
- **Files removed:** none (components reused).
- **Dependencies:** Phase 1.
- **Risks:** Splitting the dashboard's 6 parallel fetches across pages means
  each page fetches its own subset — verify no page drops needed data (e.g.,
  `withdrawableMinor` for withdrawals). Preserve `getWalletPage` bounds.
- **Validation:** Each new route loads its data; nav active states correct;
  pricing save works; withdrawal OTP flow works; wallet pagination via
  `?walletPage=` works; suspended agents see read-only on each page; 401 on any
  workspace page → `/login`.
- **Completion criteria:** All 6 workspace routes exist with focused content;
  dashboard is overview-only; no behavior lost; checks pass.


### Phase 3 — Progressive-disclosure improvements

- **Objective:** Apply UX improvements to existing functionality using existing
  APIs.
- **Changes:**
  1. Withdrawal gating: in `/withdrawals`, render a "Request withdrawal" button;
     reveal the request flow on click; collapse on cancel/success. History
     always visible.
  2. Price-change confirm: add inline confirm in `PriceCard` before the POST.
  3. Visible theme selector: add `ThemeSelector` to `/settings` (writes
     `localStorage("theme")`, applies class — reuses `ThemeProvider` logic).
  4. Storefront preview: add "View your store" link on `/sales` (opens
     `/buy/[webSalesId]` in new tab).
  5. OTP resend: add "Resend code" buttons on OTP steps (auth, recovery,
     withdrawal) that re-POST the existing `.../otp` endpoint.
  6. Better suspension guidance: enhance the suspension alert with a
     "contact support" / "learn more" affordance (static for now).
- **Files created:** `components/_workspace/theme-selector.tsx`.
- **Files modified:** `withdrawal-panel.tsx` (gating), `pricing-grid.tsx`
  (confirm), `agent-auth-flow.tsx`, `buyer-recovery-flow.tsx`,
  `withdrawal-panel.tsx` (resend), `(workspace)/sales/page.tsx` (preview link),
  `(workspace)/dashboard/page.tsx` (suspension affordance).
- **Dependencies:** Phase 2.
- **Risks:** Gating the withdrawal form changes visible behavior — ensure the
  form appears reliably and the OTP/verify/create flow is uninterrupted. Price
  confirm must not break save + `router.refresh()`.
- **Validation:** Withdrawal: button reveals form; full OTP flow completes;
  cancel hides form. Pricing: confirm required; save persists. Theme: selector
  changes + persists. Resend: re-requests OTP without losing state. Suspension:
  affordance present.
- **Completion criteria:** All 6 improvements work; no regressions; checks pass.

### Phase 4 — Buyer/storefront separation

- **Objective:** Separate the public buyer surface into its own route group with
  buyer-appropriate chrome, without changing URLs.
- **Changes:**
  - Add `variant` prop to `DorafMark` (`"agent"` | `"buyer"`); buyer variant
    omits "Agent" subtext.
  - Create `app/(storefront)/layout.tsx`: buyer header (`DorafMark variant="buyer"`
    + "Recover purchase" link to `/recover`).
  - Move `app/buy/[webSalesId]/page.tsx` → `app/(storefront)/buy/[webSalesId]/page.tsx`.
  - Move `app/recover/page.tsx` → `app/(storefront)/recover/page.tsx`.
  - Create `app/(auth)/layout.tsx` rendering `<AuthPageShell>{children}</AuthPageShell>`.
  - Move `app/login/page.tsx` → `app/(auth)/login/page.tsx`; `app/register/page.tsx`
    → `app/(auth)/register/page.tsx`. Pages become thin wrappers around
    `AgentAuthFlow` (the shell moves to the layout).
  - Replace buyer-page `DorafMark` usages with the buyer variant.
- **Files created:** `(storefront)/layout.tsx`, `(auth)/layout.tsx`.
- **Files modified:** `doraf-mark.tsx` (variant). Moved page files.
- **Files removed:** old `buy/...`, `recover/`, `login/`, `register/` page paths
  (after move).
- **Dependencies:** Phase 2 (so workspace is settled). Can run in parallel with
  Phase 3.
- **Risks:** Moving public routes must not change URLs. The storefront header
  currently renders its own header inline — ensure the layout doesn't double-
  render. The Paystack `Script` stays on the storefront page (not layout).
- **Validation:** `/buy/[webSalesId]` and `/recover` load unchanged at the same
  URLs; buyer header shows no "Agent" text; "Recover purchase" link works;
  `/login` and `/register` render inside `AuthPageShell`; auth redirects
  unchanged; proxy still treats these correctly (storefront public, auth gated
  for redirect).
- **Completion criteria:** Buyer and agent surfaces separated by layout; URLs
  unchanged; no "Agent" branding on buyer pages; auth pages unchanged.


### Phase 5 — Shared utility and component cleanup

- **Objective:** Consolidate duplicated helpers; split the two components that
  justify it.
- **Changes:**
  - Create `lib/format.ts` (`formatMoney`, `formatDateTime`) and
    `lib/api-client.ts` (`readResponse`).
  - Replace all inline `money()`, date formatters, and `readResponse` copies.
  - Make `lib/money-format.ts` a thin re-export of `formatMoney` (remove after
    all imports migrate).
  - Split `WithdrawalPanel` → `WithdrawalRequestFlow` + `WithdrawalHistory`
    (state boundary justification in §6).
  - Split `StorefrontCheckout` → `CheckoutForm` + `OrderStatusCard` +
    `useOrderStatus` hook (§6).
- **Files created:** `lib/format.ts`, `lib/api-client.ts`,
  `components/withdrawal-request-flow.tsx`, `components/withdrawal-history.tsx`,
  `components/checkout-form.tsx`, `components/order-status-card.tsx`,
  `hooks/use-order-status.ts`.
- **Files modified:** all files using the duplicated helpers; the two split
  components' consumers (`/withdrawals`, `/buy/[webSalesId]`).
- **Files removed:** none immediately (`money-format.ts` re-export kept).
- **Dependencies:** Phase 4 (so routes are in final positions before rewriting
  helpers across them).
- **Risks:** Formatting drift — ensure `formatMoney` matches `pesewasToGhs`
  output exactly (BigInt, `−` minus). The splits must preserve exact mutation
  behavior and the polling lifecycle.
- **Validation:** Money renders identically before/after (compare dashboard,
  pricing, wallet, withdrawal, storefront). Withdrawal flow end-to-end.
  Checkout end-to-end including polling + Paystack resume.
- **Completion criteria:** One `money`, one `readResponse`, one date formatter;
  two justified splits done; all checks pass.

### Phase 6 — Missing features (only after scope confirmation)

- **Objective:** Implement Category C features **only after** product-owner
  decisions D1–D4 (§15). Not part of the structural refactor.
- **Changes:** Per confirmed scope. Each feature is its own sub-phase:
  - 6a Orders (`/sales` table + endpoint) — if D1 confirms in-scope.
  - 6b Reporting metrics (`/dashboard` KPIs + endpoint) — if D2 confirms.
  - 6c Notifications (Settings prefs + endpoint + bell) — if D3 confirms.
  - 6d CSV exports (Settings request + endpoint) — if D4 confirms (currently
    deferred).
  - 6e First-run onboarding (`/dashboard` checklist) — optional.
- **Files:** TBD per feature. Each requires backend work (new agent-facing
  endpoints).
- **Dependencies:** Phases 1–5 complete; product-owner decisions.
- **Risks:** Backend coordination; scope creep. Keep each behind its decision.
- **Validation:** Per feature; integration with the new IA.
- **Completion criteria:** Each implemented feature has a deliberate home and
  passes its acceptance criteria; deferred features retain intentional
  placeholders.

### Phase 7 — Final accessibility, responsive, and regression review

- **Objective:** Whole-app review across the new IA.
- **Changes:** Fixes for a11y, responsive, keyboard, focus management, theme,
  and any regressions found.
- **Files:** as needed.
- **Dependencies:** Phase 5 (and any Phase 6 items done).
- **Validation:** See §12 testing strategy in full; run the full matrix.
- **Completion criteria:** §13 acceptance criteria all met.


---

## 10. Atomic implementation tasks

Tasks are ordered by dependency. Each is safe to commit independently unless
noted. Task IDs: `P<phase>-<n>`.

### Phase 1 tasks

#### P1-1 Create the workspace nav component
- **Purpose:** Persistent primary navigation (client component, active state).
- **Files:** create `apps/agent/components/_workspace/workspace-nav.tsx`.
- **Instructions:** Create a `"use client"` component exporting `WorkspaceNav`
  that renders a list of `<Link>` items. Initially include only Dashboard
  (`/dashboard`). Use `usePathname()` to set `aria-current="page"` and an active
  class via `cn`. Items array: `{ href, label }`. Keep it presentational; no
  data fetching. Mobile collapse toggle can be a simple `useState` boolean.
- **Prerequisites:** Phase 0.
- **Acceptance:** Renders a nav with Dashboard link; active state applied on
  `/dashboard`; keyboard reachable.
- **Tests:** Manual — visit `/dashboard`, confirm nav + active state.
- **Safe to commit independently:** Yes.

#### P1-2 Create the workspace header component
- **Purpose:** Shared header with brand, agent identity, sign-out.
- **Files:** create `apps/agent/components/_workspace/workspace-header.tsx`.
- **Instructions:** `"use client"` component exporting `WorkspaceHeader` taking
  `{ name, phoneMask }` props. Render `DorafMark` (agent variant), the name +
  masked phone (hidden on small screens, matching current dashboard header), and
  the existing `LogoutButton`. Reuse `LogoutButton` unchanged.
- **Prerequisites:** P1-1.
- **Acceptance:** Header shows brand + name/phone + Sign out; sign-out navigates
  to `/login`.
- **Tests:** Manual — sign out works.
- **Safe to commit independently:** Yes.

#### P1-3 Create the page-header component
- **Purpose:** Consistent page title + description across workspace pages.
- **Files:** create `apps/agent/components/_workspace/page-header.tsx`.
- **Instructions:** Server component exporting `PageHeader` with
  `{ title, description, children? }`. Renders an `<h1>` (font-heading) +
  description paragraph. `children` for optional actions.
- **Prerequisites:** none.
- **Acceptance:** Renders title/description.
- **Safe to commit independently:** Yes.

#### P1-4 Create the workspace layout and move the dashboard
- **Purpose:** Introduce `(workspace)` group layout; relocate `/dashboard` into
  it without changing content.
- **Files:** create `apps/agent/app/(workspace)/layout.tsx`; move
  `apps/agent/app/dashboard/page.tsx` →
  `apps/agent/app/(workspace)/dashboard/page.tsx`.
- **Instructions:** `layout.tsx` is a server component: fetch
  `/agent-auth/session` via `apiRequest(..., true)`; on 401 `redirect("/login")`;
  pass `agent` (name, phoneMask, status) to `WorkspaceHeader` and render
  `WorkspaceNav` + `{children}`. Keep the moved `dashboard/page.tsx` content
  identical (still fetches its own data — the layout session fetch is additive).
- **Prerequisites:** P1-1, P1-2, P1-3.
- **Acceptance:** `/dashboard` renders inside the shell (header + nav + page);
  URL unchanged; unauthenticated → `/login`; data loads.
- **Tests:** Manual + `typecheck`/`build`.
- **Safe to commit independently:** Yes (the move + layout together).

#### P1-5 Expand the proxy matcher
- **Purpose:** Protect all future workspace routes.
- **Files:** modify `apps/agent/proxy.ts`.
- **Instructions:** Add `"/sales/:path*", "/pricing/:path*", "/wallet/:path*",
  "/withdrawals/:path*", "/settings/:path*"` to `config.matcher`. Keep redirect
  logic identical (the `startsWith("/dashboard")` check should be generalized to
  a workspace-paths list, but behavior must stay: no-session on any workspace
  path → `/login`; has-session on `/login`|`/register` → `/dashboard`).
- **Prerequisites:** P1-4.
- **Acceptance:** Unauthenticated requests to `/pricing` etc. redirect to
  `/login` (once those pages exist in Phase 2; until then they 404, which is
  fine — the matcher still runs).
- **Tests:** Manual — hit `/pricing` unauthenticated → redirected to `/login`.
- **Safe to commit independently:** Yes.


### Phase 2 tasks

#### P2-1 Create the Wallet page
- **Purpose:** Dedicated wallet + ledger page; preserve `?walletPage=`.
- **Files:** create `apps/agent/app/(workspace)/wallet/page.tsx`.
- **Instructions:** Server component. Fetch `session`, `walletSummary`
  (`/agent-wallet/summary`), `transactions` (`/agent-wallet/transactions?page=N`).
  Move the `getWalletPage` helper (and `MAX_WALLET_TRANSACTION_PAGE`) here (or to
  `lib`). Render `PageHeader` ("Wallet") + `WalletBalanceCard` +
  `TransactionHistoryTable`. On 401 → `redirect("/login")`.
- **Prerequisites:** P1-5.
- **Acceptance:** `/wallet` loads; `?walletPage=2` paginates; empty state shows;
  401 → `/login`.
- **Tests:** Manual pagination; typecheck.
- **Safe to commit independently:** Yes.

#### P2-2 Create the Withdrawals page
- **Purpose:** Dedicated withdrawals page; preserve the existing panel behavior.
- **Files:** create `apps/agent/app/(workspace)/withdrawals/page.tsx`.
- **Instructions:** Fetch `session`, `walletSummary` (for `withdrawableMinor`),
  `withdrawals`. Render `PageHeader` + `WithdrawalPanel` (unchanged) with
  `phoneMask`, `withdrawableMinor`, `withdrawals`, `readOnly`. Do NOT gate the
  form yet (that's Phase 3).
- **Prerequisites:** P2-1.
- **Acceptance:** `/withdrawals` loads; OTP flow works; history shows; read-only
  on suspend.
- **Tests:** Manual end-to-end withdrawal (sandbox).
- **Safe to commit independently:** Yes.

#### P2-3 Create the Pricing page
- **Purpose:** Dedicated pricing editor.
- **Files:** create `apps/agent/app/(workspace)/pricing/page.tsx`.
- **Instructions:** Fetch `session`, `prices`. Render `PageHeader` + `PricingGrid`
  (unchanged) with `readOnly`. Do NOT add confirm yet (Phase 3).
- **Prerequisites:** P2-2.
- **Acceptance:** `/pricing` loads; saving a price persists + refreshes; range
  validation works; read-only on suspend.
- **Tests:** Manual price save.
- **Safe to commit independently:** Yes.

#### P2-4 Create the Sales page
- **Purpose:** Home for the sales link + (future) orders.
- **Files:** create `apps/agent/app/(workspace)/sales/page.tsx`.
- **Instructions:** Fetch `session`, `channel`; compute `salesUrl` (same logic as
  current dashboard). Render `PageHeader` + `SalesLinkCard`. Below it, render an
  intentional empty state for orders using `@workspace/ui/components/empty`:
  "Order history is coming. Your sales link and wallet ledger are available
  now." with links to `/wallet`. (If D1 later confirms orders in-scope, replace
  this in Phase 6a.)
- **Prerequisites:** P2-3.
- **Acceptance:** `/sales` shows the link card + copy/share work + orders
  placeholder; read-only note on suspend.
- **Tests:** Manual copy/share.
- **Safe to commit independently:** Yes.

#### P2-5 Extract the account-summary card and create Settings
- **Purpose:** Move account/security info to `/settings`.
- **Files:** create
  `apps/agent/components/_workspace/account-summary-card.tsx`; create
  `apps/agent/app/(workspace)/settings/page.tsx`.
- **Instructions:** Extract the existing dashboard "Security" card (sign-in
  method, masked phone, status badge) into `AccountSummaryCard` (presentational,
  takes `agent`). `settings/page.tsx` fetches `session`, renders `PageHeader` +
  `AccountSummaryCard` + reserved sections (Notifications "Coming soon",
  Exports "Not yet available — deferred") using `Card`/`Separator`, + a Legal
  placeholder. Do NOT add the theme selector yet (Phase 3).
- **Prerequisites:** P2-4.
- **Acceptance:** `/settings` shows account summary + reserved placeholders;
  status badge correct.
- **Tests:** Manual.
- **Safe to commit independently:** Yes.

#### P2-6 Slim the dashboard to overview-only
- **Purpose:** Make `/dashboard` an overview; remove moved sections.
- **Files:** modify `apps/agent/app/(workspace)/dashboard/page.tsx`.
- **Instructions:** Keep welcome header + suspension alert. Render: wallet
  snapshot (`WalletBalanceCard`), recent 5 transactions (slice `items` from
  `?page=1`; pass a `pagination` with `totalPages: 1` so the table hides
  pagination), a pricing-set count summary (count of `prices` rows where
  `retailPriceMinor != null`) with a link to `/pricing`, a sales CTA card
  linking to `/sales`, and quick-action links to `/pricing`, `/withdrawals`,
  `/sales`. Remove `WithdrawalPanel`, full `TransactionHistoryTable`,
  `PricingGrid`, `SalesLinkCard` (full), and the inline Security card. Fetch
  fewer endpoints (drop `withdrawals`).
- **Prerequisites:** P2-1 through P2-5 (so destinations exist before links).
- **Acceptance:** Dashboard shows overview only; all CTAs link to working
  pages; no broken references; suspension alert retained.
- **Tests:** Manual; typecheck.
- **Safe to commit independently:** Yes.

#### P2-7 Wire all nav links
- **Purpose:** Enable the remaining nav items.
- **Files:** modify `apps/agent/components/_workspace/workspace-nav.tsx`.
- **Instructions:** Add Sales, Pricing, Wallet, Withdrawals, Settings to the
  items array with their routes.
- **Prerequisites:** P2-6.
- **Acceptance:** All nav items present; active states correct per route.
- **Tests:** Manual click each.
- **Safe to commit independently:** Yes.


### Phase 3 tasks

#### P3-1 Gate the withdrawal request form
- **Purpose:** Progressive disclosure for withdrawals.
- **Files:** modify `apps/agent/components/withdrawal-panel.tsx`; possibly
  `apps/agent/app/(workspace)/withdrawals/page.tsx`.
- **Instructions:** Add a `requestOpen` state (default false). When false, show a
  "Request withdrawal" button (disabled if `readOnly`). When true, render the
  existing details→otp→verified flow. On cancel or successful create, set
  `requestOpen` false. Keep `WithdrawalHistory` always visible. Preserve the
  exact OTP/token/create calls and `router.refresh()`.
- **Prerequisites:** P2-2.
- **Acceptance:** Form hidden initially; button reveals it; full flow works;
  cancel hides it; read-only disables the button.
- **Tests:** Manual end-to-end.
- **Safe to commit independently:** Yes.

#### P3-2 Add inline price-change confirmation
- **Purpose:** Confirm before committing a price change.
- **Files:** modify `apps/agent/components/pricing-grid.tsx` (`PriceCard`).
- **Instructions:** Add a `confirming` state. On "Save new price" click, instead
  of submitting immediately, show an inline "Confirm GHS X.XX? [Confirm]
  [Cancel]" UI. Confirm performs the existing POST; cancel returns to edit.
  Preserve the validation, profit calc, and `router.refresh()`.
- **Prerequisites:** P2-3.
- **Acceptance:** Save requires confirm; confirm persists; cancel aborts.
- **Tests:** Manual.
- **Safe to commit independently:** Yes.

#### P3-3 Add a visible theme selector
- **Purpose:** Replace the hidden `D` hotkey with a visible control.
- **Files:** create `apps/agent/components/_workspace/theme-selector.tsx`;
  modify `apps/agent/app/(workspace)/settings/page.tsx`.
- **Instructions:** `"use client"` component with Light/Dark/System options
  (buttons or `NativeSelect`). On change, write `localStorage("theme")` and
  apply the class via the same logic as `theme-provider.tsx`'s `applyTheme`
  (import or replicate). System option clears the stored value and follows
  `prefers-color-scheme`. Keep the `D` hotkey working.
- **Prerequisites:** P2-5.
- **Acceptance:** Selecting a theme applies + persists across reloads; System
  follows OS.
- **Tests:** Manual across reloads.
- **Safe to commit independently:** Yes.

#### P3-4 Add a storefront preview link
- **Purpose:** Let agents view their own store.
- **Files:** modify `apps/agent/app/(workspace)/sales/page.tsx`.
- **Instructions:** Add a "View your store" `Button` (render as `<a>` with
  `target="_blank" rel="noopener"`) pointing to `salesUrl`. Compute the URL in
  the page.
- **Prerequisites:** P2-4.
- **Acceptance:** Link opens the storefront in a new tab.
- **Tests:** Manual.
- **Safe to commit independently:** Yes.

#### P3-5 Add OTP resend actions
- **Purpose:** Let users re-request a code.
- **Files:** modify `agent-auth-flow.tsx`, `buyer-recovery-flow.tsx`,
  `withdrawal-panel.tsx`.
- **Instructions:** On each OTP step, add a "Resend code" ghost `Button` that
  re-calls the existing `.../otp` POST (auth login/registration otp with current
  `phone`; recovery request with current `orderReference`; withdrawal
  `/api/withdrawals/otp`). Capture the new `challengeId` from the response. Show
  a transient "Code sent" state. Optional: disable for a few seconds.
- **Prerequisites:** P2-2, P2-3.
- **Acceptance:** Resend triggers a new code; verification works with the new
  challenge.
- **Tests:** Manual per flow.
- **Safe to commit independently:** Yes (per file).

#### P3-6 Improve suspension guidance
- **Purpose:** Turn the suspension dead-end into a path.
- **Files:** modify `apps/agent/app/(workspace)/dashboard/page.tsx`.
- **Instructions:** In the suspension `Alert`, add: "Contact support to resolve
  this." (static text for now; a real support contact is a later product
  decision). Keep the destructive variant.
- **Prerequisites:** P2-6.
- **Acceptance:** Alert includes guidance.
- **Safe to commit independently:** Yes.


### Phase 4 tasks

#### P4-1 Add a variant to DorafMark
- **Purpose:** Enable buyer vs agent branding.
- **Files:** modify `apps/agent/components/doraf-mark.tsx`.
- **Instructions:** Add `variant?: "agent" | "buyer"` (default `"agent"`). In the
  buyer variant, omit the "Agent" subtext `<span>`.
- **Prerequisites:** none.
- **Acceptance:** Buyer variant renders without "Agent".
- **Safe to commit independently:** Yes.

#### P4-2 Create the storefront layout and move buyer pages
- **Purpose:** Buyer chrome + stable URLs.
- **Files:** create `apps/agent/app/(storefront)/layout.tsx`; move
  `app/buy/[webSalesId]/page.tsx` → `app/(storefront)/buy/[webSalesId]/page.tsx`;
  move `app/recover/page.tsx` → `app/(storefront)/recover/page.tsx`.
- **Instructions:** `layout.tsx` renders a buyer header: `DorafMark variant="buyer"`
  + a "Recover purchase" ghost link to `/recover`. The storefront page currently
  renders its own header — remove the inline header from the page (layout
  provides it); keep the "Secure checkout" badge in the layout header if
  desired. The recovery page's inline header is likewise replaced. Keep the
  Paystack `Script` on the storefront page.
- **Prerequisites:** P4-1.
- **Acceptance:** `/buy/[webSalesId]` and `/recover` unchanged URLs; buyer
  header shows no "Agent"; "Recover purchase" link works; checkout + recovery
  flows intact.
- **Tests:** Manual full purchase + recovery.
- **Safe to commit independently:** Yes (move + layout together).

#### P4-3 Create the auth layout and move auth pages
- **Purpose:** Shared auth chrome; thin page wrappers.
- **Files:** create `apps/agent/app/(auth)/layout.tsx`; move
  `app/login/page.tsx` → `app/(auth)/login/page.tsx`; move
  `app/register/page.tsx` → `app/(auth)/register/page.tsx`.
- **Instructions:** `layout.tsx` renders `<AuthPageShell>{children}</AuthPageShell>`.
  The moved login/register pages drop the `AuthPageShell` wrapper and render
  only `<AgentAuthFlow mode="..." />`.
- **Prerequisites:** P4-2.
- **Acceptance:** `/login` and `/register` render inside the shell; cross-links
  work; redirects unchanged.
- **Tests:** Manual login + register.
- **Safe to commit independently:** Yes.


### Phase 5 tasks

#### P5-1 Consolidate money and date formatting
- **Purpose:** One source of truth.
- **Files:** create `apps/agent/lib/format.ts`; modify all consumers
  (`buy/[webSalesId]/page.tsx`, `storefront-checkout.tsx`, `pricing-grid.tsx`,
  `withdrawal-panel.tsx`, `transaction-history-table.tsx`,
  `wallet-balance-card.tsx`).
- **Instructions:** Implement `formatMoney` (BigInt-safe, `−` minus, accepts
  number/bigint/string) and `formatDateTime` (Accra tz). Replace inline
  `money()`/`formatAccraDate`/`formatDate`. Make `lib/money-format.ts` re-export
  `formatMoney` as `pesewasToGhs` for compatibility.
- **Prerequisites:** Phase 4.
- **Acceptance:** All money/date values render identically to before.
- **Tests:** Manual comparison + typecheck.
- **Safe to commit independently:** Yes.

#### P5-2 Consolidate readResponse
- **Purpose:** One response parser.
- **Files:** create `apps/agent/lib/api-client.ts`; modify
  `agent-auth-flow.tsx`, `buyer-recovery-flow.tsx`, `withdrawal-panel.tsx`,
  `pricing-grid.tsx`.
- **Instructions:** Move the most complete `readResponse` (handles `string[]`
  join) to `lib/api-client.ts`; replace all inline copies.
- **Prerequisites:** P5-1.
- **Acceptance:** Error messages render identically.
- **Safe to commit independently:** Yes.

#### P5-3 Split WithdrawalPanel
- **Purpose:** Separate request flow from history.
- **Files:** create `components/withdrawal-request-flow.tsx`,
  `components/withdrawal-history.tsx`; modify `withdrawal-panel.tsx` (becomes a
  thin wrapper) and `app/(workspace)/withdrawals/page.tsx`.
- **Instructions:** Move the 3-step state machine + form + OTP into
  `WithdrawalRequestFlow` (own state). Move the table + empty state into
  `WithdrawalHistory` (props only). `WithdrawalPanel` (or the page) composes
  them with the gating from P3-1. Preserve all mutations and `router.refresh()`.
- **Prerequisites:** P3-1, P5-1, P5-2.
- **Acceptance:** Withdrawal flow + history identical behavior.
- **Tests:** Manual end-to-end.
- **Safe to commit independently:** Yes.

#### P5-4 Split StorefrontCheckout
- **Purpose:** Separate form, status, and polling.
- **Files:** create `components/checkout-form.tsx`,
  `components/order-status-card.tsx`, `hooks/use-order-status.ts`; modify
  `storefront-checkout.tsx` (orchestrator) and
  `app/(storefront)/buy/[webSalesId]/page.tsx`.
- **Instructions:** Extract `CheckoutForm` (product/quantity/contact + order
  creation + Paystack open), `OrderStatusCard` (awaiting/paid/failed), and
  `useOrderStatus` (3s polling + manual verify). Orchestrator switches on
  `order` state. Preserve idempotency key, polling lifecycle, and Paystack
  resume.
- **Prerequisites:** P5-1, P5-2.
- **Acceptance:** Checkout end-to-end + polling + Paystack resume identical.
- **Tests:** Manual full purchase.
- **Safe to commit independently:** Yes.

> Phase 6 tasks are not enumerated here because they depend on product-owner
> decisions D1–D4 (§15). Each confirmed feature becomes its own sub-phase
> (6a–6e) with tasks defined at that time. Phase 7 is a review pass, not new
> tasks.


---

## 11. Migration safety

How to avoid regressions in each risk area.

- **Session cookies:** `agentSessionCookie` (`doraf_agent_session`) and
  `registrationCookie` are unchanged. The layout and pages use the existing
  `apiRequest(..., true)` which reads the cookie server-side. No cookie logic
  changes.
- **Authentication redirects:** `proxy.ts` keeps the same intent (no-session
  workspace → `/login`; has-session `/login`|`/register` → `/dashboard`). Only
  the matcher grows. Each workspace page also keeps the `401 → redirect("/login")`
  defense-in-depth. After P1-5, verify all workspace paths redirect when
  unauthenticated.
- **Middleware/proxy matcher:** Must list every workspace segment explicitly
  (route groups don't create URL segments). A single `/portal/:path*` alternative
  is rejected (breaks `/dashboard`). Verify with unauthenticated hits to each new
  path.
- **Suspended-agent read-only behavior:** The `readOnly = status === "SUSPENDED"`
  derivation stays in each page and is passed to `PricingGrid`,
  `WithdrawalPanel`/`WithdrawalRequestFlow`, and `SalesLinkCard`. The gating in
  P3-1 must disable the "Request withdrawal" button when `readOnly`. Pricing
  confirm (P3-2) must remain disabled when `readOnly`. Verify a suspended agent
  cannot submit any mutation across all pages.
- **Server/client component boundaries:** Layouts that fetch data are server
  components; `WorkspaceNav`, `WorkspaceHeader`, `ThemeSelector`, and the
  interactive flows are `"use client"`. Do not introduce client-only APIs in
  server components. The `usePathname` hook is client-only (nav is client).
- **Query-string pagination:** `?walletPage=` is preserved on `/wallet` with the
  identical `getWalletPage` bounds (`MAX_WALLET_TRANSACTION_PAGE = 10_000`).
  Moving the helper must not change its regex or cap. The dashboard recent-5
  uses `?page=1` only.
- **Paystack checkout:** The `Script` (`js.paystack.co/v2/inline.js`,
  `afterInteractive`) stays on the storefront page, not the layout. The
  `PaystackPop` global, `resumeTransaction(accessCode)`, idempotency key
  (`crypto.randomUUID()`), and 3s polling are preserved through the P5-4 split.
  Verify a sandbox purchase after the split.
- **Buyer sales links:** `/buy/[webSalesId]` URL is unchanged by the
  `(storefront)` group move. No redirect or rewrite is added. Existing
  distributed links keep working.
- **Recovery URLs:** `/recover` URL is unchanged. The recovery flow's
  anti-enumeration generic responses and bearer-token voucher fetch are
  preserved.
- **Loading and error states:** No `loading.tsx`/`error.tsx` are introduced in
  this refactor (keep current inline behavior). If added later, they must not
  mask the `401 → redirect` path. `apiJson`/`ApiError` behavior is unchanged.
- **Dark mode:** `ThemeProvider`, the `beforeInteractive` theme script, and the
  `D` hotkey remain. The new `ThemeSelector` (P3-3) uses the same `localStorage`
  key (`"theme"`) and class toggle; it must not fight the hotkey or the system
  listener. Verify light/dark/system across reloads and navigation.
- **Mobile responsiveness:** The nav collapses on small screens (P1-1). The
  workspace header hides name/phone on small screens (current pattern). Verify
  each page at mobile widths; ensure no horizontal overflow from the new layout.


---

## 12. Testing strategy

The repo currently has no `apps/agent` test suite (tests live in `apps/api`).
This refactor is primarily structural, so the strategy emphasizes **manual
verification + typecheck/lint/build gates**, with a small set of route-access
automated checks recommended where feasible.

### Automated (run every phase)
- `pnpm --filter agent typecheck` — catches moved imports / broken types.
- `pnpm --filter agent lint` — style/correctness.
- `pnpm --filter agent build` — confirms the route tree compiles and the proxy
  matcher is valid.

### Recommended automated checks (add if a test harness is introduced)
- Route access: unauthenticated GET to each workspace path returns a redirect to
  `/login` (assert via the dev server or a supertest-style harness against the
  proxy). Authenticated GET to `/login`/`/register` redirects to `/dashboard`.
- Public route accessibility: `/buy/[webSalesId]` and `/recover` return 200 (no
  auth redirect).

### Manual checks (per phase, then full matrix in Phase 7)
- **Route access:** hit each workspace route signed-in and signed-out.
- **Unauthenticated redirects:** `/dashboard`, `/sales`, `/pricing`, `/wallet`,
  `/withdrawals`, `/settings` → `/login` when no cookie.
- **Authenticated redirects:** `/login`, `/register` → `/dashboard` when cookie
  present.
- **Active navigation states:** each nav item highlights on its route.
- **Mobile navigation:** nav collapses/expands; active state visible; no
  overflow.
- **Page data loading:** each page loads its data; 401 → `/login`; partial
  failures render inline errors (current behavior).
- **Pricing updates:** set a price, confirm (P3-2), verify persistence +
  `router.refresh()`; verify range validation; verify read-only on suspend.
- **Withdrawal details and OTP flow:** open gated form (P3-1), enter amount,
  receive OTP, verify, create; verify history updates; verify read-only disables
  entry; verify resend (P3-5).
- **Suspended accounts:** sign in as a suspended agent; confirm all mutation
  controls disabled across all pages; confirm history/views visible; confirm
  nav fully available.
- **Wallet pagination:** walk `?walletPage=1..N`; verify prev/next; verify cap at
  `MAX_WALLET_TRANSACTION_PAGE`.
- **Storefront checkout:** full sandbox purchase (reserve → Paystack → status
  polling → paid); verify "Start another order"; verify empty-store state.
- **Purchase recovery:** full recovery (reference → OTP → vouchers → copy);
  verify anti-enumeration generic response on a bad reference; verify "Recover
  another".
- **Public route accessibility:** `/buy/[webSalesId]` and `/recover` reachable
  without auth.
- **Browser back-button:** navigate Dashboard → Pricing → back returns to
  Dashboard with state preserved (layout persists).
- **Deep linking:** paste `/wallet?walletPage=2` and `/pricing` directly into the
  URL bar; verify they load (not redirected away when authed).
- **Keyboard navigation:** Tab through nav; activate links with Enter; reach
  sign-out; reach theme selector; operate OTP inputs.
- **Responsive layouts:** check each page at 360px, 768px, 1280px.
- **Themes:** light, dark, system via the selector (P3-3) and the `D` hotkey;
  verify persistence across reloads and across route navigation (layout
  preserves).


---

## 13. Acceptance criteria for the complete refactor

The refactor is complete when **all** of the following hold (Phases 1–5; Phase 6
items add their own criteria when confirmed):

1. Every major agent task has a dedicated route: Dashboard (overview), Sales,
   Pricing, Wallet, Withdrawals, Settings.
2. The dashboard is an overview only — it contains no full pricing editor, no
   withdrawal request form, no full paginated ledger, no security card, and no
   full withdrawal history.
3. Workspace navigation is persistent across all workspace pages and is
   responsive (collapses on mobile).
4. Existing pricing, wallet, withdrawal, storefront, and recovery behavior still
   works end-to-end (verified by manual happy paths).
5. Public sales-link URLs (`/buy/[webSalesId]`) and `/recover` remain valid and
   unchanged.
6. All authenticated pages enforce session requirements (proxy redirect +
   per-page 401 redirect).
7. Suspended agents retain read-only access to all workspace pages with all
   mutation controls disabled.
8. Financial formatting is consistent throughout the app (one `formatMoney`;
   no inline `money()` copies).
9. No major feature is duplicated across pages (pricing, withdrawals, ledger,
   sales link each live in exactly one primary place).
10. Missing features have deliberate homes (Settings sections, `/sales`
    placeholder) without fake functionality; placeholders clearly state
    unavailability.
11. Buyer surfaces show no "Agent" branding; agent surfaces show agent branding.
12. `typecheck`, `lint`, and `build` pass for `apps/agent`.
13. A visible theme selector exists in Settings; the `D` hotkey still works.
14. Withdrawal requests are gated behind an explicit intent action.
15. Price changes require an inline confirmation before committing.

---

## 14. Risk register

| Risk | Likelihood | Impact | Mitigation | Phase |
|---|---|---|---|---|
| Moving `dashboard` into `(workspace)` changes its URL or breaks the root redirect | Low | High | Route groups don't affect URLs; verify `/dashboard` resolves and `app/page.tsx` redirect target unchanged | P1-4 |
| Proxy matcher misses a new workspace path → unauthenticated access | Medium | High | List every segment explicitly; add a manual check hitting each path signed-out; consider a shared workspace-paths constant | P1-5 |
| Splitting the dashboard's 6 fetches drops data a page needs (e.g., `withdrawableMinor`) | Medium | Medium | Per-page data map (§7); each page fetches its own subset; verify withdrawal page still has `withdrawableMinor` | P2 |
| Withdrawal gating breaks the OTP/verify/create flow | Medium | High | P3-1 preserves the exact calls and `router.refresh()`; manual end-to-end test | P3-1 |
| Price confirm breaks save + refresh | Low | Medium | P3-2 only adds a gate before the existing POST; manual save test | P3-2 |
| `formatMoney` diverges from `pesewasToGhs` output (formatting drift) | Medium | Medium | Match BigInt + `−` semantics exactly; visual comparison before/after | P5-1 |
| Storefront `Script`/Paystack broken by layout move | Low | High | Keep `Script` on the page, not layout; verify sandbox purchase after P4-2 | P4-2 |
| Mobile nav unusable without a Sheet primitive | Low | Low | Simple conditional toggle from `Button`/`Link`; no primitive needed | P1-1 |
| Theme selector fights the `D` hotkey / system listener | Low | Low | Same `localStorage` key + class toggle; verify all three modes | P3-3 |
| `readResponse` consolidation changes error message wording | Low | Low | Use the most complete copy (`string[]` join); compare error states | P5-2 |
| Scope creep pulls Category C features into the structural refactor | Medium | Medium | Phases 1–5 explicitly exclude Category C; gate behind decisions D1–D4 | All |


---

## 15. Decision log

Decisions requiring product-owner input. Each has a **recommended default**,
clearly marked as a recommendation.

### D1 — Is order history currently in scope?
- **Context:** `docs/product/04-agent-portal.md` and `06-mvp-scope.md` list order
  history as included. `docs/planning/implementation-progress.md` marks the agent
  portal phase complete without mentioning orders, and no orders UI exists.
- **Question:** Should order history be implemented now, or is it intentionally
  deferred?
- **Recommended default:** Treat as **deferred** for this refactor; represent
  with an intentional empty state on `/sales`. Implement in Phase 6a after
  confirmation + backend endpoint. **(Recommendation — confirm with product
  owner.)**

### D2 — Are reporting-period metrics (today/7d/30d/lifetime) currently in scope?
- **Context:** Documented in `04-agent-portal.md` "Home dashboard"; not
  implemented; requires a new agent reporting endpoint.
- **Question:** Implement now or defer?
- **Recommended default:** **Defer**; show no fake KPIs on the dashboard. If a
  lightweight metric is desired using existing data (e.g., current ledger
  balance only), that's already on the dashboard. Full reporting waits for
  Phase 6b + backend. **(Recommendation — confirm with product owner.)**

### D3 — Are notifications currently in scope?
- **Context:** Documented in `04-agent-portal.md`; not implemented; requires a
  feed + preferences backend.
- **Recommended default:** **Defer**; reserve a Settings section placeholder; no
  header bell until implemented (Phase 6c). **(Recommendation — confirm.)**

### D4 — Do exports remain deferred?
- **Context:** `implementation-progress.md` (2026-08-02) states privacy-safe
  exports were deferred by product-owner decision.
- **Recommended default:** **Keep deferred**; reserve a Settings section with
  "Not yet available" state. Implement in Phase 6d when unblocked.
  **(Recommendation — confirm.)**

### D5 — Terms & privacy acceptance during registration
- **Context:** `agent-onboarding.md` flags this as a compliance topic; currently
  only a passive footer line.
- **Recommended default:** Out of scope for this structural refactor; track as a
  compliance task. The refactor keeps the existing footer. **(Recommendation —
  confirm with legal/compliance.)**

### D6 — Route prefix vs route groups for the workspace
- **Context:** Route groups keep URLs stable but require listing each path in the
  proxy matcher. A `/portal` prefix simplifies the matcher but changes
  `/dashboard`.
- **Recommended default:** **Route groups** (no URL change; preserves
  `/dashboard` redirect and any external links). **(Recommendation.)**

### D7 — Price-change confirmation: inline vs modal dialog
- **Context:** `@workspace/ui` has no dialog primitive.
- **Recommended default:** **Inline confirm** (no new primitive needed). A modal
  dialog is optional later and would require adding a dialog primitive to
  `@workspace/ui`. **(Recommendation.)**

### D8 — Withdrawal request: inline reveal vs dialog/drawer
- **Context:** Same primitive gap as D7.
- **Recommended default:** **Inline reveal** on `/withdrawals` (no new
  primitive). Dialog/drawer optional later. **(Recommendation.)**

### D9 — Pre-payment review/confirm step in checkout
- **Context:** `docs/flows/online-purchase.md` step 6 calls for a final review
  with explicit confirmation; the current UI goes form → Paystack directly.
- **Question:** Add the review step now or defer?
- **Recommended default:** **Defer** to a follow-up after the P5-4 checkout
  split (it's a buyer-flow change, not part of the agent workspace structural
  refactor). Track as a separate task. **(Recommendation — confirm with product
  owner.)**

### D10 — Buyer surface: route groups now vs separate app later
- **Context:** Route groups separate chrome without a new app; a full
  `apps/storefront` split is the long-term end state.
- **Recommended default:** **Route groups now** (`(storefront)`); revisit a
  separate app only when traffic/branding/divergence justifies it. **(Recommendation.)**


---

## Deliverable summary

### 1. Concise summary of the proposed sequence
1. **Phase 0** — Baseline verification (no source changes).
2. **Phase 1** — Workspace shell + navigation: `(workspace)` layout, header, nav,
   move `/dashboard` in, expand proxy matcher.
3. **Phase 2** — Route decomposition: create `/wallet`, `/withdrawals`,
   `/pricing`, `/sales`, `/settings`; slim `/dashboard` to overview; wire nav.
4. **Phase 3** — Progressive disclosure: gate withdrawals, confirm pricing, theme
   selector, storefront preview, OTP resend, suspension guidance.
5. **Phase 4** — Buyer/auth separation: `DorafMark` variant, `(storefront)`
   layout + move buyer pages, `(auth)` layout + move auth pages.
6. **Phase 5** — Utility/component cleanup: consolidate `money`/date/`readResponse`;
   split `WithdrawalPanel` and `StorefrontCheckout`.
7. **Phase 6** — Missing features, only after product-owner decisions D1–D4.
8. **Phase 7** — Final accessibility, responsive, and regression review.

### 2. The first five atomic implementation tasks
1. **P1-1** Create the workspace nav component
   (`components/_workspace/workspace-nav.tsx`).
2. **P1-2** Create the workspace header component
   (`components/_workspace/workspace-header.tsx`). 3. **P1-3** Create the page-header component
   (`components/_workspace/page-header.tsx`).
4. **P1-4** Create the workspace layout and move the dashboard
   (`app/(workspace)/layout.tsx`; move `dashboard/page.tsx`).
5. **P1-5** Expand the proxy matcher (`proxy.ts`).

### 3. Blockers that must be resolved before implementation
- **No technical blockers** for Phases 1–5. They reorganize existing
  functionality with no backend changes.
- **Product-owner decisions D1–D4** are required **before Phase 6** (order
  history, reporting metrics, notifications, exports). The structural refactor
  must not silently implement or fake these.
- **D5 (terms acceptance)** and **D9 (checkout review step)** are compliance /
  product-flow decisions that should be tracked but do not block Phases 1–5.

### 4. Recommended first implementation task
**P1-1 — Create the workspace nav component.** It is a leaf client component
with no dependencies on other new files, no behavior change to existing routes,
and is safe to commit independently. It establishes the `_workspace/` folder and
the nav pattern that P1-2, P1-4, and P2-7 build on.

---

Status update: Phase 0, Phase 1, Phase 2, Phase 3, and Phase 4 are completed. Ready to proceed to Phase 5.

