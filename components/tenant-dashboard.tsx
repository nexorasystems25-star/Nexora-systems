"use client";

import { useState, useEffect } from "react";

// ============================================================================
// TENANT DASHBOARD
// ============================================================================
// Main dashboard with key metrics and quick actions
// ============================================================================

interface DashboardData {
  organization: {
    name: string;
    slug: string;
    lifecycle: string;
    daysSinceCreation: number;
  };
  stats: {
    totalMembers: number;
    pendingInvites: number;
    recentActivity: number;
  };
  subscription: {
    plan: string;
    status: string;
    isTrial: boolean;
    trialDaysLeft: number | null;
    monthlyAmount: number;
  };
  quickActions: Array<{
    label: string;
    href: string;
    icon: string;
  }>;
}

const ICONS: Record<string, JSX.Element> = {
  users: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  chart: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  calendar: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  money: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export default function TenantDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch("/api/platform/analytics");
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">Failed to load dashboard</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
        <h1 className="text-2xl font-bold">
          Welcome to {data.organization.name}
        </h1>
        <p className="mt-1 text-indigo-100">
          {data.organization.daysSinceCreation === 0
            ? "Let's get you started!"
            : `Member for ${data.organization.daysSinceCreation} days`}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              {ICONS.users}
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {data.stats.totalMembers}
              </div>
              <div className="text-sm text-gray-500">Total Members</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 text-yellow-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {data.stats.pendingInvites}
              </div>
              <div className="text-sm text-gray-500">Pending Invites</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {data.stats.recentActivity}
              </div>
              <div className="text-sm text-gray-500">Activity (7d)</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
              {ICONS.money}
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {data.subscription.plan === "none"
                  ? "Free"
                  : data.subscription.plan}
              </div>
              <div className="text-sm text-gray-500">Current Plan</div>
            </div>
          </div>
        </div>
      </div>

      {/* Trial banner */}
      {data.subscription.isTrial && data.subscription.trialDaysLeft !== null && (
        <div className="rounded-xl bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium text-blue-900">
                  Free Trial - {data.subscription.trialDaysLeft} days remaining
                </p>
                <p className="text-sm text-blue-700">
                  Upgrade to continue using all features after trial ends
                </p>
              </div>
            </div>
            <a
              href="/dashboard/billing"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Upgrade Now
            </a>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {data.quickActions.map((action) => (
            <a
              key={action.href}
              href={action.href}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-4 text-center transition-all hover:border-indigo-300 hover:bg-indigo-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-600 group-hover:bg-indigo-100 group-hover:text-indigo-600">
                {ICONS[action.icon] || ICONS.users}
              </div>
              <span className="text-sm font-medium text-gray-700">
                {action.label}
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* Getting Started Checklist */}
      {data.organization.daysSinceCreation <= 7 && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Getting Started
          </h2>
          <div className="space-y-3">
            <ChecklistItem
              checked={data.stats.totalMembers > 1}
              label="Invite team members"
              href="/dashboard/members"
            />
            <ChecklistItem
              checked={false}
              label="Set up your first event"
              href="/dashboard/events"
            />
            <ChecklistItem
              checked={false}
              label="Configure finance settings"
              href="/dashboard/finance"
            />
            <ChecklistItem
              checked={data.stats.totalMembers > 5}
              label="Import member data"
              href="/dashboard/members"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistItem({
  checked,
  label,
  href,
}: {
  checked: boolean;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-lg p-3 hover:bg-gray-50"
    >
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full ${
          checked
            ? "bg-green-100 text-green-600"
            : "border-2 border-gray-300"
        }`}
      >
        {checked && (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span
        className={`flex-1 ${
          checked ? "text-gray-500 line-through" : "text-gray-700"
        }`}
      >
        {label}
      </span>
      {!checked && (
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </a>
  );
}
