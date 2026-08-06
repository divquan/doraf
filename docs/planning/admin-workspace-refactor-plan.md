# Admin workspace refactor plan

Status: Active (planned; not yet implemented)
Last updated: 2026-08-05

This is an executable implementation plan for restructuring `apps/admin` from a
single-page feature dump (`/dashboard`) into a structured, navigable
administration workspace with intentional page responsibilities, role-aware
navigation, and progressive disclosure for sensitive operations.

It is derived from the UX & product architecture audit and validated against the
current codebase and Next.js 16 framework conventions. It is **not** a redesign
of visual styling and **does not implement anything**. An implementation agent
should be able to execute it without reinterpreting the audit.

Companion documents:

- [Agent workspace refactor plan](agent-workspace-refactor-plan.md) — the
  structural template this plan mirrors (Phases 0-4 already executed there).
- [Administration portal](product/05-administration-portal.md) — intended admin
  surface.
- [MVP scope](product/06-mvp-scope.md) — confirmed feature boundaries.
- [Users and roles](product/01-users-and-roles.md) — the two internal roles.
- [Implementation progress](planning/implementation-progress.md) — current
  state and deferred items.

## Validated codebase facts (non-negotiable)

Confirmed by reading the code and the Next.js 16 docs bundled at
`node_modules/.pnpm/next@16.2.6.../dist/docs/`.

1. **`proxy.ts` is a single file at the app root** (`apps/admin/proxy.ts`).
   Next.js 16 docs: "only one `proxy.ts` file is supported per project... located
   at the same level as pages or app." It **cannot** live in a route group.
   Route protection is path-based via the `matcher` config. Current state:
   `protectedPaths = ["/dashboard", "/inventory"]`,
   `matcher = ["/dashboard/:path*", "/inventory/:path*"]`. It only redirects
   **unauthenticated** users away from protected paths (no authed-user redirect
   off `/login`).
2. **Route groups `(name)`** enable shared layouts **without affecting URLs**.
   Moving `dashboard` into `(workspace)` keeps `/dashboard`; moving
   `inventory/batches/[batchId]` into `(workspace)` keeps
   `/inventory/batches/[batchId]`. All URLs stable.
3. **`@workspace/ui` exports** `alert`, `badge`, `button`, `card`, **`dialog`**,
   `empty`, `field`, `input`, `input-otp`, `label`, `native-select`,
   `separator`, `spinner`, `table`, `toggle`, `toggle-group`. The `dialog`
   primitive (`Dialog`, `DialogTrigger`, `DialogPortal`, `DialogBackdrop`,
   `DialogPopup`, `DialogHeader`, `DialogFooter`, `DialogTitle`,
   `DialogDescription`, `DialogClose`) **now exists** — unlike at the time the
   agent plan was written. This unlocks modal confirmations for sensitive admin
   actions (see §6/§15 D7). `cn` is at `@workspace/ui/lib/utils`.
4. **Internal roles**: exactly two, `InternalRole.ADMINISTRATOR` and
   `InternalRole.SUPPORT` (`apps/api/src/generated/prisma/client`). The admin UI
   already models this as `viewerRole: "ADMINISTRATOR" | "SUPPORT"` inside the
   pricing payload (`apps/admin/components/pricing-controls.tsx`).
5. **There is no internal session/me endpoint.** `apps/api/src/internal-access/
passkey-auth.controller.ts` (`@Controller('internal-auth')`) exposes only
   passkey options/verify + `logout`. The agent app has
   `GET /agent-auth/session` (mirrored shape below) but internal users have no
   equivalent — this is the layout's role-source gap (§15 D1). The guard and
   principal already exist: `InternalSessionGuard` + `@CurrentInternalPrincipal()`
   populate `InternalPrincipal { userId, sessionId, displayName, role,
authenticationStrength, authenticatedAt, stepUpAt }`
   (`internal-access.types.ts`). Adding a `@Get('session')` is a small additive
   change mirroring `agent-auth.controller.ts:90`.
6. **Session cookie**: `doraf_internal_session` (`apps/admin/lib/internal-api.ts`,
   HttpOnly, sameSite lax). `internal-api.ts` starts with `import "server-only"`
   — **client components cannot import it**. That is why the passkey forms each
   carry an inline `readJson` (§8).
7. **Backend role guards** (confirmed in `apps/api/src/`):
   - `reporting-admin` controller — ADMIN + SUPPORT (overview + requeue).
   - `inventory-read` controller — ADMIN + SUPPORT (overview + batch detail).
   - `inventory-import` controller — ADMIN only (manual entry commit).
   - `pricing` controller — ADMIN at controller level; **one GET route allows
     SUPPORT** (read-only pricing). This is the current source of `viewerRole`.
   - `withdrawals-admin` controller — ADMIN only.
   - `agent-administration` controller — ADMIN only.
   - `internal-users` controller — ADMIN only (invitations).
   - `order-exceptions` / `refunds` controllers — ADMIN only (unused by UI).
