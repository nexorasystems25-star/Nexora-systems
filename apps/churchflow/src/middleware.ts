import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { resolveTenantFromDomain, extractSlugFromHostname, isMFAEnabled, verifyMFACode } from "@nexora/auth";

const publicPaths = ["/login", "/register", "/forgot-password", "/api/auth"];
const ownerPaths = ["/owner"];
const tenantPaths = ["/app"];

const JWT_SECRET_RAW = process.env.JWT_SECRET;
const jwtSecret = JWT_SECRET_RAW
  ? new TextEncoder().encode(JWT_SECRET_RAW)
  : null;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Hostname-based tenant resolution
  const hostname = request.nextUrl.hostname;
  const fastPath = extractSlugFromHostname(hostname);

  let tenantContext = null;
  if (fastPath) {
    tenantContext = {
      organizationId: "", // Will be resolved by downstream handlers if needed
      slug: fastPath.slug,
      name: "", // Will be resolved by downstream handlers if needed
      productSlug: fastPath.productSlug,
    };
  } else {
    tenantContext = await resolveTenantFromDomain(hostname);
  }

  const headers = new Headers(request.headers);
  if (tenantContext) {
    headers.set("x-tenant-id", tenantContext.organizationId);
    headers.set("x-tenant-slug", tenantContext.slug);
    headers.set("x-product-slug", tenantContext.productSlug);
  }

  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  }

  if (!jwtSecret) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  }

  try {
    const { payload } = await jwtVerify(token, jwtSecret);
    const role = payload.role as string | undefined;
    const isSuperAdmin = payload.isSuperAdmin as boolean | undefined;
    const userId = payload.userId as string | undefined;

    const isOwnerRoute = ownerPaths.some((path) => pathname.startsWith(path));
    const isTenantRoute = tenantPaths.some((path) => pathname.startsWith(path));

    if (isOwnerRoute && !isSuperAdmin && role !== "platform_owner" && role !== "nexora_staff") {
      const response = NextResponse.redirect(new URL("/app", request.url));
      headers.forEach((value, key) => response.headers.set(key, value));
      return response;
    }

    if (isTenantRoute && (isSuperAdmin || role === "platform_owner")) {
      const response = NextResponse.redirect(new URL("/owner", request.url));
      headers.forEach((value, key) => response.headers.set(key, value));
      return response;
    }

    // MFA enforcement for sensitive routes
    const sensitiveRoutes = ["/settings", "/billing", "/members/invite"];
    const isSensitiveRoute = sensitiveRoutes.some(route => 
      pathname.startsWith(route)
    );

    if (isSensitiveRoute && userId) {
      const mfaEnabled = await isMFAEnabled(userId);
      if (mfaEnabled) {
        // Check for MFA verification header/token
        const mfaToken = request.headers.get("x-mfa-verified");
        if (!mfaToken) {
          return NextResponse.json(
            { error: "MFA verification required" },
            { status: 403 }
          );
        }
        // Verify MFA token
        const verified = await verifyMFACode(userId, mfaToken);
        if (!verified) {
          return NextResponse.json(
            { error: "Invalid MFA code" },
            { status: 403 }
          );
        }
      }
    }

    return NextResponse.next({ request: { headers } });
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
