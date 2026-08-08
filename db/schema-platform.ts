import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ============================================================================
// PLATFORM ENUMS
// ============================================================================

export const lifecycleEnum = pgEnum("lifecycle_state", [
  "lead",
  "qualified",
  "consultation",
  "proposal",
  "contracted",
  "onboarding",
  "active",
  "at_risk",
  "renewal_due",
  "suspended",
  "offboarding",
  "archived",
]);

export const membershipScopeEnum = pgEnum("membership_scope", [
  "platform",
  "staff",
  "tenant",
  "self",
]);

// ============================================================================
// PLATFORM TABLES (Nexora Control Plane)
// ============================================================================

// 1.1 Organizations (Tenants)
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    sector: text("sector").notNull().default("church"),
    lifecycle: lifecycleEnum("lifecycle").notNull().default("lead"),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("organizations_slug_idx").on(table.slug),
    index("organizations_lifecycle_idx").on(table.lifecycle),
  ]
);

// 1.2 Products (ChurchFlow, School Suite, etc.)
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    status: text("status").notNull().default("planned"),
    description: text("description"),
    config: jsonb("config").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("products_slug_idx").on(table.slug)]
);

// 1.3 Identities (User accounts across platform)
export const identities = pgTable(
  "identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authUserId: uuid("auth_user_id").notNull().unique(),
    email: text("email").notNull().unique(),
    fullName: text("full_name").notNull(),
    status: text("status").notNull().default("invited"),
    mfaRequired: boolean("mfa_required").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("identities_auth_user_idx").on(table.authUserId),
    uniqueIndex("identities_email_idx").on(table.email),
  ]
);

// 1.4 Memberships (User-tenant mappings with roles)
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identityId: uuid("identity_id")
      .notNull()
      .references(() => identities.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    productId: uuid("product_id").references(() => products.id),
    role: text("role").notNull(),
    scope: membershipScopeEnum("scope").notNull().default("tenant"),
    status: text("status").notNull().default("invited"),
    permissions: jsonb("permissions").default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("memberships_identity_idx").on(table.identityId),
    index("memberships_organization_idx").on(table.organizationId),
    uniqueIndex("memberships_identity_org_role_idx").on(
      table.identityId,
      table.organizationId,
      table.role
    ),
  ]
);

// 1.5 Subscriptions (Billing per tenant-product)
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    plan: text("plan").notNull().default("starter"),
    status: text("status").notNull().default("trialing"),
    monthlyAmount: integer("monthly_amount").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("GHS"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    renewalAt: date("renewal_at"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("subscriptions_organization_idx").on(table.organizationId),
  ]
);

// 1.6 Invoices
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
    number: text("number").notNull().unique(),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("GHS"),
    status: text("status").notNull().default("draft"),
    dueAt: date("due_at"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("invoices_organization_idx").on(table.organizationId),
    uniqueIndex("invoices_number_idx").on(table.number),
  ]
);

// 1.7 Support Tickets
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    ticketNumber: text("ticket_number").notNull().unique(),
    subject: text("subject").notNull(),
    description: text("description"),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("open"),
    category: text("category").default("general"),
    assignedTo: uuid("assigned_to").references(() => identities.id),
    createdBy: uuid("created_by").references(() => identities.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("support_tickets_organization_idx").on(table.organizationId),
    uniqueIndex("support_tickets_number_idx").on(table.ticketNumber),
  ]
);

// 1.8 Audit Events (Platform-wide)
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    actorId: uuid("actor_id").references(() => identities.id),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    entityCode: text("entity_code"),
    payload: jsonb("payload").notNull().default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_organization_idx").on(table.organizationId),
    index("audit_events_created_idx").on(table.createdAt),
  ]
);

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

// 1.10 Platform Configuration
export const platformConfig = pgTable("platform_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedBy: uuid("updated_by").references(() => identities.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// 1.10 Notifications
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identityId: uuid("identity_id")
      .notNull()
      .references(() => identities.id),
    organizationId: uuid("organization_id").references(() => organizations.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message"),
    metadata: jsonb("metadata").default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_identity_idx").on(table.identityId),
  ]
);

// ============================================================================
// CHURCHFLOW PRODUCT TABLES (with tenant_id)
// ============================================================================

