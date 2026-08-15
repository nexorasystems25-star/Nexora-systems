# Plan: Branch / Campus Model (D6)

- **Date:** 2026-08-15
- **Spec:** `docs/superpowers/specs/2026-08-15-nexora-branch-model.md`
- **Deferred item:** D6 (from `docs/superpowers/specs/2026-08-15-nexora-access-model-design.md` §10.1)

## Build steps (ordered, each independently testable)

- [x] **1. Migration + schema** — `supabase/migrations/20260815_branch_model.sql` applied
      (live). `branches` table + `branch_id` on `memberships`, `invitations`,
      `cf_members`, `cf_events`, `cf_finance_funds`, `cf_finance_transactions`,
      `cf_checkin_children`, RLS helper `auth_allowed_branch_ids(org_id)`, RLS on
      `branches`. `packages/db/src/schema.ts` updated (`branches`, `membership.branchId`,
      `branchId` on the ChurchFlow entities). Migration applied 2026-08-15.
- [x] **2. Authorization / branch scope** — Implemented in ChurchFlow (where tenant data
      lives), not AICOS: `apps/churchflow/src/lib/branch.ts` resolves allowed branches
      from `memberships`, computes active-branch context from the `cf-active-branch`
      cookie, and `applyBranchFilter` / `branchIdForWrite` scope Supabase queries/writes.
      `auth/me` now returns `branchScope` and handles multiple memberships.
- [x] **3. Branches API (tenant-scoped)** — `apps/churchflow/src/app/api/admin/branches`
      (GET list / POST create, tenant-admin) and `.../branches/[id]` (PATCH / DELETE).
      `apps/churchflow/src/app/api/branch/select` (GET current selection + POST set
      cookie, validated against allowed branches).
- [x] **4. ChurchFlow UI** — `BranchSwitcher` mounted in root layout (top bar); reads
      `/api/branch/select`, posts selection. Branch filter wired into events, finance,
      and check-in/children routes (GET + POST). `apps/churchflow/src/app/(dashboard)/settings/branches/page.tsx`
      provides a full Campuses admin page (list/create/edit/set-primary/delete), linked
      from the sidebar ("Campuses" under CORE) and the `/settings` title map.
- [x] **5. Tests** — `scripts/test-branch-model.ts` (run `npm run test:branch` in
      churchflow; uses `tsx`) validates against the live DB inside a rolled-back
      transaction: branch_id on all 7 tenant tables, `branches` table +
      `auth_allowed_branch_ids(uuid)` helper, the `applyBranchFilter` scoping pattern
      (scoped excludes NULL, org-wide includes all), and the set-primary pattern
      (exactly one primary per org). Rollback migration `20260815_branch_model.down.sql`
      added. ChurchFlow + db packages typecheck clean.
      - *Note:* true RLS isolation tests are moot — ChurchFlow uses the service-role
        client (bypasses RLS); branch scoping is enforced app-side in `lib/branch.ts`.
        `branches` RLS itself is deny-by-default. Impersonation branch scope (support
        plane) is a follow-up (depends on D4 impersonation UI).

## Follow-ups (Phase 2)

- Branches admin page UI (create/edit/delete from settings). — **DONE** (`/settings/branches`).
- Role-assignment scope selector (set `branch_id` on invitations / memberships). — **DONE** for
  memberships: `GET/PATCH/DELETE /api/admin/memberships[/:id]` (tenant-admin gated) + Team page
  `/settings/team` with per-member role + campus-scope `<select>` (org-wide | branch). `invitations.branch_id`
  column exists and is ready but no invitation-create flow exists in ChurchFlow yet; wire when invites ship.
- Billing gating (Multi-campus). — **DONE**. `POST /api/admin/branches` allows the first campus always;
  a 2nd requires the `multi_campus` feature flag enabled for the org's plan (`lib/feature-flags.ts`
  evaluates `feature_flags.enabled` + `allowed_plans` against `subscriptions.plan`; first campus free).
  `GET /api/admin/branches` now returns `branchCount` + `multiCampusEnabled` and the Campuses UI
  proactively disables "+ New Campus" and shows an upgrade banner when gated. **Config needed:** a
  platform admin must create the `multi_campus` flag (e.g. `POST /api/admin/feature-flags`
  `{ name:"multi_campus", enabled:true, allowed_plans:["professional"] }`) — verified absent on GRAG,
  whose live plan is `professional`.
- Cross-branch reporting / roll-ups. — **DONE**. `GET /api/admin/reports/rollup` aggregates finance
  (sum of `amount_pesewas` grouped by branch + type), active members, and events per campus, scoped by
  the caller's branch context (`requestBranchContext` + `applyBranchFilter`, so a single-campus user sees
  only their campus + org-wide-shared records). Reports page (`/reports`) shows consolidated KPI cards +
  a per-campus table with a date range, and respects the top-bar campus selector. Verified live on GRAG.
- Branch templates (copy groups/people on creation). — **DONE (scoped)**. `POST /api/admin/branches`
  accepts `clone_from` (a branch id of the same org); after creating the campus it copies that source
  campus's `cf_finance_funds` rows into the new campus. Groups are org-wide (`cf_groups` has no
  `branch_id`) so they are not cloned per branch; member/people records are intentionally NOT duplicated
  (cloning individuals would create bad duplicate-person data). Campuses UI offers a "Copy setup from"
  dropdown listing existing campuses when creating. Verified the clone INSERT/SELECT + FK on live DB.

## Dependencies

- D4 (tenant-scoped custom roles) — D6 extends the same role table with a scope column.
  Build D4 first or in tandem.
