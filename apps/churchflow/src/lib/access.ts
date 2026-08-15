import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getPrincipalFromRequest,
  type AuthenticatedPrincipal,
} from "./tenant";

export type ActorScope = "platform" | "product" | "tenant";

export type AccessContext = AuthenticatedPrincipal;

/** Resolve the caller's full access context from the verified session cookie. */
export async function getAccessContext(
  request: NextRequest | Request
): Promise<AccessContext | null> {
  return await getPrincipalFromRequest(request as Request);
}

/**
 * Enforce a minimum access plane.
 *  - "platform": only platform_owner / nexora_staff
 *  - "product":  platform OR a product super-admin of `requiredProductId`
 *  - "tenant":   any authenticated caller (tenant-scoped)
 * Returns null when authorized, or a NextResponse to short-circuit with 401/403.
 */
export function requireScope(
  ctx: AccessContext | null,
  scope: ActorScope,
  requiredProductId?: string
): NextResponse | null {
  if (!ctx) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (scope === "platform" && ctx.actorScope !== "platform") {
    return NextResponse.json({ error: "Platform access required" }, { status: 403 });
  }
  if (scope === "product") {
    const isPlatform = ctx.actorScope === "platform";
    const isProductAdmin =
      ctx.actorScope === "product" &&
      (!requiredProductId || ctx.productId === requiredProductId);
    if (!isPlatform && !isProductAdmin) {
      return NextResponse.json({ error: "Product admin access required" }, { status: 403 });
    }
  }
  return null;
}
