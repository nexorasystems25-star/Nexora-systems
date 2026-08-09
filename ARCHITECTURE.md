# Nexora Systems — Complete Architecture

**Last Updated:** 2026-08-09  
**Status:** Production-ready multi-product SaaS platform

---

## 1. Organizational Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NEXORA SYSTEMS (Company)                             │
│                          Platform Owner: Nexora                             │
│                     Monorepo: pnpm + Turborepo                              │
│                     Database: PostgreSQL (Supabase)                         │
│                     Legacy: Cloudflare D1                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AICOS (AI Company Operating System)                     │
│                        Internal Control Plane                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  AI AGENTS (packages/aicos/src/hierarchy.ts)                               │
│  ├── Chief Executive Agent (ceo-001)                                       │
│  │   └── Chief Operating Officer Agent (coo-001)                           │
│  │   └── Chief Product Officer Agent (cpo-001)                             │
│  │   └── Chief Technology Officer Agent (cto-001)                          │
│  │                                                                         │
│  PRODUCT REGISTRY (packages/aicos/src/registry.ts)                         │
│  ├── ChurchFlow — active — churchflow.app                                  │
│  ├── School Suite — development — schoolsuite.app                          │
│  ├── Counseling — development — counseling.app                             │
│  └── Susu — development — susu.app                                         │
│  │                                                                         │
│  ARCHITECTURE REVIEW (packages/aicos/src/architecture-review.ts)           │
│  ├── Dependency drift detection                                            │
│  ├── Security scans                                                        │
│  └── Performance checks                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PRODUCTS (SaaS Applications)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ CHURCHFLOW (apps/churchflow) — Church Management                    │   │
│  │ Domain: churchflow.app                                              │   │
│  │ Status: Active                                                      │   │
│  │                                                                     │   │
│  │ Pages:                                                              │   │
│  │ ├── /login, /register, /forgot-password                           │   │
│  │ ├── /app (tenant dashboard)                                        │   │
│  │ ├── /app/[module] (members, events, finance, reports, settings)   │   │
│  │ ├── /church/[slug] (public tenant page)                            │   │
│  │ └── /owner (platform management)                                   │   │
│  │     ├── /owner (dashboard)                                          │   │
│  │     ├── /owner/organizations                                       │   │
│  │     ├── /owner/subscriptions                                       │   │
│  │     └── /owner/approvals                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ SCHOOL SUITE (apps/school-suite) — Education Management            │   │
│  │ Domain: schoolsuite.app                                             │   │
│  │ Status: Development                                                │   │
│  │ Routes: /school/[slug]                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ COUNSELING (apps/counseling) — Therapy & Mental Health              │   │
│  │ Domain: counseling.app                                              │   │
│  │ Status: Development                                                │   │
│  │ Routes: /counseling/[slug]                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ SUSU (apps/susu) — Savings & Community Finance                      │   │
│  │ Domain: susu.app                                                    │   │
│  │ Status: Development                                                │   │
│  │ Routes: /susu/[slug]                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ NEXORA WEB (apps/nexora-web) — Marketing Site                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ MOBILE (mobile/) — Expo React Native App                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CLIENTS (Tenants Using Products)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GRAG CHURCH (Tenant 001)                                                  │
│  ├── Organization: GRAG Church                                             │
│  ├── Slug: grag                                                            │
│  ├── Sector: church                                                        │
│  ├── Product: ChurchFlow                                                   │
│  ├── Status: Active                                                        │
│  │                                                                         │
│  │ Access Methods:                                                        │
│  │ ├── Subdomain: grag.churchflow.app                                    │
│  │ ├── Custom domain: gragchurch.com (after DNS setup)                   │
│  │ └── Path fallback: churchflow.app/church/grag                         │
│  │                                                                         │
│  │ Tenant Resolution:                                                     │
│  │ ├── 1. Exact domain match → tenant_domains table                      │
│  │ ├── 2. Subdomain extraction → slug lookup                            │
│  │ └── 3. Path-based fallback → /church/[slug]                           │
│  │                                                                         │
│  │ Subscription:                                                          │
│  │ ├── Plan: professional                                                │
│  │ ├── Status: active                                                    │
│  │ └── Amount: 99 GHS/month                                              │
│  │                                                                         │
│  │ Users:                                                                │
│  │ ├── Platform Owner (nexorasystems25@gmail.com) — scope: platform      │
│  │ ├── GRAG Admin — scope: tenant, role: tenant_admin                    │
│  │ ├── GRAG Staff — scope: tenant, role: manager                         │
│  │ └── GRAG Members — scope: self                                        │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  FUTURE TENANTS:                                                           │
│  ├── Grace Academy (School Suite)                                          │
│  ├── Hope Counseling (Counseling)                                          │
│  └── Community Savings Group (Susu)                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Architecture