8. **`app/dashboard/page.tsx` (142 lines) is the entire admin surface.** It
   fetches `/admin/products/pricing`, `/admin/inventory`,
   `/admin/reporting/overview` in parallel and additionally `/admin/withdrawals`
   when `viewerRole === "ADMINISTRATOR"`. It renders: header (text "Doraf
   Administration" + `LogoutButton`), executive overview (`OperationsDashboard`),
   inventory operations (`InventoryOverview` + `ManualInventoryForm`, admin),
   pricing operations (`PricingControls` + `ProductAvailability`, admin),
   withdrawal operations (`WithdrawalOperations`, admin), agent management
   (`AgentManagement`, admin), and `InviteInternalUserForm` — **shown to all
   roles** even though the backend is ADMIN-only (a role leak to close; noted in
   `implementation-progress.md` as "Support invitation-authorization coverage").
9. **Batch detail already exists** at `app/inventory/batches/[batchId]/page.tsx`
   (185 lines) with its own `LogoutButton` and a "← Back to operations" link to
   `/dashboard`; it imports `formatMoney`/`formatDateTime` from
   `components/inventory-overview.tsx` (cross-component coupling, §8).
10. **Duplicated helpers** (the §8 cleanup material):
    - `readJson` ×2 — `passkey-login-form.tsx`, `passkey-enrollment-form.tsx`
      (client; identical).
    - Money ×3 with **two semantics**: `formatGhs(minorStr: string)` BigInt →
      `GHS 1,234.56` (`operations-dashboard.tsx:442`); `money(value: string)`
      BigInt → `GHS x.yz` (`withdrawal-operations.tsx:401`); `money(minor:
number)` Intl `en-GH` GHS currency (`pricing-controls.tsx:59`);
      `formatMoney(value: number, currency)` Intl with currency param
      (`inventory-overview.tsx:183`).
    - Date ×3 with **inconsistent timezones**: `formatDate` no tz + `dateStyle:
"short"` (`operations-dashboard.tsx:449`); `formatDate` with
      `Africa/Accra` + `dateStyle: "medium"` (`withdrawal-operations.tsx:406`);
      `formatDateTime` no tz + `dateStyle: "medium"` (`inventory-overview.tsx:190`).
11. **Leftover empty skeleton directories** from earlier aborted refactors (not
    tracked by git, safe to delete): `app/(dashboard)/` (empty subdirs `agents`,
    `operations`, `dashboard`, `team`, `inventory/batches/[batchId]`,
    `withdrawals`, `pricing`) and top-level `app/agents/`, `app/pricing/`,
    `app/team/`, `app/withdrawals/`. See P1-7.
12. **No `public/` directory** in `apps/admin` — there is no `logo.jpg`, so the
    brand is text ("Doraf Administration"). The admin app is also a separate
    Next.js app and **cannot import from `apps/agent`**; the `_workspace/`
    primitives below are new admin-local components (informed by, not shared
    with, the agent versions).
13. **No `not-found.tsx`, `loading.tsx`, or `error.tsx`**; error/loading is
    inline per page. **No test suite** in `apps/admin` (tests live in
    `apps/api`). Scripts: `dev` (port 3001), `build`, `lint`, `typecheck`,
    `format`. Next 16 async `params`/`searchParams` are Promises.
14. **Reporting endpoint** returns the only dashboard data that is not duplicated
    elsewhere: `AdminReportingOverviewData` (financial / fulfillment /
    operations / invariants). It is the entire basis for the slimmed overview.
15. **All 14 BFF routes** under `app/api/` are thin same-origin proxies that
    forward the `doraf_internal_session` cookie as a Bearer token. Contracts stay
    unchanged (only one _additive_ route is proposed: `app/api/session`).

---

## 1. Scope and goals

### What this refactor will accomplish

- Decompose the single `/dashboard` page into a navigable workspace with
  dedicated routes: `/dashboard`, `/inventory`, `/pricing`, `/withdrawals`,
  `/agents`, `/operators`, `/settings`.
- Introduce a persistent authenticated workspace layout with **role-aware**
  primary navigation (ADMINISTRATOR sees admin-only sections; SUPPORT does not),
  a workspace header with operator identity + role, and sign-out.
- Make `/dashboard` an **overview only** (executive reporting + task entry
  points) — not the entire application.
- Add a session source for the shell: `GET /internal-auth/session` (mirrors the
  agent pattern) exposed via a new BFF route `app/api/session` — the single
  source of operator identity + role for the layout (§15 D1).
- Enforce role boundaries at the page level: admin-only pages redirect non-admin
  roles away, closing the current "Support can see the invite form but the
  backend rejects it" gap.
- Apply progressive disclosure to sensitive operations using the now-available
  `Dialog` primitive (withdrawal decisions, agent suspend/restore, product
  publish/unpublish, inventory commit) — optional polish, §6/§15 D7.
- Consolidate duplicated money/date/`readJson` helpers into one source of truth.
- Give confirmed-but-unimplemented features (audit explorer, privacy-safe
  exports, delivery-failure, dispute/refund and reconciliation queues)
  **deliberate homes** with intentional empty states until scope is confirmed —
  never fake functionality.

### What this refactor will deliberately NOT accomplish

- It will not implement audit explorer, exports, delivery failures, dispute/
  refund/reconciliation queues, or low-stock alerts as working features. These
  require backend work and are Category C (§15 D3/D4/D5).
- It will not change existing backend/API contracts. All 14 BFF routes
  (`app/api/...`) stay unchanged; only the additive `app/api/session` route and
  its backend `GET /internal-auth/session` are added.
- It will not redesign visual styling or the design system.
- It will not change any URLs (route groups keep `/dashboard`,
  `/inventory/batches/[batchId]`, `/login`, `/enroll`).
- It will not introduce new backend services.

### Expected user-facing outcome

- A signed-in Administrator sees persistent navigation and can go directly to
  Dashboard, Inventory, Pricing, Withdrawals, Agents, Operators, or Settings.
- A signed-in Support operator sees a filtered workspace: Dashboard, Inventory
  (read-only), Pricing (read-only), Settings — with no admin-only entry points.
- The dashboard answers "how is the business operating?" at a glance (within
  existing APIs) and links to detail pages.
- Each task has a focused page with a clear primary purpose.
- Sensitive decisions require explicit confirmation before committing.
- Financial values and timestamps are formatted consistently everywhere.

### Architectural outcome

- Two route groups: `(auth)` and `(workspace)`, each with its own layout.
- A single root `proxy.ts` with an expanded matcher covering all workspace
  routes.
- Reusable workspace primitives (sidebar, topbar, page header, theme selector)
  in `apps/admin/components/_workspace/`.
- A shared formatting module (`lib/format.ts`) and a client-safe response helper
  (`lib/client-api.ts`).
- Existing leaf components are **reused**, not rewritten, moving unchanged into
  their new pages where possible.

---

## 2. Current-to-target mapping

| Current section / component | Current file                                                                       | Current route                  | Proposed route                            | Action                                                                       | Behavior to preserve                                                                |
| --------------------------- | ---------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Root layout                 | `app/layout.tsx`                                                                   | all                            | all                                       | Keep as root                                                                 | Fonts, `ThemeProvider`, beforeInteractive theme script                              |
| Root redirect               | `app/page.tsx`                                                                     | `/`                            | `/`                                       | Keep                                                                         | cookie? dashboard : login                                                           |
| Header + sign-out           | inline in `dashboard/page.tsx` + `components/logout-button.tsx`                    | `/dashboard`                   | workspace topbar (all pages)              | Extract to `_workspace/workspace-topbar.tsx`; reuse `LogoutButton` unchanged | Sign-out → `/login`                                                                 |
| Executive overview          | `components/operations-dashboard.tsx`                                              | `/dashboard`                   | `/dashboard`                              | Keep (slim page)                                                             | Require-outbox requeue, invariants, financial/fulfillment/operations tiles          |
| Inventory operations        | `components/inventory-overview.tsx` (server)                                       | `/dashboard`                   | `/inventory`                              | Move                                                                         | Per-product counts, recent 25 batches, batch-detail links                           |
| Manual inventory entry      | `components/manual-inventory-form.tsx`                                             | `/dashboard`                   | `/inventory` (admin)                      | Move                                                                         | Preview/commit state machine, validate-all-or-nothing                               |
| Pricing controls            | `components/pricing-controls.tsx`                                                  | `/dashboard`                   | `/pricing`                                | Move                                                                         | SUPPORT read-only card; ADMIN default + override forms                              |
| Product availability        | `components/product-availability.tsx`                                              | `/dashboard`                   | `/pricing` (admin)                        | Move                                                                         | Publish/unpublish with reason                                                       |
| Withdrawal operations       | `components/withdrawal-operations.tsx`                                             | `/dashboard`                   | `/withdrawals` (admin)                    | Move                                                                         | Card state machine (approve/reject/verify/finalize + Paystack OTP), recent outcomes |
| Agent management            | `components/agent-management.tsx`                                                  | `/dashboard`                   | `/agents` (admin)                         | Move                                                                         | Suspend/restore with reason                                                         |
| Invite internal operator    | `components/invite-internal-user-form.tsx`                                         | `/dashboard` (all roles)       | `/operators` (admin only)                 | Move + gate                                                                  | Enrollment token reveal-once                                                        |
| Batch detail                | `app/inventory/batches/[batchId]/page.tsx`                                         | `/inventory/batches/[batchId]` | `(workspace)/inventory/batches/[batchId]` | Move; back-link → `/inventory`                                               | Masked voucher table, detail cards                                                  |
| Login page                  | `app/login/page.tsx`                                                               | `/login`                       | `(auth)/login`                            | Move                                                                         | Passkey form, `?enrolled=` banner                                                   |
| Enroll page                 | `app/enroll/page.tsx`                                                              | `/enroll`                      | `(auth)/enroll`                           | Move                                                                         | Passkey enrollment form                                                             |
| Money/date/readJson helpers | 3 files + 2 inline `readJson`                                                      | —                              | `lib/format.ts` + `lib/client-api.ts`     | Consolidate (§8)                                                             | Exact renderings; `Africa/Accra` tz                                                 |
| Proxy/middleware            | `proxy.ts`                                                                         | all                            | all                                       | Expand matcher                                                               | Unauthenticated → `/login`                                                          |
| Empty skeleton dirs         | `app/(dashboard)/`, `app/agents/`, `app/pricing/`, `app/team/`, `app/withdrawals/` | —                              | —                                         | Delete (P1-7)                                                                | —                                                                                   |
| BFF API routes (14)         | `app/api/**`                                                                       | `/api/...`                     | `/api/...`                                | Unchanged                                                                    | All contracts                                                                       |

### Items with no current implementation (Category C — §15)

| Feature                                  | Proposed home                   | Treatment in refactor                                                 |
| ---------------------------------------- | ------------------------------- | --------------------------------------------------------------------- |
| Audit explorer                           | `/settings` (reserved section)  | Intentional "Authorized administrators only — coming" empty state     |
| Privacy-safe exports                     | `/settings` (reserved section)  | "Not yet available — deferred" (deferred by product-owner 2026-08-02) |
| Delivery-failure queue                   | `/dashboard` operations summary | Reserved; not in nav until implemented                                |
| Disputes / replacements / refunds queues | `/dashboard` operations summary | Reserved; not in nav until implemented                                |
| Reconciliation queue                     | `/dashboard` operations summary | Reserved; not in nav until implemented                                |
| Low-stock alerts                         | `/inventory`                    | Reserved note; requires configurable thresholds (backend)             |

---

## 3. Proposed route and layout tree

```
apps/admin/
  app/
    layout.tsx                       # ROOT (unchanged): fonts, ThemeProvider, theme script, metadata
    page.tsx                         # redirect: /dashboard (unchanged)
    favicon.ico
    (auth)/
      layout.tsx                     # NEW: renders <AuthPageShell>{children}</AuthPageShell>
      login/page.tsx                 # MOVED from app/login (URL /login stable)
      enroll/page.tsx                # MOVED from app/enroll (URL /enroll stable)
    (workspace)/
      layout.tsx                     # NEW (server): fetch /api/session; 401 → /login; render WorkspaceShell(operator, role)
      dashboard/page.tsx             # MOVED + slimmed to overview
      inventory/page.tsx             # NEW: InventoryOverview + ManualInventoryForm (admin)
      inventory/batches/[batchId]/page.tsx  # MOVED (URL stable); back-link → /inventory
      pricing/page.tsx               # NEW: PricingControls + ProductAvailability (admin)
      withdrawals/page.tsx           # NEW (admin): WithdrawalOperations
      agents/page.tsx                # NEW (admin): AgentManagement
      operators/page.tsx             # NEW (admin): InviteInternalUserForm
      settings/page.tsx              # NEW: operator identity + appearance + reserved sections
    api/                             # UNCHANGED — all 14 BFF route handlers stay in place
      ...                            # (+ one NEW additive route: api/session)
  components/
    _workspace/                      # NEW subfolder for workspace chrome + shared shells
      workspace-shell.tsx            # NEW (client): sidebar + topbar + <main>, mobile drawer state
      workspace-sidebar.tsx          # NEW (client): role-filtered primary nav, usePathname active state
      workspace-topbar.tsx           # NEW (client): breadcrumb, operator name + role badge, sign-out
      page-header.tsx                # NEW (server): consistent page title + description + actions
      theme-selector.tsx             # NEW (client): Light/Dark/System control (Phase 3)
    _auth/
      auth-page-shell.tsx            # NEW: centered auth layout extracted from login/enroll (Phase 4)
    ... (existing components stay; some split per §6)
  lib/
    internal-api.ts                  # unchanged (server-only)
    format.ts                        # NEW: formatMoney, formatDateTime (consolidated, §8)
    client-api.ts                    # NEW: readJson (consolidated, §8)
  proxy.ts                           # MODIFIED: expand matcher to all workspace routes (root-level, NOT in a group)
```

### Why route groups and not path prefixes

Route groups give each audience its own layout **without changing URLs**.
`/dashboard`, `/inventory/batches/[batchId]`, `/login`, and `/enroll` stay
exactly where they are, preserving the root redirect target, the proxy matcher's
existing coverage, and any external links. A path prefix (e.g.
`/portal/dashboard`) would break the existing `/dashboard` redirect and the
`/inventory/batches/[batchId]` deep link.

### Route protection strategy

`proxy.ts` stays at the app root (Next.js 16 permits only one proxy file, at the
project root). It **cannot** be scoped to a route group. Protection remains
**path-based via the matcher**:

```ts
// apps/admin/proxy.ts (proposed)
const workspacePaths = [
  "/dashboard",
  "/inventory",
  "/pricing",
  "/withdrawals",
  "/agents",
  "/operators",
  "/settings",
]

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/inventory/:path*",
    "/pricing/:path*",
    "/withdrawals/:path*",
    "/agents/:path*",
    "/operators/:path*",
    "/settings/:path*",
  ],
}
```

The redirect logic stays identical in intent: **no session cookie + workspace
path → `/login`**. The current proxy does not redirect authenticated users away
from `/login`; keep that behavior (an optional enhancement, not part of this
refactor).

Because `(workspace)` routes resolve to top-level paths, the matcher lists each
segment. This is the behavior-preserving choice. (Alternative: a real `/portal`
prefix so the matcher is a single `/portal/:path*` — but that changes
`/dashboard` and is **not** recommended; see §15 D6.)

As defense-in-depth, each workspace page keeps the current pattern: server-side
fetch with `withSession`, and `redirect("/login")` on `401`. Admin-only pages
additionally handle `403` → `redirect("/dashboard")` (§15 D2).

### Role-based page access

- **Both roles:** `/dashboard`, `/inventory` (read; admin sees the manual-entry
  form), `/pricing` (SUPPORT sees the read-only card — existing component
  behavior), `/settings`.
- **ADMIN only:** `/withdrawals`, `/agents`, `/operators`.
- **Enforcement:** (1) the layout hides admin-only nav items for SUPPORT;
  (2) each admin-only page fetches its admin-guarded BFF endpoint, and on `403`
  calls `redirect("/dashboard")`; (3) the backend guards remain the ultimate
  authority. `proxy.ts` cannot role-filter (the cookie is an opaque token), so
  role gating lives in server components only.

### API routes that remain unchanged

All 14 handlers under `app/api/` stay in place, unchanged. No existing BFF
contract changes. One **additive** route is proposed: `app/api/session`
(Phase 1, §5 `(workspace)/layout.tsx`).

---

## 4. Navigation design

### Primary navigation items

| Label       | Route          | Roles                   | Icon (Hugeicons candidate) | Notes                                             |
| ----------- | -------------- | ----------------------- | -------------------------- | ------------------------------------------------- |
| Dashboard   | `/dashboard`   | all                     | `DashboardSquare01Icon`    | Overview; default landing                         |
| Inventory   | `/inventory`   | all                     | `PackageIcon` or `BoxIcon` | Stock counts, batch history, manual entry (admin) |
| Pricing     | `/pricing`     | all (SUPPORT read-only) | `Tag01Icon`                | Default + override pricing; availability (admin)  |
| Withdrawals | `/withdrawals` | ADMIN                   | `MoneyReceiveCircleIcon`   | Approval/rejection + Paystack OTP progression     |
| Agents      | `/agents`      | ADMIN                   | `UserGroupIcon`            | Suspend/restore agent access                      |
| Operators   | `/operators`   | ADMIN                   | `UserAdd02Icon`            | Invite internal operators                         |
| Settings    | `/settings`    | all                     | `Settings02Icon`           | Operator identity, appearance, reserved sections  |

Icons are optional and chosen from `@hugeicons/core-free-icons` (already in use).
Selection is a visual detail, not structural; final names are decided at
implementation time.

### Desktop behavior

- A persistent left **side navigation** rendered by `(workspace)/layout.tsx`
  (mirrors the agent workspace: fixed `w-64` rail on `lg+`).
- The workspace **topbar** contains: a breadcrumb (Workspace / {page}), the
  signed-in operator's name + role badge, and `LogoutButton`. This generalizes
  the current dashboard header into the layout.

### Mobile behavior

- Below `lg`, the side nav collapses into a slide-over drawer driven by a simple
  `useState` toggle in the client shell (the `@workspace/ui` drawer is not
  required; `Button` + `Link` + `usePathname` suffice — same approach as the
  agent workspace).
- Active item is visually distinct (`bg-accent text-accent-foreground`) via `cn`.

### Active-state behavior

- `workspace-sidebar.tsx` is a client component using `usePathname()`.
- An item is active when `pathname === item.route` (exact for `/dashboard`) or
  `pathname.startsWith(item.route + "/")` (for nested routes such as
  `/inventory/batches/[batchId]` highlighting Inventory).
- Active state applied to the `<Link>` via `className` and `aria-current="page"`.

### Role filtering

- `navItems` is one shared array with a `roles: ("ADMINISTRATOR" | "SUPPORT")[]`
  field (or an `adminOnly` flag). The sidebar filters by the `role` prop passed
  down from the server layout's session fetch.
- SUPPORT must never see an admin-only nav item, so no dead-end clicks occur.

### Workspace header responsibilities

- Render operator identity (displayName + role badge) — from the session, passed
  from the server layout.
- Render `LogoutButton` (reused unchanged; it already does `router.replace("/login")`).
- Render a breadcrumb of the current page.
- Do **not** render page-specific content; that lives in each page.

### Sign-out location

- Primary: workspace topbar (all pages), via the existing `LogoutButton`.
- Secondary: `/settings` (optional, same component).

---

## 5. Page responsibility specifications

Each page below documents: primary intent, information shown, primary/secondary
actions, components, data required, loading/empty/error states, role behavior,
related links, and what must **not** appear.

### `/dashboard` — Overview

- **Primary user intent:** "How is the platform operating, and what needs
  attention?"
- **Information shown (overview only):**
  - Page header: "Operations workspace" + short description (replaces the inline
    header; sign-out moves to the topbar).
  - Executive overview: `OperationsDashboard` (financial, fulfillment,
    operations, invariants, stuck-outbox requeue) — **unchanged component**.
  - An operations **quick-links** row: Inventory, Pricing, Withdrawals (admin
    only), Agents (admin only) — a deliberate overview-to-detail entry point.
- **Primary action:** None directly (it is an overview). CTAs route to detail
  pages.
- **Secondary actions:** Sign out (topbar); navigate via side nav.
- **Components:** `PageHeader`, `OperationsDashboard`, a `QuickLinks` card (new,
  small server component) or link list.
- **Data required:** `reporting` (`/admin/reporting/overview`). **Dropped** from
  this page: pricing and inventory payloads (they move to their pages); the
  withdrawals list (moves to `/withdrawals`).
- **Loading state:** Inline (current pattern). No `loading.tsx`.
- **Empty/error state:** `OperationsDashboard` renders inline error/empty
  states as today. 401 → `redirect("/login")`.
- **Role behavior:** Both roles. The quick-links row conditionally shows
  admin-only links based on `viewerRole` (from the pricing endpoint is no longer
  fetched here — use the session fetch, or render admin links only if the
  session role is ADMIN; simplest: pass `role` from the session fetch of the
  layout is NOT available to pages, so the page fetches `/api/session` for role
  OR renders a generic link set. **Recommended:** fetch `/api/session` for the
  `role` and show admin links accordingly. This keeps the overview accurate
  without loading products/agents.)
- **Links to related pages:** `/inventory`, `/pricing`, `/withdrawals`, `/agents`,
  `/operators`, `/settings`.
- **Must NOT appear here:** the pricing editor, the inventory overview + manual
  form, the withdrawal operations queue, agent management, the invite form.
  These now live on their own pages.

### `/inventory` — Inventory operations

- **Primary user intent:** "Monitor stock and enter new batches."
- **Information shown:** `InventoryOverview` (per-product counts, recent 25
  batches with batch-detail links) + `ManualInventoryForm` (admin only).
- **Primary action:** Commit a validated inventory batch (admin).
- **Secondary actions:** Open a batch detail (`/inventory/batches/[batchId]`).
- **Components:** `PageHeader`, `InventoryOverview`, `ManualInventoryForm` (admin).
- **Data required:** `pricing` (`/admin/products/pricing` — provides `products`
  for the form and `viewerRole`), `inventory` (`/admin/inventory`). Fetched in
  parallel exactly as the current dashboard does; both 401 → `redirect("/login")`.
- **Loading/empty/error:** Existing component states; `InventoryOverview` already
  handles the empty batch history.
- **Role behavior:** Both roles see the overview. The manual form renders only
  when `viewerRole === "ADMINISTRATOR"` (current behavior). SUPPORT's backend
  would reject a commit anyway (inventory-import is ADMIN-only).
- **Links:** `/dashboard`, `/inventory/batches/[batchId]`, `/pricing`.
- **Must NOT appear:** pricing editor, withdrawals, agent management.

### `/inventory/batches/[batchId]` — Batch detail (moved)

- **Primary user intent:** "Inspect a specific inventory batch and its masked
  voucher entries."
- **Information shown:** detail cards + voucher table (unchanged).
- **Actions:** None (view). Back link.
- **Changes:** Moves into `(workspace)/inventory/batches/[batchId]` (URL
  unchanged). The "← Back to operations" link target changes from `/dashboard`
  to `/inventory`. Its own `LogoutButton` is removed (the topbar provides
  sign-out) — or kept harmlessly; recommended: remove since the layout now
  renders the topbar.
- **Data required:** `GET /admin/inventory/batches/:id` (unchanged).
- **Role behavior:** Both roles (inventory-read allows SUPPORT).
- **Links:** `/inventory`.
- **Must NOT appear:** admin-only tools.

### `/pricing` — Pricing operations

- **Primary user intent:** "Configure effective product ranges and targeted
  agent exceptions."
- **Information shown:** `PricingControls` (role-aware: SUPPORT read-only card;
  ADMIN default + override forms) + `ProductAvailability` (admin).
- **Primary action:** Create/update a pricing policy (admin).
- **Secondary actions:** Publish/unpublish a product (admin).
- **Components:** `PageHeader`, `PricingControls`, `ProductAvailability` (admin).
- **Data required:** `pricing` (`/admin/products/pricing`). 401 → redirect.
- **Loading/empty/error:** Existing component states; per-form save errors.
- **Role behavior:** SUPPORT sees `PricingControls`' read-only branch (existing
  behavior) and no `ProductAvailability`.
