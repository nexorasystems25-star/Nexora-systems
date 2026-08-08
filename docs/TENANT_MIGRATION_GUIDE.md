# Tenant Migration Guide

This guide explains how to update existing ChurchFlow API routes to support multi-tenant access.

## Quick Start

### Option 1: Use the Compatibility Layer (Recommended for existing routes)

The compatibility layer adds tenant scoping with minimal changes to existing code.

```typescript
// Before (old single-tenant route)
import { requirePermission } from "../_access";
import { getDb } from "../../db";

export async function GET(request: Request) {
  const access = await requirePermission(request, "members.read");
  if (access.response) return access.response;
  
  const db = await getDb();
  const members = await db.select().from(membersTable);
  return apiJson({ members }, 200, requestId);
}

// After (with tenant compatibility)
import { requirePermission } from "../_access";
import { resolveTenantContext, checkTenantPermission } from "../_tenant-compat";
import { getDb } from "../../db";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const access = await requirePermission(request, "members.read");
  if (access.response) return access.response;
  
  // Get tenant context
  const tenantContext = await resolveTenantContext(request);
  
  const db = await getDb();
  
  // If tenant context exists, scope queries to tenant
  let members;
  if (tenantContext?.tenantId) {
    // Tenant-scoped query
    members = await db
      .select()
      .from(membersTable)
      .where(eq(membersTable.tenantId, tenantContext.tenantId));
  } else {
    // Legacy: no tenant context
    members = await db.select().from(membersTable);
  }
  
  return apiJson({ members }, 200, requestId);
}
```

### Option 2: Use the Full Tenant Middleware (For new routes)

For new routes or when refactoring, use the full tenant middleware:

```typescript
import { withTenantContext, requireTenantPermission } from "../_tenant";
import { getDb } from "../../db";
import { eq } from "drizzle-orm";
import { members } from "../../db/schema";

async function getMembersHandler(request: Request, user: TenantUser) {
  const db = await getDb();
  
  // Query is automatically scoped to tenant
  const result = await db
    .select()
    .from(members)
    .where(eq(members.tenantId, user.tenantId));
  
  return { members: result };
}

export const GET = withTenantContext(getMembersHandler, {
  permission: "members.read",
});
```

## Database Schema Changes

All ChurchFlow tables need a `tenant_id` column. See the migration file:

```sql
-- Add tenant_id to all ChurchFlow tables
ALTER TABLE cf_members ADD COLUMN tenant_id UUID REFERENCES organizations(id);
ALTER TABLE cf_events ADD COLUMN tenant_id UUID REFERENCES organizations(id);
ALTER TABLE cf_attendance_sessions ADD COLUMN tenant_id UUID REFERENCES organizations(id);
-- ... etc for all 27 tables
```

## Query Scoping

When querying data, always scope by `tenant_id`:

```typescript
// ✅ Correct - tenant-scoped
const members = await db
  .select()
  .from(members)
  .where(eq(members.tenantId, tenantId));

// ❌ Wrong - returns all tenants' data
const members = await db.select().from(members);
```

## Role-Based Access Control

The new auth system supports these roles:

| Role | Permissions |
|------|-------------|
| `owner` | Full access |
| `tenant_admin` | Manage all features |
| `client_admin` | Manage most features |
| `admin` | Manage members, events, attendance |
| `manager` | Manage members, events, attendance |
| `leader` | View members, events, attendance |
| `member` | View members, events |
| `viewer` | View only |

## Testing

1. **With tenant context**: Add `X-Tenant-ID` header to requests
2. **Without tenant context**: Falls back to legacy auth behavior
3. **Platform users**: Can access all tenants (useful for support)

## Migration Checklist

For each route file:

- [ ] Import tenant utilities from `_tenant-compat.ts`
- [ ] Add tenant context resolution
- [ ] Scope database queries by `tenant_id`
- [ ] Update permission checks to use tenant-aware auth
- [ ] Test with and without tenant context
- [ ] Update frontend to send `X-Tenant-ID` header

## Files to Update

Priority 1 (Core features):
- [x] `app/api/members/route.ts` ✅ (Already done as `route-tenant.ts`)
- [x] `app/api/finance/route.ts` ✅ (Already done as `route-tenant.ts`)
- [x] `app/api/attendance/route.ts` ✅ (Already done as `route-tenant.ts`)
- [x] `app/api/events/route.ts` ✅ (Already done as `route-tenant.ts`)

Priority 2 (Secondary features):
- [x] `app/api/care/route.ts` ✅ (Already done as `route-tenant.ts`)
- [x] `app/api/households/route.ts` ✅ (Already done as `route-tenant.ts`)
- [x] `app/api/volunteers/route.ts` ✅ (Already done as `route-tenant.ts`)
- [x] `app/api/organisation-units/route.ts` ✅ (Already done as `route-tenant.ts`)
- [x] `app/api/records/route.ts` ✅ (Already done as `route-tenant.ts`)
- [x] `app/api/reminders/route.ts` ✅ (Already done as `route-tenant.ts`)

Priority 3 (Advanced features):
- [x] `app/api/payroll/route.ts` ✅ (Already done as `route-tenant.ts`)
- [x] `app/api/communication/route.ts` ✅ (Already done as `route-tenant.ts`)
- [x] `app/api/reports/route.ts` ✅ (Already done as `route-tenant.ts`)
- [x] `app/api/audit/route.ts` ✅ (Already done as `route-tenant.ts`)

## Frontend Updates

Add tenant header to all API calls:

```typescript
// Using the tenant fetch wrapper
import { tenantFetch } from "../lib/tenant-context";

const response = await tenantFetch("/api/members");

// Or manually
const tenantId = localStorage.getItem("selected_tenant_id");
const response = await fetch("/api/members", {
  headers: {
    "X-Tenant-ID": tenantId || "",
  },
});
```
