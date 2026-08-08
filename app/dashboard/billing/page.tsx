"use client";

import BillingManager from "../../../components/billing-manager";

// ============================================================================
// BILLING PAGE
// ============================================================================
// Subscription and billing management page
// ============================================================================

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your subscription, view invoices, and update payment methods
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <BillingManager />
      </div>
    </div>
  );
}
