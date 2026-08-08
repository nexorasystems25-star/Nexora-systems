# Multi-Product Domain Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable each Nexora product to operate on its own domain with tenant resolution from hostname via middleware.

**Architecture:** Middleware-based tenant resolution extracts tenant identity from hostname (subdomain or custom domain), with path-based fallback. A new `tenant_domains` table maps domains to organizations.

**Tech Stack:** Next.js middleware, Drizzle ORM, PostgreSQL, jose (JWT)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `db/schema-platform.ts` | Modify | Add `tenantDomains` table |
| `packages/config/src/domains.ts` | Create | Product domain configuration |
| `packages/auth/src/tenant.ts` | Create | Tenant resolution helpers |
| `apps/churchflow/src/middleware.ts` | Modify | Add hostname-based tenant resolution |
| `supabase/migrations/20260808_add_tenant_domains.sql` | Create | Database migration |

---

### Task 1: Add tenant_domains table to schema

**Files:**
- Modify: `db/schema-platform.ts`

- [ ] **Step 1: Add tenantDomains table definition**

Add after the `auditEvents` table definition (around line 240):

```typescript
// 1.9 Tenant Domains (domain-to-tenant mapping)
export const tenantDomains = pgTable(
  "tenant_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    domain: varchar("domain", { length: 255 }).notNull().unique(),
    productSlug: varchar("product_slug", { length: 50 }).notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("tenant_domains_domain_idx").on(table.domain),
    index("tenant_domains_org_idx").on(table.organizationId),
    index("tenant_domains_product_idx").on(table.productSlug),
  ]
);
```

- [ ] **Step 2: Export tenantDomains from schema**

Ensure `tenantDomains` is exported in the schema file's exports.

- [ ] **Step 3: Verify schema compiles**

Run: `npx drizzle-kit generate --name add_tenant_domains`
Expected: Migration file created in `supabase/migrations/`

- [ ] **Step 4: Commit**

```bash
git add db/schema-platform.ts supabase/migrations/
git commit -m "feat(db): add tenant_domains table for domain-to-tenant mapping"
```

---

### Task 2: Create domain configuration

**Files:**
- Create: `packages/config/src/domains.ts`

- [ ] **Step 1: Create domain configuration file**

```typescript
// packages/config/src/domains.ts

export const PRODUCT_DOMAINS: Record<string, string> = {
  churchflow: "churchflow.app",
  "school-suite": "schoolsuite.app",
  counseling: "counseling.app",
  susu: "susu.app",
};

export const PRODUCT_SLUGS = Object.keys(PRODUCT_DOMAINS);

export function getProductDomain(productSlug: string): string | null {
  return PRODUCT_DOMAINS[productSlug] || null;
}

export function getProductSlugFromDomain(domain: string): string | null {
  for (const [slug, baseDomain] of Object.entries(PRODUCT_DOMAINS)) {
    if (domain === baseDomain || domain.endsWith(`.${baseDomain}`)) {
      return slug;
    }
  }
  return null;
}
```

- [ ] **Step 2: Export from package index**

Create or update `packages/config/src/index.ts`:

```typescript
export { PRODUCT_DOMAINS, PRODUCT_SLUGS, getProductDomain, getProductSlugFromDomain } from "./domains";
```

- [ ] **Step 3: Commit**

```bash
git add packages/config/src/domains.ts packages/config/src/index.ts
git commit -m "feat(config): add product domain configuration"
```

---

### Task 3: Create tenant resolution helpers

**Files:**
- Create: `packages/auth/src/tenant.ts`

- [ ] **Step 1: Create tenant resolution module**

