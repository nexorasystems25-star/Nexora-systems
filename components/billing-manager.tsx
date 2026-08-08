"use client";

import { useState, useEffect } from "react";

// ============================================================================
// BILLING MANAGER
// ============================================================================
// Displays subscription info, invoices, and plan management
// ============================================================================

interface Subscription {
  id: string;
  plan: string;
  status: string;
  monthlyAmount: number;
  currency: string;
  productName: string;
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAt?: string;
  cancelledAt?: string;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  amount: string;
  issuedAt: string;
  dueAt?: string;
  paidAt?: string;
}

interface BillingSummary {
  isTrial: boolean;
  trialDaysLeft: number | null;
  daysUntilRenewal: number | null;
  monthlyDisplay: string;
}

interface BillingData {
  subscription: Subscription;
  summary: BillingSummary;
  recentInvoices: Invoice[];
}

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 99,
    features: ["Up to 100 members", "5 user accounts", "Basic features"],
  },
  {
    id: "professional",
    name: "Professional",
    price: 299,
    popular: true,
    features: [
      "Unlimited members",
      "All features",
      "Priority support",
      "Advanced analytics",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 599,
    features: [
      "Everything in Professional",
      "Multi-campus",
      "API access",
      "Dedicated support",
    ],
  },
];

export default function BillingManager() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchBilling = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/platform/billing");
      if (response.ok) {
        const data = await response.json();
        setBilling(data);
      }
    } catch (error) {
      console.error("Failed to fetch billing:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  const handlePlanChange = async (newPlan: string) => {
    setActionLoading(true);
    try {
      const response = await fetch("/api/platform/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upgrade", plan: newPlan }),
      });

      if (response.ok) {
        await fetchBilling();
        setShowPlanModal(false);
      }
    } catch (error) {
      console.error("Failed to change plan:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel? You will lose access at the end of your billing period.")) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch("/api/platform/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });

      if (response.ok) {
        await fetchBilling();
      }
    } catch (error) {
      console.error("Failed to cancel:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      const response = await fetch("/api/platform/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });

      if (response.ok) {
        await fetchBilling();
      }
    } catch (error) {
      console.error("Failed to reactivate:", error);
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">No billing information available</p>
      </div>
    );
  }

  const { subscription, summary, recentInvoices } = billing;
  const currentPlan = PLANS.find((p) => p.id === subscription.plan);

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Current Plan
            </h2>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                {summary.monthlyDisplay}
              </span>
              <span className="text-gray-500">/month</span>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                subscription.status === "active"
                  ? "bg-green-100 text-green-700"
                  : subscription.status === "trialing"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {subscription.status === "trialing"
                ? "Free Trial"
                : subscription.status}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-sm text-gray-500">Plan</div>
            <div className="font-medium text-gray-900">
              {currentPlan?.name || subscription.plan}
            </div>
          </div>
          {summary.isTrial && summary.trialDaysLeft !== null && (
            <div>
              <div className="text-sm text-gray-500">Trial Ends</div>
              <div className="font-medium text-orange-600">
                {summary.trialDaysLeft} days left
              </div>
            </div>
          )}
          {!summary.isTrial && summary.daysUntilRenewal !== null && (
            <div>
              <div className="text-sm text-gray-500">Renews In</div>
              <div className="font-medium text-gray-900">
                {summary.daysUntilRenewal} days
              </div>
            </div>
          )}
          {subscription.cancelAt && (
            <div>
              <div className="text-sm text-gray-500">Cancels On</div>
              <div className="font-medium text-red-600">
                {new Date(subscription.cancelAt).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>

        {/* Trial warning */}
        {summary.isTrial && summary.trialDaysLeft !== null && summary.trialDaysLeft <= 3 && (
          <div className="mt-4 rounded-lg bg-orange-50 p-4">
            <div className="flex">
              <svg
                className="h-5 w-5 text-orange-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-orange-800">
                  Trial ending soon
                </h3>
                <p className="mt-1 text-sm text-orange-700">
                  Your free trial ends in {summary.trialDaysLeft} days. Add a
                  payment method to continue using ChurchFlow.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => setShowPlanModal(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {subscription.status === "trialing"
              ? "Choose Plan"
              : "Change Plan"}
          </button>
          {subscription.cancelAt ? (
            <button
              onClick={handleReactivate}
              disabled={actionLoading}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Reactivate Subscription
            </button>
          ) : (
            <button
              onClick={handleCancelSubscription}
              disabled={actionLoading}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Cancel Subscription
            </button>
          )}
        </div>
      </div>

      {/* Invoices */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Invoices
          </h2>
          <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            View All
          </button>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="mt-4 py-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No invoices yet</p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-gray-200">
            {recentInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between py-4"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {invoice.number}
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(invoice.issuedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900">
                    {invoice.amount}
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2 text-xs font-medium ${
                      invoice.status === "paid"
                        ? "bg-green-100 text-green-700"
                        : invoice.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {invoice.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plan Change Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPlanModal(false)}
          />
          <div className="relative mx-4 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                Change Plan
              </h3>
              <button
                onClick={() => setShowPlanModal(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-xl border-2 p-4 transition-all ${
                    subscription.plan === plan.id
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {plan.popular && (
                    <div className="mb-2 text-xs font-semibold text-indigo-600">
                      POPULAR
                    </div>
                  )}
                  <h4 className="text-lg font-semibold text-gray-900">
                    {plan.name}
                  </h4>
                  <div className="mt-2">
                    <span className="text-2xl font-bold">
                      GH₵{plan.price}
                    </span>
                    <span className="text-gray-500">/mo</span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {plan.features.map((feature, i) => (
                      <li
                        key={i}
                        className="flex items-center text-sm text-gray-600"
                      >
                        <svg
                          className="mr-2 h-4 w-4 text-green-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handlePlanChange(plan.id)}
                    disabled={
                      subscription.plan === plan.id || actionLoading
                    }
                    className={`mt-4 w-full rounded-lg py-2 text-sm font-medium ${
                      subscription.plan === plan.id
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                    }`}
                  >
                    {subscription.plan === plan.id
                      ? "Current Plan"
                      : "Select Plan"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
