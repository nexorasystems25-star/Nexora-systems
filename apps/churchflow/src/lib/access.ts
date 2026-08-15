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

/**
 * Platform-owner-only gate. Unlike requireScope, this is gated on the explicit
 * `platform_owner` ROLE, never on `isSuperAdmin` — because `isSuperAdmin` is
 * true for every platform role (incl. nexora_staff) and cannot distinguish an
 * owner from support staff.
 */
export function requirePlatformOwner(
  ctx: AccessContext | null
): NextResponse | null {
  if (!ctx) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (ctx.role !== "platform_owner") {
    return NextResponse.json({ error: "Platform owner access required" }, { status: 403 });
  }
  return null;
}

/**
 * Enforces that a product-scoped caller only touches rows belonging to their own
 * product. Platform callers (actorScope "platform") are exempt. Guards against
 * cross-product IDOR on product-scoped mutations.
 */
export function assertWithinProduct(
  ctx: AccessContext | null,
  membershipProductId: string
): NextResponse | null {
  if (!ctx) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (ctx.actorScope === "product" && ctx.productId !== membershipProductId) {
    return NextResponse.json({ error: "Product mismatch" }, { status: 403 });
  }
  return null;
}
