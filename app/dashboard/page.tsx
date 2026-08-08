"use client";

import TenantDashboard from "../../components/tenant-dashboard";

// ============================================================================
// DASHBOARD PAGE
// ============================================================================
// Main dashboard with tenant-specific analytics and quick actions
// ============================================================================

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <TenantDashboard />
      </div>
    </div>
  );
}