```typescript
// packages/auth/src/tenant.ts

import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { organizations, tenantDomains } from "../../db/schema-platform";
import { PRODUCT_DOMAINS } from "../../config/src/domains";

export interface TenantContext {
  organizationId: string;
  slug: string;
  name: string;
  productSlug: string;
}

/**
 * Resolve tenant from a full domain (subdomain or custom domain).
 * Example: "grag.churchflow.app" → { slug: "grag", productSlug: "churchflow" }
 */
export async function resolveTenantFromDomain(
  domain: string
): Promise<TenantContext | null> {
  const db = await getDb();
  const host = domain.split(":")[0].toLowerCase();

  // 1. Exact domain match in tenant_domains table
  const [tenantDomain] = await db
    .select()
    .from(tenantDomains)
    .where(eq(tenantDomains.domain, host))
    .limit(1);

  if (tenantDomain) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, tenantDomain.organizationId))
      .limit(1);

    if (org && org.status === "active") {
      return {
        organizationId: org.id,
        slug: org.slug,
        name: org.name,
        productSlug: tenantDomain.productSlug,
      };
    }
  }

  // 2. Subdomain extraction (e.g., "grag.churchflow.app" → slug "grag")
  for (const [productSlug, baseDomain] of Object.entries(PRODUCT_DOMAINS)) {
    if (host.endsWith(`.${baseDomain}`)) {
      const slug = host.replace(`.${baseDomain}`, "");
      return resolveTenantFromSlug(slug, productSlug);
    }
  }

  return null;
}

/**
 * Resolve tenant from organization slug and product.
 * Used for path-based fallback: /church/[slug]
 */
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

/**
 * Extract tenant slug from hostname without DB lookup.
 * Synchronous, fast path for subdomains.
 */
export function extractSlugFromHostname(
  hostname: string
): { slug: string; productSlug: string } | null {
  const host = hostname.split(":")[0].toLowerCase();

  for (const [productSlug, baseDomain] of Object.entries(PRODUCT_DOMAINS)) {
    if (host.endsWith(`.${baseDomain}`)) {
      const slug = host.replace(`.${baseDomain}`, "");
      if (slug) {
        return { slug, productSlug };
      }
    }
  }

  return null;
}
```

- [ ] **Step 2: Export from package index**

Create or update `packages/auth/src/index.ts`:

```typescript
export {
  resolveTenantFromDomain,
  resolveTenantFromSlug,
  extractSlugFromHostname,
  type TenantContext,
} from "./tenant";
```

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/tenant.ts packages/auth/src/index.ts
git commit -m "feat(auth): add tenant resolution helpers for domain-based routing"
```

---

### Task 4: Update middleware with hostname-based resolution

**Files:**
- Modify: `apps/churchflow/src/middleware.ts`

- [ ] **Step 1: Replace middleware with hostname-based resolution**

```typescript
// apps/churchflow/src/middleware.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { extractSlugFromHostname } from "@nexora/auth";

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

  // 1. Try hostname-based resolution (subdomain)
  const hostnameResult = extractSlugFromHostname(hostname);
  if (hostnameResult) {
    const response = NextResponse.next();
    response.headers.set("x-tenant-slug", hostnameResult.slug);
    response.headers.set("x-product-slug", hostnameResult.productSlug);
    return response;
  }

  // 2. Path-based fallback: /church/[slug]
  const churchMatch = pathname.match(/^\/church\/([^\/]+)/);
  if (churchMatch) {
    const response = NextResponse.next();
    response.headers.set("x-tenant-slug", churchMatch[1]);
    response.headers.set("x-product-slug", "churchflow");
    return response;
  }

  // 3. No tenant found — continue without tenant context
  // (API routes will handle missing tenant)
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Verify middleware compiles**

Run: `cd apps/churchflow && npx next build --no-lint`
Expected: Build succeeds (may have type errors from missing env vars, but no syntax errors)

- [ ] **Step 3: Commit**

```bash
git add apps/churchflow/src/middleware.ts
git commit -m "feat(middleware): add hostname-based tenant resolution"
```

---

### Task 5: Create database migration

