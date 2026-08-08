import { createClient } from "@supabase/supabase-js";

export interface PlanEntitlements {
  maxMembers: number;
  maxStorage: number; // in bytes
  maxEvents: number;
  features: string[];
}

export const PLAN_LIMITS: Record<string, PlanEntitlements> = {
  free: {
    maxMembers: 100,
    maxStorage: 1024 * 1024 * 1024, // 1GB
    maxEvents: 10,
    features: ["basic"],
  },
  starter: {
    maxMembers: 100,
    maxStorage: 1024 * 1024 * 1024, // 1GB
    maxEvents: 10,
    features: ["basic"],
  },
  professional: {
    maxMembers: 1000,
    maxStorage: 10 * 1024 * 1024 * 1024, // 10GB
    maxEvents: 100,
    features: ["basic", "advanced", "analytics"],
  },
  enterprise: {
    maxMembers: 10000,
    maxStorage: 100 * 1024 * 1024 * 1024, // 100GB
    maxEvents: -1, // unlimited
    features: ["basic", "advanced", "analytics", "custom", "priority"],
  },
};

export type ResourceType = "members" | "storage" | "events" | "feature";

export interface EntitlementCheck {
  allowed: boolean;
  current: number;
  limit: number;
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }
  return createClient(supabaseUrl, supabaseKey);
}

export async function getOrganizationPlan(
  organizationId: string
): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .single();

  if (error || !data) {
    return "free";
  }
  return data.plan || "free";
}

async function getCurrentUsage(
  organizationId: string,
  resource: ResourceType
): Promise<number> {
  const supabase = getSupabaseClient();

  switch (resource) {
    case "members": {
      const { count } = await supabase
        .from("cf_members")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", organizationId)
        .eq("status", "Active");
      return count || 0;
    }
    case "storage": {
      const { data } = await supabase
        .from("cf_archive_assets")
        .select("file_size")
        .eq("tenant_id", organizationId);
      if (!data) return 0;
      return data.reduce(
        (total: number, item: { file_size: number | null }) =>
          total + (item.file_size || 0),
        0
      );
    }
    case "events": {
      const { count } = await supabase
        .from("cf_church_events")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", organizationId);
      return count || 0;
    }
    case "feature":
      return 0;
    default:
      return 0;
  }
}

export async function checkEntitlement(
  organizationId: string,
  resource: ResourceType,
  featureName?: string
): Promise<EntitlementCheck> {
  const plan = await getOrganizationPlan(organizationId);
  const entitlements = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  if (resource === "feature") {
    const enabled = featureName
      ? entitlements.features.includes(featureName)
      : false;
    return {
      allowed: enabled,
      current: enabled ? 1 : 0,
      limit: 1,
    };
  }

  const current = await getCurrentUsage(organizationId, resource);

  let limit: number;
  switch (resource) {
    case "members":
      limit = entitlements.maxMembers;
      break;
    case "storage":
      limit = entitlements.maxStorage;
      break;
    case "events":
      limit = entitlements.maxEvents;
      break;
    default:
      limit = 0;
  }

  const allowed = limit === -1 || current < limit;

  return { allowed, current, limit };
}

export function isFeatureEnabled(plan: string, feature: string): boolean {
  const entitlements = PLAN_LIMITS[plan];
  return entitlements?.features.includes(feature) ?? false;
}

export function requireEntitlement(
  resource: ResourceType,
  featureName?: string
) {
  return async (req: { headers: { get: (name: string) => string | null } }) => {
    const organizationId = req.headers.get("x-tenant-id");
    if (!organizationId) {
      return { allowed: false, reason: "No organization" };
    }

    const check = await checkEntitlement(organizationId, resource, featureName);
    if (!check.allowed) {
      return {
        allowed: false,
        reason: `Limit exceeded: ${check.current}/${check.limit} ${resource}`,
      };
    }

    return { allowed: true };
  };
}
