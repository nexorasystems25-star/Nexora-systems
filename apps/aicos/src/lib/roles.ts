// Role + navigation contract for the AICOS control plane.
// Pure module: safe to import from Edge middleware and client components.

export type PlatformRole =
  | "platform_owner"
  | "platform_admin"
  | "platform_staff"
  | "support_agent"
  | "billing_admin";

// Where each role lands after login.
export const ROLE_HOME: Record<PlatformRole, string> = {
  platform_owner: "/dashboard",
  platform_admin: "/dashboard",
  platform_staff: "/dashboard",
  billing_admin: "/billing",
  support_agent: "/support",
};

export interface NavItem {
  name: string;
  href: string;
  icon: string;
}

const ICONS = {
  dashboard:
    "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  tenants:
    "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  billing:
    "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  support:
    "M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z",
  settings:
    "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
};

const ALL_NAV: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: ICONS.dashboard },
  { name: "Tenants", href: "/tenants", icon: ICONS.tenants },
  { name: "Billing", href: "/billing", icon: ICONS.billing },
  { name: "Support", href: "/support", icon: ICONS.support },
  { name: "Settings", href: "/settings", icon: ICONS.settings },
];

const BILLING_NAV: NavItem[] = [ALL_NAV[0], ALL_NAV[2]];
const SUPPORT_NAV: NavItem[] = [ALL_NAV[0], ALL_NAV[3]];
// Owner + admin only: fine-tune cross-tenant product super-admins.
const SUPER_NAV: NavItem[] = [
  ...ALL_NAV,
  { name: "Product Memberships", href: "/platform/product-memberships", icon: ICONS.settings },
];

// Sidebar entries each role is allowed to see.
export const ROLE_NAV: Record<PlatformRole, NavItem[]> = {
  platform_owner: SUPER_NAV,
  platform_admin: SUPER_NAV,
  platform_staff: ALL_NAV,
  billing_admin: BILLING_NAV,
  support_agent: SUPPORT_NAV,
};

// Sections that restricted roles may NOT reach. Owners/admins/staff may reach
// every control-plane section; billing and support are scoped narrowly.
const BILLING_DENY = [
  "/tenants",
  "/support",
  "/settings",
  "/agents",
  "/sessions",
  "/governance",
  "/products",
  "/reviews",
  "/chat",
  "/platform",
];

const SUPPORT_DENY = [
  "/tenants",
  "/billing",
  "/settings",
  "/agents",
  "/sessions",
  "/governance",
  "/products",
  "/reviews",
  "/chat",
  "/platform",
];

function matches(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(p + "/"));
}

export function canAccess(path: string, role: PlatformRole | null): boolean {
  if (!role) return false;
  // The root path is always allowed (middleware redirects it home).
  if (path === "/") return true;
  if (role === "billing_admin") return !matches(path, BILLING_DENY);
  if (role === "support_agent") return !matches(path, SUPPORT_DENY);
  return true;
}
