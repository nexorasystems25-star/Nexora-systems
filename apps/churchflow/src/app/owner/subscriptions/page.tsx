import { Suspense } from "react";

// ============================================================================
// OWNER PORTAL — Subscriptions Page
// ============================================================================
// Lists all subscriptions on the platform
// ============================================================================

async function getSubscriptions() {
  // In production, fetch from API or database
  return [
    { id: "1", organizationName: "GRAG Church", plan: "professional", status: "active", amount: 99, currency: "USD", startDate: "2024-01-15" },
    { id: "2", organizationName: "Grace Academy", plan: "starter", status: "active", amount: 29, currency: "USD", startDate: "2024-03-20" },
    { id: "3", organizationName: "Hope Counseling", plan: "free", status: "trialing", amount: 0, currency: "USD", startDate: "2024-06-10" },
  ];
}

function SubscriptionsTable({ subscriptions }: { subscriptions: any[] }) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-4 border-b">
        <h3 className="text-lg font-medium">All Subscriptions</h3>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {subscriptions.map((sub) => (
            <tr key={sub.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sub.organizationName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.plan}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${sub.status === 'active' ? 'bg-green-100 text-green-800' : sub.status === 'trialing' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {sub.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${sub.amount}/{sub.currency}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.startDate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function SubscriptionsPage() {
  const subscriptions = await getSubscriptions();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Subscriptions</h2>
      <Suspense fallback={<div>Loading subscriptions...</div>}>
        <SubscriptionsTable subscriptions={subscriptions} />
      </Suspense>
    </div>
  );
}
