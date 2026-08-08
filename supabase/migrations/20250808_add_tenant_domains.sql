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