- **Links:** `/dashboard`, `/inventory`.
- **Must NOT appear:** inventory, withdrawals, agent management.

### `/withdrawals` — Withdrawal operations (ADMIN only)

- **Primary user intent:** "Review held funds, approve/reject Mobile Money
  transfers, and reconcile Paystack outcomes."
- **Information shown:** `WithdrawalOperations` (active queue + recent outcomes) —
  **unchanged component**.
- **Primary action:** Advance a withdrawal through its state machine
  (approve/reject/verify/finalize + merchant OTP).
- **Components:** `PageHeader`, `WithdrawalOperations`.
- **Data required:** `withdrawals` (`/admin/withdrawals`). 401 → redirect;
  **403 → `redirect("/dashboard")`** (SUPPORT).
- **Loading/empty/error:** Existing `Empty` state ("No withdrawals need
  attention") and per-card messages.
- **Role behavior:** ADMIN only. Nav item hidden for SUPPORT; direct URL access
  is caught by the 403 redirect.
- **Links:** `/dashboard`, `/agents`.
- **Must NOT appear:** pricing, inventory, agent management.

### `/agents` — Agent management (ADMIN only)

- **Primary user intent:** "Control whether an agent can accept new sales while
  preserving their account and historical access."
- **Information shown:** `AgentManagement` — **unchanged component** (agent list,
  suspend/restore with reason).
- **Primary action:** Suspend / restore an agent.
- **Components:** `PageHeader`, `AgentManagement`.
- **Data required:** `pricing` (`/admin/products/pricing` — the `agents` array is
  part of this payload today; keep using it). 401 → redirect; 403 → redirect.
- **Loading/empty/error:** Existing states.
- **Role behavior:** ADMIN only.
- **Links:** `/dashboard`, `/withdrawals`.
- **Must NOT appear:** pricing editor, inventory.

### `/operators` — Internal operators (ADMIN only)

- **Primary user intent:** "Invite an internal operator."
- **Information shown:** `InviteInternalUserForm` — **unchanged component** (raw
  inputs today; optional `@workspace/ui` migration in §6/Phase 5). Enrollment
  token is shown once.
- **Primary action:** Create an invitation (`POST /api/internal-users`).
- **Components:** `PageHeader`, `InviteInternalUserForm`.
- **Data required:** none (form posts to BFF).
- **Role behavior:** **ADMIN only.** This closes the current gap where the form
  is visible to SUPPORT but the backend rejects it. Nav item hidden for SUPPORT;
  the BFF `internal-users` route returns 403 for SUPPORT (page can rely on that,
  or proactively redirect on `viewerRole` — recommended: keep the page simple
  and let the BFF 403 surface as an inline error, since the nav already hides the
  entry point).
- **Links:** `/dashboard`.
- **Must NOT appear:** any other admin tools.

### `/settings` — Operator identity, appearance, reserved sections

- **Primary user intent:** "See who I am signed in as, adjust appearance, and
  find tools that are coming."
- **Information shown:**
  - **Operator identity** card: displayName + role badge ("Administrator" /
    "Support") + sign-in method ("Passkey"). Display-only for v1 (from
    `/api/session`).
  - **Appearance:** theme selection (Light / Dark / System) — a visible control
    replacing the hidden `D` hotkey as the discoverable affordance (the hotkey
    remains). Reuses the existing `ThemeProvider`/`applyTheme` mechanism and the
    `"theme"` localStorage key.
  - **Reserved sections (intentional placeholders, not fake features):**
    Exports — "Not yet available — deferred" (product-owner decision
    2026-08-02); Audit explorer — "Authorized administrators only — coming".
- **Primary action:** Change theme (immediate). Everything else is display-only.
- **Secondary actions:** Sign out (secondary location).
- **Components:** `PageHeader`, an `OperatorIdentityCard` (new, server or
  presentational), `ThemeSelector` (new, client), `Card`/`Separator` for
  reserved sections.
- **Data required:** `session` (`/api/session`).
- **Loading/empty/error:** Standard; 401 → redirect.
- **Role behavior:** Both roles; the reserved sections render identically.
- **Links:** `/dashboard`.
- **Must NOT appear:** pricing, inventory, withdrawals, agent management.

### `(auth)/layout.tsx`

- **Purpose:** Shared auth chrome. Renders `<AuthPageShell>{children}</AuthPageShell>`.
- **Effect:** Removes the duplicated centered-layout markup (`mx-auto flex
min-h-svh max-w-md flex-col justify-center gap-8 p-6`) from `login` and
  `enroll`; pages become thin wrappers.
- **Behavior preserved:** The centered column, headings, and cross-links
  (`/enroll` from `/login`) remain. (Phase 4.)

### Root `app/layout.tsx`

- **Unchanged.** Keeps fonts, `ThemeProvider`, theme script, metadata. No
  audience chrome here (that lives in route-group layouts).

---

## 6. Component refactoring plan

Principle: **move unchanged first; split only where state boundaries justify it.**
Route migration (Phase 2) happens before most splits (Phase 5) so the refactor
stays behavior-preserving and reviewable.

### Move unchanged (Phase 1–2)

These components relocate into their new pages with no internal changes:

- `operations-dashboard.tsx` → `/dashboard`.
- `inventory-overview.tsx` (server component) → `/inventory`.
- `manual-inventory-form.tsx` → `/inventory` (admin).
- `pricing-controls.tsx` → `/pricing`.
- `product-availability.tsx` → `/pricing` (admin).
- `withdrawal-operations.tsx` → `/withdrawals` (admin).
- `agent-management.tsx` → `/agents` (admin).
- `invite-internal-user-form.tsx` → `/operators` (admin).
- `logout-button.tsx` → workspace topbar (layout).
- `inventory/batches/[batchId]/page.tsx` → `(workspace)` (URL stable).

### Assessed for split

#### `withdrawal-operations.tsx` (430 lines)

- **Verdict:** **Move unchanged.** The active-queue cards + recent-outcomes list
  are cohesive, and the `WithdrawalCard` state machine is already an internal
  component. Extracting `WithdrawalCard` to its own file is optional, low-risk
  cleanup (Phase 5 P5-4) but not required. Its local `money`/`formatDate`/
  `networkLabel`/`stateLabel`/`StatusBadge`/`isTerminal` move to `lib/format.ts`
  (money/date) or stay local (state/network labels are withdrawal-specific; keep
  local — do **not** promote to `@workspace/ui`).

#### `pricing-controls.tsx` (264 lines)

- **Verdict:** **Move unchanged.** Already internally decomposed
  (`PricingForm` / `OverrideForm` / `OperationForm`). Replace inline `money()`
  with `lib/format.ts` in Phase 5. Add optional confirm via `Dialog` in Phase 3
  (P3-2) if chosen.

#### `operations-dashboard.tsx` (454 lines)

- **Verdict:** **Move unchanged.** Client component; owns the requeue mutation.
  Replace inline `formatGhs`/`formatDate` in Phase 5. No split.

#### `manual-inventory-form.tsx` (423 lines)

- **Verdict:** **Move unchanged.** The preview/commit state machine is cohesive.
  No split. Optional confirm via `Dialog` in Phase 3 (P3-2).

#### `inventory-overview.tsx` (199 lines)

- **Verdict:** **Move unchanged**, but its exported `formatMoney`/`formatDateTime`
  helpers leave it in Phase 5 (`lib/format.ts`); the batch-detail page's import
  moves to `lib/format.ts` at the same time.

#### `invite-internal-user-form.tsx` (128 lines)

- **Verdict:** **Move unchanged.** Uses raw `<input>`/`<select>`/`<textarea>`
  rather than `@workspace/ui` primitives. Migrating to `@workspace/ui` `Field`/
  `Input`/`NativeSelect` is optional polish (P5-5), not required.

---

## 7. Data and API dependency map

"All endpoints" below are the existing BFF routes under `app/api/`, which proxy
to the Nest API at `DORAF_API_URL`. No existing BFF or backend contract changes.
Only `/api/session` is new (additive).

| Page                           | Server data fetches (existing)                                | Client mutations                                                                            | Auth                                   | Missing APIs (Category C)          |
| ------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------- |
| `/dashboard`                   | `reporting/overview` + `session` (for role-aware quick links) | `POST /api/reporting/requeue-outbox` (inside `OperationsDashboard`)                         | 401 → `/login`                         | none                               |
| `/inventory`                   | `pricing`, `inventory`                                        | `POST /api/inventory` (preview + commit, admin)                                             | 401 → `/login`                         | low-stock thresholds / alerts (D3) |
| `/inventory/batches/[batchId]` | `GET /api/inventory/...`                                      | none                                                                                        | 401 → `/login`; 404 → `notFound()`     | none                               |
| `/pricing`                     | `pricing`                                                     | `POST /api/pricing`, `POST /api/pricing/overrides`, `POST /api/products/[productId]/status` | 401 → `/login`                         | none                               |
| `/withdrawals`                 | `withdrawals`                                                 | `POST /api/withdrawals/[withdrawalId]` (approve/reject/verify/finalize)                     | 401 → `/login`; **403 → `/dashboard`** | none                               |
| `/agents`                      | `pricing` (for `agents` array)                                | `POST /api/agents/[agentId]/status`                                                         | 401 → `/login`; **403 → `/dashboard`** | none                               |
| `/operators`                   | none                                                          | `POST /api/internal-users`                                                                  | 401 → `/login`; **403 → inline error** | none                               |
| `/settings`                    | `session`                                                     | theme (localStorage, client-only)                                                           | 401 → `/login`                         | exports (D4), audit explorer (D5)  |
| `/login` `/enroll`             | none                                                          | passkey ceremonies (POST)                                                                   | **public**                             | none                               |

### Classification

- **Route migration requiring no existing API changes:** all of Phases 1–2.
  Pages call the same BFF routes the dashboard calls today, in different files.
- **UI improvements using existing APIs:** role-aware nav (via the additive
  session endpoint), Dialog confirmations, theme selector, batch back-link —
  all use existing endpoints or client-only state.
- **Additive API work (small, mirrored from the agent app):** `GET
/internal-auth/session` backend route + `app/api/session` BFF route (Phase 1,
  D1). It changes no existing contract.
- **Features requiring new backend support:** audit explorer, exports,
  delivery-failure queue, dispute/refund/reconciliation queues, low-stock
  alerts. Category C — **not** part of the structural refactor.

### 403 handling

- Admin-only pages (`/withdrawals`, `/agents`, `/operators`) fetch
  ADMIN-guarded BFF endpoints. For SUPPORT these return 403. Recommended
  behavior: `/withdrawals` and `/agents` → `redirect("/dashboard")`;
  `/operators` → surface the BFF's inline error (nav already hides the entry
  point). This is defense-in-depth; the backend remains authoritative.

