import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve the active plan for an organization from its subscription row.
 * Returns null when there is no active subscription.
 */
export async function getOrgActivePlan(
  supabase: SupabaseClient,
  orgId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1);
  const sub = (data ?? [])[0] as { plan?: string; status?: string } | undefined;
  if (!sub || sub.status === "canceled" || sub.status === "expired") return null;
  return sub.plan ?? null;
}

/**
 * Evaluate a global feature flag for a specific organization.
 *
 * A flag is "on" for an org when it is enabled AND either:
 *  - `allowed_plans` is empty/null (enabled for every plan), or
 *  - the org's active plan is in `allowed_plans`.
 *
 * This is how plan-gated features (e.g. "multi_campus") are controlled without
 * new billing schema — platform admins manage the flag via /api/admin/feature-flags.
 */
export async function isFeatureEnabledForOrg(
  supabase: SupabaseClient,
  flagName: string,
  orgId: string
): Promise<boolean> {
  const { data: flag } = await supabase
    .from("feature_flags")
    .select("enabled, allowed_plans")
    .eq("name", flagName)
    .maybeSingle();

  if (!flag || !flag.enabled) return false;

  const allowed = (flag.allowed_plans as string[] | null) ?? [];
  if (allowed.length === 0) return true;

  const plan = await getOrgActivePlan(supabase, orgId);
  if (!plan) return false;
  return allowed.includes(plan);
}
