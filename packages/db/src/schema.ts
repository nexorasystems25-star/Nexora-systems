import {
  pgTable,
  pgEnum,
  uuid,
  text,
  real,
  timestamp,
  boolean,
  integer,
  jsonb,
  date,
  inet,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
}, (table) => ({
  slugProductIdx: uniqueIndex("organizations_slug_product_idx").on(table.slug, table.productId),
}));

// Branches / Campuses (multi-site within a tenant)
export const branches = pgTable("branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  address: text("address"),
  timezone: text("timezone"),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  orgSlugIdx: uniqueIndex("branches_org_slug_idx").on(table.organizationId, table.slug),
  orgIdx: index("branches_org_idx").on(table.organizationId),
}));

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

// Memberships (User-Tenant relationship). branchId scopes a role to a single
// branch (NULL = org-wide). One org-wide membership + one per branch per identity.
export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  identityId: uuid("identity_id").references(() => identities.id),
  organizationId: uuid("organization_id").references(() => organizations.id),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  role: text("role").notNull(),
  status: text("status").default("active"),
  invitedBy: uuid("invited_by").references(() => identities.id),
  invitedAt: timestamp("invited_at"),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => ({
  identityOrgIdx: uniqueIndex("memberships_identity_org_idx")
    .on(table.identityId, table.organizationId)
    .where(sql`branch_id IS NULL`),
  identityOrgBranchIdx: uniqueIndex("memberships_identity_org_branch_idx")
    .on(table.identityId, table.organizationId, table.branchId)
    .where(sql`branch_id IS NOT NULL`),
  branchIdx: index("memberships_branch_idx").on(table.branchId),
}));

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

// Support Tickets (extended for product-scoped support + SLA)
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  productId: uuid("product_id").references(() => products.id),
  identityId: uuid("identity_id").references(() => identities.id),
  subject: text("subject").notNull(),
  description: text("description"),
  status: text("status").default("open"),
  priority: text("priority").default("medium"),
  category: text("category").default("general"),
  productArea: text("product_area"),
  assignedTo: uuid("assigned_to").references(() => identities.id),
  createdBy: uuid("created_by").references(() => identities.id),
  firstResponseAt: timestamp("first_response_at"),
  slaDueAt: timestamp("sla_due_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audit Events (extended with product + impersonation scope)
export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  productId: uuid("product_id").references(() => products.id),
  identityId: uuid("identity_id").references(() => identities.id),
  actorScope: text("actor_scope"),
  impersonatedBy: uuid("impersonated_by").references(() => identities.id),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  metadata: jsonb("metadata"),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// ACCESS MODEL TABLES (three-plane: platform / product / tenant)
// ============================================================================

// Product super-admins (e.g. ChurchFlow product owner) across all tenants of a product.
export const productMemberships = pgTable("product_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  identityId: uuid("identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull().default("product_support"), // product_owner | product_admin | product_support
  grantedBy: uuid("granted_by").references(() => identities.id),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  productIdentityIdx: uniqueIndex("product_memberships_product_identity_idx").on(table.productId, table.identityId),
}));

// Nexora platform staff (non-owner operators: support, billing, success).
export const platformStaff = pgTable("platform_staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  identityId: uuid("identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull().default("support"), // owner | support | billing | success
  permissions: jsonb("permissions").default([]),
  grantedBy: uuid("granted_by").references(() => identities.id),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  identityIdx: uniqueIndex("platform_staff_identity_idx").on(table.identityId),
}));

// Threaded replies on a support ticket (separates conversation from the ticket row).
export const supportTicketMessages = pgTable("support_ticket_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").references(() => supportTickets.id, { onDelete: "cascade" }).notNull(),
  authorIdentityId: uuid("author_identity_id").references(() => identities.id),
  authorScope: text("author_scope").notNull(), // platform | product | tenant | client
  body: text("body").notNull(),
  isInternal: boolean("is_internal").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  ticketIdx: index("support_ticket_messages_ticket_idx").on(table.ticketId),
}));

