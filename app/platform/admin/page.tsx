"use client";

import PlatformAdminDashboard from "../../../../components/platform-admin-dashboard";

// ============================================================================
// PLATFORM ADMIN PAGE
// ============================================================================
// Main admin dashboard for Nexora staff
// ============================================================================

export default function PlatformAdminPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">Platform Admin</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all tenants, subscriptions, and platform health
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PlatformAdminDashboard />
      </div>
    </div>
  );
}
