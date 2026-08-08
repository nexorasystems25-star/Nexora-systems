"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ============================================================================
// TENANT CONTEXT
// ============================================================================
// Provides tenant state management for the frontend
// ============================================================================

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  lifecycle: string;
  status: string;
  product?: {
    name: string;
    slug: string;
  };
  subscription?: {
    plan: string;
    status: string;
    renewalAt?: string;
  };
}

export interface TenantContextType {
  // Current tenant
  tenant: TenantInfo | null;
  tenants: TenantInfo[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setTenant: (tenant: TenantInfo | null) => void;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshTenants: () => Promise<void>;

  // Helpers
  isPlatformUser: boolean;
  hasTenant: boolean;
  tenantId: string | null;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenantState] = useState<TenantInfo | null>(null);
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load tenants on mount
  useEffect(() => {
    refreshTenants();
  }, []);

  const refreshTenants = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/platform/tenants", {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load tenants");
      }

      const data = await response.json();
      setTenants(data.tenants || []);

      // Auto-select if only one tenant
      if (data.tenants?.length === 1 && !tenant) {
        setTenantState(data.tenants[0]);
        saveTenantId(data.tenants[0].id);
      } else if (data.tenants?.length > 0) {
        // Restore saved tenant selection
        const savedTenantId = getSavedTenantId();
        if (savedTenantId) {
          const savedTenant = data.tenants.find(
            (t: TenantInfo) => t.id === savedTenantId
          );
          if (savedTenant) {
            setTenantState(savedTenant);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tenants");
    } finally {
      setIsLoading(false);
    }
  };

  const setTenant = useCallback((newTenant: TenantInfo | null) => {
    setTenantState(newTenant);
    if (newTenant) {
      saveTenantId(newTenant.id);
    } else {
      clearTenantId();
    }
  }, []);

  const switchTenant = useCallback(
    async (tenantId: string) => {
      const newTenant = tenants.find((t) => t.id === tenantId);
      if (newTenant) {
        setTenant(newTenant);
        // Reload page to refresh all data
        window.location.reload();
      }
    },
    [tenants, setTenant]
  );

  const isPlatformUser = tenants.some(
    (t) => t.lifecycle === "platform" || t.lifecycle === "staff"
  );

  const value: TenantContextType = {
    tenant,
    tenants,
    isLoading,
    error,
    setTenant,
    switchTenant,
    refreshTenants,
    isPlatformUser,
    hasTenant: !!tenant,
    tenantId: tenant?.id || null,
  };

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getAccessToken(): string {
  // Get from Supabase or local storage
  if (typeof window !== "undefined") {
    return localStorage.getItem("supabase_access_token") || "";
  }
  return "";
}

function getSavedTenantId(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("selected_tenant_id");
  }
  return null;
}

function saveTenantId(tenantId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("selected_tenant_id", tenantId);
  }
}

function clearTenantId(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("selected_tenant_id");
  }
}

/**
 * Get tenant ID for API requests.
 * Returns the current tenant ID or throws if no tenant selected.
 */
export function getTenantIdForRequest(): string {
  const tenantId = getSavedTenantId();
  if (!tenantId) {
    throw new Error("No tenant selected. Please select an organization.");
  }
  return tenantId;
}

/**
 * Add tenant_id to fetch options.
 */
export function withTenantFetch(
  options: RequestInit = {}
): RequestInit {
  const tenantId = getSavedTenantId();
  if (!tenantId) return options;

  const headers = new Headers(options.headers);
  headers.set("X-Tenant-ID", tenantId);

  return {
    ...options,
    headers,
  };
}

/**
 * Tenant-aware fetch wrapper.
 */
export async function tenantFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const tenantOptions = withTenantFetch(options);
  return fetch(url, tenantOptions);
}

// ============================================================================
// TENANT SWITCHER COMPONENT PROPS
// ============================================================================

export interface TenantSwitcherProps {
  className?: string;
  onTenantChange?: (tenant: TenantInfo) => void;
}

/**
 * Get lifecycle badge color.
 */
export function getLifecycleColor(lifecycle: string): string {
  const colors: Record<string, string> = {
    lead: "bg-gray-100 text-gray-800",
    qualified: "bg-blue-100 text-blue-800",
    consultation: "bg-purple-100 text-purple-800",
    proposal: "bg-indigo-100 text-indigo-800",
    contracted: "bg-cyan-100 text-cyan-800",
    onboarding: "bg-yellow-100 text-yellow-800",
    active: "bg-green-100 text-green-800",
    at_risk: "bg-orange-100 text-orange-800",
    renewal_due: "bg-amber-100 text-amber-800",
    suspended: "bg-red-100 text-red-800",
    offboarding: "bg-gray-100 text-gray-800",
    archived: "bg-gray-100 text-gray-500",
  };
  return colors[lifecycle] || "bg-gray-100 text-gray-800";
}

/**
 * Get status badge color.
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    trialing: "bg-blue-100 text-blue-800",
    past_due: "bg-red-100 text-red-800",
    cancelled: "bg-gray-100 text-gray-500",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}