// 2.1 Members (Core church member records)
export const cfMembers = pgTable(
  "cf_members",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    churchId: text("church_id").notNull(),
    name: text("name").notNull(),
    initials: text("initials").notNull(),
    groupName: text("group_name").notNull().default("General"),
    phone: text("phone").notNull().default(""),
    email: text("email"),
    gender: text("gender"),
    birthDate: text("birth_date"),
    maritalStatus: text("marital_status"),
    weddingDate: text("wedding_date"),
    address: text("address"),
    hometown: text("hometown"),
    occupation: text("occupation"),
    membershipType: text("membership_type"),
    baptismStatus: text("baptism_status"),
    emergencyName: text("emergency_name"),
    emergencyPhone: text("emergency_phone"),
    notes: text("notes"),
    profilePhotoKey: text("profile_photo_key"),
    status: text("status").notNull().default("Active"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_members_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_members_tenant_church_id_idx").on(
      table.tenantId,
      table.churchId
    ),
  ]
);

// 2.2 Church Users (Tenant-scoped user accounts)
export const cfUsers = pgTable(
  "cf_users",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    identityId: uuid("identity_id").references(() => identities.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull().default("ministry_leader"),
    campus: text("campus").notNull().default("Grace Centre"),
    status: text("status").notNull().default("Active"),
    memberId: integer("member_id").references(() => cfMembers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  },
  (table) => [
    index("cf_users_tenant_idx").on(table.tenantId),
    index("cf_users_identity_idx").on(table.identityId),
    uniqueIndex("cf_users_tenant_email_idx").on(table.tenantId, table.email),
  ]
);

// 2.3 Mobile Devices
export const cfMobileDevices = pgTable(
  "cf_mobile_devices",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => cfUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    deviceName: text("device_name").notNull().default("ChurchFlow Mobile"),
    status: text("status").notNull().default("Active"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdByUserId: integer("created_by_user_id").references(
      () => cfUsers.id,
      { onDelete: "set null" }
    ),
    createdByName: text("created_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("cf_mobile_devices_tenant_idx").on(table.tenantId),
  ]
);

// 2.4 Households
export const cfHouseholds = pgTable(
  "cf_households",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    householdCode: text("household_code").notNull(),
    name: text("name").notNull(),
    address: text("address").notNull().default(""),
    primaryPhone: text("primary_phone").notNull().default(""),
    campus: text("campus").notNull().default("Grace Centre"),
    pastoralZone: text("pastoral_zone").notNull().default("Unassigned"),
    status: text("status").notNull().default("Active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_households_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_households_tenant_code_idx").on(
      table.tenantId,
      table.householdCode
    ),
  ]
);

// 2.5 Household Members
export const cfHouseholdMembers = pgTable(
  "cf_household_members",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    householdId: integer("household_id")
      .notNull()
      .references(() => cfHouseholds.id, { onDelete: "cascade" }),
    memberId: integer("member_id")
      .notNull()
      .references(() => cfMembers.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("Member"),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (table) => [
    index("cf_household_members_tenant_idx").on(table.tenantId),
  ]
);

// 2.6 Organisation Units (Ministries, Departments)
export const cfOrganisationUnits = pgTable(
  "cf_organisation_units",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull().default("Ministry"),
    leaderName: text("leader_name").notNull().default("Unassigned"),
    memberCount: integer("member_count").notNull().default(0),
    meetingSchedule: text("meeting_schedule")
      .notNull()
      .default("To be scheduled"),
    campus: text("campus").notNull().default("Grace Centre"),
    status: text("status").notNull().default("Active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_organisation_units_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_organisation_units_tenant_name_idx").on(
      table.tenantId,
      table.name
    ),
  ]
);

// 2.7 Leadership Appointments
export const cfLeadershipAppointments = pgTable(
  "cf_leadership_appointments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    appointmentCode: text("appointment_code").notNull(),
    memberId: integer("member_id").references(() => cfMembers.id, {
      onDelete: "set null",
    }),
    leaderName: text("leader_name").notNull(),
    title: text("title").notNull(),
    leadershipLevel: text("leadership_level").notNull(),
    ministry: text("ministry").notNull(),
    campus: text("campus").notNull().default("Grace Centre"),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    termEndDate: timestamp("term_end_date", { withTimezone: true }),
    status: text("status").notNull().default("Active"),
    createdByUserId: integer("created_by_user_id").references(
      () => cfUsers.id,
      { onDelete: "set null" }
    ),
    createdByName: text("created_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_leadership_appointments_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_leadership_appointments_tenant_code_idx").on(
      table.tenantId,
      table.appointmentCode
    ),
  ]
);