---

## 8. Shared utility cleanup

Goal: one source of truth for formatting and response parsing, without leaking
admin-specific abstractions into `@workspace/ui`.

### `lib/format.ts` (new)

- `formatMoney(value: number | bigint | string, currency = "GHS"): string`
  - Accepts integer **minor units** (pesewas). Handles `number` (pricing/
    inventory), `string` (reporting/withdrawals), and `bigint`.
  - Single Intl implementation:
    `new Intl.NumberFormat("en-GH", { style: "currency", currency,
minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value)
/ 100)`.
  - For GHS this renders `GHS 1,234.56` — identical to the current BigInt
    helpers' output for realistic magnitudes (and identical to the current Intl
    helpers exactly). Safe magnitude: all current data is far below `2^53` minor
    units; the equivalence must be verified visually in Phase 5 (§14 risk:
    formatting drift).
  - `currency` param preserved for inventory acquisition costs
    (`inventory-overview.tsx` currently passes `batch.currency`).
- `formatDateTime(value: string, timeZone = "Africa/Accra"): string`
  - `new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short",
timeZone })`.
  - Canonical tz is `Africa/Accra` (matches `withdrawal-operations.tsx` and the
    product's reporting-period convention). `operations-dashboard.tsx`'s
    `dateStyle: "short"` normalizes to `"medium"` — an intentional, documented
    unification.

### `lib/client-api.ts` (new)

- `readJson(response: Response): Promise<unknown>` — the consolidated copy of the
  passkey forms' helper (parses JSON, extracts `message` on non-ok, throws
  `Error`).
- **Must not** live in `internal-api.ts`: that module is `server-only`, and the
  consumers are client components. Hence a separate non-server-only module.

### Migration

- Replace inline `formatGhs`/`money`/`formatDate`/`formatMoney` in
  `operations-dashboard.tsx`, `withdrawal-operations.tsx`, `pricing-controls.tsx`,
  `inventory-overview.tsx`, and the batch-detail page import.
- Replace inline `readJson` in `passkey-login-form.tsx` and
  `passkey-enrollment-form.tsx`.

### Shared components (stay in-app, not in `@workspace/ui`)

These are admin-app-specific shells, not cross-app primitives, so they live in
`apps/admin/components/_workspace/`, **not** in `@workspace/ui`:

- `PageHeader` — title + description (server component).
- `WorkspaceShell` / `WorkspaceSidebar` / `WorkspaceTopbar` — workspace chrome
  (client).
- `ThemeSelector` — appearance control (client).
- `OperatorIdentityCard` — display-only identity on `/settings`.

### Status badges & labels

- `WithdrawalState`/`StateBadge`/`networkLabel` and the voucher `StateBadge` are
  feature-specific. Keep them local to their components; do **not** promote to
  `@workspace/ui`.

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
- **Validation:** `pnpm --filter admin typecheck`, `lint`, `build`. Manually:
  enroll an operator, log in, view the dashboard, view a batch detail, set a
  price, commit a manual inventory entry, approve a withdrawal (sandbox),
  suspend an agent, invite an operator. Record happy paths.
- **Completion criteria:** All checks pass; manual happy paths documented.

### Phase 1 — Workspace shell, session source, and navigation

- **Objective:** Introduce the `(workspace)` route group, the additive session
  endpoint, layout, persistent role-aware nav, and topbar — **without** moving
  dashboard content out yet. The existing `/dashboard` becomes a child of the
  group and renders inside the new shell; the batch-detail page moves in too
  (URL stable).
- **Changes:**
  1. Add `GET /internal-auth/session` (backend) + `app/api/session/route.ts`
     (BFF) — see P1-1 and §15 D1.
  2. Create `app/(workspace)/layout.tsx` (server): fetch `/api/session`; on 401
     `redirect("/login")`; render `WorkspaceShell` with `operator`
     (`displayName`, `role`).
  3. Create `components/_workspace/workspace-shell.tsx` (client): sidebar +
     topbar + `<main>`; mobile drawer state.
  4. Create `components/_workspace/workspace-sidebar.tsx` (client):
     role-filtered nav; only Dashboard/Inventory/Pricing/Settings live initially
     (all roles); admin items appear in Phase 2.
  5. Create `components/_workspace/workspace-topbar.tsx` (client): breadcrumb,
     operator name + role badge, `LogoutButton`.
  6. Create `components/_workspace/page-header.tsx` (server).
  7. Move `app/dashboard/page.tsx` → `app/(workspace)/dashboard/page.tsx` and
     `app/inventory/batches/[batchId]/page.tsx` →
     `app/(workspace)/inventory/batches/[batchId]/page.tsx` (URLs unchanged;
     content unchanged for now).
  8. Expand `proxy.ts` matcher to all workspace paths (additive paths are safe
     before their pages exist — unauthenticated requests redirect to `/login`).
  9. Delete the leftover empty skeleton dirs (`app/(dashboard)/`, `app/agents/`,
     `app/pricing/`, `app/team/`, `app/withdrawals/`).
- **Files created:** `(workspace)/layout.tsx`, `_workspace/workspace-shell.tsx`,
  `_workspace/workspace-sidebar.tsx`, `_workspace/workspace-topbar.tsx`,
  `_workspace/page-header.tsx`, `api/session/route.ts`,
  `apps/api/.../passkey-auth.controller.ts` (additive route).
