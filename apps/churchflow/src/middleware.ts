import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PRODUCT_DOMAINS: Record<string, string> = {
  churchflow: "churchflow.app",
  school: "school-suite.app",
  counseling: "counseling.app",
  susu: "susu.app",
};

function extractSlugFromHostname(
  hostname: string
): { slug: string; productSlug: string } | null {
  const host = hostname.split(":")[0].toLowerCase();
  for (const [productSlug, baseDomain] of Object.entries(PRODUCT_DOMAINS)) {
    if (host.endsWith(`.${baseDomain}`)) {
      const slug = host.replace(`.${baseDomain}`, "");
      if (slug) return { slug, productSlug };
    }
  }
  return null;
}

const publicPaths = ["/login", "/register", "/forgot-password", "/api/auth"];
const ownerPaths = ["/owner"];
const platformPaths = ["/platform"];
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

  const headers = new Headers(request.headers);
  if (fastPath) {
    headers.set("x-tenant-slug", fastPath.slug);
    headers.set("x-product-slug", fastPath.productSlug);
  }

  const churchMatch = pathname.match(/^\/church\/([^\/]+)/);
  const isBaseChurchPage = /^\/church\/[^\/]+$/.test(pathname);
  if (churchMatch) {
    headers.set("x-tenant-slug", churchMatch[1]);
    headers.set("x-product-slug", "churchflow");
  }

  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    if (isBaseChurchPage || fastPath) {
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
    const actorScope = payload.actorScope as string | undefined;
    const tokenProductId = payload.productId as string | undefined;

    const isOwnerRoute = ownerPaths.some((path) => pathname.startsWith(path));
    const isPlatformRoute = platformPaths.some((path) => pathname.startsWith(path));
    const isTenantRoute = tenantPaths.some((path) => pathname.startsWith(path));

    // /owner and /platform require elevated planes. Tenant-only users are bounced
    // to /app. Platform staff and product super-admins are admitted.
    const hasElevatedPlane = isSuperAdmin || actorScope === "platform" || actorScope === "product";

    if ((isOwnerRoute || isPlatformRoute) && !hasElevatedPlane) {
      const response = NextResponse.redirect(new URL("/app", request.url));
      headers.forEach((value, key) => response.headers.set(key, value));
      return response;
    }

    if (isPlatformRoute && actorScope === "product") {
      // Surface the product scope so handlers can constrain writes to it.
      headers.set("x-actor-scope", "product");
      if (tokenProductId) headers.set("x-product-id", tokenProductId);
    }

    if (isTenantRoute && hasElevatedPlane) {
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