// Audited, time-bounded support impersonation of a tenant.
export const impersonationSessions = pgTable("impersonation_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  staffIdentityId: uuid("staff_identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull(),
  staffScope: text("staff_scope").notNull(), // platform | product
  targetOrganizationId: uuid("target_organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id),
  reason: text("reason").notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  endedAt: timestamp("ended_at"),
  ipAddress: inet("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  staffIdx: index("impersonation_sessions_staff_idx").on(table.staffIdentityId),
  targetIdx: index("impersonation_sessions_target_idx").on(table.targetOrganizationId),
}));

// Invitations
export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  role: text("role").notNull(),
  invitedBy: uuid("invited_by").references(() => identities.id),
  token: text("token").notNull(),
  status: text("status").default("pending"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tenant Domains (custom domain mappings)
export const tenantDomains = pgTable("tenant_domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  productSlug: text("product_slug").notNull(),
  domain: text("domain").notNull().unique(),
  isPrimary: boolean("is_primary").default(false),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// CHURCHFLOW PRODUCT TABLES
// ============================================================================

// ChurchFlow Members
export const cfMembers = pgTable("cf_members", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid("tenant_id").references(() => organizations.id),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
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
}, (table) => ({
  tenantIdx: index("cf_members_tenant_idx").on(table.tenantId),
  branchIdx: index("cf_members_branch_idx").on(table.branchId),
}));

// ChurchFlow Events
export const cfEvents = pgTable("cf_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid("tenant_id").references(() => organizations.id),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
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
}, (table) => ({
  tenantIdx: index("cf_events_tenant_idx").on(table.tenantId),
  branchIdx: index("cf_events_branch_idx").on(table.branchId),
}));

// ChurchFlow Finance Funds
export const cfFinanceFunds = pgTable("cf_finance_funds", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid("tenant_id").references(() => organizations.id),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  purpose: text("purpose"),
  status: text("status").default("Active"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdx: index("cf_finance_funds_tenant_idx").on(table.tenantId),
  branchIdx: index("cf_finance_funds_branch_idx").on(table.branchId),
}));

// ChurchFlow Finance Transactions
export const cfFinanceTransactions = pgTable("cf_finance_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid("tenant_id").references(() => organizations.id),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
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
}, (table) => ({
  tenantIdx: index("cf_finance_transactions_tenant_idx").on(table.tenantId),
  branchIdx: index("cf_finance_transactions_branch_idx").on(table.branchId),
}));

// ============================================================================
// AICOS RUNTIME TABLES (shared agent runtime — see @nexora/aicos)
// ============================================================================

export const aicosAgentRoleEnum = pgEnum("aicos_agent_role", [
  "chief-executive",
  "coo",
  "cpo",
  "cto",
  "developer",
  "custom",
]);

export const aicosSessionStatusEnum = pgEnum("aicos_session_status", [
  "active",
  "archived",
]);

export const aicosMessageRoleEnum = pgEnum("aicos_message_role", [
  "user",
  "assistant",
  "tool",
]);

export const aicosReviewTypeEnum = pgEnum("aicos_review_type", [
  "code-review",
  "dependency-audit",
  "security-scan",
  "performance-check",
]);

export const aicosReviewStatusEnum = pgEnum("aicos_review_status", [
  "pending",
  "approved",
  "rejected",
  "failed",
]);

// Status of a human-in-the-loop change request for an agent's configuration.
// `approved` means the reviewer accepted AND the patch was applied; `rejected`
// means it was denied (nothing changed on the agent).
export const aicosChangeStatusEnum = pgEnum("aicos_change_status", [
  "pending",
  "approved",
  "rejected",
]);