- **Files modified:** `proxy.ts`; two page files moved.
- **Files removed:** empty skeleton dirs.
- **Dependencies:** Phase 0.
- **Risks:** The layout's session fetch adds one request per workspace
  navigation (the new `/internal-auth/session`). Moving pages into the group must
  not change URLs or data fetching.
- **Validation:** `/dashboard` renders inside the shell (sidebar + topbar +
  page); unauthenticated → `/login`; role badge shows correct role; sign-out
  works; batch detail still loads at its URL.
- **Completion criteria:** Workspace shell visible on `/dashboard` and batch
  detail; session endpoint returns operator identity + role; all Phase 0 checks
  pass; URLs unchanged.

### Phase 2 — Route decomposition of existing functionality

- **Objective:** Move existing dashboard sections into dedicated pages; slim
  `/dashboard`.
- **Changes (one page per task, in order):**
  1. Create `app/(workspace)/inventory/page.tsx`: fetch `pricing` + `inventory`;
     render `PageHeader` + `InventoryOverview` + `ManualInventoryForm` (when
     `viewerRole === "ADMINISTRATOR"`).
  2. Create `app/(workspace)/pricing/page.tsx`: fetch `pricing`; render
     `PageHeader` + `PricingControls` + `ProductAvailability` (admin).
  3. Create `app/(workspace)/withdrawals/page.tsx`: fetch `withdrawals`; 403 →
     `redirect("/dashboard")`; render `PageHeader` + `WithdrawalOperations`
     (unchanged).
  4. Create `app/(workspace)/agents/page.tsx`: fetch `pricing` (agents array);
     403 → `redirect("/dashboard")`; render `PageHeader` + `AgentManagement`
     (unchanged).
  5. Create `app/(workspace)/operators/page.tsx`: render `PageHeader` +
     `InviteInternalUserForm` (unchanged).
  6. Create `app/(workspace)/settings/page.tsx`: fetch `session`; render
     `PageHeader` + operator identity + reserved sections. (Theme selector added
     in Phase 3.)
  7. Slim `app/(workspace)/dashboard/page.tsx` to overview-only: `PageHeader` +
     `OperationsDashboard` + role-aware quick links. Drop the pricing/inventory/
     withdrawals fetches.
  8. Wire all nav links in `workspace-sidebar.tsx` (add Inventory, Pricing,
     Withdrawals, Agents, Operators, Settings with their `roles`).
- **Files created:** the 6 new page files.
- **Files modified:** `(workspace)/dashboard/page.tsx` (slimmed);
  `workspace-sidebar.tsx`; batch-detail back-link → `/inventory`.
- **Files removed:** none (components reused).
- **Dependencies:** Phase 1.
- **Risks:** Splitting the dashboard's parallel fetches across pages means each
  page fetches its own subset — verify no page drops needed data (e.g., `/agents`
  and `/inventory` both need the pricing payload for `agents`/`products`).
- **Validation:** Each new route loads its data; nav active states correct;
  admin-only pages visible to ADMIN and hidden from SUPPORT; SUPPORT direct URL
  hits redirect to `/dashboard`; pricing save + inventory commit + withdrawal
  OTP flows work; 401 on any workspace page → `/login`.
- **Completion criteria:** All 7 workspace routes exist with focused content;
  dashboard is overview-only; no behavior lost; checks pass.

### Phase 3 — Role-separation polish and sensitive-action confirmation

- **Objective:** Tighten the SUPPORT experience and add explicit confirmation to
  destructive/sensitive actions using the now-available `Dialog` primitive.
- **Changes:**
  1. Verify SUPPORT read-only experience end-to-end: pricing read-only card,
     inventory overview without manual form, no admin nav items, no admin CTAs.
  2. Add `Dialog`-based confirmation to sensitive actions: withdrawal
     approve/reject/finalize, agent suspend/restore, product publish/unpublish,
     inventory commit. Each wraps the existing mutation in a confirm step
     (title + description + reason input where the component already collects a
     reason). Mutations and `router.refresh()` preserved.
  3. Add `ThemeSelector` to `/settings` (writes `localStorage("theme")`, applies
     the class via the existing `applyTheme` logic — export it from
     `theme-provider.tsx` or replicate). The `D` hotkey remains.
  4. Optional: add the theme selector to the topbar popover (mirrors the agent
     workspace).
- **Files created:** `_workspace/theme-selector.tsx`; confirmation subcomponents
  as needed per feature.
- **Files modified:** `withdrawal-operations.tsx`, `agent-management.tsx`,
  `product-availability.tsx`, `manual-inventory-form.tsx` (confirm gates),
  `(workspace)/settings/page.tsx`, `theme-provider.tsx` (export `applyTheme`).
- **Dependencies:** Phase 2.
- **Risks:** Confirm gates must not break the mutation flows or
  `router.refresh()`; Dialog must be keyboard-accessible and focus-managed by the
  existing primitive.
- **Validation:** Each sensitive action requires explicit confirmation; cancel
  aborts; flows complete end-to-end; theme persists across reloads.
- **Completion criteria:** All confirmations work; SUPPORT sees a clean
  read-only workspace; checks pass.

### Phase 4 — Auth route-group extraction

- **Objective:** Shared auth chrome via `(auth)`, mirroring the agent pattern.
- **Changes:**
  - Create `app/(auth)/layout.tsx` rendering `<AuthPageShell>{children}</AuthPageShell>`
    and `components/_auth/auth-page-shell.tsx` (the extracted centered layout).
  - Move `app/login/page.tsx` → `app/(auth)/login/page.tsx`; move
    `app/enroll/page.tsx` → `app/(auth)/enroll/page.tsx`. Pages become thin
    wrappers (drop the duplicated centered markup).
- **Files created:** `(auth)/layout.tsx`, `_auth/auth-page-shell.tsx`.
- **Files modified:** moved page files.
- **Files removed:** old `login/` and `enroll/` page paths (after move).
- **Dependencies:** Phase 2 (workspace settled). Can run in parallel with
  Phase 3.
- **Risks:** Moving public/auth routes must not change URLs or the `?enrolled=`
  banner handling.
- **Validation:** `/login` and `/enroll` render inside the shell; cross-link
  works; proxy behavior unchanged.
- **Completion criteria:** Auth pages share one shell; URLs unchanged.

### Phase 5 — Shared utility and component cleanup

- **Objective:** Consolidate duplicated helpers; optional small splits.
- **Changes:**
  - Create `lib/format.ts` (`formatMoney`, `formatDateTime`) and
    `lib/client-api.ts` (`readJson`).
  - Replace inline `formatGhs`/`money`/`formatDate`/`formatMoney` in
    `operations-dashboard.tsx`, `withdrawal-operations.tsx`, `pricing-controls.tsx`,
    `inventory-overview.tsx`; update the batch-detail page's import to
    `lib/format.ts`.
  - Replace inline `readJson` in both passkey forms with `lib/client-api.ts`.
  - Optional: extract `WithdrawalCard` from `withdrawal-operations.tsx`;
    migrate `invite-internal-user-form.tsx` inputs to `@workspace/ui`.
- **Files created:** `lib/format.ts`, `lib/client-api.ts`.
- **Files modified:** the consumers above.
- **Files removed:** none.
- **Dependencies:** Phase 4 (routes in final positions before rewriting helpers
  across them).
- **Risks:** Formatting drift — verify `formatMoney`/`formatDateTime` render
  identically to today (visual comparison of dashboard, inventory, pricing,
  withdrawal pages).
- **Validation:** Money/timestamps identical before/after; error messages
  identical.
- **Completion criteria:** One money formatter, one date formatter, one
  `readJson`; all checks pass.

### Phase 6 — Missing features (only after scope confirmation)

- **Objective:** Implement Category C features **only after** product-owner
  decisions D3–D5 (§15). Not part of the structural refactor.
- **Changes:** Per confirmed scope. Each feature is its own sub-phase:
  - 6a Audit explorer (`/settings` section + endpoint) — if D5 confirms.
  - 6b Privacy-safe exports (`/settings` request + endpoint) — if D4 unblocks.
  - 6c Delivery-failure / dispute / refund / reconciliation queues (dashboard
    links → dedicated pages + endpoints) — if D3 confirms.
  - 6d Low-stock alerts (`/inventory`) — if D3 confirms.