### 2.1 Primary Database (Supabase PostgreSQL)

**Connection:** `packages/db/src/index.ts`
```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
```

**Environment Variable:**
```
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

**Tables:**

| Table | Purpose | Level |
|-------|---------|-------|
| `platform_owners` | Verified Nexora owners | Company |
| `products` | Product registry | Products |
| `organizations` | Tenant companies/churches | Clients |
| `identities` | User accounts | All |
| `memberships` | User-tenant mappings with roles | All |
| `subscriptions` | Billing per tenant-product | Clients |
| `tenant_domains` | Domain-to-tenant routing | Clients |
| `invoices` | Billing records | Clients |
| `audit_events` | Platform-wide audit log | All |
| `support_tickets` | Customer support | Clients |

### 2.2 Legacy Database (Cloudflare D1)

**Connection:** `db/index.ts`
```typescript
import { drizzle } from "drizzle-orm/d1";

export async function getDb() {
  const { env } = await import("cloudflare:workers");
  return drizzle(env.DB, { schema });
}
```

**Usage:** Legacy ChurchFlow tables (cf_members, cf_church_events, etc.)

### 2.3 Database Schema Files

| File | Purpose |
|------|---------|
| `db/schema-platform.ts` | Platform tables (organizations, products, subscriptions, etc.) |
| `db/schema.ts` | Legacy ChurchFlow tables (members, events, finance, etc.) |
| `packages/db/src/schema.ts` | Shared schema for Supabase connection |
| `supabase/migrations/` | Database migrations |
| `supabase/combined-setup.sql` | Full schema setup |

---

## 3. Email Services

### 3.1 Current Implementation

**Status:** Using Supabase Auth for email operations

**Files:**
- `mobile/src/api.ts` — Email OTP authentication
- `apps/churchflow/src/lib/auth.ts` — Email-based auth

**Functions:**
```typescript
// Send email OTP
export async function sendEmailOtp(email: string) {
  await ensureApproved(email);
  await authRequest("otp", { email, create_user: true });
}

// Verify email OTP
export async function verifyEmailOtp(email: string, token: string) {
  const data = await authRequest("verify", { email, token, type: "email" });
}
```

### 3.2 Recommended Email Services

For production, integrate with:

| Service | Use Case | Cost |
|---------|----------|------|
| **Resend** | Transactional emails | Free tier: 100 emails/day |
| **SendGrid** | Marketing emails | Free tier: 100 emails/day |
| **Amazon SES** | High volume | $0.10 per 1,000 emails |

**Environment Variables Needed:**
```
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@churchflow.app
```

---

## 4. SMS Services (Vagual SMS)

### 4.1 Current Implementation

**Status:** Not yet implemented

**Planned Integration:**

```typescript
// packages/billing/src/sms.ts
import { VagualSMS } from "vagual-sms";

const sms = new VagualSMS({
  apiKey: process.env.VAGUAL_API_KEY,
  senderId: "NEXORA",
});

export async function sendSMS(to: string, message: string) {
  return sms.send({
    to,
    message,
    senderId: "NEXORA",
  });
}

