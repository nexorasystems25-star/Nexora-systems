"use client";

import { useState } from "react";

// ============================================================================
// TENANT ONBOARDING WIZARD
// ============================================================================
// Multi-step wizard for setting up a new organization
// ============================================================================

interface OnboardingData {
  // Step 1: Organization
  organizationName: string;
  organizationSlug: string;
  sector: string;

  // Step 2: Contact
  contactEmail: string;
  contactPhone: string;

  // Step 3: Plan
  plan: string;

  // Step 4: Admin
  adminName: string;
  adminEmail: string;
}

const SECTORS = [
  { value: "church", label: "Church" },
  { value: "school", label: "School" },
  { value: "counselling", label: "Counselling Center" },
  { value: "susu", label: "Susu/Cooperative" },
  { value: "other", label: "Other" },
];

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 99,
    features: [
      "Up to 100 members",
      "Basic attendance tracking",
      "Finance management",
      "5 user accounts",
      "Email support",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: 299,
    popular: true,
    features: [
      "Unlimited members",
      "Advanced analytics",
      "Volunteer management",
      "Care cases",
      "Payroll (up to 10 staff)",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 599,
    features: [
      "Everything in Professional",
      "Multi-campus support",
      "Advanced payroll",
      "API access",
      "Custom integrations",
      "Dedicated support",
    ],
  },
];

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    organizationName: "",
    organizationSlug: "",
    sector: "church",
    contactEmail: "",
    contactPhone: "",
    plan: "professional",
    adminName: "",
    adminEmail: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 4;

  const updateData = (partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));

    // Auto-generate slug from name
    if (partial.organizationName) {
      const slug = partial.organizationName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 50);
      setData((prev) => ({ ...prev, ...partial, organizationSlug: slug }));
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return data.organizationName.trim().length >= 3 && data.organizationSlug.length >= 3;
      case 2:
        return data.contactEmail.includes("@");
      case 3:
        return !!data.plan;
      case 4:
        return data.adminName.trim().length > 0 && data.adminEmail.includes("@");
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!canProceed()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/platform/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Onboarding failed");
      }

      // Success - redirect to dashboard
      window.location.href = `/dashboard?tenant=${result.organization.slug}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set up your organization</h1>
          <p className="mt-2 text-gray-600">
            Get started with ChurchFlow in just a few steps
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    i + 1 <= step
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {i + 1 < step ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                {i < totalSteps - 1 && (
                  <div
                    className={`ml-2 h-1 w-16 ${
                      i + 1 < step ? "bg-indigo-600" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-gray-500">
            <span>Organization</span>
            <span>Contact</span>
            <span>Plan</span>
            <span>Admin</span>
          </div>
        </div>

        {/* Step content */}
        <div className="rounded-2xl bg-white p-6 shadow-lg">
          {/* Step 1: Organization */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Organization Details
                </h2>
                <p className="text-sm text-gray-500">
                  Tell us about your organization
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Organization Name *
                </label>
                <input
                  type="text"
                  value={data.organizationName}
                  onChange={(e) => updateData({ organizationName: e.target.value })}
                  placeholder="e.g., Grace and Glory Church"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  URL Slug *
                </label>
                <div className="mt-1 flex rounded-lg border border-gray-300">
                  <span className="flex items-center rounded-l-lg border-r border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">
                    churchflow.app/
                  </span>
                  <input
                    type="text"
                    value={data.organizationSlug}
                    onChange={(e) => updateData({ organizationSlug: e.target.value })}
                    placeholder="grace-and-glory"
                    className="block w-full rounded-r-lg border-0 px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  This will be your unique identifier
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Sector
                </label>
                <select
                  value={data.sector}
                  onChange={(e) => updateData({ sector: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                >
                  {SECTORS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Contact */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Contact Information
                </h2>
                <p className="text-sm text-gray-500">
                  How can we reach you?
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={data.contactEmail}
                  onChange={(e) => updateData({ contactEmail: e.target.value })}
                  placeholder="admin@graceandglory.com"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={data.contactPhone}
                  onChange={(e) => updateData({ contactPhone: e.target.value })}
                  placeholder="+233 24 000 0000"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Step 3: Plan */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Choose Your Plan
                </h2>
                <p className="text-sm text-gray-500">
                  Start with a 14-day free trial
                </p>
              </div>

              <div className="grid gap-4">
                {PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => updateData({ plan: plan.id })}
                    className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all ${
                      data.plan === plan.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-4 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
                        Most Popular
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {plan.name}
                        </h3>
                        <ul className="mt-2 space-y-1">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-center text-sm text-gray-600">
                              <svg className="mr-2 h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          GH₵{plan.price}
                        </div>
                        <div className="text-sm text-gray-500">/month</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Admin */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Admin Account
                </h2>
                <p className="text-sm text-gray-500">
                  Set up the primary administrator
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={data.adminName}
                  onChange={(e) => updateData({ adminName: e.target.value })}
                  placeholder="Pastor John Smith"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={data.adminEmail}
                  onChange={(e) => updateData({ adminEmail: e.target.value })}
                  placeholder="admin@graceandglory.com"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This account will have full administrative access
                </p>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-8 flex justify-between">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < totalSteps ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting}
                className="rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Setting up..." : "Complete Setup"}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-gray-500">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
