# NEXORA PLATFORM — Complete System Architecture

**Version:** 1.0
**Date:** August 2026
**Status:** Implementation Ready
**Owner:** Nexora Systems (nexorasystems25@gmail.com)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Company Structure](#2-company-structure)
3. [Product Portfolio](#3-product-portfolio)
4. [Domain Architecture](#4-domain-architecture)
5. [Technical Architecture](#5-technical-architecture)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Multi-Tenant Architecture](#7-multi-tenant-architecture)
8. [Database Design](#8-database-design)
9. [API Architecture](#9-api-architecture)
10. [Billing & Pricing](#10-billing--pricing)
11. [Deployment Architecture](#11-deployment-architecture)
12. [Security Architecture](#12-security-architecture)
13. [Implementation Roadmap](#13-implementation-roadmap)

---

## 1. Executive Summary

### 1.1 Vision

Nexora is a multi-product SaaS company building enterprise software for:
- **Churches** (ChurchFlow)
- **Schools** (School Suite)
- **Counseling Centers** (Counseling Platform)
- **Susu/Group Savings** (Susu Platform)

### 1.2 Architecture Principles

| Principle | Description |
|-----------|-------------|
| **Monorepo** | Single codebase, shared packages, independent deployment |
| **Multi-Tenant** | Each product isolates tenant data with row-level security |
| **Product Independence** | Each product has its own domain, pricing, and features |
| **Shared Infrastructure** | Auth, billing, UI components shared across products |
| **Owner Control** | Platform owner has super admin access to everything |

### 1.3 Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Code Structure | Monorepo (Turborepo) | Shared code, single CI/CD, lower cost |
| Domains | Separate per product | Brand independence, SEO, future sale potential |
| Pricing | Tiered + Bundles | Maximizes revenue, customer flexibility |
| Auth | Shared SSO | Single sign-on across all products |
| Database | PostgreSQL + RLS | Enterprise-grade security, tenant isolation |

---

## 2. Company Structure

### 2.1 Organization Hierarchy

```
NEXORA SYSTEMS (Company)
├── Platform Owner (Super Admin)
├── Nexora Staff (Support, Sales, Engineering)
│
├── PRODUCTS
│   ├── ChurchFlow
│   │   ├── Tenants (Churches)
│   │   │   ├── GRAG (Tenant 001)
│   │   │   ├── Grace Centre (Tenant 002)
│   │   │   └── ...
│   │   └── Users (per tenant)
│   │
│   ├── School Suite
│   │   ├── Tenants (Schools)
│   │   └── Users
│   │
│   ├── Counseling Platform
│   │   ├── Tenants (Counseling Centers)
│   │   └── Users
│   │
│   └── Susu Platform
│       ├── Tenants (Susu Groups)
│       └── Users
│
└── SUBSCRIPTIONS
    ├── Per-product pricing
    ├── Bundle discounts
    └── Enterprise platform license
```

### 2.2 User Types

| User Type | Access Level | Entry Point |
|-----------|--------------|-------------|
| **Platform Owner** | Full access to everything | admin.nexora.com |
| **Nexora Staff** | Assigned tenants only | admin.nexora.com |
| **Tenant Admin** | Full access to their tenant | app.{product}.com/{slug} |
| **Tenant Manager** | Limited admin access | app.{product}.com/{slug} |
| **Tenant User** | Read/write specific modules | app.{product}.com/{slug} |
| **Tenant Viewer** | Read-only access | app.{product}.com/{slug} |
| **Public** | Registration, login | {product}.com |

---

## 3. Product Portfolio

### 3.1 ChurchFlow

**Target:** Churches, religious organizations
**Domain:** churchflow.app
**Dashboard:** app.churchflow.app/{tenant-slug}

**Features:**
- Member management
- Event scheduling & attendance
- Financial tracking (tithe, offerings, expenses)
- Group/ministry management
- Communication (SMS, email)
- Reports & analytics
- Mobile app access

**Tech Stack:**
- Next.js 16 (React 19)
- Supabase (PostgreSQL)
- Drizzle ORM
- Cloudflare Workers

### 3.2 School Suite

**Target:** Schools, educational institutions
**Domain:** schoolsuite.app
**Dashboard:** app.schoolsuite.app/{tenant-slug}

**Features:**
- Student information system
- Attendance tracking
- Grade book
- Parent portal
- Fee management
- Staff management
- Academic calendar

### 3.3 Counseling Platform

**Target:** Counseling centers, therapy practices
**Domain:** counselingplatform.app
**Dashboard:** app.counselingplatform.app/{tenant-slug}

**Features:**
- Client management
- Appointment scheduling
- Session notes (SOAP/DAP)
- Billing & insurance
- Telehealth integration
- Outcome tracking

### 3.4 Susu Platform

**Target:** Susu collectors, group savings
**Domain:** susuplatform.app
**Dashboard:** app.susuplatform.app/{tenant-slug}

**Features:**
- Member management
- Contribution tracking
- Payout management
- Mobile money integration
- Reports & analytics
- SMS notifications

---

## 4. Domain Architecture

### 4.1 Domain Structure

| Domain | Purpose | Application |
|--------|---------|-------------|
| `nexora.com` | Company website | Next.js static site |
| `admin.nexora.com` | Staff admin portal | AICOS (Next.js) |
| `churchflow.app` | ChurchFlow marketing | Static marketing site |
| `app.churchflow.app` | ChurchFlow dashboard | Next.js SaaS app |
| `school-suite.app` | School Suite marketing | Static marketing site |
| `app.school-suite.app` | School Suite dashboard | Next.js SaaS app |
| `counselingplatform.app` | Counseling marketing | Static marketing site |
| `app.counselingplatform.app` | Counseling dashboard | Next.js SaaS app |
| `susuplatform.app` | Susu marketing | Static marketing site |
| `app.susuplatform.app` | Susu dashboard | Next.js SaaS app |

### 4.2 URL Patterns

```
Marketing Sites:
  https://churchflow.app                    → Landing page
  https://churchflow.app/pricing            → Pricing page
  https://churchflow.app/features           → Features page
  https://churchflow.app/about              → About page
  https://churchflow.app/contact            → Contact page

Dashboard Apps:
  https://app.churchflow.app/               → Tenant selector / login
  https://app.churchflow.app/grag           → GRAG church dashboard
  https://app.churchflow.app/grag/members   → Members module
  https://app.churchflow.app/grag/events    → Events module
  https://app.churchflow.app/grag/finance   → Finance module

Admin Portal:
  https://admin.nexora.com/                 → Platform dashboard
  https://admin.nexora.com/tenants          → Tenant management
  https://admin.nexora.com/billing          → Billing overview
  https://admin.nexora.com/support          → Support tickets
```

### 4.3 DNS Configuration

```dns
; Company site
nexora.com.              A       104.x.x.x (Vercel)
admin.nexora.com.        CNAME   nexora.vercel.app.

; ChurchFlow
churchflow.app.          A       104.x.x.x (Vercel)
app.churchflow.app.      CNAME   churchflow.vercel.app.

; School Suite
school-suite.app.        A       104.x.x.x (Vercel)
app.school-suite.app.    CNAME   school-suite.vercel.app.

; Counseling
counselingplatform.app.  A       104.x.x.x (Vercel)
app.counselingplatform.app. CNAME counseling.vercel.app.

; Susu
susuplatform.app.        A       104.x.x.x (Vercel)
app.susuplatform.app.    CNAME   susu.vercel.app.
```

---

## 5. Technical Architecture

### 5.1 Monorepo Structure

```
nexora-platform/
├── apps/
│   ├── nexora-web/              # Company website
│   ├── aicos/                   # Staff admin portal
│   ├── churchflow/              # ChurchFlow SaaS
│   ├── school-suite/            # School Suite SaaS
│   ├── counseling/              # Counseling SaaS
│   └── susu/                    # Susu SaaS
│
├── packages/
│   ├── ui/                      # Shared React components
│   ├── auth/                    # Shared authentication
│   ├── billing/                 # Shared billing/Stripe
│   ├── db/                      # Shared database schema
│   ├── config/                  # Shared configs
│   └── utils/                   # Shared utilities
│
├── marketing/
│   ├── churchflow-site/         # ChurchFlow marketing
│   ├── school-site/             # School Suite marketing
│   ├── counseling-site/         # Counseling marketing
│   └── susu-site/               # Susu marketing
│
├── supabase/
│   ├── migrations/              # Database migrations
│   └── seed.sql                 # Seed data
│
├── turbo.json                   # Turborepo config
├── package.json                 # Root package.json
├── pnpm-workspace.yaml          # pnpm workspace
└── tsconfig.json                # Base TypeScript config
```

### 5.2 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 16, React 19 | UI framework |
| **Styling** | Tailwind CSS v4 | Utility-first CSS |
| **State** | React Context, Zustand | Client state |
| **Backend** | Next.js API Routes | Server-side logic |
| **Database** | Supabase (PostgreSQL) | Data storage |
| **ORM** | Drizzle ORM | Type-safe queries |
| **Auth** | Supabase Auth | Authentication |
| **Payments** | Stripe | Billing & subscriptions |
| **Storage** | Cloudflare R2 | File storage |
| **CDN** | Cloudflare | Global distribution |
| **Hosting** | Vercel | Application hosting |
| **Monorepo** | Turborepo | Build orchestration |
| **Package Manager** | pnpm | Dependency management |

### 5.3 Package Dependencies

```
packages/ui
├── react
├── react-dom
├── tailwindcss
└── class-variance-authority

packages/auth
├── @supabase/supabase-js
├── @supabase/ssr
└── jose (JWT)

packages/billing
├── stripe
└── @stripe/stripe-js

packages/db
├── drizzle-orm
├── postgres
└── drizzle-kit

packages/config
├── typescript
├── eslint
└── prettier
```

---

## 6. Authentication & Authorization

### 6.1 Auth Hierarchy

```
Level 1: PLATFORM OWNER
├── Email: nexorasystems25@gmail.com
├── Access: ALL tenants, ALL products
├── Permissions: Unlimited
└── MFA: Required

Level 2: NEXORA STAFF
├── Roles: Support, Sales, Engineering
├── Access: Assigned tenants only
├── Permissions: Scoped to role
└── MFA: Required

Level 3: TENANT USERS
├── Roles: Admin, Manager, Leader, Member, Viewer
├── Access: Single tenant only
├── Permissions: Role-based
└── MFA: Optional

Level 4: PUBLIC
├── Actions: Register, Login, Password Reset
├── Access: Marketing sites only
└── Permissions: None
```

### 6.2 Role Permissions Matrix

| Permission | Owner | Staff | Admin | Manager | Leader | Member | Viewer |
|------------|-------|-------|-------|---------|--------|--------|--------|
| members.read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| members.write | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| members.delete | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| events.read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| events.write | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| finance.read | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| finance.write | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| finance.approve | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| reports.read | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| settings.read | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| settings.write | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| tenant.manage | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| platform.manage | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 6.3 JWT Token Structure

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "platform_owner",
  "is_super_admin": true,
  "tenant_id": "tenant-uuid",
  "product_id": "product-uuid",
  "permissions": ["members.read", "members.write", "..."],
  "iat": 1691234567,
  "exp": 1691320967
}
```

### 6.4 Auth Flow

```
1. User visits app.churchflow.app
   ↓
2. Redirect to login page
   ↓
3. User enters credentials
   ↓
4. Supabase Auth validates
   ↓
5. JWT token issued with claims:
   - user_id
   - email
   - role
   - tenant_id
   - product_id
   - permissions
   ↓
6. Token stored in httpOnly cookie
   ↓
7. Subsequent requests include token
   ↓
8. Middleware validates token + checks permissions
   ↓
9. Request proceeds or 401/403
```

---

## 7. Multi-Tenant Architecture

### 7.1 Tenant Isolation Strategy

**Approach:** Shared database, row-level security (RLS)

```
┌─────────────────────────────────────────────────────────┐
│                    SHARED DATABASE                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  organizations table                                     │
│  ├── id: uuid                                            │
│  ├── name: text                                          │
│  ├── slug: text (unique)                                 │
│  ├── product_id: uuid (foreign key)                      │
│  └── ...                                                 │
│                                                          │
│  cf_members table (ChurchFlow)                           │
│  ├── id: serial                                          │
│  ├── tenant_id: uuid (foreign key → organizations.id)    │
│  ├── name: text                                          │
│  └── ...                                                 │
│                                                          │
│  ss_students table (School Suite)                        │
│  ├── id: serial                                          │
│  ├── tenant_id: uuid (foreign key → organizations.id)    │
│  ├── name: text                                          │
│  └── ...                                                 │
│                                                          │
│  RLS Policy:                                             │
│  WHERE tenant_id = current_setting('app.current_tenant') │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Tenant Context

Every API request includes tenant context:

```typescript
// Request headers
X-Tenant-ID: "uuid-of-tenant"
Authorization: "Bearer <jwt-token>"

// Or query parameter
?tenant_id=uuid-of-tenant

// Or cookie (for SSR)
Cookie: selected_tenant_id=uuid-of-tenant
```

### 7.3 Tenant Switching

Users with access to multiple tenants can switch:

```
┌─────────────────────────────────────────┐
│  Tenant Switcher (Dropdown)             │
├─────────────────────────────────────────┤
│  📍 GRAG Church (current)              │
│  📍 Grace Centre                       │
│  📍 Action Chapel                      │
│  + Add New Tenant                      │
└─────────────────────────────────────────┘
```

### 7.4 Cross-Product Access

Platform Owner can access any tenant in any product:

```
Owner Dashboard
├── Products
│   ├── ChurchFlow (12 tenants)
│   │   ├── GRAG → app.churchflow.app/grag
│   │   ├── Grace Centre → app.churchflow.app/grace-centre
│   │   └── ...
│   ├── School Suite (8 tenants)
│   │   ├── Premium School → app.school-suite.app/premium-school
│   │   └── ...
│   ├── Counseling (5 tenants)
│   └── Susu (15 tenants)
```

---

## 8. Database Design

### 8.1 Platform Tables (Shared)

```sql
-- Products (ChurchFlow, School Suite, etc.)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  status TEXT DEFAULT 'active',
  pricing_tiers JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations (Tenants)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  product_id UUID REFERENCES products(id),
  lifecycle_state TEXT DEFAULT 'lead',
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(slug, product_id)
);

-- Identities (Users)
CREATE TABLE identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memberships (User-Tenant relationship)
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID REFERENCES identities(id),
  organization_id UUID REFERENCES organizations(id),
  role TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  invited_by UUID REFERENCES identities(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identity_id, organization_id)
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  product_id UUID REFERENCES products(id),
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_invoice_id TEXT,
  amount_pesewas INTEGER NOT NULL,
  currency TEXT DEFAULT 'GHS',
  status TEXT DEFAULT 'pending',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support Tickets
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  identity_id UUID REFERENCES identities(id),
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  assigned_to UUID REFERENCES identities(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Events
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  identity_id UUID REFERENCES identities(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 8.2 Product Tables (ChurchFlow Example)

```sql
-- All tables have tenant_id for isolation
CREATE TABLE cf_members (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  church_id TEXT NOT NULL,
  name TEXT NOT NULL,
  initials TEXT,
  group_name TEXT,
  phone TEXT,
  email TEXT,
  gender TEXT,
  birth_date DATE,
  marital_status TEXT,
  status TEXT DEFAULT 'Active',
  joined_at DATE,
  profile_photo_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cf_events (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  event_code TEXT NOT NULL,
  title TEXT NOT NULL,
  event_type TEXT,
  start_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  venue TEXT,
  coordinator TEXT,
  expected_attendance INTEGER,
  status TEXT DEFAULT 'Planning',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cf_finance_transactions (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  reference TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  fund_id INTEGER,
  amount_pesewas INTEGER NOT NULL,
  transaction_date DATE NOT NULL,
  payment_method TEXT,
  description TEXT,
  status TEXT DEFAULT 'Pending',
  recorded_by TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_cf_members_tenant ON cf_members(tenant_id);
CREATE INDEX idx_cf_events_tenant ON cf_events(tenant_id);
CREATE INDEX idx_cf_finance_tenant ON cf_finance_transactions(tenant_id);
```

### 8.3 Row-Level Security (RLS)

```sql
-- Enable RLS on all tenant tables
ALTER TABLE cf_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE cf_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cf_finance_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their tenant's data
CREATE POLICY cf_members_tenant_isolation ON cf_members
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY cf_events_tenant_isolation ON cf_events
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY cf_finance_tenant_isolation ON cf_finance_transactions
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Platform owners bypass RLS
CREATE POLICY cf_members_platform_owner ON cf_members
  USING (current_setting('app.is_platform_owner') = 'true');
```

---

## 9. API Architecture

### 9.1 API Structure

```
/api/
├── auth/                    # Authentication endpoints
│   ├── login/
│   ├── logout/
│   ├── register/
│   └── callback/
│
├── platform/                # Platform admin endpoints
│   ├── tenants/             # Tenant management
│   ├── products/            # Product management
│   ├── billing/             # Billing overview
│   ├── analytics/           # Platform analytics
│   └── admin/               # Admin operations
│
├── tenants/                 # Tenant-scoped endpoints
│   ├── [tenantId]/
│   │   ├── members/         # Member management
│   │   ├── events/          # Event management
│   │   ├── finance/         # Finance management
│   │   ├── reports/         # Reporting
│   │   └── settings/        # Tenant settings
│
└── public/                  # Public endpoints
    ├── products/            # Product listing
    ├── pricing/             # Pricing info
    └── health/              # Health check
```

### 9.2 API Middleware Stack

```
Request
  ↓
[CORS Middleware]
  ↓
[Rate Limiting]
  ↓
[CSRF Protection]
  ↓
[Auth Middleware]
  ↓
[Tenant Context Middleware]
  ↓
[Permission Check]
  ↓
[Route Handler]
  ↓
[Audit Logging]
  ↓
Response
```

### 9.3 Tenant-Aware API Example

```typescript
// app/api/tenants/[tenantId]/members/route.ts

import { resolveTenantContext, checkTenantPermission } from '@nexora/auth';
import { db } from '@nexora/db';
import { cf_members } from '@nexora/db/schema';

export async function GET(request: Request, { params }: { params: { tenantId: string } }) {
  // 1. Resolve tenant context
  const tenantContext = await resolveTenantContext(request);
  if (!tenantContext) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Check permission
  const hasPermission = await checkTenantPermission(tenantContext, 'members.read');
  if (!hasPermission) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Query with tenant isolation
  const members = await db
    .select()
    .from(cf_members)
    .where(eq(cf_members.tenantId, params.tenantId));

  return Response.json({ members });
}
```

---

## 10. Billing & Pricing

### 10.1 Product Pricing

| Product | Starter | Professional | Enterprise |
|---------|---------|--------------|------------|
| **ChurchFlow** | GHS 99/mo | GHS 299/mo | GHS 599/mo |
| **School Suite** | GHS 149/mo | GHS 399/mo | GHS 799/mo |
| **Counseling** | GHS 199/mo | GHS 499/mo | GHS 899/mo |
| **Susu** | GHS 149/mo | GHS 349/mo | GHS 699/mo |

### 10.2 Bundle Discounts

| Bundle | Discount | Example |
|--------|----------|---------|
| 2 Products | 15% off | ChurchFlow + School Suite = GHS 593/mo |
| 3 Products | 25% off | ChurchFlow + School + Counseling = GHS 973/mo |
| All 4 Products | 30% off | Full Platform = GHS 1,397/mo |

### 10.3 Enterprise Platform License

| Feature | Details |
|---------|---------|
| Price | GHS 2,999/mo |
| Tenants | Unlimited across all products |
| Support | Priority 24/7 |
| Integrations | Custom API integrations |
| Account Manager | Dedicated account manager |
| SLA | 99.9% uptime guarantee |

### 10.4 Stripe Integration

```typescript
// packages/billing/src/plans.ts

export const PLANS = {
  churchflow: {
    starter: {
      name: 'Starter',
      price: 9900, // GHS 99 in pesewas
      interval: 'month',
      features: ['Up to 100 members', 'Basic reporting', 'Email support'],
    },
    professional: {
      name: 'Professional',
      price: 29900,
      interval: 'month',
      features: ['Up to 500 members', 'Advanced reporting', 'Priority support', 'Mobile app'],
    },
    enterprise: {
      name: 'Enterprise',
      price: 59900,
      interval: 'month',
      features: ['Unlimited members', 'Custom reporting', '24/7 support', 'Custom integrations'],
    },
  },
  // ... other products
};
```

---

## 11. Deployment Architecture

### 11.1 Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  CDN (Cloudflare)                                           │
│  ├── Static assets (marketing sites)                        │
│  ├── Edge caching                                           │
│  └── DDoS protection                                        │
│                                                              │
│  Hosting (Vercel)                                           │
│  ├── Serverless functions (API routes)                      │
│  ├── SSR rendering (dashboards)                             │
│  └── Automatic scaling                                      │
│                                                              │
│  Database (Supabase)                                        │
│  ├── PostgreSQL 15                                          │
│  ├── Connection pooling                                     │
│  ├── Automated backups                                      │
│  └── Point-in-time recovery                                 │
│                                                              │
│  Storage (Cloudflare R2)                                    │
│  ├── Profile photos                                         │
│  ├── Document uploads                                       │
│  └── Backups                                                │
│                                                              │
│  Auth (Supabase Auth)                                       │
│  ├── Email/password                                         │
│  ├── OAuth (Google, Microsoft)                              │
│  ├── Magic links                                            │
│  └── MFA (TOTP)                                            │
│                                                              │
│  Payments (Stripe)                                          │
│  ├── Subscriptions                                          │
│  ├── Invoices                                               │
│  ├── Webhooks                                               │
│  └── Customer portal                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 CI/CD Pipeline

```
Code Push
  ↓
GitHub Actions
  ↓
├── Lint (ESLint)
├── Type Check (TypeScript)
├── Test (Vitest)
├── Build (Turborepo)
  ↓
Preview Deployment (Vercel)
  ↓
PR Review
  ↓
Merge to main
  ↓
Production Deployment (Vercel)
  ↓
Database Migration (Supabase CLI)
  ↓
Health Check
```

### 11.3 Environment Configuration

```bash
# Environment Variables (per app)

# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://app.churchflow.app

# Payments
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Storage
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...

# App
APP_URL=https://app.churchflow.app
TENANT_ID=...
```

---

## 12. Security Architecture

### 12.1 Security Layers

```
Layer 1: Network Security
├── Cloudflare DDoS protection
├── WAF (Web Application Firewall)
├── Rate limiting
└── IP blocking

Layer 2: Authentication
├── Supabase Auth (JWT)
├── MFA for admin users
├── Session management
└── Password policies

Layer 3: Authorization
├── Role-based access control (RBAC)
├── Row-level security (RLS)
├── API permission checks
└── Tenant isolation

Layer 4: Data Security
├── Encryption at rest (AES-256)
├── Encryption in transit (TLS 1.3)
├── Database backups
└── Audit logging

Layer 5: Application Security
├── CSRF protection
├── XSS prevention
├── SQL injection prevention
└── Input validation
```

### 12.2 Compliance

| Regulation | Status | Implementation |
|------------|--------|----------------|
| GDPR | ✅ Ready | Data export, deletion, consent |
| Ghana Data Protection Act | ✅ Ready | Local data residency, consent |
| SOC 2 | 🟡 Prep | Audit logging, access controls |
| PCI DSS | ✅ Stripe handles | No card data stored |

### 12.3 Audit Logging

Every action is logged:

```json
{
  "id": "uuid",
  "organization_id": "tenant-uuid",
  "identity_id": "user-uuid",
  "action": "member.created",
  "entity_type": "member",
  "entity_id": "123",
  "metadata": {
    "church_id": "CH-001",
    "name": "John Doe"
  },
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2026-08-05T10:30:00Z"
}
```

---

## 13. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

| Task | Owner | Status |
|------|-------|--------|
| Set up Turborepo monorepo | Engineering | ⬜ |
| Create shared packages (auth, db, ui) | Engineering | ⬜ |
| Configure Supabase project | DevOps | ⬜ |
| Set up Stripe account | Business | ⬜ |
| Deploy ChurchFlow (migrate existing) | Engineering | ⬜ |

### Phase 2: Core Products (Weeks 3-4)

| Task | Owner | Status |
|------|-------|--------|
| Build AICOS admin portal | Engineering | ⬜ |
| Build ChurchFlow tenant dashboard | Engineering | ⬜ |
| Set up auth + tenant isolation | Engineering | ⬜ |
| Implement billing integration | Engineering | ⬜ |
| Create marketing site templates | Design | ⬜ |

### Phase 3: Expansion (Weeks 5-6)

| Task | Owner | Status |
|------|-------|--------|
| Build School Suite app | Engineering | ⬜ |
| Build Counseling app | Engineering | ⬜ |
| Build Susu app | Engineering | ⬜ |
| Create marketing sites | Design | ⬜ |
| Set up domains + SSL | DevOps | ⬜ |

### Phase 4: Launch (Weeks 7-8)

| Task | Owner | Status |
|------|-------|--------|
| Security audit | Security | ⬜ |
| Performance testing | QA | ⬜ |
| Documentation | Technical Writing | ⬜ |
| Beta testing | Product | ⬜ |
| Production launch | All | ⬜ |

---

## Appendices

### A. API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | User login |
| POST | /api/auth/logout | User logout |
| GET | /api/platform/tenants | List all tenants |
| POST | /api/platform/tenants | Create tenant |
| GET | /api/tenants/[id]/members | List tenant members |
| POST | /api/tenants/[id]/members | Create member |
| GET | /api/tenants/[id]/events | List tenant events |
| POST | /api/tenants/[id]/events | Create event |
| GET | /api/tenants/[id]/finance | List transactions |
| POST | /api/tenants/[id]/finance | Create transaction |

### B. Database Migrations

All migrations are stored in `supabase/migrations/`:

| Migration | Description |
|-----------|-------------|
| 20250805_multi_tenant_platform.sql | Create platform tables |
| 20250805_cf_tenant_scoping.sql | Add tenant_id to ChurchFlow tables |
| 20250805_rls_policies.sql | Enable row-level security |

### C. Environment Variables

See Section 11.3 for complete list.

### D. Contact

| Role | Email |
|------|-------|
| Platform Owner | nexorasystems25@gmail.com |
| Technical Lead | [TBD] |
| Support | support@nexora.com |

---

**Document Version:** 1.0
**Last Updated:** August 5, 2026
**Next Review:** September 5, 2026