- **Files:** TBD per feature. Each requires backend work (new admin-facing
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

#### P1-1 Add the internal session endpoint (backend + BFF)

- **Purpose:** Single source of operator identity + role for the workspace shell
  (mirrors the agent app's `GET /agent-auth/session`).
- **Files:** modify
  `apps/api/src/internal-access/passkey-auth.controller.ts`; create
  `apps/admin/app/api/session/route.ts`.
- **Instructions (backend):** Add to `PasskeyAuthController`:
  ```
  @Get('session')
  @UseGuards(InternalSessionGuard)
  session(@CurrentInternalPrincipal() principal: InternalPrincipal) {
    return {
      operator: {
        id: principal.userId,
        displayName: principal.displayName,
        role: principal.role,
      },
    };
  }
  ```
  Import `Get` from `@nestjs/common`. `NoStoreInterceptor` already applies at
  controller level. **Instructions (BFF):** `app/api/session/route.ts` exports
  `GET` that proxies `apiRequest("/internal-auth/session", {}, true)` and returns
  `noStoreJson(await apiJson(response))`, wrapping in try/catch with
  `routeError` (same shape as `app/api/pricing/route.ts`).
- **Prerequisites:** Phase 0.
- **Acceptance:** `GET /internal-auth/session` with a valid Bearer token returns
  `{ operator: { id, displayName, role } }`; without a token returns 401;
  `GET /api/session` returns the same proxied.
- **Tests:** `pnpm --filter api test` (existing suites must pass), plus manual
  curl with the session cookie; `pnpm --filter admin typecheck`.
- **Safe to commit independently:** Yes (additive; nothing consumes it yet).
- **Fallback (only if backend changes are disallowed):** the layout fetches
  `/admin/products/pricing` and derives `viewerRole` (no `displayName`). See §15
  D1.

#### P1-2 Create the workspace sidebar component

- **Purpose:** Persistent role-aware primary navigation (client component).
- **Files:** create `apps/admin/components/_workspace/workspace-sidebar.tsx`.
- **Instructions:** `"use client"` component exporting `WorkspaceSidebar`
  accepting `{ role, mobileOpen, onCloseMobile }`. Define `navItems` with
  `{ href, label, icon, roles: InternalRole[] }`. Initially include Dashboard,
  Inventory, Pricing, Settings (all roles). Filter by `role`. Use `usePathname()`
  with an `isActive` helper (`/dashboard` exact; others prefix). Brand area:
  text "Doraf" + "Administration" label (no image — `apps/admin` has no
  `public/`). Desktop fixed `lg:block w-64`; mobile slide-over drawer with
  backdrop + close button. Use `aria-current="page"`.
- **Prerequisites:** Phase 0.
- **Acceptance:** Renders nav for the given role; active state correct on
  `/dashboard`; mobile drawer toggles.
- **Tests:** Manual; typecheck.
- **Safe to commit independently:** Yes.

#### P1-3 Create the workspace topbar component

- **Purpose:** Shared header with breadcrumb, operator identity, sign-out.
- **Files:** create `apps/admin/components/_workspace/workspace-topbar.tsx`.
- **Instructions:** `"use client"` component exporting `WorkspaceTopbar` taking
  `{ operator, onOpenMobile }` (`operator: { displayName, role }`). Render a
  hamburger (mobile, opens the drawer), a "Workspace / {page}" breadcrumb, the
  operator's displayName + role badge ("Administrator"/"Support"), and the
  existing `LogoutButton`. Keep it minimal (no theme popover until P3-3).
- **Prerequisites:** P1-2.
- **Acceptance:** Header shows identity + role + sign-out; sign-out navigates to
  `/login`.
- **Tests:** Manual.
- **Safe to commit independently:** Yes.

#### P1-4 Create the page-header component

- **Purpose:** Consistent page title + description across workspace pages.
- **Files:** create `apps/admin/components/_workspace/page-header.tsx`.
- **Instructions:** Server component exporting `PageHeader` with
  `{ title, description, actions? }` (same contract as the agent workspace's
  version). Renders `<h1 className="font-heading ...">` + description + optional
  actions.
- **Prerequisites:** none.
- **Acceptance:** Renders title/description/actions.
- **Safe to commit independently:** Yes.

#### P1-5 Create the workspace layout and move the dashboard + batch page

- **Purpose:** Introduce `(workspace)` group layout; relocate `/dashboard` and
  the batch-detail page into it without changing content.
- **Files:** create `apps/admin/app/(workspace)/layout.tsx`; move
  `apps/admin/app/dashboard/page.tsx` →
  `apps/admin/app/(workspace)/dashboard/page.tsx`; move
  `apps/admin/app/inventory/batches/[batchId]/page.tsx` →
  `apps/admin/app/(workspace)/inventory/batches/[batchId]/page.tsx`.
- **Instructions:** `layout.tsx` is a server component: fetch `/api/session` via
  `apiRequest(..., true)`; on 401 `redirect("/login")`; pass `operator`
  (`displayName`, `role`) to `WorkspaceShell`. Keep the moved page files'
  content identical for now (the layout session fetch is additive). The batch
  page keeps its own back-link and `LogoutButton` for this phase (topbar is
  present, so the page `LogoutButton` may be removed here — recommended) and its
  back-link target is updated to `/inventory` only once that page exists (or
  defer to P2).
- **Prerequisites:** P1-1, P1-2, P1-3, P1-4.
- **Acceptance:** `/dashboard` and `/inventory/batches/[batchId]` render inside
  the shell; URLs unchanged; unauthenticated → `/login`; data loads; role badge
  correct.
- **Tests:** Manual + typecheck/build.
- **Safe to commit independently:** Yes (the moves + layout together).

#### P1-6 Expand the proxy matcher

- **Purpose:** Protect all future workspace routes.
- **Files:** modify `apps/admin/proxy.ts`.
- **Instructions:** Replace `protectedPaths` with a `workspacePaths` array
  (dashboard, inventory, pricing, withdrawals, agents, operators, settings);
  keep the identical redirect logic (no-session on any workspace path →
  `/login`). Expand `config.matcher` accordingly (list in §3). Do **not** add an
  authed-user redirect off `/login` (not current behavior).
- **Prerequisites:** P1-5.
- **Acceptance:** Unauthenticated requests to `/pricing` etc. redirect to
  `/login` (until the pages exist in Phase 2 they 404 for authenticated users,
  which is fine — the matcher still runs).
- **Tests:** Manual — hit `/pricing` unauthenticated → redirected to `/login`.
- **Safe to commit independently:** Yes.

#### P1-7 Delete leftover empty skeleton directories

- **Purpose:** Remove aborted-refactor scaffolding.
- **Files:** delete empty dirs `apps/admin/app/(dashboard)/`, `apps/admin/app/
agents/`, `apps/admin/app/pricing/`, `apps/admin/app/team/`,
  `apps/admin/app/withdrawals/`.
- **Prerequisites:** P1-5 (so the real `(workspace)` group is in place).
- **Acceptance:** `apps/admin/app` contains no empty route dirs.
- **Safe to commit independently:** Yes (git won't track empty dirs; nothing
  breaks).

### Phase 2 tasks

#### P2-1 Create the Inventory page

- **Purpose:** Dedicated inventory operations page.
- **Files:** create `apps/admin/app/(workspace)/inventory/page.tsx`.
- **Instructions:** Server component. Fetch `pricing` (`/admin/products/pricing`)
  and `inventory` (`/admin/inventory`) in parallel; 401 → `redirect("/login")`.
  Render `PageHeader` ("Inventory") + `InventoryOverview` + (when
  `viewerRole === "ADMINISTRATOR"`) `ManualInventoryForm products={pricing.products}`.
- **Prerequisites:** P1-6.
- **Acceptance:** `/inventory` loads counts + batches; admin sees manual form;
  SUPPORT does not; empty batch history shows.
- **Tests:** Manual; typecheck.
- **Safe to commit independently:** Yes.

#### P2-2 Create the Pricing page

- **Purpose:** Dedicated pricing editor + availability.
- **Files:** create `apps/admin/app/(workspace)/pricing/page.tsx`.
- **Instructions:** Fetch `pricing`; 401 → redirect. Render `PageHeader` +
  `PricingControls data={pricing}` + (when ADMIN) `ProductAvailability products={pricing.products}`.
- **Prerequisites:** P2-1.
- **Acceptance:** `/pricing` loads; SUPPORT sees read-only card; ADMIN save +
  override + availability work.
- **Tests:** Manual save.
- **Safe to commit independently:** Yes.

#### P2-3 Create the Withdrawals page

- **Purpose:** Dedicated withdrawal operations queue (admin only).
- **Files:** create `apps/admin/app/(workspace)/withdrawals/page.tsx`.
- **Instructions:** Fetch `withdrawals` (`/admin/withdrawals`); 401 → redirect;
  **403 → `redirect("/dashboard")`**. Render `PageHeader` +
  `WithdrawalOperations` (unchanged).
- **Prerequisites:** P2-2.
- **Acceptance:** `/withdrawals` loads queue + recent outcomes for ADMIN; SUPPORT
  is redirected to `/dashboard`; approve/reject/verify/finalize flows work.
- **Tests:** Manual end-to-end (sandbox).
- **Safe to commit independently:** Yes.

#### P2-4 Create the Agents page

- **Purpose:** Dedicated agent management (admin only).
- **Files:** create `apps/admin/app/(workspace)/agents/page.tsx`.
- **Instructions:** Fetch `pricing` (the `agents` array lives in that payload
  today); 401 → redirect; 403 → `redirect("/dashboard")`. Render `PageHeader` +
  `AgentManagement agents={pricing.agents}`.
- **Prerequisites:** P2-3.
- **Acceptance:** `/agents` lists agents; suspend/restore works; SUPPORT
  redirected.
- **Tests:** Manual.
- **Safe to commit independently:** Yes.

#### P2-5 Create the Operators page

- **Purpose:** Dedicated invite-internal-operator page (admin only).
- **Files:** create `apps/admin/app/(workspace)/operators/page.tsx`.
- **Instructions:** Server component (no fetch). Render `PageHeader` +
  `InviteInternalUserForm` (unchanged). Role enforcement is via nav gating +
  the BFF's own 403 (surface as an inline error). 401 protection comes from the
  layout.
- **Prerequisites:** P2-4.
- **Acceptance:** `/operators` shows the form; ADMIN invitation succeeds; SUPPORT
  sees an inline 403 error if they reach the URL directly.
- **Tests:** Manual.
- **Safe to commit independently:** Yes.

#### P2-6 Create the Settings page

- **Purpose:** Operator identity + reserved sections.
- **Files:** create `apps/admin/app/(workspace)/settings/page.tsx`; create
  `apps/admin/components/_workspace/operator-identity-card.tsx`.
- **Instructions:** Fetch `session` (`/api/session`); 401 → redirect. Render
  `PageHeader` + `OperatorIdentityCard` (displayName, role badge, "Passkey"
  sign-in method — display-only) + reserved sections via `Card`/`Separator`:
  Exports ("Not yet available — deferred"), Audit explorer ("Authorized
  administrators only — coming"). Do NOT add the theme selector yet (Phase 3).
- **Prerequisites:** P2-5.
- **Acceptance:** `/settings` shows identity + reserved placeholders; role badge
  correct.
- **Tests:** Manual.
- **Safe to commit independently:** Yes.

#### P2-7 Slim the dashboard to overview-only

- **Purpose:** Make `/dashboard` an overview; remove moved sections.
- **Files:** modify `apps/admin/app/(workspace)/dashboard/page.tsx`.
- **Instructions:** Keep `PageHeader` ("Operations workspace") + `OperationsDashboard`
  (reporting data). Add a role-aware quick-links card (Inventory, Pricing,
  Withdrawals (ADMIN), Agents (ADMIN)) using `/api/session` for the role. Remove
  `InventoryOverview`, `ManualInventoryForm`, `PricingControls`,
  `ProductAvailability`, `WithdrawalOperations`, `AgentManagement`,
  `InviteInternalUserForm`, and the inline header/sign-out. Fetch only
  `reporting` + `session`.
- **Prerequisites:** P2-1 through P2-6 (destinations exist before links).
- **Acceptance:** Dashboard shows overview only; quick links reach working pages;
  no broken references.
- **Tests:** Manual; typecheck.
- **Safe to commit independently:** Yes.

#### P2-8 Wire all nav links

- **Purpose:** Enable the remaining nav items with role filtering.
- **Files:** modify `apps/admin/components/_workspace/workspace-sidebar.tsx`.
- **Instructions:** Add Inventory, Pricing, Withdrawals (ADMIN), Agents (ADMIN),
  Operators (ADMIN), Settings with their `roles`. Update the batch-detail
  back-link to `/inventory`.
- **Prerequisites:** P2-7.
- **Acceptance:** All nav items present; role filtering correct (SUPPORT sees no
  admin items); active states correct.
- **Tests:** Manual per role.
- **Safe to commit independently:** Yes.

### Phase 3 tasks

#### P3-1 Support read-only experience review

- **Purpose:** Confirm SUPPORT cannot mutate anything.
- **Files:** review `(workspace)/inventory/page.tsx`, `(workspace)/pricing/page.tsx`,
  `workspace-sidebar.tsx`.
- **Instructions:** Verify: pricing renders `PricingControls`' read-only branch;
  no `ManualInventoryForm`/`ProductAvailability` for SUPPORT; no admin nav items;
  direct URL to `/withdrawals`/`/agents` redirects. Fix any leaks found.
- **Prerequisites:** P2-8.
- **Acceptance:** A SUPPORT operator sees a fully read-only workspace.
- **Safe to commit independently:** Yes.

#### P3-2 Dialog confirmations for sensitive actions

- **Purpose:** Explicit confirmation before destructive/sensitive commits, using
  the now-available `Dialog` primitive.
- **Files:** modify `withdrawal-operations.tsx` (approve/reject/finalize),
  `agent-management.tsx` (suspend/restore), `product-availability.tsx`
  (publish/unpublish), `manual-inventory-form.tsx` (commit).
- **Instructions:** Wrap each existing mutation trigger in a
  `DialogTrigger`-opened confirm (title + description + the existing reason
  field where one is already collected). Confirming runs the exact existing
  fetch; cancel closes without mutating. Preserve `router.refresh()`, pending
  states, and inline message display. Reuse the primitive's focus/keyboard
  management; do not fork it.
- **Prerequisites:** P2-3/P2-4/P2-2/P2-1.
- **Acceptance:** Every sensitive action requires explicit confirm; cancel
  aborts; flows complete; read-only/disabled states preserved.
- **Tests:** Manual per flow.
- **Safe to commit independently:** Yes (per component).
- **Note:** Optional. If deferred, the refactor still succeeds without it.

#### P3-3 Add a visible theme selector

- **Purpose:** Replace the hidden `D` hotkey as the discoverable control.
- **Files:** create `apps/admin/components/_workspace/theme-selector.tsx`; modify
  `apps/admin/app/(workspace)/settings/page.tsx` (and optionally
  `workspace-topbar.tsx`).
- **Instructions:** `"use client"` with Light/Dark/System options (buttons or
  `NativeSelect`). On change, write `localStorage("theme")` and apply the class
  via the same logic as `theme-provider.tsx`'s `applyTheme` (export `applyTheme`
  from `theme-provider.tsx` and import it, or replicate). System option clears
  the stored value and follows `prefers-color-scheme`. Keep the `D` hotkey
  working.
- **Prerequisites:** P2-6.
- **Acceptance:** Selecting a theme applies + persists across reloads; System
  follows OS; the hotkey still works.
- **Tests:** Manual across reloads.
- **Safe to commit independently:** Yes.

#### P3-4 Update the batch-detail back-link and sign-out

- **Purpose:** Point the batch page at its new home and drop the duplicate
  sign-out.
- **Files:** modify
  `apps/admin/app/(workspace)/inventory/batches/[batchId]/page.tsx`.
- **Instructions:** Change "← Back to operations" → "← Back to inventory" linking
  to `/inventory`. Remove the page's `LogoutButton` (the topbar provides
  sign-out) if not already removed in P1-5.
- **Prerequisites:** P2-1.
- **Acceptance:** Back link navigates to `/inventory`; sign-out in topbar.
- **Safe to commit independently:** Yes.

### Phase 4 tasks

#### P4-1 Create the auth layout and shell

- **Purpose:** Shared auth chrome.
- **Files:** create `apps/admin/app/(auth)/layout.tsx`;
  `apps/admin/components/_auth/auth-page-shell.tsx`.
- **Instructions:** `AuthPageShell` renders the current centered auth column
  (`mx-auto flex min-h-svh max-w-md flex-col justify-center gap-8 p-6`).
  `(auth)/layout.tsx` renders `<AuthPageShell>{children}</AuthPageShell>`.
- **Prerequisites:** Phase 2.
- **Acceptance:** Auth pages render inside the shell.
- **Safe to commit independently:** Yes.

#### P4-2 Move login and enroll pages

- **Purpose:** Thin wrappers; remove duplicated markup.
- **Files:** move `apps/admin/app/login/page.tsx` →
  `apps/admin/app/(auth)/login/page.tsx`; move `apps/admin/app/enroll/page.tsx` →
  `apps/admin/app/(auth)/enroll/page.tsx`.
- **Instructions:** Drop the centered wrapper markup from both pages; keep the
  heading content, the `?enrolled=` banner (login), and the cross-link to
  `/enroll`.
- **Prerequisites:** P4-1.
- **Acceptance:** `/login` and `/enroll` unchanged URLs and behavior.
- **Tests:** Manual login + enrollment.
- **Safe to commit independently:** Yes (moves together).

### Phase 5 tasks

#### P5-1 Consolidate money and date formatting

- **Purpose:** One source of truth.
- **Files:** create `apps/admin/lib/format.ts`; modify
  `operations-dashboard.tsx`, `withdrawal-operations.tsx`, `pricing-controls.tsx`,
  `inventory-overview.tsx`, `(workspace)/inventory/batches/[batchId]/page.tsx`.
- **Instructions:** Implement `formatMoney` (single Intl implementation,
  currency param, §8) and `formatDateTime` (Accra tz, medium + short). Replace
  the inline helpers and the cross-component import (`formatMoney`/`formatDateTime`
  from `inventory-overview`). Remove the now-unused local helpers.
- **Prerequisites:** Phase 4.
- **Acceptance:** All money/date values render identically to before (visual
  comparison).
- **Tests:** Manual comparison + typecheck.
- **Safe to commit independently:** Yes.

#### P5-2 Consolidate readJson

- **Purpose:** One response parser for client components.
- **Files:** create `apps/admin/lib/client-api.ts`; modify
  `passkey-login-form.tsx`, `passkey-enrollment-form.tsx`.
- **Instructions:** Move the identical inline `readJson` to `lib/client-api.ts`;
  replace both copies. Do NOT place it in `internal-api.ts` (server-only).
- **Prerequisites:** P5-1.
- **Acceptance:** Error messages render identically.
- **Safe to commit independently:** Yes.

#### P5-3 (Optional) Extract WithdrawalCard

- **Purpose:** Reduce `withdrawal-operations.tsx` (430 lines).
- **Files:** create `apps/admin/components/withdrawal-card.tsx`; modify
  `withdrawal-operations.tsx`.
- **Instructions:** Move `WithdrawalCard` (the approve/reject/verify/finalize +
  OTP state machine) to its own file, passing `withdrawal` + an `onSettled`/
  `router` refresh callback or leaving the fetch inside. Keep the state labels
  and helpers local to the feature.
- **Prerequisites:** P5-1.
- **Acceptance:** Withdrawal flows identical.
- **Safe to commit independently:** Yes.

#### P5-4 (Optional) Migrate InviteInternalUserForm inputs

- **Purpose:** Use `@workspace/ui` primitives.
- **Files:** modify `apps/admin/components/invite-internal-user-form.tsx`.
- **Instructions:** Swap raw `<input>`/`<select>`/`<textarea>` for
  `Field`/`Input`/`NativeSelect`/`Textarea` from `@workspace/ui`, preserving the
  token-reveal behavior.
- **Prerequisites:** none.
- **Acceptance:** Invitation flow identical.
- **Safe to commit independently:** Yes.

> Phase 6 tasks are not enumerated here because they depend on product-owner
> decisions D3–D5 (§15). Each confirmed feature becomes its own sub-phase
> (6a–6d) with tasks defined at that time. Phase 7 is a review pass, not new
> tasks.

---

## 11. Migration safety

How to avoid regressions in each risk area.

- **Session cookies:** `doraf_internal_session` is unchanged. The layout and
  pages use the existing `apiRequest(..., true)` which reads the cookie
  server-side. No cookie logic changes.
- **Authentication redirects:** `proxy.ts` keeps the same intent (no-session
  workspace path → `/login`). Only the matcher grows. Each workspace page keeps
  the `401 → redirect("/login")` defense-in-depth. After P1-6, verify all
  workspace paths redirect when unauthenticated.
- **Role enforcement:** `proxy.ts` cannot role-filter (opaque token). Role
  gating lives in: (a) the layout session fetch (nav), (b) page-level `403 →
redirect("/dashboard")`, (c) the backend guards. Verify a SUPPORT session
  cannot reach admin-only pages by URL.
- **Middleware/proxy matcher:** must list every workspace segment explicitly
  (route groups don't create URL segments). A `/portal/:path*` alternative is
  rejected (breaks `/dashboard`). Verify with unauthenticated hits to each new
  path.
- **Server/client component boundaries:** Layouts that fetch data are server
  components; `WorkspaceShell`/`WorkspaceSidebar`/`WorkspaceTopbar`/
  `ThemeSelector` and the interactive flows are `"use client"`. Do not introduce
  client-only APIs in server components. `usePathname` is client-only (sidebar).
  `internal-api.ts` is `server-only` — client components must use
  `lib/client-api.ts`.
- **Data dependencies after splitting:** `/agents` and `/inventory` both need
  the pricing payload (`agents`/`products` arrays). `/dashboard` drops those
  fetches. Verify each page fetches its own subset and drops nothing it needs.
- **Dialog confirmations:** the `@workspace/ui` dialog is an existing,
  accessible primitive. Confirm gates must preserve the exact mutation calls and
  `router.refresh()`; cancel must not mutate. Verify keyboard dismissal and
  focus return.
- **Theme:** `ThemeProvider`, the `beforeInteractive` theme script, and the `D`
  hotkey remain. The new `ThemeSelector` (P3-3) uses the same `localStorage`
  key (`"theme"`) and class toggle; it must not fight the hotkey or the system
  listener. Verify light/dark/system across reloads and navigation.
- **Batch detail deep link:** `/inventory/batches/[batchId]` URL is unchanged by
  the `(workspace)` move. No redirect or rewrite is added. The back-link target
  changes to `/inventory` (once that page exists).
- **Loading and error states:** No `loading.tsx`/`error.tsx` are introduced
  (keep current inline behavior). If added later, they must not mask the
  `401 → redirect` or `403 → redirect` paths.
- **Auth pages:** `/login` and `/enroll` URLs unchanged by the `(auth)` group
  move. The `?enrolled=` banner handling and cross-links are preserved.
- **Mobile responsiveness:** the side nav collapses to a drawer on small
  screens (P1-2). Verify each page at mobile widths; ensure no horizontal
  overflow from the new layout.

---

## 12. Testing strategy

The repo has no `apps/admin` test suite (tests live in `apps/api`). This refactor
is primarily structural, so the strategy emphasizes **manual verification +
typecheck/lint/build gates**, with a small set of route-access automated checks
recommended where feasible.

### Automated (run every phase)

- `pnpm --filter admin typecheck` — catches moved imports / broken types.
- `pnpm --filter admin lint` — style/correctness.
- `pnpm --filter admin build` — confirms the route tree compiles and the proxy
  matcher is valid.
- `pnpm --filter api test` — after P1-1 (the additive session endpoint must not
  break existing internal-auth suites; add a unit test for the new handler if a
  pattern exists).

### Recommended automated checks (add if a test harness is introduced)

- Route access: unauthenticated GET to each workspace path returns a redirect to
  `/login`. Authenticated SUPPORT GET to `/withdrawals`, `/agents`, `/operators`
  is blocked (403 → redirect).
- Public route accessibility: `/login` and `/enroll` return 200 (no auth
  redirect).

### Manual checks (per phase, then full matrix in Phase 7)

- **Route access:** hit each workspace route signed-in (as both roles) and
  signed-out.
- **Unauthenticated redirects:** `/dashboard`, `/inventory`, `/pricing`,
  `/withdrawals`, `/agents`, `/operators`, `/settings` → `/login` when no
  cookie.
- **Role behavior:** sign in as SUPPORT — admin nav items absent, `/withdrawals`
  and `/agents` redirect to `/dashboard`, pricing read-only, inventory has no
  manual form. Sign in as ADMIN — everything present.
- **Active navigation states:** each nav item highlights on its route (including
  `/inventory/batches/[batchId]` highlighting Inventory).
- **Mobile navigation:** nav collapses/expands; active state visible; no
  overflow.
- **Page data loading:** each page loads its data; 401 → `/login`; partial
  failures render inline errors (current behavior).
- **Pricing updates:** set a price + override, publish/unpublish a product,
  verify persistence + `router.refresh()`.
- **Inventory commit:** full manual batch preview → commit (admin); SUPPORT
  cannot commit.
- **Withdrawal flow:** approve/reject/verify/finalize + merchant OTP (sandbox);
  verify recent-outcomes updates.
- **Agent management:** suspend with reason; restore; verify audit behavior.
- **Operator invitation:** create an invitation as ADMIN; token shown once;
  SUPPORT attempt fails.
- **Theme:** light/dark/system via the selector (P3-3) and the `D` hotkey;
  persistence across reloads and navigation.
- **Batch detail:** deep link loads at the unchanged URL; back link → `/inventory`.
- **Browser back-button:** navigate Dashboard → Inventory → back returns with
  state preserved (layout persists).
- **Keyboard navigation:** Tab through nav; activate links with Enter; reach
  sign-out; operate Dialog confirms; reach the theme selector.
- **Responsive layouts:** check each page at 360px, 768px, 1280px.

---

## 13. Acceptance criteria for the complete refactor

The refactor is complete when **all** of the following hold (Phases 1–5; Phase 6
items add their own criteria when confirmed):

1. Every major admin task has a dedicated route: Dashboard (overview), Inventory,
   Pricing, Withdrawals, Agents, Operators, Settings.
2. The dashboard is an overview only — it contains no pricing editor, no
   inventory overview/manual form, no withdrawal queue, no agent management, and
   no invite form.
3. Workspace navigation is persistent across all workspace pages, role-aware,
   and responsive (collapses on mobile).
4. Existing inventory, pricing, withdrawal, agent, invitation, and batch-detail
   behavior still works end-to-end (verified by manual happy paths).
5. All URLs are unchanged: `/dashboard`, `/inventory/batches/[batchId]`,
   `/login`, `/enroll`.
6. All authenticated pages enforce session requirements (proxy redirect +
   per-page 401 redirect).
7. SUPPORT operators have a read-only workspace: no admin nav items, no manual
   inventory form, read-only pricing, and direct URL access to admin-only pages
   is blocked. No sensitive action is reachable by SUPPORT.
8. Financial formatting and timestamps are consistent throughout the app (one
   `formatMoney`; one `formatDateTime` with `Africa/Accra`; no inline copies).
9. No major feature is duplicated across pages (pricing, inventory, withdrawals,
   agent management, invitations each live in exactly one primary place).
10. Confirmed-but-unimplemented features (exports, audit explorer, operational
    queues) have deliberate homes in `/settings` with intentional empty states —
    no fake functionality.
11. Sensitive actions (withdrawal decisions, agent suspend/restore, product
    publish/unpublish, inventory commit) require explicit confirmation.
12. `typecheck`, `lint`, and `build` pass for `apps/admin`; `pnpm --filter api
test` passes after P1-1.
13. A visible theme selector exists in Settings; the `D` hotkey still works.
14. The internal session endpoint (`GET /internal-auth/session` + BFF
    `app/api/session`) returns operator identity + role and is the single source
    for the shell's role-aware behavior.

---

## 14. Risk register

| Risk                                                                                         | Likelihood   | Impact | Mitigation                                                                                                                                  | Phase   |
| -------------------------------------------------------------------------------------------- | ------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Moving `dashboard`/batch page into `(workspace)` changes URLs or breaks the root redirect    | Low          | High   | Route groups don't affect URLs; verify `/dashboard` and `/inventory/batches/[batchId]` resolve and `app/page.tsx` redirect target unchanged | P1-5    |
| Proxy matcher misses a new workspace path → unauthenticated access                           | Medium       | High   | List every segment explicitly; manual check hitting each path signed-out; shared `workspacePaths` constant                                  | P1-6    |
| The layout needs a role source but no session endpoint exists                                | High (today) | High   | P1-1 adds `GET /internal-auth/session` (mirrors agent pattern); fallback = reuse pricing `viewerRole` (§15 D1)                              | P1-1    |
| Splitting the dashboard's fetches drops data a page needs (e.g., `agents`/`products` arrays) | Medium       | Medium | Per-page data map (§7); `/inventory` + `/agents` both fetch pricing; verify per page                                                        | P2      |
| SUPPORT reaches an admin-only page or mutation                                               | Medium       | High   | Nav gating + page-level 403 redirect + backend guards; P3-1 review pass                                                                     | P2/P3-1 |
| Dialog confirmations break mutation flows or `router.refresh()`                              | Medium       | Medium | Confirm gate wraps the existing fetch only; cancel never mutates; manual end-to-end per flow                                                | P3-2    |
| `formatMoney`/`formatDateTime` diverge from current output (formatting drift)                | Medium       | Medium | Single Intl implementation; visual comparison before/after; tz canonicalized to `Africa/Accra`                                              | P5-1    |
| Theme selector fights the `D` hotkey / system listener                                       | Low          | Low    | Same `localStorage` key + class toggle; export/reuse `applyTheme`; verify all three modes                                                   | P3-3    |
| `readJson` consolidation changes error message wording                                       | Low          | Low    | Move the exact existing implementation; compare error states                                                                                | P5-2    |
| Backend session endpoint breaks existing internal-auth tests                                 | Low          | Medium | Additive route only; run `pnpm --filter api test`; add a unit test if a pattern exists                                                      | P1-1    |
| Scope creep pulls Category C features into the structural refactor                           | Medium       | Medium | Phases 1–5 explicitly exclude Category C; gate behind decisions D3–D5                                                                       | All     |

---

## 15. Decision log

Decisions requiring product-owner input. Each has a **recommended default**,
clearly marked as a recommendation.

### D1 — Source of operator identity + role for the workspace shell

- **Context:** `apps/api` has no internal session endpoint; the only role source
  today is `viewerRole` inside `GET /admin/products/pricing`. The agent app
  solved this with `GET /agent-auth/session`. `implementation-progress.md`
  already flags "Session-expiry ... coverage" as outstanding.
- **Question:** How should the layout learn the operator's `role` (and name)?
- **Recommended default:** Add `GET /internal-auth/session` (backend, guarded by
  `InternalSessionGuard`, returning `{ operator: { id, displayName, role } }`)
  - BFF `app/api/session`. Additive, mirrors the agent pattern, closes the
    session-identity gap, and avoids loading products+agents on every navigation.
    **Fallback if backend changes are disallowed:** the layout fetches
    `/admin/products/pricing` and derives `viewerRole` (no displayName; heavier).
    **(Recommendation — confirm with product owner.)**

### D2 — How do admin-only pages behave for SUPPORT on direct URL access?

- **Recommended default:** `redirect("/dashboard")` for `/withdrawals` and
  `/agents` (silent, safe); surface the BFF inline 403 error on `/operators`
  (nav already hides it). Either way the backend remains authoritative.
  **(Recommendation.)**

### D3 — Are the operational queues (delivery failures, disputes/refunds,

reconciliation, low-stock alerts) in scope now?

- **Context:** `05-administration-portal.md` and `06-mvp-scope.md` confirm these
  queues as part of the portal; none are implemented; all require backend work.
- **Recommended default:** **Defer.** Reserve them in the dashboard's operations
  summary and `/settings`; implement in Phase 6c/6d after confirmation + backend
  endpoints. Do not add dead nav links. **(Recommendation — confirm.)**

### D4 — Do privacy-safe exports remain deferred?

- **Context:** `implementation-progress.md` (2026-08-02) states exports were
  deferred by product-owner decision.
- **Recommended default:** **Keep deferred**; `/settings` shows "Not yet
  available — deferred". Implement in Phase 6b when unblocked. **(Recommendation
  — confirm.)**

