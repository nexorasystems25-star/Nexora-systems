# Archived Files

## rls-policies-deprecated.sql

**Removed:** 2026-08-09
**Reason:** Conflicting RLS implementation with the migration file.

The migration file (`supabase/migrations/20250805_multi_tenant_platform.sql`) is the
authoritative source for all RLS policies. It uses `get_user_tenant_id()` based on
`auth.uid()`, which is the standard Supabase approach.

This standalone file used a different mechanism (`set_current_tenant` / `get_current_tenant`
session variables), which is incompatible. The migration file supersedes this file.
