-- ============================================================================
-- ROW-LEVEL SECURITY POLICIES FOR CHURCHFLOW
-- ============================================================================
-- Defense-in-depth: RLS ensures tenant isolation at the database level
-- even if application-layer checks are bypassed.
-- ============================================================================

-- ============================================================================
-- PLATFORM TABLES (no RLS needed — managed by service role)
-- ============================================================================

-- Organizations, identities, memberships, subscriptions are managed
-- by the platform service role, not by tenant users.

-- ============================================================================
-- CHURCHFLOW TABLES — Enable RLS
-- ============================================================================

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
-- TENANT ISOLATION POLICIES
-- ============================================================================
-- Each policy checks that the request's tenant_id matches the row's tenant_id.
-- The app sets app.current_tenant via a session variable before each query.
-- ============================================================================

-- Helper: Set tenant context function
CREATE OR REPLACE FUNCTION public.set_current_tenant(tenant_uuid UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant', tenant_uuid::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Get current tenant
CREATE OR REPLACE FUNCTION public.get_current_tenant()
RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.current_tenant', true)::uuid;
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Check if user is platform owner
CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('app.is_platform_owner', true) = 'true';
EXCEPTION
  WHEN OTHERS THEN RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- POLICIES: Members
-- ============================================================================

CREATE POLICY cf_members_tenant_isolation ON public.cf_members
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

-- ============================================================================
-- POLICIES: Users
-- ============================================================================

CREATE POLICY cf_users_tenant_isolation ON public.cf_users
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

-- ============================================================================
-- POLICIES: Mobile Devices
-- ============================================================================

CREATE POLICY cf_mobile_devices_tenant_isolation ON public.cf_mobile_devices
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

-- ============================================================================
-- POLICIES: Households
-- ============================================================================

CREATE POLICY cf_households_tenant_isolation ON public.cf_households
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

CREATE POLICY cf_household_members_tenant_isolation ON public.cf_household_members
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

-- ============================================================================
-- POLICIES: Organisation Units
-- ============================================================================

CREATE POLICY cf_organisation_units_tenant_isolation ON public.cf_organisation_units
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

CREATE POLICY cf_leadership_appointments_tenant_isolation ON public.cf_leadership_appointments
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

-- ============================================================================
-- POLICIES: Volunteers
-- ============================================================================

CREATE POLICY cf_volunteers_tenant_isolation ON public.cf_volunteers
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

CREATE POLICY cf_volunteer_assignments_tenant_isolation ON public.cf_volunteer_assignments
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

-- ============================================================================
-- POLICIES: Attendance
-- ============================================================================

CREATE POLICY cf_attendance_sessions_tenant_isolation ON public.cf_attendance_sessions
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

CREATE POLICY cf_attendance_records_tenant_isolation ON public.cf_attendance_records
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

-- ============================================================================
-- POLICIES: Finance
-- ============================================================================

CREATE POLICY cf_finance_funds_tenant_isolation ON public.cf_finance_funds
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

CREATE POLICY cf_finance_transactions_tenant_isolation ON public.cf_finance_transactions
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

-- ============================================================================
-- POLICIES: Welfare
-- ============================================================================

CREATE POLICY cf_welfare_requests_tenant_isolation ON public.cf_welfare_requests
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

-- ============================================================================
-- POLICIES: Payroll
-- ============================================================================

CREATE POLICY cf_payroll_staff_tenant_isolation ON public.cf_payroll_staff
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

CREATE POLICY cf_payroll_runs_tenant_isolation ON public.cf_payroll_runs
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

CREATE POLICY cf_payroll_items_tenant_isolation ON public.cf_payroll_items
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

-- ============================================================================
-- POLICIES: Records
-- ============================================================================

CREATE POLICY cf_generated_records_tenant_isolation ON public.cf_generated_records
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

CREATE POLICY cf_archive_assets_tenant_isolation ON public.cf_archive_assets
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

-- ============================================================================
-- POLICIES: Events
-- ============================================================================

CREATE POLICY cf_church_events_tenant_isolation ON public.cf_church_events
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

CREATE POLICY cf_event_programme_items_tenant_isolation ON public.cf_event_programme_items
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

CREATE POLICY cf_event_assignments_tenant_isolation ON public.cf_event_assignments
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

-- ============================================================================
-- POLICIES: Care
-- ============================================================================

CREATE POLICY cf_care_cases_tenant_isolation ON public.cf_care_cases
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

CREATE POLICY cf_care_activities_tenant_isolation ON public.cf_care_activities
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

-- ============================================================================
-- POLICIES: Communication
-- ============================================================================

CREATE POLICY cf_communication_campaigns_tenant_isolation ON public.cf_communication_campaigns
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

-- ============================================================================
-- POLICIES: Reminders
-- ============================================================================

CREATE POLICY cf_celebration_reminders_tenant_isolation ON public.cf_celebration_reminders
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

-- ============================================================================
-- POLICIES: Audit Logs
-- ============================================================================

CREATE POLICY cf_audit_logs_tenant_isolation ON public.cf_audit_logs
  FOR ALL
  USING (tenant_id = public.get_current_tenant() OR public.is_platform_owner());

-- ============================================================================
-- DONE
-- ============================================================================
-- All 27 ChurchFlow tables now have RLS enabled with tenant isolation.
-- Platform owners bypass RLS via is_platform_owner() check.
-- ============================================================================
