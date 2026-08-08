"use client";

import { useState } from "react";
import { useTenant, getLifecycleColor, getStatusColor } from "../lib/tenant-context";

// ============================================================================
// TENANT SWITCHER COMPONENT
// ============================================================================
// Allows users to switch between tenants (organizations)
// ============================================================================

interface TenantSwitcherProps {
  className?: string;
}

export default function TenantSwitcher({ className = "" }: TenantSwitcherProps) {
  const { tenant, tenants, isLoading, switchTenant } = useTenant();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  if (!tenant && tenants.length === 0) {
    return (
      <div className={`flex items-center gap-2 text-gray-500 ${className}`}>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <span className="text-sm">No organization assigned</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
      >
        {/* Organization icon */}
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-semibold">
          {tenant?.name?.charAt(0) || "O"}
        </div>

        {/* Organization info */}
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium text-gray-900">
            {tenant?.name || "Select Organization"}
          </span>
          {tenant?.product && (
            <span className="text-xs text-gray-500">
              {tenant.product.name}
            </span>
          )}
        </div>

        {/* Dropdown arrow */}
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-medium text-gray-900">
                Switch Organization
              </h3>
              <p className="text-xs text-gray-500">
                Select an organization to manage
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto py-2">
              {tenants.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    switchTenant(t.id);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                    tenant?.id === t.id ? "bg-indigo-50" : ""
                  }`}
                >
                  {/* Icon */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold">
                    {t.name.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {t.name}
                      </span>
                      {tenant?.id === t.id && (
                        <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getLifecycleColor(t.lifecycle)}`}>
                        {t.lifecycle}
                      </span>
                      {t.product && (
                        <span className="text-xs text-gray-500">
                          {t.product.name}
                        </span>
                      )}
                    </div>
                    {t.subscription && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(t.subscription.status)}`}>
                          {t.subscription.plan}
                        </span>
                        {t.subscription.renewalAt && (
                          <span className="text-xs text-gray-400">
                            Renews {new Date(t.subscription.renewalAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {tenants.length === 0 && (
              <div className="px-4 py-8 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">
                  No organizations found
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Contact your administrator to get access
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