// 2.8 Volunteers
export const cfVolunteers = pgTable(
  "cf_volunteers",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    volunteerCode: text("volunteer_code").notNull(),
    memberId: integer("member_id").references(() => cfMembers.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    skills: text("skills").notNull().default(""),
    availability: text("availability").notNull().default("Sundays"),
    ministryPreference: text("ministry_preference")
      .notNull()
      .default("General Service"),
    safeguardingStatus: text("safeguarding_status")
      .notNull()
      .default("Not required"),
    status: text("status").notNull().default("Active"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdByUserId: integer("created_by_user_id").references(
      () => cfUsers.id,
      { onDelete: "set null" }
    ),
    createdByName: text("created_by_name").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_volunteers_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_volunteers_tenant_code_idx").on(
      table.tenantId,
      table.volunteerCode
    ),
  ]
);

// 2.9 Volunteer Assignments
export const cfVolunteerAssignments = pgTable(
  "cf_volunteer_assignments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    volunteerId: integer("volunteer_id")
      .notNull()
      .references(() => cfVolunteers.id, { onDelete: "cascade" }),
    eventId: integer("event_id"),
    assignmentDate: timestamp("assignment_date", { withTimezone: true }).notNull(),
    serviceName: text("service_name").notNull(),
    teamName: text("team_name").notNull(),
    role: text("role").notNull(),
    callTime: text("call_time").notNull(),
    status: text("status").notNull().default("Assigned"),
    createdByUserId: integer("created_by_user_id").references(
      () => cfUsers.id,
      { onDelete: "set null" }
    ),
    createdByName: text("created_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_volunteer_assignments_tenant_idx").on(table.tenantId),
  ]
);

// 2.10 Attendance Sessions
export const cfAttendanceSessions = pgTable(
  "cf_attendance_sessions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionCode: text("session_code").notNull(),
    title: text("title").notNull(),
    serviceType: text("service_type").notNull().default("Sunday Service"),
    serviceDate: timestamp("service_date", { withTimezone: true }).notNull(),
    startTime: text("start_time").notNull(),
    campus: text("campus").notNull().default("Grace Centre"),
    venue: text("venue").notNull().default("Main Auditorium"),
    status: text("status").notNull().default("Scheduled"),
    expectedCount: integer("expected_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_attendance_sessions_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_attendance_sessions_tenant_code_idx").on(
      table.tenantId,
      table.sessionCode
    ),
  ]
);

// 2.11 Attendance Records
export const cfAttendanceRecords = pgTable(
  "cf_attendance_records",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => cfAttendanceSessions.id, { onDelete: "cascade" }),
    memberId: integer("member_id").references(() => cfMembers.id, {
      onDelete: "set null",
    }),
    personType: text("person_type").notNull().default("Member"),
    visitorName: text("visitor_name"),
    attendanceStatus: text("attendance_status").notNull().default("Present"),
    checkInMethod: text("check_in_method").notNull().default("Manual"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    notes: text("notes"),
  },
  (table) => [
    index("cf_attendance_records_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_attendance_records_session_member_idx").on(
      table.sessionId,
      table.memberId
    ),
  ]
);

// 2.12 Finance Funds
export const cfFinanceFunds = pgTable(
  "cf_finance_funds",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    purpose: text("purpose").notNull().default("Church operations"),
    status: text("status").notNull().default("Active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_finance_funds_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_finance_funds_tenant_code_idx").on(
      table.tenantId,
      table.code
    ),
  ]
);

// 2.13 Finance Transactions
export const cfFinanceTransactions = pgTable(
  "cf_finance_transactions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(),
    type: text("type").notNull(),
    category: text("category").notNull(),
    fundId: integer("fund_id")
      .notNull()
      .references(() => cfFinanceFunds.id),
    amountPesewas: integer("amount_pesewas").notNull(),
    transactionDate: timestamp("transaction_date", { withTimezone: true }).notNull(),
    paymentMethod: text("payment_method").notNull().default("Cash"),
    description: text("description").notNull(),
    payerPayee: text("payer_payee"),
    receiptNumber: text("receipt_number"),
    status: text("status").notNull().default("Pending"),
    recordedBy: text("recorded_by").notNull(),
    recordedByUserId: integer("recorded_by_user_id").references(
      () => cfUsers.id,
      { onDelete: "set null" }
    ),
    recordedByEmail: text("recorded_by_email"),
    approvedBy: text("approved_by"),
    approvedByUserId: integer("approved_by_user_id").references(
      () => cfUsers.id,
      { onDelete: "set null" }
    ),
    approvedByEmail: text("approved_by_email"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    decisionReason: text("decision_reason"),
    reversalOfId: integer("reversal_of_id"),
    reversalReason: text("reversal_reason"),
    immutableAt: timestamp("immutable_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_finance_transactions_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_finance_transactions_tenant_reference_idx").on(
      table.tenantId,
      table.reference
    ),
  ]
);

