import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  date,
  inet,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ============================================================================
// PLATFORM TABLES (Shared across all products)
// ============================================================================

// Products (ChurchFlow, School Suite, etc.)
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain"),
  description: text("description"),
  status: text("status").default("active"),
  pricingTiers: jsonb("pricing_tiers"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Organizations (Tenants)
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  productId: uuid("product_id").references(() => products.id),
  lifecycleState: text("lifecycle_state").default("lead"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("organizations_slug_product_idx").on(table.slug, table.productId),
]);

// Identities (Users)
export const identities = pgTable("identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  emailVerified: boolean("email_verified").default(false),
  mfaEnabled: boolean("mfa_enabled").default(false),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Memberships (User-Tenant relationship)
export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  identityId: uuid("identity_id").references(() => identities.id),
  organizationId: uuid("organization_id").references(() => organizations.id),
  role: text("role").notNull(),
  status: text("status").default("active"),
  invitedBy: uuid("invited_by").references(() => identities.id),
  invitedAt: timestamp("invited_at"),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => [
  uniqueIndex("memberships_identity_org_idx").on(table.identityId, table.organizationId),
]);

// Subscriptions
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  productId: uuid("product_id").references(() => products.id),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan").notNull(),
  status: text("status").default("active"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAt: timestamp("cancel_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoices
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
  stripeInvoiceId: text("stripe_invoice_id"),
  amountPesewas: integer("amount_pesewas").notNull(),
  currency: text("currency").default("GHS"),
  status: text("status").default("pending"),
  dueDate: date("due_date"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Support Tickets
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  identityId: uuid("identity_id").references(() => identities.id),
  subject: text("subject").notNull(),
  description: text("description"),
  status: text("status").default("open"),
  priority: text("priority").default("medium"),
  assignedTo: uuid("assigned_to").references(() => identities.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audit Events
export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  identityId: uuid("identity_id").references(() => identities.id),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  metadata: jsonb("metadata"),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Invitations
export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  email: text("email").notNull(),
  role: text("role").notNull(),
  invitedBy: uuid("invited_by").references(() => identities.id),
  token: text("token").notNull(),
  status: text("status").default("pending"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// CHURCHFLOW PRODUCT TABLES
// ============================================================================

// ChurchFlow Members
export const cfMembers = pgTable("cf_members", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid("tenant_id").references(() => organizations.id),
  churchId: text("church_id").notNull(),
  name: text("name").notNull(),
  initials: text("initials"),
  groupName: text("group_name"),
  phone: text("phone"),
  email: text("email"),
  gender: text("gender"),
  birthDate: date("birth_date"),
  maritalStatus: text("marital_status"),
  status: text("status").default("Active"),
  joinedAt: date("joined_at"),
  profilePhotoKey: text("profile_photo_key"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("cf_members_tenant_idx").on(table.tenantId),
]);

// ChurchFlow Events
export const cfEvents = pgTable("cf_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid("tenant_id").references(() => organizations.id),
  eventCode: text("event_code").notNull(),
  title: text("title").notNull(),
  eventType: text("event_type"),
  startDate: date("start_date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  venue: text("venue"),
  coordinator: text("coordinator"),
  expectedAttendance: integer("expected_attendance"),
  status: text("status").default("Planning"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("cf_events_tenant_idx").on(table.tenantId),
]);

// ChurchFlow Finance Funds
export const cfFinanceFunds = pgTable("cf_finance_funds", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid("tenant_id").references(() => organizations.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  purpose: text("purpose"),
  status: text("status").default("Active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("cf_finance_funds_tenant_idx").on(table.tenantId),
]);

// ChurchFlow Finance Transactions
export const cfFinanceTransactions = pgTable("cf_finance_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid("tenant_id").references(() => organizations.id),
  reference: text("reference").notNull(),
  type: text("type").notNull(),
  category: text("category"),
  fundId: integer("fund_id").references(() => cfFinanceFunds.id),
  amountPesewas: integer("amount_pesewas").notNull(),
  transactionDate: date("transaction_date").notNull(),
  paymentMethod: text("payment_method"),
  description: text("description"),
  payerPayee: text("payer_payee"),
  receiptNumber: text("receipt_number"),
  status: text("status").default("Pending"),
  recordedBy: text("recorded_by"),
  recordedByUserId: integer("recorded_by_user_id"),
  recordedByEmail: text("recorded_by_email"),
  approvedBy: text("approved_by"),
  approvedByUserId: integer("approved_by_user_id"),
  approvedByEmail: text("approved_by_email"),
  approvedAt: timestamp("approved_at"),
  decisionReason: text("decision_reason"),
  reversalOfId: integer("reversal_of_id"),
  reversalReason: text("reversal_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  immutableAt: timestamp("immutable_at"),
}, (table) => [
  index("cf_finance_transactions_tenant_idx").on(table.tenantId),
]);

// ============================================================================
// EXPORTS
// ============================================================================

export type Product = typeof products.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Identity = typeof identities.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;

export type CfMember = typeof cfMembers.$inferSelect;
export type CfEvent = typeof cfEvents.$inferSelect;
export type CfFinanceFund = typeof cfFinanceFunds.$inferSelect;
export type CfFinanceTransaction = typeof cfFinanceTransactions.$inferSelect;