### D5 — Audit explorer scope

- **Context:** Confirmed feature (`05-administration-portal.md`); not
  implemented; requires an audit-search backend.
- **Recommended default:** **Defer**; reserve a `/settings` section ("Authorized
  administrators only — coming"). Implement in Phase 6a. **(Recommendation —
  confirm.)**

### D6 — Route group vs path prefix for the workspace

- **Context:** Route groups keep URLs stable but require listing each path in the
  proxy matcher. A `/portal` prefix simplifies the matcher but changes
  `/dashboard` and `/inventory/batches/[batchId]`.
- **Recommended default:** **Route groups** (`(workspace)`). **(Recommendation.)**

### D7 — Sensitive-action confirmation: Dialog now available

- **Context:** Unlike at agent-plan time, `@workspace/ui` now ships `dialog`.
- **Recommended default:** Use the existing `Dialog` primitive for confirmations
  (P3-2) — no new primitive needed. If product owner prefers no modal changes in
  this refactor, P3-2 is optional and droppable without affecting the structure.
  **(Recommendation.)**

### D8 — Invite-internal-operator placement and roles

- **Context:** The form is currently shown to all roles but the backend is
  ADMIN-only.
- **Recommended default:** Move to `/operators`, ADMIN-only, hidden from SUPPORT
  nav. This closes the documented "Support invitation-authorization coverage"
  gap. **(Recommendation — confirm.)**

