-- ============================================================================
-- NEXORA PLATFORM: Multi-Tenant Migration for ChurchFlow
-- ============================================================================
-- Purpose: Transform ChurchFlow from single-tenant SQLite to multi-tenant
--          PostgreSQL within the Nexora enterprise platform.
--
-- Architecture:
--   Platform Layer: organizations, products, identities, memberships,
--                   subscriptions, invoices, support_tickets, audit_events
--   Product Layer:  All ChurchFlow tables with tenant_id foreign key
--
-- Auth Hierarchy:
--   Level 1: Platform Owner (nexorasystems25@gmail.com) - full platform access
--   Level 2: Nexora Staff - manage clients, billing, support
--   Level 3: Client Users - tenant-scoped access (admin, manager, leader, member)
--   Level 4: Public - registration, login, password reset
--
-- First Tenant: GRAG (Tenant 001, product: ChurchFlow)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SECTION 1: PLATFORM TABLES (Nexora Control Plane)
-- ============================================================================

-- Lifecycle states for client organizations
DO $$ BEGIN
    CREATE TYPE public.lifecycle_state AS ENUM (
        'lead', 'qualified', 'consultation', 'proposal', 'contracted',
        'onboarding', 'active', 'at_risk', 'renewal_due', 'suspended',
        'offboarding', 'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Membership scopes
DO $$ BEGIN
    CREATE TYPE public.membership_scope AS ENUM (
        'platform', 'staff', 'tenant', 'self'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1.1 Organizations (Tenants)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    sector TEXT NOT NULL DEFAULT 'church',
    lifecycle public.lifecycle_state NOT NULL DEFAULT 'lead',
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.2 Products (ChurchFlow, School Suite, etc.)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'planned',
    description TEXT,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.3 Identities (User accounts across platform)
CREATE TABLE IF NOT EXISTS public.identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'invited',
    mfa_required BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.4 Memberships (User-tenant mappings with roles)
CREATE TABLE IF NOT EXISTS public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id UUID NOT NULL REFERENCES public.identities(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    role TEXT NOT NULL,
    scope public.membership_scope NOT NULL DEFAULT 'tenant',
    status TEXT NOT NULL DEFAULT 'invited',
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(identity_id, organization_id, role)
);

-- 1.5 Subscriptions (Billing per tenant-product)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    plan TEXT NOT NULL DEFAULT 'starter',
    status TEXT NOT NULL DEFAULT 'trialing',
    monthly_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'GHS',
    trial_ends_at TIMESTAMPTZ,
    renewal_at DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.6 Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    subscription_id UUID REFERENCES public.subscriptions(id),
    number TEXT NOT NULL UNIQUE,
    amount NUMERIC(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'GHS',
    status TEXT NOT NULL DEFAULT 'draft',
    due_at DATE,
    paid_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.7 Support Tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    ticket_number TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    category TEXT DEFAULT 'general',
    assigned_to UUID REFERENCES public.identities(id),
    created_by UUID REFERENCES public.identities(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.8 Audit Events (Platform-wide)
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id),
    actor_id UUID REFERENCES public.identities(id),
    actor_email TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    entity_code TEXT,
    payload JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.9 Platform Configuration
CREATE TABLE IF NOT EXISTS public.platform_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES public.identities(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.10 Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id UUID NOT NULL REFERENCES public.identities(id),
    organization_id UUID REFERENCES public.organizations(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    metadata JSONB DEFAULT '{}',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SECTION 2: CHURCHFLOW PRODUCT TABLES (with tenant_id)
-- ============================================================================

-- 2.1 Members (Core church member records)
CREATE TABLE IF NOT EXISTS public.cf_members (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    church_id TEXT NOT NULL,
    name TEXT NOT NULL,
    initials TEXT NOT NULL,
    group_name TEXT NOT NULL DEFAULT 'General',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT,
    gender TEXT,
    birth_date TEXT,
    marital_status TEXT,
    wedding_date TEXT,
    address TEXT,
    hometown TEXT,
    occupation TEXT,
    membership_type TEXT,
    baptism_status TEXT,
    emergency_name TEXT,
    emergency_phone TEXT,
    notes TEXT,
    profile_photo_key TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, church_id)
);

-- 2.2 Church Users (Tenant-scoped user accounts)
CREATE TABLE IF NOT EXISTS public.cf_users (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    identity_id UUID REFERENCES public.identities(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'ministry_leader',
    campus TEXT NOT NULL DEFAULT 'Grace Centre',
    status TEXT NOT NULL DEFAULT 'Active',
    member_id BIGINT REFERENCES public.cf_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    UNIQUE(tenant_id, email)
);

-- 2.3 Mobile Devices
CREATE TABLE IF NOT EXISTS public.cf_mobile_devices (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.cf_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    device_name TEXT NOT NULL DEFAULT 'ChurchFlow Mobile',
    status TEXT NOT NULL DEFAULT 'Active',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_by_user_id BIGINT REFERENCES public.cf_users(id) ON DELETE SET NULL,
    created_by_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

-- 2.4 Households
CREATE TABLE IF NOT EXISTS public.cf_households (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    household_code TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    primary_phone TEXT NOT NULL DEFAULT '',
    campus TEXT NOT NULL DEFAULT 'Grace Centre',
    pastoral_zone TEXT NOT NULL DEFAULT 'Unassigned',
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, household_code)
);

-- 2.5 Household Members
CREATE TABLE IF NOT EXISTS public.cf_household_members (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    household_id BIGINT NOT NULL REFERENCES public.cf_households(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES public.cf_members(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL DEFAULT 'Member',
    is_primary BOOLEAN NOT NULL DEFAULT false
);

-- 2.6 Organisation Units (Ministries, Departments)
CREATE TABLE IF NOT EXISTS public.cf_organisation_units (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Ministry',
    leader_name TEXT NOT NULL DEFAULT 'Unassigned',
    member_count INTEGER NOT NULL DEFAULT 0,
    meeting_schedule TEXT NOT NULL DEFAULT 'To be scheduled',
    campus TEXT NOT NULL DEFAULT 'Grace Centre',
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- 2.7 Leadership Appointments
CREATE TABLE IF NOT EXISTS public.cf_leadership_appointments (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    appointment_code TEXT NOT NULL,
    member_id BIGINT REFERENCES public.cf_members(id) ON DELETE SET NULL,
    leader_name TEXT NOT NULL,
    title TEXT NOT NULL,
    leadership_level TEXT NOT NULL,
    ministry TEXT NOT NULL,
    campus TEXT NOT NULL DEFAULT 'Grace Centre',
    start_date TIMESTAMPTZ NOT NULL,
    term_end_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'Active',
    created_by_user_id BIGINT REFERENCES public.cf_users(id) ON DELETE SET NULL,
    created_by_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, appointment_code)
);

-- 2.8 Volunteers
CREATE TABLE IF NOT EXISTS public.cf_volunteers (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    volunteer_code TEXT NOT NULL,
    member_id BIGINT REFERENCES public.cf_members(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    skills TEXT NOT NULL DEFAULT '',
    availability TEXT NOT NULL DEFAULT 'Sundays',
    ministry_preference TEXT NOT NULL DEFAULT 'General Service',
    safeguarding_status TEXT NOT NULL DEFAULT 'Not required',
    status TEXT NOT NULL DEFAULT 'Active',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id BIGINT REFERENCES public.cf_users(id) ON DELETE SET NULL,
    created_by_name TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, volunteer_code)
);

-- 2.9 Volunteer Assignments
CREATE TABLE IF NOT EXISTS public.cf_volunteer_assignments (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    volunteer_id BIGINT NOT NULL REFERENCES public.cf_volunteers(id) ON DELETE CASCADE,
    event_id BIGINT,
    assignment_date TIMESTAMPTZ NOT NULL,
    service_name TEXT NOT NULL,
    team_name TEXT NOT NULL,
    role TEXT NOT NULL,
    call_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Assigned',
    created_by_user_id BIGINT REFERENCES public.cf_users(id) ON DELETE SET NULL,
    created_by_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.10 Attendance Sessions
CREATE TABLE IF NOT EXISTS public.cf_attendance_sessions (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    session_code TEXT NOT NULL,
    title TEXT NOT NULL,
    service_type TEXT NOT NULL DEFAULT 'Sunday Service',
    service_date TIMESTAMPTZ NOT NULL,
    start_time TEXT NOT NULL,
    campus TEXT NOT NULL DEFAULT 'Grace Centre',
    venue TEXT NOT NULL DEFAULT 'Main Auditorium',
    status TEXT NOT NULL DEFAULT 'Scheduled',
    expected_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, session_code)
);

-- 2.11 Attendance Records
CREATE TABLE IF NOT EXISTS public.cf_attendance_records (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    session_id BIGINT NOT NULL REFERENCES public.cf_attendance_sessions(id) ON DELETE CASCADE,
    member_id BIGINT REFERENCES public.cf_members(id) ON DELETE SET NULL,
    person_type TEXT NOT NULL DEFAULT 'Member',
    visitor_name TEXT,
    attendance_status TEXT NOT NULL DEFAULT 'Present',
    check_in_method TEXT NOT NULL DEFAULT 'Manual',
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    UNIQUE(session_id, member_id)
);

-- 2.12 Finance Funds
CREATE TABLE IF NOT EXISTS public.cf_finance_funds (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'Church operations',
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

-- 2.13 Finance Transactions
CREATE TABLE IF NOT EXISTS public.cf_finance_transactions (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    reference TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    fund_id BIGINT NOT NULL REFERENCES public.cf_finance_funds(id),
    amount_pesewas BIGINT NOT NULL,
    transaction_date TIMESTAMPTZ NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    description TEXT NOT NULL,
    payer_payee TEXT,
    receipt_number TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    recorded_by TEXT NOT NULL,
    recorded_by_user_id BIGINT REFERENCES public.cf_users(id) ON DELETE SET NULL,
    recorded_by_email TEXT,
    approved_by TEXT,
    approved_by_user_id BIGINT REFERENCES public.cf_users(id) ON DELETE SET NULL,
    approved_by_email TEXT,
    approved_at TIMESTAMPTZ,
    decision_reason TEXT,
    reversal_of_id BIGINT,
    reversal_reason TEXT,
    immutable_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, reference)
);

-- 2.14 Welfare Requests
CREATE TABLE IF NOT EXISTS public.cf_welfare_requests (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    request_code TEXT NOT NULL,
    member_id BIGINT REFERENCES public.cf_members(id) ON DELETE SET NULL,
    beneficiary_name TEXT NOT NULL,
    beneficiary_phone TEXT,
    support_type TEXT NOT NULL,
    amount_requested_pesewas BIGINT NOT NULL,
    amount_approved_pesewas BIGINT,
    urgency TEXT NOT NULL DEFAULT 'Normal',
    assessment_summary TEXT NOT NULL,
    assigned_committee TEXT NOT NULL DEFAULT 'Welfare Committee',
    decision_reason TEXT,
    status TEXT NOT NULL DEFAULT 'Pending assessment',
    finance_transaction_id BIGINT REFERENCES public.cf_finance_transactions(id) ON DELETE SET NULL,
    requested_by_user_id BIGINT REFERENCES public.cf_users(id) ON DELETE SET NULL,
    requested_by_name TEXT NOT NULL,
    reviewed_by_user_id BIGINT REFERENCES public.cf_users(id) ON DELETE SET NULL,
    reviewed_by_name TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, request_code)
);

-- 2.15 Payroll Staff
CREATE TABLE IF NOT EXISTS public.cf_payroll_staff (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    staff_code TEXT NOT NULL,
    member_id BIGINT REFERENCES public.cf_members(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    department TEXT NOT NULL,
    employment_type TEXT NOT NULL DEFAULT 'Full-time',
    bank_name TEXT,
    bank_account_last4 TEXT,
    mobile_money_number TEXT,
    base_salary_pesewas BIGINT NOT NULL,
    recurring_allowance_pesewas BIGINT NOT NULL DEFAULT 0,
    recurring_deduction_pesewas BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Active',
    created_by_user_id BIGINT REFERENCES public.cf_users(id) ON DELETE SET NULL,
    created_by_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, staff_code)
);

-- 2.16 Payroll Runs
CREATE TABLE IF NOT EXISTS public.cf_payroll_runs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    run_code TEXT NOT NULL,
    pay_period TEXT NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft',
    gross_pesewas BIGINT NOT NULL DEFAULT 0,
    deductions_pesewas BIGINT NOT NULL DEFAULT 0,
    net_pesewas BIGINT NOT NULL DEFAULT 0,
    prepared_by_user_id BIGINT REFERENCES public.cf_users(id) ON DELETE SET NULL,
    prepared_by_name TEXT NOT NULL,
    approved_by_user_id BIGINT REFERENCES public.cf_users(id) ON DELETE SET NULL,
    approved_by_name TEXT,
    approved_at TIMESTAMPTZ,
    decision_reason TEXT,
    finance_transaction_id BIGINT REFERENCES public.cf_finance_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, run_code)
);

-- 2.17 Payroll Items
CREATE TABLE IF NOT EXISTS public.cf_payroll_items (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    payroll_run_id BIGINT NOT NULL REFERENCES public.cf_payroll_runs(id) ON DELETE CASCADE,
    staff_id BIGINT NOT NULL REFERENCES public.cf_payroll_staff(id),
    base_salary_pesewas BIGINT NOT NULL,
    allowances_pesewas BIGINT NOT NULL DEFAULT 0,
    deductions_pesewas BIGINT NOT NULL DEFAULT 0,
    net_pay_pesewas BIGINT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'Pending'
);

-- 2.18 Generated Records (Certificates, Letters)
CREATE TABLE IF NOT EXISTS public.cf_generated_records (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    record_code TEXT NOT NULL,
    record_type TEXT NOT NULL,
    template_type TEXT NOT NULL,
    member_id BIGINT REFERENCES public.cf_members(id) ON DELETE SET NULL,
    subject_name TEXT NOT NULL,
    event_date TIMESTAMPTZ,
    fields_json JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'Draft',
    issued_at TIMESTAMPTZ,
    issued_by_user_id BIGINT REFERENCES public.cf_users(id) ON DELETE SET NULL,
    issued_by_name TEXT,
    created_by_user_id BIGINT REFERENCES public.cf_users(id) ON DELETE SET NULL,
    created_by_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, record_code)
);

-- 2.19 Archive Assets (Sermons, Documents, Media)
CREATE TABLE IF NOT EXISTS public.cf_archive_assets (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    asset_code TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    speaker_author TEXT,
    ministry TEXT NOT NULL DEFAULT 'Church-wide',
    event_date TIMESTAMPTZ,
    scripture_reference TEXT,
    tags TEXT NOT NULL DEFAULT '',
    file_key TEXT,
    file_name TEXT,
    content_type TEXT,
    file_size BIGINT,
    external_url TEXT,
    visibility TEXT NOT NULL DEFAULT 'Internal',
    status TEXT NOT NULL DEFAULT 'Published',
    uploaded_by_user_id BIGINT REFERENCES public.cf_users(id) ON DELETE SET NULL,
    uploaded_by_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, asset_code)
);

-- 2.20 Church Events
CREATE TABLE IF NOT EXISTS public.cf_church_events (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_code TEXT NOT NULL,
    title TEXT NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'Service',
    start_date TIMESTAMPTZ NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    campus TEXT NOT NULL DEFAULT 'Grace Centre',
    venue TEXT NOT NULL DEFAULT 'Main Auditorium',
    coordinator TEXT NOT NULL DEFAULT 'Unassigned',
    expected_attendance INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Planning',
    attendance_session_id BIGINT REFERENCES public.cf_attendance_sessions(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, event_code)
);

-- 2.21 Event Programme Items
CREATE TABLE IF NOT EXISTS public.cf_event_programme_items (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_id BIGINT NOT NULL REFERENCES public.cf_church_events(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    title TEXT NOT NULL,
    owner TEXT NOT NULL DEFAULT 'Unassigned',
    duration_minutes INTEGER NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'Ready'
);

-- 2.22 Event Assignments
CREATE TABLE IF NOT EXISTS public.cf_event_assignments (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_id BIGINT NOT NULL REFERENCES public.cf_church_events(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    leader_name TEXT NOT NULL DEFAULT 'Unassigned',
    required_count INTEGER NOT NULL DEFAULT 1,
    confirmed_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending'
);

-- 2.23 Care Cases
CREATE TABLE IF NOT EXISTS public.cf_care_cases (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    case_code TEXT NOT NULL,
    member_id BIGINT REFERENCES public.cf_members(id) ON DELETE SET NULL,
    person_name TEXT NOT NULL,
    person_phone TEXT,
    person_type TEXT NOT NULL DEFAULT 'Member',
    case_type TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'Church office',
    priority TEXT NOT NULL DEFAULT 'Normal',
    stage TEXT NOT NULL DEFAULT 'New',
    assigned_to TEXT NOT NULL DEFAULT 'Pastoral Care Team',
    next_action_date TIMESTAMPTZ,
    summary TEXT NOT NULL,
    sensitive_notes TEXT,
    is_confidential BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'Open',
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, case_code)
);

-- 2.24 Care Activities
CREATE TABLE IF NOT EXISTS public.cf_care_activities (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    case_id BIGINT NOT NULL REFERENCES public.cf_care_cases(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    note TEXT NOT NULL,
    outcome TEXT,
    completed_by TEXT NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.25 Communication Campaigns
CREATE TABLE IF NOT EXISTS public.cf_communication_campaigns (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    campaign_code TEXT NOT NULL,
    name TEXT NOT NULL,
    channel TEXT NOT NULL,
    audience TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft',
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    recipient_count INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    created_by_user_id BIGINT REFERENCES public.cf_users(id) ON DELETE SET NULL,
    created_by_name TEXT NOT NULL,
    created_by_email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, campaign_code)
);

-- 2.26 Celebration Reminders
CREATE TABLE IF NOT EXISTS public.cf_celebration_reminders (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    reminder_code TEXT NOT NULL,
    member_id BIGINT NOT NULL REFERENCES public.cf_members(id) ON DELETE CASCADE,
    celebration_type TEXT NOT NULL,
    occurrence_date TIMESTAMPTZ NOT NULL,
    channel TEXT NOT NULL DEFAULT 'In-app',
    status TEXT NOT NULL DEFAULT 'Prepared',
    campaign_id BIGINT REFERENCES public.cf_communication_campaigns(id) ON DELETE SET NULL,
    prepared_by_user_id BIGINT REFERENCES public.cf_users(id) ON DELETE SET NULL,
    prepared_by_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, member_id, celebration_type, occurrence_date)
);

-- 2.27 Audit Logs (Tenant-scoped)
CREATE TABLE IF NOT EXISTS public.cf_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_email TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    detail TEXT,
    request_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SECTION 3: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Platform indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_lifecycle ON public.organizations(lifecycle);
CREATE INDEX IF NOT EXISTS idx_identities_auth_user ON public.identities(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_identities_email ON public.identities(email);
CREATE INDEX IF NOT EXISTS idx_memberships_identity ON public.memberships(identity_id);
CREATE INDEX IF NOT EXISTS idx_memberships_organization ON public.memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_organization ON public.subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_organization ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_organization ON public.support_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_organization ON public.audit_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON public.audit_events(created_at);

-- ChurchFlow tenant indexes (critical for RLS performance)
CREATE INDEX IF NOT EXISTS idx_cf_members_tenant ON public.cf_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_users_tenant ON public.cf_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_users_identity ON public.cf_users(identity_id);
CREATE INDEX IF NOT EXISTS idx_cf_households_tenant ON public.cf_households(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_organisation_units_tenant ON public.cf_organisation_units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_volunteers_tenant ON public.cf_volunteers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_attendance_sessions_tenant ON public.cf_attendance_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_attendance_records_tenant ON public.cf_attendance_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_finance_funds_tenant ON public.cf_finance_funds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_finance_transactions_tenant ON public.cf_finance_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_welfare_requests_tenant ON public.cf_welfare_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_payroll_staff_tenant ON public.cf_payroll_staff(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_payroll_runs_tenant ON public.cf_payroll_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_generated_records_tenant ON public.cf_generated_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_archive_assets_tenant ON public.cf_archive_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_church_events_tenant ON public.cf_church_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_care_cases_tenant ON public.cf_care_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_communication_campaigns_tenant ON public.cf_communication_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_celebration_reminders_tenant ON public.cf_celebration_reminders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cf_audit_logs_tenant ON public.cf_audit_logs(tenant_id);

-- ============================================================================
-- SECTION 4: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cf_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_mobile_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_organisation_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_leadership_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_volunteer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_finance_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_welfare_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_payroll_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_generated_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_archive_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_church_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_event_programme_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_event_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_care_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_care_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_communication_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_celebration_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cf_audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 5: HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Get current user's identity ID
CREATE OR REPLACE FUNCTION public.current_identity_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT id FROM public.identities WHERE auth_user_id = auth.uid()
$$;

-- Check if user has access to an organization
CREATE OR REPLACE FUNCTION public.has_org_access(target UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.identity_id = public.current_identity_id()
        AND m.organization_id = target
        AND m.status = 'active'
    ) OR EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.identity_id = public.current_identity_id()
        AND m.scope = 'platform'
        AND m.role = 'platform_owner'
        AND m.status = 'active'
    )
$$;

-- Get user's role in an organization
CREATE OR REPLACE FUNCTION public.get_org_role(target UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT role FROM public.memberships
    WHERE identity_id = public.current_identity_id()
    AND organization_id = target
    AND status = 'active'
    LIMIT 1
$$;

-- Check if user is platform owner/staff
CREATE OR REPLACE FUNCTION public.is_platform_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.identity_id = public.current_identity_id()
        AND m.scope IN ('platform', 'staff')
        AND m.status = 'active'
    )
$$;

-- Get user's tenant ID for ChurchFlow
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT organization_id FROM public.memberships
    WHERE identity_id = public.current_identity_id()
    AND scope = 'tenant'
    AND status = 'active'
    LIMIT 1
$$;

-- ============================================================================
-- SECTION 6: RLS POLICIES FOR PLATFORM TABLES
-- ============================================================================

-- Organizations: Users can read orgs they have membership in, platform users can see all
DROP POLICY IF EXISTS "org_select_policy" ON public.organizations;
CREATE POLICY "org_select_policy" ON public.organizations
    FOR SELECT USING (
        public.has_org_access(id) OR public.is_platform_user()
    );

-- Identities: Users can read their own, platform users can read all
DROP POLICY IF EXISTS "identity_select_policy" ON public.identities;
CREATE POLICY "identity_select_policy" ON public.identities
    FOR SELECT USING (
        id = public.current_identity_id() OR public.is_platform_user()
    );

-- Memberships: Users can read their own and org members, platform users can see all
DROP POLICY IF EXISTS "membership_select_policy" ON public.memberships;
CREATE POLICY "membership_select_policy" ON public.memberships
    FOR SELECT USING (
        identity_id = public.current_identity_id()
        OR public.has_org_access(organization_id)
        OR public.is_platform_user()
    );

-- Subscriptions: Org members can read, platform users can manage
DROP POLICY IF EXISTS "subscription_select_policy" ON public.subscriptions;
CREATE POLICY "subscription_select_policy" ON public.subscriptions
    FOR SELECT USING (
        public.has_org_access(organization_id) OR public.is_platform_user()
    );

-- Invoices: Org members can read
DROP POLICY IF EXISTS "invoice_select_policy" ON public.invoices;
CREATE POLICY "invoice_select_policy" ON public.invoices
    FOR SELECT USING (
        public.has_org_access(organization_id) OR public.is_platform_user()
    );

-- Support tickets: Org members can read their tickets
DROP POLICY IF EXISTS "support_ticket_select_policy" ON public.support_tickets;
CREATE POLICY "support_ticket_select_policy" ON public.support_tickets
    FOR SELECT USING (
        public.has_org_access(organization_id) OR public.is_platform_user()
    );

-- Audit events: Org members can read their org events, platform users can see all
DROP POLICY IF EXISTS "audit_event_select_policy" ON public.audit_events;
CREATE POLICY "audit_event_select_policy" ON public.audit_events
    FOR SELECT USING (
        public.has_org_access(organization_id) OR public.is_platform_user()
    );

-- Notifications: Users can read their own
DROP POLICY IF EXISTS "notification_select_policy" ON public.notifications;
CREATE POLICY "notification_select_policy" ON public.notifications
    FOR SELECT USING (
        identity_id = public.current_identity_id()
    );

-- ============================================================================
-- SECTION 7: RLS POLICIES FOR CHURCHFLOW TABLES
-- ============================================================================

-- Generic tenant isolation policy for all ChurchFlow tables
-- Users can only access data for their assigned tenant

DROP POLICY IF EXISTS "cf_members_policy" ON public.cf_members;
CREATE POLICY "cf_members_policy" ON public.cf_members
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_users_policy" ON public.cf_users;
CREATE POLICY "cf_users_policy" ON public.cf_users
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_mobile_devices_policy" ON public.cf_mobile_devices;
CREATE POLICY "cf_mobile_devices_policy" ON public.cf_mobile_devices
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_households_policy" ON public.cf_households;
CREATE POLICY "cf_households_policy" ON public.cf_households
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_household_members_policy" ON public.cf_household_members;
CREATE POLICY "cf_household_members_policy" ON public.cf_household_members
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_organisation_units_policy" ON public.cf_organisation_units;
CREATE POLICY "cf_organisation_units_policy" ON public.cf_organisation_units
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_leadership_appointments_policy" ON public.cf_leadership_appointments;
CREATE POLICY "cf_leadership_appointments_policy" ON public.cf_leadership_appointments
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_volunteers_policy" ON public.cf_volunteers;
CREATE POLICY "cf_volunteers_policy" ON public.cf_volunteers
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_volunteer_assignments_policy" ON public.cf_volunteer_assignments;
CREATE POLICY "cf_volunteer_assignments_policy" ON public.cf_volunteer_assignments
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_attendance_sessions_policy" ON public.cf_attendance_sessions;
CREATE POLICY "cf_attendance_sessions_policy" ON public.cf_attendance_sessions
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_attendance_records_policy" ON public.cf_attendance_records;
CREATE POLICY "cf_attendance_records_policy" ON public.cf_attendance_records
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_finance_funds_policy" ON public.cf_finance_funds;
CREATE POLICY "cf_finance_funds_policy" ON public.cf_finance_funds
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_finance_transactions_policy" ON public.cf_finance_transactions;
CREATE POLICY "cf_finance_transactions_policy" ON public.cf_finance_transactions
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_welfare_requests_policy" ON public.cf_welfare_requests;
CREATE POLICY "cf_welfare_requests_policy" ON public.cf_welfare_requests
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_payroll_staff_policy" ON public.cf_payroll_staff;
CREATE POLICY "cf_payroll_staff_policy" ON public.cf_payroll_staff
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_payroll_runs_policy" ON public.cf_payroll_runs;
CREATE POLICY "cf_payroll_runs_policy" ON public.cf_payroll_runs
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_payroll_items_policy" ON public.cf_payroll_items;
CREATE POLICY "cf_payroll_items_policy" ON public.cf_payroll_items
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_generated_records_policy" ON public.cf_generated_records;
CREATE POLICY "cf_generated_records_policy" ON public.cf_generated_records
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_archive_assets_policy" ON public.cf_archive_assets;
CREATE POLICY "cf_archive_assets_policy" ON public.cf_archive_assets
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_church_events_policy" ON public.cf_church_events;
CREATE POLICY "cf_church_events_policy" ON public.cf_church_events
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_event_programme_items_policy" ON public.cf_event_programme_items;
CREATE POLICY "cf_event_programme_items_policy" ON public.cf_event_programme_items
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_event_assignments_policy" ON public.cf_event_assignments;
CREATE POLICY "cf_event_assignments_policy" ON public.cf_event_assignments
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_care_cases_policy" ON public.cf_care_cases;
CREATE POLICY "cf_care_cases_policy" ON public.cf_care_cases
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_care_activities_policy" ON public.cf_care_activities;
CREATE POLICY "cf_care_activities_policy" ON public.cf_care_activities
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_communication_campaigns_policy" ON public.cf_communication_campaigns;
CREATE POLICY "cf_communication_campaigns_policy" ON public.cf_communication_campaigns
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_celebration_reminders_policy" ON public.cf_celebration_reminders;
CREATE POLICY "cf_celebration_reminders_policy" ON public.cf_celebration_reminders
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_audit_logs_policy" ON public.cf_audit_logs;
CREATE POLICY "cf_audit_logs_policy" ON public.cf_audit_logs
    FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- ============================================================================
-- SECTION 8: SEED DATA - FIRST TENANT (GRAG)
-- ============================================================================

-- Insert ChurchFlow product if not exists
INSERT INTO public.products (name, slug, status, description)
VALUES ('ChurchFlow', 'churchflow', 'live', 'Church operations platform')
ON CONFLICT (slug) DO NOTHING;

-- Insert first tenant: GRAG
INSERT INTO public.organizations (name, slug, sector, lifecycle, status)
VALUES ('Grace and Glory Church', 'grag', 'church', 'active', 'active')
ON CONFLICT (slug) DO NOTHING
RETURNING id;

-- Get the organization ID for GRAG
DO $$
DECLARE
    org_id UUID;
    product_id UUID;
    identity_id UUID;
BEGIN
    -- Get org ID
    SELECT id INTO org_id FROM public.organizations WHERE slug = 'grag';

    -- Get product ID
    SELECT id INTO product_id FROM public.products WHERE slug = 'churchflow';

    -- Create subscription for GRAG
    INSERT INTO public.subscriptions (organization_id, product_id, plan, status, monthly_amount, currency)
    VALUES (org_id, product_id, 'professional', 'active', 299.00, 'GHS')
    ON CONFLICT DO NOTHING;

    -- Platform owner identity will be created on first login via auth trigger
    -- For now, create a placeholder that will be linked on first auth
END $$;

-- ============================================================================
-- SECTION 9: TRIGGERS FOR AUTOMATIC UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply triggers to relevant tables
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at
    BEFORE UPDATE ON public.support_tickets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cf_members_updated_at
    BEFORE UPDATE ON public.cf_members
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cf_users_updated_at
    BEFORE UPDATE ON public.cf_users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cf_households_updated_at
    BEFORE UPDATE ON public.cf_households
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cf_leadership_appointments_updated_at
    BEFORE UPDATE ON public.cf_leadership_appointments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cf_volunteers_updated_at
    BEFORE UPDATE ON public.cf_volunteers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cf_welfare_requests_updated_at
    BEFORE UPDATE ON public.cf_welfare_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cf_payroll_staff_updated_at
    BEFORE UPDATE ON public.cf_payroll_staff
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cf_generated_records_updated_at
    BEFORE UPDATE ON public.cf_generated_records
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cf_archive_assets_updated_at
    BEFORE UPDATE ON public.cf_archive_assets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cf_care_cases_updated_at
    BEFORE UPDATE ON public.cf_care_cases
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cf_communication_campaigns_updated_at
    BEFORE UPDATE ON public.cf_communication_campaigns
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- SECTION 10: VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Tenant summary with subscription info
CREATE OR REPLACE VIEW public.v_tenant_summary AS
SELECT
    o.id AS tenant_id,
    o.name AS tenant_name,
    o.slug AS tenant_slug,
    o.lifecycle,
    o.status AS tenant_status,
    p.name AS product_name,
    p.slug AS product_slug,
    s.plan,
    s.status AS subscription_status,
    s.monthly_amount,
    s.currency,
    s.renewal_at,
    o.created_at AS onboarded_at
FROM public.organizations o
JOIN public.subscriptions s ON s.organization_id = o.id
JOIN public.products p ON p.id = s.product_id;

-- View: User memberships with tenant info
CREATE OR REPLACE VIEW public.v_user_memberships AS
SELECT
    i.id AS identity_id,
    i.email,
    i.full_name,
    m.organization_id,
    o.name AS organization_name,
    o.slug AS organization_slug,
    m.role,
    m.scope,
    m.status AS membership_status,
    p.name AS product_name
FROM public.identities i
JOIN public.memberships m ON m.identity_id = i.id
JOIN public.organizations o ON o.id = m.organization_id
LEFT JOIN public.subscriptions s ON s.organization_id = o.id
LEFT JOIN public.products p ON p.id = s.product_id;

-- View: ChurchFlow tenant stats
CREATE OR REPLACE VIEW public.v_cf_tenant_stats AS
SELECT
    tenant_id,
    (SELECT COUNT(*) FROM public.cf_members m WHERE m.tenant_id = t.tenant_id) AS member_count,
    (SELECT COUNT(*) FROM public.cf_users u WHERE u.tenant_id = t.tenant_id) AS user_count,
    (SELECT COUNT(*) FROM public.cf_households h WHERE h.tenant_id = t.tenant_id) AS household_count,
    (SELECT COUNT(*) FROM public.cf_volunteers v WHERE v.tenant_id = t.tenant_id) AS volunteer_count,
    (SELECT COUNT(*) FROM public.cf_church_events e WHERE e.tenant_id = t.tenant_id) AS event_count,
    (SELECT COUNT(*) FROM public.cf_finance_transactions ft WHERE ft.tenant_id = t.tenant_id) AS transaction_count
FROM (SELECT DISTINCT tenant_id FROM public.cf_members) t;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Run this migration against Supabase
-- 2. Create auth trigger to auto-create identities on user signup
-- 3. Update ChurchFlow API routes to use tenant_id
-- 4. Update Drizzle schema to reflect new tables
-- 5. Create onboarding flow for new tenants
-- ============================================================================