export async function sendBulkSMS(recipients: string[], message: string) {
  return sms.sendBulk({
    recipients,
    message,
    senderId: "NEXORA",
  });
}
```

### 4.2 Use Cases

| Use Case | Message Template |
|----------|------------------|
| **Member Welcome** | "Welcome to {orgName}! Your account is ready." |
| **Event Reminder** | "Reminder: {eventName} starts in 1 hour." |
| **Payment Confirmation** | "Payment of {amount} received. Thank you!" |
| **MFA Code** | "Your verification code is: {code}" |
| **Subscription Renewal** | "Your subscription renews on {date}." |

### 4.3 Environment Variables

```
VAGUAL_API_KEY=vag_xxxxx
VAGUAL_SENDER_ID=NEXORA
VAGUAL_API_URL=https://api.vagual.com/v1
```

---

## 5. Payment Channels

### 5.1 Stripe (International Cards)

**Status:** Implemented

**Files:**
- `apps/churchflow/src/lib/stripe.ts` — Stripe configuration
- `packages/billing/src/stripe.ts` — Stripe instance
- `apps/churchflow/src/app/api/webhooks/stripe/route.ts` — Webhook handler
- `apps/churchflow/src/app/api/billing/checkout/route.ts` — Checkout session
- `apps/churchflow/src/app/api/billing/portal/route.ts` — Customer portal

**Configuration:**
```typescript
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});

export const PLANS = {
  free: { monthlyPrice: 0, yearlyPrice: 0 },
  starter: { monthlyPrice: 9900, yearlyPrice: 99000 },
  pro: { monthlyPrice: 29900, yearlyPrice: 299000 },
  enterprise: { monthlyPrice: 59900, yearlyPrice: 599000 },
};
```

**Environment Variables:**
```
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_STARTER_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_STARTER_YEARLY_PRICE_ID=price_xxxxx
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_PRO_YEARLY_PRICE_ID=price_xxxxx
STRIPE_ENTERPRISE_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_ENTERPRISE_YEARLY_PRICE_ID=price_xxxxx
```

### 5.2 Mobile Money (Momo) — Ghana

**Status:** Planned for Susu product

**Integration:**
```typescript
// packages/billing/src/momo.ts
export interface MomoConfig {
  provider: "mtn" | "vodafone" | "airteltigo";
  apiKey: string;
  apiSecret: string;
  environment: "sandbox" | "production";
}

export async function initiateMomoPayment(
  amount: number,
  phone: string,
  provider: "mtn" | "vodafone" | "airteltigo"
) {
  // MTN Mobile Money API integration
  // Vodafone Cash integration
  // AirtelTigo Money integration
}
```

### 5.3 Paystack (West Africa)

**Status:** Recommended for Ghana/CEDI payments

**Integration:**
```typescript
// packages/billing/src/paystack.ts
import Paystack from "paystack-api";

const paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY);

export async function initializePaystackPayment(
  email: string,
  amount: number, // in pesewas
  currency: "GHS"
) {
  return paystack.transaction.initialize({
    email,
    amount: amount / 100, // Convert to GHS
    currency,
    callback_url: `${process.env.APP_URL}/billing/callback`,
  });
}
```

**Environment Variables:**
```
PAYSTACK_SECRET_KEY=sk_live_xxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
```

### 5.4 Flutterwave (Africa-wide)

**Status:** Alternative for multi-country expansion

**Integration:**
```typescript
// packages/billing/src/flutterwave.ts
import Flutterwave from "flutterwave-node-v3";

const flw = new Flutterwave(
  process.env.FLUTTERWAVE_PUBLIC_KEY,
  process.env.FLUTTERWAVE_SECRET_KEY
);