// 2.14 Welfare Requests
export const cfWelfareRequests = pgTable(
  "cf_welfare_requests",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requestCode: text("request_code").notNull(),
    memberId: integer("member_id").references(() => cfMembers.id, {
      onDelete: "set null",
    }),
    beneficiaryName: text("beneficiary_name").notNull(),
    beneficiaryPhone: text("beneficiary_phone"),
    supportType: text("support_type").notNull(),
    amountRequestedPesewas: integer("amount_requested_pesewas").notNull(),
    amountApprovedPesewas: integer("amount_approved_pesewas"),
    urgency: text("urgency").notNull().default("Normal"),
    assessmentSummary: text("assessment_summary").notNull(),
    assignedCommittee: text("assigned_committee")
      .notNull()
      .default("Welfare Committee"),
    decisionReason: text("decision_reason"),
    status: text("status").notNull().default("Pending assessment"),
    financeTransactionId: integer("finance_transaction_id").references(
      () => cfFinanceTransactions.id,
      { onDelete: "set null" }
    ),
    requestedByUserId: integer("requested_by_user_id").references(
      () => cfUsers.id,
      { onDelete: "set null" }
    ),
    requestedByName: text("requested_by_name").notNull(),
    reviewedByUserId: integer("reviewed_by_user_id").references(
      () => cfUsers.id,
      { onDelete: "set null" }
    ),
    reviewedByName: text("reviewed_by_name"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_welfare_requests_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_welfare_requests_tenant_code_idx").on(
      table.tenantId,
      table.requestCode
    ),
  ]
);

// 2.15 Payroll Staff
export const cfPayrollStaff = pgTable(
  "cf_payroll_staff",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    staffCode: text("staff_code").notNull(),
    memberId: integer("member_id").references(() => cfMembers.id, {
      onDelete: "set null",
    }),
    fullName: text("full_name").notNull(),
    jobTitle: text("job_title").notNull(),
    department: text("department").notNull(),
    employmentType: text("employment_type").notNull().default("Full-time"),
    bankName: text("bank_name"),
    bankAccountLast4: text("bank_account_last4"),
    mobileMoneyNumber: text("mobile_money_number"),
    baseSalaryPesewas: integer("base_salary_pesewas").notNull(),
    recurringAllowancePesewas: integer("recurring_allowance_pesewas")
      .notNull()
      .default(0),
    recurringDeductionPesewas: integer("recurring_deduction_pesewas")
      .notNull()
      .default(0),
    status: text("status").notNull().default("Active"),
    createdByUserId: integer("created_by_user_id").references(
      () => cfUsers.id,
      { onDelete: "set null" }
    ),
    createdByName: text("created_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_payroll_staff_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_payroll_staff_tenant_code_idx").on(
      table.tenantId,
      table.staffCode
    ),
  ]
);

// 2.16 Payroll Runs
export const cfPayrollRuns = pgTable(
  "cf_payroll_runs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    runCode: text("run_code").notNull(),
    payPeriod: text("pay_period").notNull(),
    paymentDate: timestamp("payment_date", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("Draft"),
    grossPesewas: integer("gross_pesewas").notNull().default(0),
    deductionsPesewas: integer("deductions_pesewas").notNull().default(0),
    netPesewas: integer("net_pesewas").notNull().default(0),
    preparedByUserId: integer("prepared_by_user_id").references(
      () => cfUsers.id,
      { onDelete: "set null" }
    ),
    preparedByName: text("prepared_by_name").notNull(),
    approvedByUserId: integer("approved_by_user_id").references(
      () => cfUsers.id,
      { onDelete: "set null" }
    ),
    approvedByName: text("approved_by_name"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    decisionReason: text("decision_reason"),
    financeTransactionId: integer("finance_transaction_id").references(
      () => cfFinanceTransactions.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_payroll_runs_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_payroll_runs_tenant_code_idx").on(
      table.tenantId,
      table.runCode
    ),
  ]
);

// 2.17 Payroll Items
export const cfPayrollItems = pgTable(
  "cf_payroll_items",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    payrollRunId: integer("payroll_run_id")
      .notNull()
      .references(() => cfPayrollRuns.id, { onDelete: "cascade" }),
    staffId: integer("staff_id")
      .notNull()
      .references(() => cfPayrollStaff.id),
    baseSalaryPesewas: integer("base_salary_pesewas").notNull(),
    allowancesPesewas: integer("allowances_pesewas").notNull().default(0),
    deductionsPesewas: integer("deductions_pesewas").notNull().default(0),
    netPayPesewas: integer("net_pay_pesewas").notNull(),
    paymentStatus: text("payment_status").notNull().default("Pending"),
  },
  (table) => [
    index("cf_payroll_items_tenant_idx").on(table.tenantId),
  ]
);

