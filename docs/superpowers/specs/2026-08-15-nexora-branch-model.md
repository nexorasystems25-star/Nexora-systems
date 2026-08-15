# Branch / Campus Model for ChurchFlow Tenants — Design Spec

- **Date:** 2026-08-15
- **Status:** Spec (ready to plan → build)
- **Parent:** `docs/superpowers/specs/2026-08-15-nexora-access-model-design.md` §10.1 (deferred item D6)
- **Related:** D4 (tenant-scoped custom roles), billing "Multi-campus" feature flag

## 1. Purpose

Allow a ChurchFlow tenant (organization) to operate multiple **branches / campuses**
(locations, congregations) with **branch-scoped data** and **branch-scoped role
assignments**, without fragmenting into separate tenants.

> Naming: the user-facing label is **Campus** (matches the billing "Multi-campus"
> flag); the internal/column key is `branch`.

## 2. Scope

**In scope (D6):**
- Platform/access layer: `branches` table, `branch_id` on tenant-plane `memberships`,
  branch scope on tenant roles (D4).
- ChurchFlow product data: people, attendance, events, finance, groups, welfare rows
  carry `branch_id` (NULL = org-wide). Detailed column placement lives in the
  ChurchFlow product schema; referenced here, implemented within ChurchFlow.

**Out of scope for D6:**
- Cross-tenant (multi-church) structures — that is the org/tenant boundary already in
  place. D6 is *within* a single tenant.
- Denominational / diocesan roll-ups across tenants (that is D2 Founder oversight at the
  platform plane, a different concern).

## 3. Data model

### 3.1 `branches`
| column | type | notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `organization_id` | uuid not null | FK `organizations(id)` on delete cascade |
| `name` | text not null | e.g. "Main Campus", "North Campus" |
| `slug` | text not null | unique per org |
| `address` | jsonb / text | location details |
| `timezone` | text | local timezone for services/events |
| `is_primary` | boolean | default false; one primary per org |
| `created_at` | timestamptz | default now() |

Unique: `(organization_id, slug)`.

### 3.2 Tenant-plane `memberships` (access scoping)
Add `branch_id uuid null references branches(id) on delete set null`.
- `branch_id IS NULL` → role is **org-wide**.
- `branch_id IS NOT NULL` → role is **scoped to that branch**.
- A user may hold multiple membership rows (e.g. org-wide `admin` + branch-scoped
  `finance`), exactly as today's additive role model.

### 3.3 Tenant data rows
Add nullable `branch_id uuid` (FK `branches(id)`, default null) to the relevant
ChurchFlow tables (people, attendance, events, finance batches, groups, welfare cases).
`NULL` = org-wide record.

## 4. Access control

- Branch scope is a **tenant-plane** dimension that composes with the three-plane model;
  it never crosses the tenant boundary.
- Tenant permission resolution collects the requesting user's memberships; for each
  tenant data query, rows are filtered to the set of `branch_id`s the user is authorized
  for (org-wide membership ⇒ all branches).
- **Tenant Admin** (tier 5) assigns branch-scoped roles via the D4 tenant role table,
  extended with a `branch_id` / scope selector (org-wide | specific branch).
- **Support plane** cross-tenant impersonation may target a branch scope for finer
  granularity and tighter audit.

## 5. RLS

- Tenant tables filtered by `branch_id` ∈ `auth_allowed_branch_ids(org_id)` (helper
  reading the caller's memberships). Org-wide membership yields all branches.
- `branches` itself is tenant-scoped (FK `organization_id`); only tenant members see
  their org's branches.

## 6. Migration

`supabase/migrations/20260815_branch_model.sql` (or next dated file):
- `create table branches (...)`.
- `alter table memberships add column branch_id ...`.
- `alter table <churchflow tables> add column branch_id ...` with indexes.
- RLS helper `auth_allowed_branch_ids(org_id uuid)` + policies.

## 7. ChurchFlow UI

- **Branch switcher** in the top bar: "All campuses" + each branch.
- **Admin → Branches**: create / edit / set primary / deactivate.
- **Admin → Roles**: assign a role with scope = org-wide or a specific branch.
- Branch context reflected in lists, dashboards, and reporting.

## 8. Open questions

1. UI label "Campus" vs "Branch" — recommend **Campus** (billing already says
   "Multi-campus").
2. Branch creation: auto-copy groups/people from primary, or start empty? (Phase 2.)
3. Cross-branch reporting / roll-ups — Phase 2.

## 9. Acceptance criteria

- A tenant can create ≥ 1 branches; tenant data is isolatable per branch.
- A role can be assigned org-wide **or** per-branch; access is enforced via RLS.
- The branch switcher shows only data the user is scoped for.
- Support impersonation can be scoped to a single branch.