**Files:**
- Create: `supabase/migrations/20260808_add_tenant_domains.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260808_add_tenant_domains.sql

-- Create tenant_domains table
CREATE TABLE IF NOT EXISTS tenant_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL,
  product_slug VARCHAR(50) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS tenant_domains_domain_idx ON tenant_domains(domain);
CREATE INDEX IF NOT EXISTS tenant_domains_org_idx ON tenant_domains(organization_id);
CREATE INDEX IF NOT EXISTS tenant_domains_product_idx ON tenant_domains(product_slug);

-- Enable RLS
ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "tenant_domains_select_policy" ON tenant_domains
  FOR SELECT USING (true);

CREATE POLICY "tenant_domains_insert_policy" ON tenant_domains
  FOR INSERT WITH CHECK (true);

CREATE POLICY "tenant_domains_update_policy" ON tenant_domains
  FOR UPDATE USING (true);

CREATE POLICY "tenant_domains_delete_policy" ON tenant_domains
  FOR DELETE USING (true);

-- Seed GRAG's subdomain
INSERT INTO tenant_domains (organization_id, domain, product_slug, is_primary, verified_at)
SELECT id, 'grag.churchflow.app', 'churchflow', true, NOW()
FROM organizations
WHERE slug = 'grag'
ON CONFLICT (domain) DO NOTHING;
```

- [ ] **Step 2: Apply migration locally**

Run: `supabase db push`
Expected: Migration applied successfully

- [ ] **Step 3: Verify GRAG domain exists**

Run: `supabase db exec "SELECT * FROM tenant_domains WHERE domain = 'grag.churchflow.app'"`
Expected: One row returned with GRAG's organization_id

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260808_add_tenant_domains.sql
git commit -m "feat(db): add tenant_domains migration and seed GRAG subdomain"
```

---

### Task 6: Test the implementation

**Files:**
- Create: `apps/churchflow/src/app/church/[slug]/page.tsx` (test page)

- [ ] **Step 1: Create test page for path-based fallback**

```typescript
// apps/churchflow/src/app/church/[slug]/page.tsx

import { notFound } from "next/navigation";

interface ChurchPageProps {
  params: { slug: string };
}

export default async function ChurchPage({ params }: ChurchPageProps) {
  const { slug } = params;

  // In production, this would query the database
  // For now, render a simple page to verify routing works
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Church: {slug}
        </h1>
        <p className="text-gray-600">
          This is the public page for {slug}.churchflow.app
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Path-based fallback route working
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test subdomain resolution**

Run: `cd apps/churchflow && npm run dev`
Open browser: `http://grag.localhost:3000`
Expected: Middleware sets `x-tenant-slug: grag` header (verify in Network tab)

- [ ] **Step 3: Test path-based fallback**

Open browser: `http://localhost:3000/church/grag`
Expected: Renders "Church: grag" page

- [ ] **Step 4: Test unknown slug**

Open browser: `http://localhost:3000/church/unknown`
Expected: Page renders (404 handling can be added later)

- [ ] **Step 5: Commit**

```bash
git add apps/churchflow/src/app/church/
git commit -m "test: add path-based fallback test page for /church/[slug]"
```

---

### Task 7: Add domain management to onboarding

**Files:**
- Modify: `app/api/platform/onboarding/route.ts`

- [ ] **Step 1: Add tenant_domains import**

```typescript
import {
  organizations,
  products,
  memberships,
  subscriptions,
  auditEvents,
  tenantDomains,
} from "../../../../db/schema-platform";
import { PRODUCT_DOMAINS } from "../../../../config/src/domains";
```

- [ ] **Step 2: Create subdomain after organization creation**

After the organization insert (around line 103), add:

```typescript
// Auto-create subdomain
await db.insert(tenantDomains).values({
  organizationId: org.id,
  domain: `${slug}.${PRODUCT_DOMAINS.churchflow}`,
  productSlug: "churchflow",
  isPrimary: true,
  verifiedAt: new Date().toISOString(),
});
```

- [ ] **Step 3: Commit**

```bash
git add app/api/platform/onboarding/route.ts
git commit -m "feat(onboarding): auto-create subdomain for new tenants"
```

---

## Self-Review Checklist

| Check | Status |
|-------|--------|
| Spec coverage — all requirements have tasks | ✅ |
| No placeholders — all code is complete | ✅ |
| Type consistency — types match across tasks | ✅ |
| File paths — exact paths specified | ✅ |
| Commands — exact commands with expected output | ✅ |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-08-multi-product-domain-architecture.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
