# Design Spec: Multi-Product Domain Architecture

**Date:** 2026-08-08  
**Status:** Approved  
**Approach:** Option A — Middleware-based tenant resolution  

---

## 1. Purpose

Enable each Nexora product (ChurchFlow, School Suite, Counseling, Susu) to operate on its own domain, with clients accessing their tenant via subdomain or custom domain. Tenant identity is resolved from the hostname, not the URL path.

## 2. Current State

- No `/church` route exists in the churchflow app
- Dashboard is hardcoded to "GRAG Church"
- `organizations` table has `slug` field but no domain mapping
- No mechanism to resolve tenant from hostname

## 3. Target Architecture

```
NEXORA SYSTEMS (Company)
├── AICOS (Operating System)
├── PRODUCTS (each with own domain)
│   ├── ChurchFlow → churchflow.app
│   ├── School Suite → schoolsuite.app
│   ├── Counseling → counseling.app
│   └── Susu → susu.app
└── CLIENTS (tenant options)
    ├── Subdomain: grag.churchflow.app
    ├── Custom domain: gragchurch.com
    └── Path fallback: churchflow.app/church/grag
```

## 4. Tenant Resolution Strategy

Tenant is resolved from the **hostname** in middleware:

```
Request: https://grag.churchflow.app/dashboard
         └─┬──┘ └────┬────┘
         subdomain   product domain
              │
              └─→ lookup: tenant_domains WHERE domain = "grag.churchflow.app"
                    │
                    └─→ load organization by organization_id
```

### Resolution Priority

1. **Exact domain match** — Check `tenant_domains` table for hostname
2. **Subdomain extraction** — Extract subdomain from product base domain, lookup by slug
3. **Path-based fallback** — Check `/church/[slug]`, `/school/[slug]`, etc.
4. **No match** — Return 404

## 5. Database Schema

### New Table: `tenant_domains`

```sql
CREATE TABLE tenant_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL,
  product_slug VARCHAR(50) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX tenant_domains_domain_idx ON tenant_domains(domain);
CREATE INDEX tenant_domains_org_idx ON tenant_domains(organization_id);
CREATE INDEX tenant_domains_product_idx ON tenant_domains(product_slug);
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | References `organizations.id` |
| `domain` | VARCHAR(255) | Full hostname (e.g., `grag.churchflow.app` or `gragchurch.com`) |
| `product_slug` | VARCHAR(50) | Product identifier (`churchflow`, `school-suite`, etc.) |
| `is_primary` | BOOLEAN | Whether this is the primary domain for the tenant |
| `verified_at` | TIMESTAMP | When DNS verification completed (null if pending) |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

## 6. Domain Configuration

### Product Base Domains

```typescript
// packages/config/src/domains.ts
export const PRODUCT_DOMAINS: Record<string, string> = {
  churchflow: "churchflow.app",
  "school-suite": "schoolsuite.app",
  counseling: "counseling.app",
  susu: "susu.app",
};
```

### Auto-Created Subdomains

When a new tenant signs up for a product, a subdomain is automatically created:

```
Organization: GRAG Church
Product: ChurchFlow
Slug: grag
Auto-created domain: grag.churchflow.app
```

## 7. Middleware Implementation

### File: `apps/churchflow/src/middleware.ts`

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PRODUCT_BASE_DOMAIN = "churchflow.app";
const publicPaths = ["/login", "/register", "/forgot-password", "/api/auth"];
const ownerPaths = ["/owner"];

const JWT_SECRET_RAW = process.env.JWT_SECRET;
const jwtSecret = JWT_SECRET_RAW
  ? new TextEncoder().encode(JWT_SECRET_RAW)
  : null;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;

  // Skip resolution for public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Resolve tenant from hostname
  const tenantSlug = resolveTenantFromHostname(hostname);

  if (tenantSlug) {
    // Set tenant context in headers
    const response = NextResponse.next();
    response.headers.set("x-tenant-slug", tenantSlug);
    response.headers.set("x-product-slug", "churchflow");
    return response;
  }

  // Path-based fallback: /church/[slug]
  const churchMatch = pathname.match(/^\/church\/([^\/]+)/);
  if (churchMatch) {
    const response = NextResponse.next();
    response.headers.set("x-tenant-slug", churchMatch[1]);
    response.headers.set("x-product-slug", "churchflow");
    return response;
  }

  // No tenant found
  return NextResponse.next();
}

function resolveTenantFromHostname(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(":")[0];

  // Check if it's a subdomain of the product domain
  if (host.endsWith(`.${PRODUCT_BASE_DOMAIN}`)) {
    return host.replace(`.${PRODUCT_BASE_DOMAIN}`, "");
  }

  // Check if it's the product domain itself (no tenant)
  if (host === PRODUCT_BASE_DOMAIN) {
    return null;
  }

  // Custom domain — would need DB lookup in production
  // For now, return null and let path-based fallback handle it
  return null;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### Notes

- The `resolveTenantFromHostname` function is synchronous for subdomain extraction
- Custom domain resolution requires async DB lookup — handled in a separate middleware layer or at the API route level
- The `x-tenant-slug` header is read by downstream pages and API routes

## 8. Tenant Resolution Helper

### File: `packages/auth/src/tenant.ts`

```typescript
import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import { organizations, tenantDomains } from "../../db/schema-platform";