// Agents — the runtime's building blocks. `product` scopes an agent to a
// specific Nexora product (ChurchFlow, School Suite, Counseling, SUSU).
export const aicosAgents = pgTable("aicos_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  product: text("product"),
  role: aicosAgentRoleEnum("role").notNull().default("custom"),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt"),
  model: text("model"),
  provider: text("provider").notNull().default("stub"),
  temperature: real("temperature").notNull().default(0.7),
  capabilities: jsonb("capabilities").default([]),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: uuid("created_by").references(() => identities.id),
  // Delegation: the agent this agent was spawned/authorized by. Null for
  // top-level agents. Self-referencing with SET NULL so removing a parent
  // disowns children instead of cascading their deletion.
  parentAgentId: uuid("parent_agent_id").references((): AnyPgColumn => aicosAgents.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Sessions — a conversation between a staff member and an agent.
export const aicosSessions = pgTable("aicos_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => aicosAgents.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New session"),
  status: aicosSessionStatusEnum("status").notNull().default("active"),
  createdBy: uuid("created_by").references(() => identities.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Messages — turns within a session.
export const aicosMessages = pgTable("aicos_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => aicosSessions.id, { onDelete: "cascade" }),
  role: aicosMessageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  model: text("model"),
  provider: text("provider"),
  toolCalls: jsonb("tool_calls"),
  createdBy: uuid("created_by").references(() => identities.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Memory — editable key/value blocks per agent (optionally per session).
export const aicosMemory = pgTable("aicos_memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => aicosAgents.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => aicosSessions.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => identities.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  agentKeyIdx: uniqueIndex("aicos_memory_agent_key_idx").on(table.agentId, table.key),
}));

// Reviews — persisted governance/architecture review records.
export const aicosReviews = pgTable("aicos_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: text("product_id").notNull(),
  type: aicosReviewTypeEnum("type").notNull(),
  status: aicosReviewStatusEnum("status").notNull().default("pending"),
  findings: jsonb("findings").default([]),
  createdBy: uuid("created_by").references(() => identities.id),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Pending agent changes — human-in-the-loop governance for privilege-affecting
// agent mutations. An agent (or a staff member without direct write permission)
// proposes a config patch; a reviewer with `agent.approve` must accept it before
// it is applied. This prevents an agent from silently rewriting its own privileges.
export const aicosPendingChanges = pgTable("aicos_pending_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").notNull().references(() => aicosAgents.id, { onDelete: "cascade" }),
  requestedById: uuid("requested_by_id").references(() => identities.id),
  // "human" for staff-initiated requests, "agent" for self-requested changes.
  requestedByType: text("requested_by_type").notNull().default("human"),
  reason: text("reason"),
  // The allow-listed subset of agent fields the proposer wants changed.
  proposedPatch: jsonb("proposed_patch").notNull(),
  status: aicosChangeStatusEnum("status").notNull().default("pending"),
  reviewerId: uuid("reviewer_id").references(() => identities.id),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  agentStatusIdx: index("aicos_pending_changes_agent_status_idx").on(table.agentId, table.status),
  orgStatusIdx: index("aicos_pending_changes_org_status_idx").on(table.organizationId, table.status),
}));

// ============================================================================
// EXPORTS
// ============================================================================

export type AicosAgent = typeof aicosAgents.$inferSelect;
export type NewAicosAgent = typeof aicosAgents.$inferInsert;
export type AicosSession = typeof aicosSessions.$inferSelect;
export type NewAicosSession = typeof aicosSessions.$inferInsert;
export type AicosMessage = typeof aicosMessages.$inferSelect;
export type NewAicosMessage = typeof aicosMessages.$inferInsert;
export type AicosMemory = typeof aicosMemory.$inferSelect;
export type NewAicosMemory = typeof aicosMemory.$inferInsert;
export type AicosReview = typeof aicosReviews.$inferSelect;
export type NewAicosReview = typeof aicosReviews.$inferInsert;
export type AicosPendingChange = typeof aicosPendingChanges.$inferSelect;
export type NewAicosPendingChange = typeof aicosPendingChanges.$inferInsert;

export type Product = typeof products.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
export type Identity = typeof identities.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type ProductMembership = typeof productMemberships.$inferSelect;
export type NewProductMembership = typeof productMemberships.$inferInsert;
export type PlatformStaff = typeof platformStaff.$inferSelect;
export type NewPlatformStaff = typeof platformStaff.$inferInsert;
export type SupportTicketMessage = typeof supportTicketMessages.$inferSelect;
export type NewSupportTicketMessage = typeof supportTicketMessages.$inferInsert;
export type ImpersonationSession = typeof impersonationSessions.$inferSelect;
export type NewImpersonationSession = typeof impersonationSessions.$inferInsert;

export type CfMember = typeof cfMembers.$inferSelect;
export type CfEvent = typeof cfEvents.$inferSelect;
export type CfFinanceFund = typeof cfFinanceFunds.$inferSelect;
export type CfFinanceTransaction = typeof cfFinanceTransactions.$inferSelect;