// 2.18 Generated Records (Certificates, Letters)
export const cfGeneratedRecords = pgTable(
  "cf_generated_records",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    recordCode: text("record_code").notNull(),
    recordType: text("record_type").notNull(),
    templateType: text("template_type").notNull(),
    memberId: integer("member_id").references(() => cfMembers.id, {
      onDelete: "set null",
    }),
    subjectName: text("subject_name").notNull(),
    eventDate: timestamp("event_date", { withTimezone: true }),
    fieldsJson: jsonb("fields_json").notNull().default({}),
    status: text("status").notNull().default("Draft"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    issuedByUserId: integer("issued_by_user_id").references(
      () => cfUsers.id,
      { onDelete: "set null" }
    ),
    issuedByName: text("issued_by_name"),
    createdByUserId: integer("created_by_user_id").references(
      () => cfUsers.id,
      { onDelete: "set null" }
    ),
    createdByName: text("created_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_generated_records_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_generated_records_tenant_code_idx").on(
      table.tenantId,
      table.recordCode
    ),
  ]
);

// 2.19 Archive Assets (Sermons, Documents, Media)
export const cfArchiveAssets = pgTable(
  "cf_archive_assets",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    assetCode: text("asset_code").notNull(),
    assetType: text("asset_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    speakerAuthor: text("speaker_author"),
    ministry: text("ministry").notNull().default("Church-wide"),
    eventDate: timestamp("event_date", { withTimezone: true }),
    scriptureReference: text("scripture_reference"),
    tags: text("tags").notNull().default(""),
    fileKey: text("file_key"),
    fileName: text("file_name"),
    contentType: text("content_type"),
    fileSize: integer("file_size"),
    externalUrl: text("external_url"),
    visibility: text("visibility").notNull().default("Internal"),
    status: text("status").notNull().default("Published"),
    uploadedByUserId: integer("uploaded_by_user_id").references(
      () => cfUsers.id,
      { onDelete: "set null" }
    ),
    uploadedByName: text("uploaded_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_archive_assets_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_archive_assets_tenant_code_idx").on(
      table.tenantId,
      table.assetCode
    ),
  ]
);

// 2.20 Church Events
export const cfChurchEvents = pgTable(
  "cf_church_events",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    eventCode: text("event_code").notNull(),
    title: text("title").notNull(),
    eventType: text("event_type").notNull().default("Service"),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time"),
    campus: text("campus").notNull().default("Grace Centre"),
    venue: text("venue").notNull().default("Main Auditorium"),
    coordinator: text("coordinator").notNull().default("Unassigned"),
    expectedAttendance: integer("expected_attendance").notNull().default(0),
    status: text("status").notNull().default("Planning"),
    attendanceSessionId: integer("attendance_session_id").references(
      () => cfAttendanceSessions.id,
      { onDelete: "set null" }
    ),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_church_events_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_church_events_tenant_code_idx").on(
      table.tenantId,
      table.eventCode
    ),
  ]
);

// 2.21 Event Programme Items
export const cfEventProgrammeItems = pgTable(
  "cf_event_programme_items",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    eventId: integer("event_id")
      .notNull()
      .references(() => cfChurchEvents.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    title: text("title").notNull(),
    owner: text("owner").notNull().default("Unassigned"),
    durationMinutes: integer("duration_minutes").notNull().default(10),
    status: text("status").notNull().default("Ready"),
  },
  (table) => [
    index("cf_event_programme_items_tenant_idx").on(table.tenantId),
  ]
);