export interface TenantContext {
  organizationId: string;
  slug: string;
  name: string;
  productSlug: string;
}

export async function resolveTenantFromDomain(
  domain: string
): Promise<TenantContext | null> {
  const db = await getDb();

  // Look up domain in tenant_domains table
  const [tenantDomain] = await db
    .select()
    .from(tenantDomains)
    .where(eq(tenantDomains.domain, domain))
    .limit(1);

  if (!tenantDomain) return null;

  // Load organization
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, tenantDomain.organizationId))
    .limit(1);

  if (!org || org.status !== "active") return null;

  return {
    organizationId: org.id,
    slug: org.slug,
    name: org.name,
    productSlug: tenantDomain.productSlug,
  };
}

export async function resolveTenantFromSlug(
  slug: string,
  productSlug: string
): Promise<TenantContext | null> {
  const db = await getDb();

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org || org.status !== "active") return null;

  return {
    organizationId: org.id,
    slug: org.slug,
    name: org.name,
    productSlug,
  };
}
```

## 9. Custom Domain Flow

1. Client purchases custom domain (e.g., `gragchurch.com`)
2. Client adds CNAME record: `gragchurch.com → cname.vercel-dns.com`
3. Platform verifies DNS via API call
4. Domain added to `tenant_domains` table with `verified_at` timestamp
5. All requests to `gragchurch.com` resolve to GRAG's tenant

### DNS Verification

```typescript
import dns from "dns";

export async function verifyDomain(domain: string): Promise<boolean> {
  return new Promise((resolve) => {
    dns.resolveCname(domain, (err, addresses) => {
      if (err) return resolve(false);
      // Check if CNAME points to our platform
      const expected = cname.vercel-dns.com";
      resolve(addresses.some((addr) => addr === expected));
    });
  });
}
```

## 10. Subdomain Flow

1. Client signs up for ChurchFlow (e.g., GRAG)
2. Auto-created subdomain: `grag.churchflow.app`
3. Domain added to `tenant_domains` table automatically
4. All requests to `grag.churchflow.app` resolve to GRAG

### Auto-Creation Logic

```typescript
// In onboarding route
await db.insert(tenantDomains).values({
  organizationId: org.id,
  domain: `${slug}.${PRODUCT_DOMAINS.churchflow}`,
  productSlug: "churchflow",
  isPrimary: true,
  verifiedAt: new Date().toISOString(), // Subdomains don't need DNS verification
});
```

## 11. Path-Based Fallback

For clients who don't configure custom domain or subdomain:

```
churchflow.app/church/grag → resolves to GRAG tenant
churchflow.app/church/grag/dashboard → GRAG dashboard
```

This is handled by the middleware's path matching:

```typescript
const churchMatch = pathname.match(/^\/church\/([^\/]+)/);
if (churchMatch) {
  // Set tenant context from URL path
}
```

## 12. API Route Tenant Resolution

API routes need to resolve tenant from headers set by middleware:

```typescript
// In API routes
export async function GET(request: Request) {
  const tenantSlug = request.headers.get("x-tenant-slug");
  if (!tenantSlug) {
    return apiJson({ error: "No tenant context" }, 400);
  }

  const tenant = await resolveTenantFromSlug(tenantSlug, "churchflow");
  if (!tenant) {
    return apiJson({ error: "Tenant not found" }, 404);
  }

  // Use tenant.organizationId for all queries
}
```

## 13. Error Handling

| Scenario | Behavior |
|----------|----------|
| Unknown subdomain | Redirect to product landing page |
| Unknown custom domain | 404 page |
| Suspended organization | "Organization unavailable" page |
| Path-based with unknown slug | Custom 404 |
| No tenant in API route | 400 error |

## 14. Testing

| Test Case | Expected Result |
|-----------|-----------------|
| `GET https://grag.churchflow.app/` | Renders GRAG's public page |
| `GET https://grag.churchflow.app/dashboard` | Renders GRAG's dashboard |
| `GET https://unknown.churchflow.app/` | Redirects to churchflow.app |
| `GET https://churchflow.app/church/grag` | Renders GRAG's public page |
| `GET https://churchflow.app/church/unknown` | Custom 404 |
| `GET https://gragchurch.com/` | Renders GRAG's public page (after DNS setup) |

## 15. Migration Plan

1. Add `tenant_domains` table to schema
2. Create migration SQL
3. Seed GRAG's subdomain: `grag.churchflow.app`
4. Update middleware with domain resolution
5. Add tenant resolution helper to auth package
6. Test with subdomain, custom domain, and path-based access

## 16. Future Enhancements

- **Domain management UI** — Admin interface for managing tenant domains
- **Automatic SSL certificates** — Let's Encrypt integration for custom domains
- **Domain redirects** — Redirect old domains to new ones
- **Domain analytics** — Track which domains are used most
- **Wildcard SSL** — Single certificate for all subdomains
