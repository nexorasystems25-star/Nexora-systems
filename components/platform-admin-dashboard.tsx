"use client";

import { useState, useEffect } from "react";

// ============================================================================
// PLATFORM ADMIN DASHBOARD
// ============================================================================
// Dashboard for Nexora staff to manage all tenants
// ============================================================================

interface PlatformStats {
  overview: {
    totalOrganizations: number;
    activeOrganizations: number;
    totalUsers: number;
    totalMembers: number;
  };
  revenue: {
    mrr: number;
    mrrDisplay: string;
  };
  subscriptions: {
    byStatus: Record<string, number>;
    byPlan: Record<string, number>;
  };
  organizations: {
    recent: Array<{
      id: string;
      name: string;
      slug: string;
      lifecycle: string;
      status: string;
      createdAt: string;
    }>;
    bySector: Record<string, number>;
  };
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trialing: "bg-blue-100 text-blue-700",
  past_due: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function PlatformAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/platform/admin/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch platform stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">Failed to load platform stats</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Organizations"
          value={stats.overview.totalOrganizations}
          subtitle={`${stats.overview.activeOrganizations} active`}
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
          color="blue"
        />
        <StatCard
          title="Platform Users"
          value={stats.overview.totalUsers}
          subtitle="Total identities"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
          color="purple"
        />
        <StatCard
          title="Total Members"
          value={stats.overview.totalMembers}
          subtitle="Across all tenants"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
          color="green"
        />
        <StatCard
          title="MRR"
          value={stats.revenue.mrrDisplay}
          subtitle="Monthly recurring revenue"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="emerald"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Subscriptions by Status */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Subscriptions by Status
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.subscriptions.byStatus).map(
              ([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[status] || "bg-gray-100 text-gray-700"}`}
                    >
                      {status}
                    </span>
                  </div>
                  <span className="font-medium text-gray-900">{count}</span>
                </div>
              )
            )}
          </div>
        </div>

        {/* Subscriptions by Plan */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Subscriptions by Plan
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.subscriptions.byPlan).map(
              ([plan, count]) => (
                <div key={plan} className="flex items-center justify-between">
                  <span className="capitalize text-gray-700">{plan}</span>
                  <span className="font-medium text-gray-900">{count}</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Recent Organizations */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Recent Organizations
          </h3>
          <a
            href="/platform/tenants"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            View All
          </a>
        </div>
        <div className="overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Organization
                </th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Lifecycle
                </th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Created
                </th>
                <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.organizations.recent.map((org) => (
                <tr key={org.id} className="hover:bg-gray-50">
                  <td className="py-4">
                    <div className="font-medium text-gray-900">{org.name}</div>
                    <div className="text-sm text-gray-500">/{org.slug}</div>
                  </td>
                  <td className="py-4">
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                      {org.lifecycle}
                    </span>
                  </td>
                  <td className="py-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        org.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {org.status}
                    </span>
                  </td>
                  <td className="py-4 text-sm text-gray-500">
                    {new Date(org.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-4 text-right">
                    <a
                      href={`/platform/tenants/${org.id}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      Manage
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Organizations by Sector */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Organizations by Sector
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Object.entries(stats.organizations.bySector).map(
            ([sector, count]) => (
              <div
                key={sector}
                className="rounded-lg border border-gray-200 p-4 text-center"
              >
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className="mt-1 text-sm capitalize text-gray-500">
                  {sector || "Unknown"}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: JSX.Element;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    purple: "bg-purple-100 text-purple-600",
    green: "bg-green-100 text-green-600",
    emerald: "bg-emerald-100 text-emerald-600",
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorClasses[color] || colorClasses.blue}`}
        >
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500">{title}</div>
        <div className="mt-1 text-xs text-gray-400">{subtitle}</div>
      </div>
    </div>
  );
}
