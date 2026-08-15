-- Rollback for 20260815_branch_model.sql
-- Run with: supabase db execute / psql <this file>  (or via migration tooling as a --down)

ALTER TABLE IF EXISTS public.cf_checkin_children DROP COLUMN IF EXISTS branch_id;
ALTER TABLE IF EXISTS public.cf_finance_transactions DROP COLUMN IF EXISTS branch_id;
ALTER TABLE IF EXISTS public.cf_finance_funds DROP COLUMN IF EXISTS branch_id;
ALTER TABLE IF EXISTS public.cf_events DROP COLUMN IF EXISTS branch_id;
ALTER TABLE IF EXISTS public.cf_members DROP COLUMN IF EXISTS branch_id;
ALTER TABLE IF EXISTS public.invitations DROP COLUMN IF EXISTS branch_id;
ALTER TABLE IF EXISTS public.memberships DROP COLUMN IF EXISTS branch_id;

DROP POLICY IF EXISTS branches_tenant_or_platform ON public.branches;
ALTER TABLE IF EXISTS public.branches DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS public.branches;

DROP FUNCTION IF EXISTS public.auth_allowed_branch_ids(uuid);