export async function initializeFlutterwavePayment(
  email: string,
  amount: number,
  currency: "GHS" | "NGN" | "KES"
) {
  return flw.Charge.create({
    email,
    amount,
    currency,
    redirect_url: `${process.env.APP_URL}/billing/callback`,
  });
}
```

**Environment Variables:**
```
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_xxxxx
FLUTTERWAVE_SECRET_KEY=FLWSECK_xxxxx
```

---

## 6. Payment Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PAYMENT PROCESSING FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. USER SELECTS PLAN                                                      │
│     └── User clicks "Upgrade" on billing page                              │
│                                                                             │
│  2. CHECKOUT SESSION CREATED                                               │
│     ├── Stripe: /api/billing/checkout                                      │
│     ├── Paystack: /api/billing/paystack/initialize                         │
│     └── Momo: /api/billing/momo/initialize                                 │
│                                                                             │
│  3. PAYMENT PROCESSING                                                     │
│     ├── Stripe: Redirects to Stripe Checkout                               │
│     ├── Paystack: Redirects to PaystackCheckout                            │
│     └── Momo: USSD prompt on phone                                         │
│                                                                             │
│  4. WEBHOOK RECEIVED                                                       │
│     ├── Stripe: /api/webhooks/stripe                                       │
│     ├── Paystack: /api/webhooks/paystack                                   │
│     └── Momo: /api/webhooks/momo                                           │
│                                                                             │
│  5. SUBSCRIPTION UPDATED                                                   │
│     ├── Update subscriptions table                                         │
│     ├── Create invoice record                                              │
│     └── Send confirmation email/SMS                                         │
│                                                                             │
│  6. USER NOTIFIED                                                          │
│     ├── Email: Payment confirmation                                        │
│     └── SMS: Payment received (optional)                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Environment Variables Summary

### 7.1 Database
```
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=eyJxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxxx
```

### 7.2 Authentication
```
JWT_SECRET=your-jwt-secret-min-32-chars
MFA_SECRET=your-mfa-secret
```

### 7.3 Email
```
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@churchflow.app
```

### 7.4 SMS (Vagual)
```
VAGUAL_API_KEY=vag_xxxxx
VAGUAL_SENDER_ID=NEXORA
VAGUAL_API_URL=https://api.vagual.com/v1
```

### 7.5 Payments (Stripe)
```
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_STARTER_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_STARTER_YEARLY_PRICE_ID=price_xxxxx
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_PRO_YEARLY_PRICE_ID=price_xxxxx
STRIPE_ENTERPRISE_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_ENTERPRISE_YEARLY_PRICE_ID=price_xxxxx
```

### 7.6 Payments (Paystack)
```
PAYSTACK_SECRET_KEY=sk_live_xxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
```

### 7.7 Payments (Momo — Ghana)
```
MOMO_API_KEY=xxxxx
MOMO_API_SECRET=xxxxx
MOMO_ENVIRONMENT=production
```

### 7.8 Payments (Flutterwave)
```
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_xxxxx
FLUTTERWAVE_SECRET_KEY=FLWSECK_xxxxx
```

### 7.9 Mobile
```
EXPO_PUBLIC_SUPABASE_URL=https://[project].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx
EXPO_PUBLIC_API_URL=https://churchflow-management.amanvid-da.chatgpt.site
```

---

## 8. File Reference

### 8.1 Core Files

| File | Purpose |
|------|---------|
| `db/schema-platform.ts` | Platform database schema |
| `db/schema.ts` | Legacy ChurchFlow schema |
| `packages/db/src/index.ts` | Database connection (Supabase) |
| `db/index.ts` | Database connection (Cloudflare D1) |
| `packages/config/src/domains.ts` | Product domain configuration |
| `packages/auth/src/tenant.ts` | Tenant resolution helpers |
| `packages/auth/src/mfa.ts` | MFA verification |
| `packages/billing/src/plans.ts` | Pricing plans |
| `packages/billing/src/entitlements.ts` | Entitlement service |
| `packages/billing/src/stripe.ts` | Stripe instance |
| `packages/billing/src/subscription-lifecycle.ts` | Subscription state machine |
| `packages/billing/src/offboarding.ts` | Offboarding pipeline |
| `packages/billing/src/approvals.ts` | Approval workflows |
| `packages/aicos/src/hierarchy.ts` | AI agent hierarchy |
| `packages/aicos/src/registry.ts` | Product registry |
| `packages/aicos/src/architecture-review.ts` | Architecture reviews |

### 8.2 API Routes

| File | Purpose |
|------|---------|
| `app/api/platform/onboarding/route.ts` | Tenant provisioning |
| `app/api/platform/suspension/route.ts` | Subscription suspension |
| `app/api/platform/offboarding/route.ts` | Tenant offboarding |
| `app/api/platform/approvals/route.ts` | Approval workflows |
| `app/api/platform/architecture/route.ts` | Architecture reviews |
| `app/api/platform/billing/route.ts` | Invoice management |
| `app/api/platform/invitations/route.ts` | User invitations |
| `apps/churchflow/src/app/api/webhooks/stripe/route.ts` | Stripe webhooks |
| `apps/churchflow/src/app/api/billing/checkout/route.ts` | Checkout sessions |
| `apps/churchflow/src/app/api/billing/portal/route.ts` | Customer portal |

### 8.3 Middleware & Auth

| File | Purpose |
|------|---------|
| `apps/churchflow/src/middleware.ts` | Hostname resolution + auth + MFA |
| `lib/auth-platform.ts` | Platform auth logic |
| `packages/auth/src/jwt.ts` | JWT verification |
| `apps/churchflow/src/lib/auth.ts` | ChurchFlow auth |

---

## 9. Deployment

### 9.1 Vercel (Next.js Apps)

```yaml
# vercel.json
{
  "buildCommand": "turbo build --filter=churchflow",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

### 9.2 Supabase (Database)

```bash
# Push schema changes
supabase db push

# Run migrations
supabase migration up
```

### 9.3 Mobile (EAS)

```bash
# Build iOS
eas build --platform ios

# Build Android
eas build --platform android
```

---

## 10. Security

### 10.1 Authentication

- **JWT Tokens** — Stateless authentication
- **MFA (TOTP)** — Time-based one-time passwords
- **Supabase Auth** — OAuth providers (Google, GitHub)

### 10.2 Authorization

- **Role-Based Access Control (RBAC)**
  - `platform_owner` — Full platform access
  - `nexora_staff` — Staff access
  - `tenant_admin` — Tenant admin
  - `manager` — Tenant manager
  - `leader` — Tenant leader
  - `member` — Basic member
  - `viewer` — Read-only

### 10.3 Tenant Isolation

- **Middleware** — Hostname-based tenant resolution
- **Headers** — x-tenant-id, x-tenant-slug, x-product-slug
- **Database** — Tenant-scoped queries

### 10.4 Security Fixes Applied

- ✅ Removed hardcoded JWT secrets
- ✅ Fixed SQL injection vulnerabilities
- ✅ Removed legacy owner email
- ✅ Added MFA enforcement
- ✅ Enabled npm audit

---

## 11. Monitoring & Observability

### 11.1 Audit Logging

- **Table:** `audit_events`
- **Events:** Login, logout, data changes, payment events

### 11.2 Architecture Reviews

- **Dependency drift detection**
- **Security scans**
- **Performance checks**

### 11.3 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm lint
  
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm typecheck
  
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test
  
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build
```

---

## 12. Future Enhancements

### 12.1 Short-term (Q3 2026)

- [ ] Implement Resend for transactional emails
- [ ] Integrate Vagual SMS for notifications
- [ ] Add Paystack for Ghana/CEDI payments
- [ ] Add MTN Mobile Money integration

### 12.2 Medium-term (Q4 2026)

- [ ] Multi-country expansion (Nigeria, Kenya)
- [ ] Custom domain SSL certificates
- [ ] Advanced analytics dashboard
- [ ] AI-powered insights

### 12.3 Long-term (2027)

- [ ] White-label solution
- [ ] API marketplace
- [ ] Mobile app rebranding
- [ ] Enterprise SSO

---

**Document generated from codebase analysis.**