### D9 — Settings scope

- **Context:** The admin app has no settings surface today; the agent app's
  settings page (account/security/appearance/legal) is the precedent.
- **Recommended default:** `/settings` = operator identity + appearance (theme
  selector) + reserved sections for exports/audit explorer. No account editing,
  no legal pages. **(Recommendation — confirm.)**

---

## Deliverable summary

### 1. Concise summary of the proposed sequence

1. **Phase 0** — Baseline verification (no source changes).
2. **Phase 1** — Workspace shell + session source + navigation: additive
   `GET /internal-auth/session` + BFF `/api/session`, `(workspace)` layout,
   `_workspace/` sidebar/topbar/page-header, move `/dashboard` + batch detail in,
   expand proxy matcher, delete empty skeleton dirs.
3. **Phase 2** — Route decomposition: create `/inventory`, `/pricing`,
   `/withdrawals`, `/agents`, `/operators`, `/settings`; slim `/dashboard` to
   overview; wire role-aware nav.
4. **Phase 3** — Role-separation polish + sensitive-action Dialog confirmations +
   visible theme selector + batch back-link.
5. **Phase 4** — Auth separation: `(auth)` layout + shell; move `/login` and
   `/enroll`.
6. **Phase 5** — Utility/component cleanup: consolidate `formatMoney`/
   `formatDateTime`/`readJson`; optional `WithdrawalCard` extraction and
   invite-form migration.
7. **Phase 6** — Missing features, only after product-owner decisions D3–D5.
8. **Phase 7** — Final accessibility, responsive, and regression review.

### 2. The first five atomic implementation tasks

1. **P1-1** Add the internal session endpoint (backend `GET /internal-auth/session`
   - BFF `app/api/session`).
2. **P1-2** Create the workspace sidebar component
   (`components/_workspace/workspace-sidebar.tsx`).
3. **P1-3** Create the workspace topbar component
   (`components/_workspace/workspace-topbar.tsx`).
4. **P1-4** Create the page-header component
   (`components/_workspace/page-header.tsx`).
5. **P1-5** Create the workspace layout and move the dashboard + batch page
   (`app/(workspace)/layout.tsx`; move the two page files).

### 3. Blockers that must be resolved before implementation

- **Decision D1** is the only Phase 1 prerequisite decision: approve the additive
  `GET /internal-auth/session` endpoint (recommended) or mandate the no-backend-
  change fallback (reuse pricing `viewerRole`).
- **Product-owner decisions D3–D5** (operational queues, exports, audit
  explorer) are required **before Phase 6**. The structural refactor must not
  silently implement or fake these.
- **D7** (Dialog confirmations) and **D8** (invite placement) affect only
  Phase 3 scope; they can be decided during implementation.

### 4. Recommended first implementation task

**P1-1 — Add the internal session endpoint.** It is additive, mirrors an
existing pattern in the same codebase, has no consumers until P1-5, and unblocks
the role-aware shell — the one structural requirement that differs from the
already-executed agent plan. It also closes the session-identity coverage gap
flagged in `implementation-progress.md`.

---

Status update: This plan is proposed and not yet implemented. No phases have
started.
