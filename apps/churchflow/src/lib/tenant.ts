import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const jwtSecret = process.env.JWT_SECRET
  ? new TextEncoder().encode(process.env.JWT_SECRET)
  : null;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Resolves the tenant (organization) id for an incoming API request.
 *
 * Security model:
 *  - Primary: the `auth-token` HttpOnly session cookie set at login. It is
 *    XSS-resistant (not readable by client JS) and verified here for signature
 *    and expiry. This matches the middleware's authentication and is the only
 *    credential the SPA actually sends on same-origin fetches.
 *  - Fallback: a Supabase `Authorization: Bearer` token, for non-browser /
 *    server-to-server callers. Also verified before use.
 *
 * The cookie is checked first so the tenant can never be overridden by a
 * caller-supplied Bearer token. Both paths are verified; neither is trusted
 * without a valid signature.
 */
export async function getTenantFromRequest(
  request: Request
): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/auth-token=([^;]+)/);
  const cookieToken = match?.[1];
  if (cookieToken && jwtSecret) {
    try {
      const { payload } = await jwtVerify(cookieToken, jwtSecret);
      const orgId = (payload.organizationId ||
        payload.orgId ||
        payload.tenantId) as string | undefined;
      if (orgId) return orgId;
    } catch {
      // invalid/expired cookie — fall through to Bearer
    }
  }

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.replace("Bearer ", "");
  if (bearer) {
    const { data: { user } } = await supabase.auth.getUser(bearer);
    if (!user) return null;
    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .single();
    return membership?.org_id || null;
  }

  return null;
}

export interface AuthenticatedPrincipal {
  orgId: string;
  userId: string | null;
  email: string | null;
  role: string | null;
  isSuperAdmin: boolean;
  actorScope: "platform" | "product" | "tenant";
  productId?: string;
  productRoles: string[];
}

/**
 * Same as getTenantFromRequest but also returns the caller's identity/role
 * from the verified session cookie. Prefer this when authorization (not just
 * tenant scoping) is required.
 */
export async function getPrincipalFromRequest(
  request: Request
): Promise<AuthenticatedPrincipal | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/auth-token=([^;]+)/);
  const cookieToken = match?.[1];
  if (cookieToken && jwtSecret) {
    try {
      const { payload } = await jwtVerify(cookieToken, jwtSecret);
      const orgId = (payload.organizationId ||
        payload.orgId ||
        payload.tenantId) as string | undefined;
      if (orgId) {
        return {
          orgId,
          userId: (payload.userId as string) ?? null,
          email: (payload.email as string) ?? null,
          role: (payload.role as string) ?? null,
          isSuperAdmin: Boolean(payload.isSuperAdmin),
          actorScope: (payload.actorScope as AuthenticatedPrincipal["actorScope"]) ?? "tenant",
          productId: (payload.productId as string) ?? undefined,
          productRoles: (payload.productRoles as string[]) ?? [],
        };
      }
    } catch {
      // invalid/expired cookie
    }
  }
  return null;
}
