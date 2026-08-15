-- ============================================================================
-- NEXORA BRANCH / CAMPUS MODEL (D6): multi-site support within a ChurchFlow tenant
-- App-layer (JWT + service-role connection) enforces branch scope; RLS is
-- defense-in-depth following the deny-by-default pattern in
-- 20260815_access_model.sql (no Supabase auth -> identities linkage, so
-- "current identity" resolves to NULL inside SQL).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. branches (campuses) -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    address TEXT,
    timezone TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_branches_organization ON public.branches(organization_id);

-- 2. memberships: add branch_id + branch-aware unique constraints ----------
ALTER TABLE public.memberships
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_memberships_branch ON public.memberships(branch_id);

-- One org-wide membership (branch_id IS NULL) per identity+org ...
DROP INDEX IF EXISTS memberships_identity_org_idx;
CREATE UNIQUE INDEX IF NOT EXISTS memberships_identity_org_idx
    ON public.memberships (identity_id, organization_id) WHERE branch_id IS NULL;
-- ... and one membership per branch.
CREATE UNIQUE INDEX IF NOT EXISTS memberships_identity_org_branch_idx
    ON public.memberships (identity_id, organization_id, branch_id) WHERE branch_id IS NOT NULL;

-- 3. ChurchFlow tenant tables: branch-scoped data --------------------------
ALTER TABLE public.cf_members
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cf_members_branch ON public.cf_members(branch_id);

ALTER TABLE public.cf_events
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cf_events_branch ON public.cf_events(branch_id);

ALTER TABLE public.cf_finance_funds
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cf_finance_funds_branch ON public.cf_finance_funds(branch_id);

ALTER TABLE public.cf_finance_transactions
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cf_finance_transactions_branch ON public.cf_finance_transactions(branch_id);

-- People / check-in (children are tagged to the branch they attend)
ALTER TABLE public.cf_checkin_children
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cf_checkin_children_branch ON public.cf_checkin_children(branch_id);

-- 4. invitations: optional branch scope -------------------------------------
ALTER TABLE public.invitations
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_branch ON public.invitations(branch_id);

-- 5. RLS helper stub: branch ids the current identity may access ----------
CREATE OR REPLACE FUNCTION public.auth_allowed_branch_ids(target_org UUID)
RETURNS UUID[]
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    -- Returns empty for direct/anon SQL (deny-by-default). The application
    -- resolves the caller's allowed branch_ids from the membership set and
    -- applies the filter in code, since current_identity_id() is NULL here.
    SELECT '{}'::UUID[]
$$;

-- 6. enable RLS on branches (defense-in-depth; app enforces scope) --------
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "branches_tenant_or_platform" ON public.branches;
CREATE POLICY "branches_tenant_or_platform" ON public.branches
    FOR ALL USING (
        public.is_platform_user()
        OR public.has_org_access(organization_id)
    );
