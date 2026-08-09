import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { resolveTenantFromDomain, extractSlugFromHostname, resolveTenantFromSlug } from "@nexora/auth";

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

  const hostname = request.nextUrl.hostname;
  const fastPath = extractSlugFromHostname(hostname);

  let tenantContext = null;
  if (fastPath) {
    tenantContext = {
      organizationId: "",
      slug: fastPath.slug,
      name: "",
      productSlug: fastPath.productSlug,
    };
  } else {
    tenantContext = await resolveTenantFromDomain(hostname);
  }

  // Path-based tenant resolution for /susu/[slug]
  const susuMatch = pathname.match(/^\/susu\/([^\/]+)/);
  const isBaseSusupage = /^\/susu\/[^\/]+$/.test(pathname);
  if (susuMatch && !tenantContext) {
    const slug = susuMatch[1];
    tenantContext = await resolveTenantFromSlug(slug, "susu");
  }

  const headers = new Headers(request.headers);
  if (tenantContext) {
    headers.set("x-tenant-id", tenantContext.organizationId);
    headers.set("x-tenant-slug", tenantContext.slug);
    headers.set("x-product-slug", tenantContext.productSlug);
  }

  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    if (isBaseSusupage) {
      return NextResponse.next({ request: { headers } });
    }
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
