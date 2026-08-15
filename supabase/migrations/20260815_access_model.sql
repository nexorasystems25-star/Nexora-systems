-- ============================================================================
-- NEXORA ACCESS MODEL: three-plane access + support system backing tables
-- (defense-in-depth; app enforces scope via the auth-token JWT + service role)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. product_memberships ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    identity_id UUID NOT NULL REFERENCES public.identities(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'product_support',
    granted_by UUID REFERENCES public.identities(id),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, identity_id)
);
CREATE INDEX IF NOT EXISTS idx_product_memberships_product ON public.product_memberships(product_id);
CREATE INDEX IF NOT EXISTS idx_product_memberships_identity ON public.product_memberships(identity_id);

-- 2. platform_staff ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id UUID NOT NULL REFERENCES public.identities(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'support',
    permissions JSONB DEFAULT '[]',
    granted_by UUID REFERENCES public.identities(id),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(identity_id)
);
CREATE INDEX IF NOT EXISTS idx_platform_staff_identity ON public.platform_staff(identity_id);

-- 3. support_ticket_messages -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    author_identity_id UUID REFERENCES public.identities(id),
    author_scope TEXT NOT NULL,
    body TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON public.support_ticket_messages(ticket_id);

-- 4. impersonation_sessions ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_identity_id UUID NOT NULL REFERENCES public.identities(id) ON DELETE CASCADE,
    staff_scope TEXT NOT NULL,
    target_organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    reason TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_staff ON public.impersonation_sessions(staff_identity_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_target ON public.impersonation_sessions(target_organization_id);

-- 5. extend support_tickets -------------------------------------------------
ALTER TABLE public.support_tickets
    ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id),
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS product_area TEXT,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.identities(id),
    ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_support_tickets_product ON public.support_tickets(product_id);

-- 6. extend audit_events ----------------------------------------------------
ALTER TABLE public.audit_events
    ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id),
    ADD COLUMN IF NOT EXISTS actor_scope TEXT,
    ADD COLUMN IF NOT EXISTS impersonated_by UUID REFERENCES public.identities(id);
CREATE INDEX IF NOT EXISTS idx_audit_events_product ON public.audit_events(product_id);

-- 7. RLS helper stubs. The application layer (auth-token JWT + service-role
--    connection, which bypasses RLS) is the authoritative access enforcement.
--    This schema has no Supabase auth.uid() -> identities linkage, so "current
--    identity" cannot be resolved inside SQL. These helpers therefore default
--    to deny for direct/anon Supabase access (defense-in-depth), which is safe
--    because every app query runs as the admin/service role that bypasses RLS.
CREATE OR REPLACE FUNCTION public.current_identity_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT NULL::UUID
$$;

CREATE OR REPLACE FUNCTION public.is_platform_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT false
$$;

CREATE OR REPLACE FUNCTION public.has_org_access(target_org UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT false
$$;

-- Is the current identity a product super-admin for target_product?
-- Resolves the current identity via the deny-by-default helper above, since
-- there is no Supabase auth linkage in this schema.
CREATE OR REPLACE FUNCTION public.is_product_superadmin(target_product UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.product_memberships pm
        WHERE pm.identity_id = public.current_identity_id()
          AND pm.product_id = target_product
          AND pm.status = 'active'
          AND pm.role IN ('product_owner', 'product_admin')
    )
$$;

-- 8. RLS helper: can the current Supabase auth user impersonate a tenant? ---
CREATE OR REPLACE FUNCTION public.can_impersonate(target_org UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.impersonation_sessions s
        WHERE s.staff_identity_id = public.current_identity_id()
          AND s.target_organization_id = target_org
          AND s.ended_at IS NULL
          AND s.expires_at > NOW()
    ) OR public.is_platform_user()
$$;

-- 9. enable RLS on new tables (defense-in-depth for anon/direct access) -----
ALTER TABLE public.product_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- 10. policies: only platform users / product super-admins can read/write --
DROP POLICY IF EXISTS "pm_platform_or_product_admin" ON public.product_memberships;
CREATE POLICY "pm_platform_or_product_admin" ON public.product_memberships
    FOR ALL USING (
        public.is_platform_user()
        OR public.is_product_superadmin(product_id)
    );

DROP POLICY IF EXISTS "ps_platform_only" ON public.platform_staff;
CREATE POLICY "ps_platform_only" ON public.platform_staff
    FOR ALL USING (public.is_platform_user());

DROP POLICY IF EXISTS "stm_ticket_access" ON public.support_ticket_messages;
CREATE POLICY "stm_ticket_access" ON public.support_ticket_messages
    FOR ALL USING (
        public.is_platform_user()
        OR public.is_product_superadmin(
            (SELECT product_id FROM public.support_tickets t WHERE t.id = ticket_id)
        )
        OR public.has_org_access(
            (SELECT organization_id FROM public.support_tickets t WHERE t.id = ticket_id)
        )
    );

DROP POLICY IF EXISTS "imp_staff_only" ON public.impersonation_sessions;
CREATE POLICY "imp_staff_only" ON public.impersonation_sessions
    FOR ALL USING (
        staff_identity_id = public.current_identity_id()
        OR public.is_platform_user()
    );
