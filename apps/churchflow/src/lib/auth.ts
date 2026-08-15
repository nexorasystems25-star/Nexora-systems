import { createClient } from "@supabase/supabase-js";
import { jwtVerify, type JWTPayload } from "jose";

export interface TenantContext {
  tenantId: string;
  orgId: string;
  userId: string;
  email: string;
  role: "platform_owner" | "nexora_staff" | "admin" | "manager" | "leader" | "member" | "viewonly";
  isSuperAdmin: boolean;
  actorScope: "platform" | "product" | "tenant";
  productId?: string;
  productRoles: string[];
  productAccess: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW) {
  throw new Error(
    "JWT_SECRET environment variable is required. " +
    "Set it in your .env.local file or environment before starting the server."
  );
}
const jwtSecret = new TextEncoder().encode(JWT_SECRET_RAW);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function verifyToken(token: string): Promise<TenantContext | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret);
    const orgId =
      (payload.organizationId as string) ||
      (payload.orgId as string) ||
      (payload.tenantId as string);
    return {
      tenantId: orgId,
      orgId,
      userId: payload.sub as string,
      email: payload.email as string,
      role: payload.role as TenantContext["role"],
      isSuperAdmin: payload.isSuperAdmin as boolean,
      actorScope: (payload.actorScope as TenantContext["actorScope"]) ?? "tenant",
      productId: (payload.productId as string) ?? undefined,
      productRoles: (payload.productRoles as string[]) ?? [],
      productAccess: payload.productAccess as string[],
    };
  } catch {
    return null;
  }
}

export async function getSession(token: string): Promise<AuthUser | null> {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return {
    id: user.id,
    email: user.email!,
    name: user.user_metadata?.name || user.email!,
    avatar: user.user_metadata?.avatar_url,
  };
}

export function hasPermission(role: string, permission: string): boolean {
  const permissions: Record<string, string[]> = {
    platform_owner: ["*"],
    nexora_staff: ["manage_orgs", "view_analytics", "manage_support"],
    admin: ["manage_members", "manage_events", "manage_finance", "manage_settings", "view_reports", "manage_communication"],
    manager: ["manage_members", "manage_events", "view_finance", "view_reports", "manage_communication"],
    leader: ["view_members", "manage_events", "view_finance", "view_reports"],
    member: ["view_members", "view_events"],
    viewonly: ["view_members", "view_events", "view_reports"],
  };
  return permissions[role]?.includes(permission) || permissions[role]?.includes("*") || false;
}

export function canAccessTenant(userTenantId: string, requestedTenantId: string, isSuperAdmin: boolean): boolean {
  return isSuperAdmin || userTenantId === requestedTenantId;
}
