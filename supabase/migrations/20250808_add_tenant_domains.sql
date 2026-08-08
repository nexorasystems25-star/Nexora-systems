-- ============================================================================
-- ADD TENANT DOMAINS TABLE
-- ============================================================================
-- Purpose: Add domain-to-tenant mapping for multi-product domain architecture.
-- This enables middleware-based tenant resolution from hostname.
-- ============================================================================

-- 1.9 Tenant Domains (domain-to-tenant mapping)
CREATE TABLE IF NOT EXISTS public.tenant_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL UNIQUE,
    product_slug VARCHAR(50) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for tenant_domains
CREATE INDEX IF NOT EXISTS tenant_domains_org_idx ON public.tenant_domains(organization_id);
CREATE INDEX IF NOT EXISTS tenant_domains_product_idx ON public.tenant_domains(product_slug);

-- ============================================================================
-- SEED DATA: GRAG Tenant Domain
-- ============================================================================

-- Insert primary domain for GRAG (Tenant 001)
DO $$
DECLARE
    grag_org_id UUID;
BEGIN
    -- Get GRAG organization ID
    SELECT id INTO grag_org_id FROM public.organizations WHERE slug = 'grag';

    -- Insert tenant domain for GRAG
    IF grag_org_id IS NOT NULL THEN
        INSERT INTO public.tenant_domains (organization_id, domain, product_slug, is_primary)
        VALUES (grag_org_id, 'grag.churchflow.app', 'churchflow', true)
        ON CONFLICT (domain) DO NOTHING;
    END IF;
END $$;

-- ============================================================================
-- DOWN MIGRATION (Uncomment to rollback)
-- ============================================================================
-- DROP TABLE IF EXISTS public.tenant_domains;
