# API Reference

## Authentication

All API requests require authentication via Bearer token:

```
Authorization: Bearer <token>
```

### Token Types

| Type | Use Case | Source |
|------|----------|--------|
| Supabase JWT | User login | Supabase Auth |
| Mobile token | Mobile app | Mobile auth endpoint |
| Platform key | Admin access | Environment variable |

---

## Multi-Tenant Headers

For tenant-scoped requests, include:

```
X-Tenant-ID: <organization-id>
```

Or use query parameter:
```
?tenant_id=<organization-id>
```

---

## Platform APIs

### Onboarding

Create new organization and subscription.

**POST** `/api/platform/onboarding`

```json
{
  "organizationName": "Grace and Glory Church",
  "organizationSlug": "grace-and-glory",
  "sector": "church",
  "contactEmail": "admin@example.com",
  "plan": "professional"
}
```

Response:
```json
{
  "success": true,
  "organization": {
    "id": "uuid",
    "name": "Grace and Glory Church",
    "slug": "grace-and-glory",
    "lifecycle": "onboarding"
  },
  "subscription": {
    "id": "uuid",
    "plan": "professional",
    "status": "trialing",
    "trialEndsAt": "2025-08-19T00:00:00Z"
  }
}
```

### Tenants

List tenants the current user has access to.

**GET** `/api/platform/tenants`

```json
{
  "tenants": [
    {
      "id": "uuid",
      "name": "Grace and Glory Church",
      "slug": "grace-and-glory",
      "lifecycle": "active",
      "status": "active",
      "product": { "name": "ChurchFlow", "slug": "churchflow" },
      "subscription": { "plan": "professional", "status": "active" }
    }
  ]
}
```

### Invitations

Manage team member invitations.

**POST** `/api/platform/invitations`

```json
{
  "email": "colleague@example.com",
  "role": "manager"
}
```

**GET** `/api/platform/invitations`

```json
{
  "invitations": [
    {
      "id": "uuid",
      "role": "manager",
      "status": "invited",
      "invitedAt": "2025-08-05T00:00:00Z",
      "expiresAt": "2025-08-12T00:00:00Z"
    }
  ]
}
```

### Billing

Manage subscriptions and view invoices.

**GET** `/api/platform/billing`

```json
{
  "subscription": {
    "id": "uuid",
    "plan": "professional",
    "status": "active",
    "monthlyAmount": 29900,
    "currency": "GHS",
    "trialEndsAt": null,
    "currentPeriodEnd": "2025-09-05"
  },
  "summary": {
    "isTrial": false,
    "trialDaysLeft": null,
    "daysUntilRenewal": 30,
    "monthlyDisplay": "GH₵299.00"
  },
  "recentInvoices": [...]
}
```

**POST** `/api/platform/billing`

```json
{
  "action": "upgrade",
  "plan": "enterprise"
}
```

Actions: `upgrade`, `downgrade`, `cancel`, `reactivate`

### Analytics

Get tenant analytics and statistics.

**GET** `/api/platform/analytics`

```json
{
  "organization": {
    "name": "Grace and Glory Church",
    "daysSinceCreation": 30
  },
  "stats": {
    "totalMembers": 150,
    "pendingInvites": 3,
    "recentActivity": 45
  },
  "subscription": {
    "plan": "professional",
    "status": "active",
    "isTrial": false
  }
}
```

### Platform Admin

Platform-wide statistics (requires platform access).

**GET** `/api/platform/admin/stats`

```json
{
  "overview": {
    "totalOrganizations": 25,
    "activeOrganizations": 20,
    "totalUsers": 150,
    "totalMembers": 5000
  },
  "revenue": {
    "mrr": 500000,
    "mrrDisplay": "GH₵5,000.00"
  },
  "subscriptions": {
    "byStatus": { "active": 20, "trialing": 5 },
    "byPlan": { "starter": 10, "professional": 12, "enterprise": 3 }
  }
}
```

---

## ChurchFlow APIs

### Members

**GET** `/api/members`
List all members (tenant-scoped).

**POST** `/api/members`
Create new member.

**PATCH** `/api/members`
Update member.

**DELETE** `/api/members`
Delete member.

### Attendance

**GET** `/api/attendance`
List attendance sessions and records.

**POST** `/api/attendance`
- `action: "create-session"` - Create new session
- `action: "check-in"` - Record attendance

### Events

**GET** `/api/events`
List events.

**POST** `/api/events`
Create new event.

### Finance

**GET** `/api/finance`
List transactions and funds.

**POST** `/api/finance`
- `action: "create-fund"` - Create fund
- `action: "record-transaction"` - Record transaction
- `action: "approve-transaction"` - Approve transaction

### Care

**GET** `/api/care`
List care cases.

**POST** `/api/care`
Create/update care case.

### Households

**GET** `/api/households`
List households.

**POST** `/api/households`
Create/update household.

### Volunteers

**GET** `/api/volunteers`
List volunteers and schedules.

**POST** `/api/volunteers`
Manage volunteer assignments.

### Organisation Units

**GET** `/api/organisation-units`
List departments/groups.

**POST** `/api/organisation-units`
Create/update unit.

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message"
}
```

### Status Codes

| Code | Meaning |
|------|---------|
| 400 | Bad request / validation error |
| 401 | Authentication required |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate) |
| 500 | Server error |

---

## Role-Based Permissions

### Platform Roles

| Role | Access |
|------|--------|
| `platform_owner` | Full platform access |
| `platform_admin` | Manage tenants, billing |
| `platform_support` | View tenants, support tickets |

### Client Roles

| Role | Permissions |
|------|-------------|
| `tenant_admin` | All tenant features |
| `client_admin` | Most features |
| `admin` | Members, events, finance |
| `manager` | Members, events |
| `leader` | View members, events |
| `member` | View own info |
| `viewer` | Read-only |