// 2.22 Event Assignments
export const cfEventAssignments = pgTable(
  "cf_event_assignments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    eventId: integer("event_id")
      .notNull()
      .references(() => cfChurchEvents.id, { onDelete: "cascade" }),
    teamName: text("team_name").notNull(),
    leaderName: text("leader_name").notNull().default("Unassigned"),
    requiredCount: integer("required_count").notNull().default(1),
    confirmedCount: integer("confirmed_count").notNull().default(0),
    status: text("status").notNull().default("Pending"),
  },
  (table) => [
    index("cf_event_assignments_tenant_idx").on(table.tenantId),
  ]
);

// 2.23 Care Cases
export const cfCareCases = pgTable(
  "cf_care_cases",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    caseCode: text("case_code").notNull(),
    memberId: integer("member_id").references(() => cfMembers.id, {
      onDelete: "set null",
    }),
    personName: text("person_name").notNull(),
    personPhone: text("person_phone"),
    personType: text("person_type").notNull().default("Member"),
    caseType: text("case_type").notNull(),
    source: text("source").notNull().default("Church office"),
    priority: text("priority").notNull().default("Normal"),
    stage: text("stage").notNull().default("New"),
    assignedTo: text("assigned_to").notNull().default("Pastoral Care Team"),
    nextActionDate: timestamp("next_action_date", { withTimezone: true }),
    summary: text("summary").notNull(),
    sensitiveNotes: text("sensitive_notes"),
    isConfidential: boolean("is_confidential").notNull().default(false),
    status: text("status").notNull().default("Open"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_care_cases_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_care_cases_tenant_code_idx").on(
      table.tenantId,
      table.caseCode
    ),
  ]
);

// 2.24 Care Activities
export const cfCareActivities = pgTable(
  "cf_care_activities",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    caseId: integer("case_id")
      .notNull()
      .references(() => cfCareCases.id, { onDelete: "cascade" }),
    activityType: text("activity_type").notNull(),
    note: text("note").notNull(),
    outcome: text("outcome"),
    completedBy: text("completed_by").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_care_activities_tenant_idx").on(table.tenantId),
  ]
);

// 2.25 Communication Campaigns
export const cfCommunicationCampaigns = pgTable(
  "cf_communication_campaigns",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campaignCode: text("campaign_code").notNull(),
    name: text("name").notNull(),
    channel: text("channel").notNull(),
    audience: text("audience").notNull(),
    subject: text("subject"),
    message: text("message").notNull(),
    status: text("status").notNull().default("Draft"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    recipientCount: integer("recipient_count").notNull().default(0),
    deliveredCount: integer("delivered_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    createdByUserId: integer("created_by_user_id").references(
      () => cfUsers.id,
      { onDelete: "set null" }
    ),
    createdByName: text("created_by_name").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_communication_campaigns_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_communication_campaigns_tenant_code_idx").on(
      table.tenantId,
      table.campaignCode
    ),
  ]
);

// 2.26 Celebration Reminders
export const cfCelebrationReminders = pgTable(
  "cf_celebration_reminders",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reminderCode: text("reminder_code").notNull(),
    memberId: integer("member_id")
      .notNull()
      .references(() => cfMembers.id, { onDelete: "cascade" }),
    celebrationType: text("celebration_type").notNull(),
    occurrenceDate: timestamp("occurrence_date", { withTimezone: true }).notNull(),
    channel: text("channel").notNull().default("In-app"),
    status: text("status").notNull().default("Prepared"),
    campaignId: integer("campaign_id").references(
      () => cfCommunicationCampaigns.id,
      { onDelete: "set null" }
    ),
    preparedByUserId: integer("prepared_by_user_id").references(
      () => cfUsers.id,
      { onDelete: "set null" }
    ),
    preparedByName: text("prepared_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_celebration_reminders_tenant_idx").on(table.tenantId),
    uniqueIndex("cf_celebration_reminders_tenant_member_type_date_idx").on(
      table.tenantId,
      table.memberId,
      table.celebrationType,
      table.occurrenceDate
    ),
  ]
);

// 2.27 Audit Logs (Tenant-scoped)
export const cfAuditLogs = pgTable(
  "cf_audit_logs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsDefault(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorEmail: text("actor_email").notNull(),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    detail: text("detail"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cf_audit_logs_tenant_idx").on(table.tenantId),
  ]
);
