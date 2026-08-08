-- ============================================================================
-- COMBINED SETUP: Migration + Seed Data (Standalone for Supabase SQL Editor)
-- ============================================================================
-- All content inlined — no \ir commands. Paste this entire file into SQL Editor.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SECTION 1: PLATFORM TABLES (Nexora Control Plane)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE public.lifecycle_state AS ENUM (
        'lead', 'qualified', 'consultation', 'proposal', 'contracted',
        'onboarding', 'active', 'at_risk', 'renewal_due', 'suspended',
        'offboarding', 'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.membership_scope AS ENUM (
        'platform', 'staff', 'tenant', 'self'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'planned',
    description TEXT,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'invited',
    mfa_required BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.platform_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES public.identities(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.cf_household_members (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    household_id BIGINT NOT NULL REFERENCES public.cf_households(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES public.cf_members(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL DEFAULT 'Member',
    is_primary BOOLEAN NOT NULL DEFAULT false
);

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
-- SECTION 3: INDEXES
-- ============================================================================

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
-- SECTION 4: ENABLE RLS
-- ============================================================================

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
-- SECTION 5: HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_identity_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT id FROM public.identities WHERE auth_user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.has_org_access(target UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.identity_id = public.current_identity_id()
        AND m.organization_id = target AND m.status = 'active'
    ) OR EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.identity_id = public.current_identity_id()
        AND m.scope = 'platform' AND m.role = 'platform_owner' AND m.status = 'active'
    )
$$;

CREATE OR REPLACE FUNCTION public.get_org_role(target UUID)
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT role FROM public.memberships
    WHERE identity_id = public.current_identity_id()
    AND organization_id = target AND status = 'active' LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_platform_user()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.identity_id = public.current_identity_id()
        AND m.scope IN ('platform', 'staff') AND m.status = 'active'
    )
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT organization_id FROM public.memberships
    WHERE identity_id = public.current_identity_id()
    AND scope = 'tenant' AND status = 'active' LIMIT 1
$$;

-- ============================================================================
-- SECTION 6: RLS POLICIES - PLATFORM
-- ============================================================================

DROP POLICY IF EXISTS "org_select_policy" ON public.organizations;
CREATE POLICY "org_select_policy" ON public.organizations
    FOR SELECT USING (public.has_org_access(id) OR public.is_platform_user());

DROP POLICY IF EXISTS "identity_select_policy" ON public.identities;
CREATE POLICY "identity_select_policy" ON public.identities
    FOR SELECT USING (id = public.current_identity_id() OR public.is_platform_user());

DROP POLICY IF EXISTS "membership_select_policy" ON public.memberships;
CREATE POLICY "membership_select_policy" ON public.memberships
    FOR SELECT USING (
        identity_id = public.current_identity_id()
        OR public.has_org_access(organization_id)
        OR public.is_platform_user()
    );

DROP POLICY IF EXISTS "subscription_select_policy" ON public.subscriptions;
CREATE POLICY "subscription_select_policy" ON public.subscriptions
    FOR SELECT USING (public.has_org_access(organization_id) OR public.is_platform_user());

DROP POLICY IF EXISTS "invoice_select_policy" ON public.invoices;
CREATE POLICY "invoice_select_policy" ON public.invoices
    FOR SELECT USING (public.has_org_access(organization_id) OR public.is_platform_user());

DROP POLICY IF EXISTS "support_ticket_select_policy" ON public.support_tickets;
CREATE POLICY "support_ticket_select_policy" ON public.support_tickets
    FOR SELECT USING (public.has_org_access(organization_id) OR public.is_platform_user());

DROP POLICY IF EXISTS "audit_event_select_policy" ON public.audit_events;
CREATE POLICY "audit_event_select_policy" ON public.audit_events
    FOR SELECT USING (public.has_org_access(organization_id) OR public.is_platform_user());

DROP POLICY IF EXISTS "notification_select_policy" ON public.notifications;
CREATE POLICY "notification_select_policy" ON public.notifications
    FOR SELECT USING (identity_id = public.current_identity_id());

-- ============================================================================
-- SECTION 7: RLS POLICIES - CHURCHFLOW
-- ============================================================================

DROP POLICY IF EXISTS "cf_members_policy" ON public.cf_members;
CREATE POLICY "cf_members_policy" ON public.cf_members FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_users_policy" ON public.cf_users;
CREATE POLICY "cf_users_policy" ON public.cf_users FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_mobile_devices_policy" ON public.cf_mobile_devices;
CREATE POLICY "cf_mobile_devices_policy" ON public.cf_mobile_devices FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_households_policy" ON public.cf_households;
CREATE POLICY "cf_households_policy" ON public.cf_households FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_household_members_policy" ON public.cf_household_members;
CREATE POLICY "cf_household_members_policy" ON public.cf_household_members FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_organisation_units_policy" ON public.cf_organisation_units;
CREATE POLICY "cf_organisation_units_policy" ON public.cf_organisation_units FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_leadership_appointments_policy" ON public.cf_leadership_appointments;
CREATE POLICY "cf_leadership_appointments_policy" ON public.cf_leadership_appointments FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_volunteers_policy" ON public.cf_volunteers;
CREATE POLICY "cf_volunteers_policy" ON public.cf_volunteers FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_volunteer_assignments_policy" ON public.cf_volunteer_assignments;
CREATE POLICY "cf_volunteer_assignments_policy" ON public.cf_volunteer_assignments FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_attendance_sessions_policy" ON public.cf_attendance_sessions;
CREATE POLICY "cf_attendance_sessions_policy" ON public.cf_attendance_sessions FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_attendance_records_policy" ON public.cf_attendance_records;
CREATE POLICY "cf_attendance_records_policy" ON public.cf_attendance_records FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_finance_funds_policy" ON public.cf_finance_funds;
CREATE POLICY "cf_finance_funds_policy" ON public.cf_finance_funds FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_finance_transactions_policy" ON public.cf_finance_transactions;
CREATE POLICY "cf_finance_transactions_policy" ON public.cf_finance_transactions FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_welfare_requests_policy" ON public.cf_welfare_requests;
CREATE POLICY "cf_welfare_requests_policy" ON public.cf_welfare_requests FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_payroll_staff_policy" ON public.cf_payroll_staff;
CREATE POLICY "cf_payroll_staff_policy" ON public.cf_payroll_staff FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_payroll_runs_policy" ON public.cf_payroll_runs;
CREATE POLICY "cf_payroll_runs_policy" ON public.cf_payroll_runs FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_payroll_items_policy" ON public.cf_payroll_items;
CREATE POLICY "cf_payroll_items_policy" ON public.cf_payroll_items FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_generated_records_policy" ON public.cf_generated_records;
CREATE POLICY "cf_generated_records_policy" ON public.cf_generated_records FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_archive_assets_policy" ON public.cf_archive_assets;
CREATE POLICY "cf_archive_assets_policy" ON public.cf_archive_assets FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_church_events_policy" ON public.cf_church_events;
CREATE POLICY "cf_church_events_policy" ON public.cf_church_events FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_event_programme_items_policy" ON public.cf_event_programme_items;
CREATE POLICY "cf_event_programme_items_policy" ON public.cf_event_programme_items FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_event_assignments_policy" ON public.cf_event_assignments;
CREATE POLICY "cf_event_assignments_policy" ON public.cf_event_assignments FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_care_cases_policy" ON public.cf_care_cases;
CREATE POLICY "cf_care_cases_policy" ON public.cf_care_cases FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_care_activities_policy" ON public.cf_care_activities;
CREATE POLICY "cf_care_activities_policy" ON public.cf_care_activities FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_communication_campaigns_policy" ON public.cf_communication_campaigns;
CREATE POLICY "cf_communication_campaigns_policy" ON public.cf_communication_campaigns FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_celebration_reminders_policy" ON public.cf_celebration_reminders;
CREATE POLICY "cf_celebration_reminders_policy" ON public.cf_celebration_reminders FOR ALL USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "cf_audit_logs_policy" ON public.cf_audit_logs;
CREATE POLICY "cf_audit_logs_policy" ON public.cf_audit_logs FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- ============================================================================
-- SECTION 8: SEED DATA - PLATFORM
-- ============================================================================

INSERT INTO public.products (name, slug, status, description)
VALUES ('ChurchFlow', 'churchflow', 'live', 'Church operations platform')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.organizations (name, slug, sector, lifecycle, status)
VALUES ('Grace and Glory Church', 'grag', 'church', 'active', 'active')
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
    org_id UUID;
    product_id UUID;
BEGIN
    SELECT id INTO org_id FROM public.organizations WHERE slug = 'grag';
    SELECT id INTO product_id FROM public.products WHERE slug = 'churchflow';

    INSERT INTO public.subscriptions (organization_id, product_id, plan, status, monthly_amount, currency)
    VALUES (org_id, product_id, 'professional', 'active', 299.00, 'GHS')
    ON CONFLICT DO NOTHING;
END $$;

-- ============================================================================
-- SECTION 9: TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cf_members_updated_at BEFORE UPDATE ON public.cf_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cf_users_updated_at BEFORE UPDATE ON public.cf_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cf_households_updated_at BEFORE UPDATE ON public.cf_households FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cf_leadership_appointments_updated_at BEFORE UPDATE ON public.cf_leadership_appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cf_volunteers_updated_at BEFORE UPDATE ON public.cf_volunteers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cf_welfare_requests_updated_at BEFORE UPDATE ON public.cf_welfare_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cf_payroll_staff_updated_at BEFORE UPDATE ON public.cf_payroll_staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cf_generated_records_updated_at BEFORE UPDATE ON public.cf_generated_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cf_archive_assets_updated_at BEFORE UPDATE ON public.cf_archive_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cf_care_cases_updated_at BEFORE UPDATE ON public.cf_care_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cf_communication_campaigns_updated_at BEFORE UPDATE ON public.cf_communication_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- SECTION 10: VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW public.v_tenant_summary AS
SELECT o.id AS tenant_id, o.name AS tenant_name, o.slug AS tenant_slug,
    o.lifecycle, o.status AS tenant_status, p.name AS product_name,
    s.plan, s.status AS subscription_status, s.monthly_amount, s.currency,
    s.renewal_at, o.created_at AS onboarded_at
FROM public.organizations o
JOIN public.subscriptions s ON s.organization_id = o.id
JOIN public.products p ON p.id = s.product_id;

CREATE OR REPLACE VIEW public.v_user_memberships AS
SELECT i.id AS identity_id, i.email, i.full_name, m.organization_id,
    o.name AS organization_name, o.slug AS organization_slug,
    m.role, m.scope, m.status AS membership_status, p.name AS product_name
FROM public.identities i
JOIN public.memberships m ON m.identity_id = i.id
JOIN public.organizations o ON o.id = m.organization_id
LEFT JOIN public.subscriptions s ON s.organization_id = o.id
LEFT JOIN public.products p ON p.id = s.product_id;

CREATE OR REPLACE VIEW public.v_cf_tenant_stats AS
SELECT tenant_id,
    (SELECT COUNT(*) FROM public.cf_members m WHERE m.tenant_id = t.tenant_id) AS member_count,
    (SELECT COUNT(*) FROM public.cf_users u WHERE u.tenant_id = t.tenant_id) AS user_count,
    (SELECT COUNT(*) FROM public.cf_households h WHERE h.tenant_id = t.tenant_id) AS household_count,
    (SELECT COUNT(*) FROM public.cf_volunteers v WHERE v.tenant_id = t.tenant_id) AS volunteer_count,
    (SELECT COUNT(*) FROM public.cf_church_events e WHERE e.tenant_id = t.tenant_id) AS event_count,
    (SELECT COUNT(*) FROM public.cf_finance_transactions ft WHERE ft.tenant_id = t.tenant_id) AS transaction_count
FROM (SELECT DISTINCT tenant_id FROM public.cf_members) t;

-- ============================================================================
-- SECTION 11: SEED DATA - CHURCHFLOW MODULE
-- ============================================================================

DO $$
DECLARE
    grag_id UUID;
    grag_user_id UUID;
    fund_gf_id BIGINT;
    fund_mf_id BIGINT;
    fund_bf_id BIGINT;
BEGIN
    SELECT id INTO grag_id FROM public.organizations WHERE slug = 'grag';
    IF grag_id IS NULL THEN
        RAISE NOTICE 'GRAG org not found, skipping seed data';
        RETURN;
    END IF;

    INSERT INTO public.identities (id, auth_user_id, email, full_name, email_verified)
    VALUES (
        'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        'admin@gragchurch.org',
        'Pastor Daniel Asante',
        true
    ) ON CONFLICT (email) DO NOTHING
    RETURNING id INTO grag_user_id;

    INSERT INTO public.memberships (identity_id, organization_id, role, scope, status)
    VALUES (
        COALESCE(grag_user_id, 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'),
        grag_id, 'owner', 'tenant', 'active'
    ) ON CONFLICT DO NOTHING;

    INSERT INTO public.cf_members (tenant_id, church_id, name, initials, group_name, phone, email, gender, birth_date, marital_status, status, joined_at)
    VALUES
      (grag_id, 'CH-001', 'Akosua Mensah', 'AM', 'Women''s Fellowship', '024 123 4567', 'akosua@example.com', 'Female', '1990-03-15', 'Married', 'Active', '2024-01-15'),
      (grag_id, 'CH-002', 'Kwame Owusu', 'KO', 'Ushers', '055 234 5678', 'kwame@example.com', 'Male', '1985-07-22', 'Married', 'Active', '2024-02-01'),
      (grag_id, 'CH-003', 'Abena Boateng', 'AB', 'Choir', '020 345 6789', 'abena@example.com', 'Female', '1995-11-08', 'Single', 'Active', '2024-03-10'),
      (grag_id, 'CH-004', 'Kofi Asare', 'KA', 'Youth Ministry', '027 456 7890', 'kofi@example.com', 'Male', '1998-01-30', 'Single', 'Active', '2024-04-05'),
      (grag_id, 'CH-005', 'Yaa Serwaa', 'YS', 'Women''s Fellowship', '050 567 8901', 'yaa@example.com', 'Female', '1988-06-12', 'Married', 'Active', '2024-05-20'),
      (grag_id, 'CH-006', 'Emmanuel Frimpong', 'EF', 'Worship Team', '024 678 9012', 'emmanuel@example.com', 'Male', '1992-09-25', 'Single', 'Active', '2024-06-01'),
      (grag_id, 'CH-007', 'Nana Boakye', 'NB', 'Media Team', '055 789 0123', 'nana@example.com', 'Male', '1997-04-18', 'Single', 'Active', '2024-07-15'),
      (grag_id, 'CH-008', 'Priscilla Agyeman', 'PA', 'Youth Ministry', '020 890 1234', 'priscilla@example.com', 'Female', '1993-12-03', 'Single', 'Active', '2024-08-01')
    ON CONFLICT (tenant_id, church_id) DO NOTHING;

    INSERT INTO public.cf_organisation_units (tenant_id, name, type, leader_name, member_count, meeting_schedule, campus)
    VALUES
      (grag_id, 'Youth Ministry', 'Ministry', 'Priscilla Agyeman', 86, 'Saturdays 4:00 PM', 'Grace Centre'),
      (grag_id, 'Women''s Ministry', 'Fellowship', 'Deaconess Lydia Owusu', 124, 'Tuesdays 5:30 PM', 'Grace Centre'),
      (grag_id, 'Finance Department', 'Department', 'Daniel Asante', 8, 'First Monday monthly', 'Grace Centre'),
      (grag_id, 'Choir', 'Ministry', 'Emmanuel Frimpong', 34, 'Thursdays 6:00 PM', 'Grace Centre')
    ON CONFLICT (tenant_id, name) DO NOTHING;

    INSERT INTO public.cf_finance_funds (tenant_id, name, code, purpose, status)
    VALUES
      (grag_id, 'General Fund', 'GF', 'Church operations', 'Active'),
      (grag_id, 'Missions Fund', 'MF', 'Global missions', 'Active'),
      (grag_id, 'Building Fund', 'BF', 'Church building project', 'Active')
    ON CONFLICT (tenant_id, code) DO NOTHING
    RETURNING id, code;

    SELECT id INTO fund_gf_id FROM public.cf_finance_funds WHERE code = 'GF' AND tenant_id = grag_id;
    SELECT id INTO fund_mf_id FROM public.cf_finance_funds WHERE code = 'MF' AND tenant_id = grag_id;
    SELECT id INTO fund_bf_id FROM public.cf_finance_funds WHERE code = 'BF' AND tenant_id = grag_id;

    IF fund_gf_id IS NOT NULL THEN
        INSERT INTO public.cf_finance_transactions (tenant_id, reference, type, category, fund_id, amount_pesewas, transaction_date, payment_method, description, payer_payee, status, recorded_by)
        VALUES
          (grag_id, 'CF-INC-001', 'Income', 'Tithe', fund_gf_id, 150000, '2026-08-02', 'Mobile Money', 'Weekly tithe collection', 'Congregation', 'Approved', 'Pastor Daniel Asante'),
          (grag_id, 'CF-INC-002', 'Income', 'Offering', fund_gf_id, 85000, '2026-08-02', 'Cash', 'Sunday offering', 'Congregation', 'Approved', 'Pastor Daniel Asante'),
          (grag_id, 'CF-EXP-001', 'Expense', 'Utilities', fund_gf_id, 45000, '2026-08-01', 'Bank Transfer', 'Electricity bill - July', 'ECG Ghana', 'Approved', 'Daniel Asante'),
          (grag_id, 'CF-EXP-002', 'Expense', 'Staff Salary', fund_gf_id, 320000, '2026-08-01', 'Bank Transfer', 'August payroll', 'Church staff', 'Pending', 'Daniel Asante')
        ON CONFLICT (tenant_id, reference) DO NOTHING;
    END IF;

    INSERT INTO public.cf_attendance_sessions (tenant_id, session_code, title, service_type, service_date, start_time, campus, venue, status, expected_count)
    VALUES
      (grag_id, 'ATT-260802-01', 'Sunday Celebration Service', 'Sunday Service', '2026-08-02', '08:30', 'Grace Centre', 'Main Auditorium', 'Open', 420),
      (grag_id, 'ATT-260729-01', 'Midweek Bible Teaching', 'Midweek Service', '2026-07-29', '18:00', 'Grace Centre', 'Chapel', 'Completed', 180),
      (grag_id, 'ATT-260726-01', 'Sunday Celebration Service', 'Sunday Service', '2026-07-26', '08:30', 'Grace Centre', 'Main Auditorium', 'Completed', 400)
    ON CONFLICT (tenant_id, session_code) DO NOTHING;

    INSERT INTO public.cf_church_events (tenant_id, event_code, title, event_type, start_date, start_time, end_time, coordinator, expected_attendance, status)
    VALUES
      (grag_id, 'EVT-260802-01', 'Sunday Celebration Service', 'Service', '2026-08-02', '08:30', '11:00', 'Pastor Daniel Asante', 420, 'Ready'),
      (grag_id, 'EVT-260805-02', 'Midweek Bible Teaching', 'Service', '2026-08-05', '18:00', '19:30', 'Rev. Lydia Owusu', 180, 'Planning'),
      (grag_id, 'EVT-260809-03', 'Youth Empowerment Summit', 'Conference', '2026-08-09', '10:00', '16:00', 'Priscilla Agyeman', 260, 'Planning')
    ON CONFLICT (tenant_id, event_code) DO NOTHING;

    INSERT INTO public.cf_care_cases (tenant_id, case_code, person_name, person_phone, person_type, case_type, source, priority, stage, assigned_to, next_action_date, summary, status, created_by)
    VALUES
      (grag_id, 'CARE-2607-001', 'Abena Boateng', '020 771 1904', 'New Convert', 'New Convert Follow-up', 'Sunday altar call', 'High', 'First Contact', 'Rev. Lydia Owusu', '2026-07-31', 'Welcome call and foundation class introduction required.', 'Open', 'Pastor Daniel Asante'),
      (grag_id, 'CARE-2607-002', 'Kofi Asare', '027 120 3301', 'Member', 'Pastoral Follow-up', 'Church office', 'Normal', 'Visit Scheduled', 'Pastor Daniel Asante', '2026-08-01', 'Home visit requested after extended absence.', 'Open', 'Pastor Daniel Asante')
    ON CONFLICT (tenant_id, case_code) DO NOTHING;

    INSERT INTO public.cf_volunteers (tenant_id, volunteer_code, name, phone, skills, availability, ministry_preference, safeguarding_status, status, created_by_user_id, created_by_name)
    VALUES
      (grag_id, 'VOL-001', 'Kwame Owusu', '055 234 5678', 'Hospitality, Guest care', 'Sundays', 'Ushers', 'Verified', 'Active', NULL, 'Pastor Daniel Asante'),
      (grag_id, 'VOL-002', 'Emmanuel Frimpong', '024 678 9012', 'Music, Worship', 'Sundays and midweek', 'Worship Team', 'Verified', 'Active', NULL, 'Pastor Daniel Asante')
    ON CONFLICT (tenant_id, volunteer_code) DO NOTHING;

    INSERT INTO public.cf_communication_campaigns (tenant_id, campaign_code, name, channel, audience, subject, message, status, recipient_count, created_by_user_id, created_by_name, created_by_email)
    VALUES
      (grag_id, 'CMP-001', 'Sunday Service Reminder', 'SMS', 'Active Members', 'Service Reminder', 'Reminder: Sunday Service starts at 8:30 AM. See you there!', 'Sent', 8, NULL, 'Pastor Daniel Asante', 'admin@gragchurch.org')
    ON CONFLICT (tenant_id, campaign_code) DO NOTHING;

    INSERT INTO public.cf_payroll_staff (tenant_id, staff_code, full_name, job_title, department, employment_type, base_salary_pesewas, recurring_allowance_pesewas, recurring_deduction_pesewas, status, created_by_user_id, created_by_name)
    VALUES
      (grag_id, 'STF-001', 'Akosua Mensah', 'Church Administrator', 'Administration', 'Full-time', 320000, 35000, 18000, 'Active', NULL, 'Pastor Daniel Asante'),
      (grag_id, 'STF-002', 'Kwame Owusu', 'Facilities Coordinator', 'Operations', 'Part-time', 180000, 15000, 5000, 'Active', NULL, 'Pastor Daniel Asante')
    ON CONFLICT (tenant_id, staff_code) DO NOTHING;

    RAISE NOTICE 'Seed data inserted for GRAG tenant';
END $$;
