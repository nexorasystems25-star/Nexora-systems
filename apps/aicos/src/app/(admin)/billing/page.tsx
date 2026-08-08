export default function BillingPage() {
  const subscriptions = [
    { id: "1", tenant: "GRAG Church", product: "ChurchFlow", plan: "Pro", amount: 299, status: "Active", nextBilling: "2026-09-15" },
    { id: "2", tenant: "Ashesi University", product: "School Suite", plan: "Enterprise", amount: 799, status: "Active", nextBilling: "2026-09-20" },
    { id: "3", tenant: "MindWell Counseling", product: "Counseling", plan: "Starter", amount: 199, status: "Active", nextBilling: "2026-09-10" },
    { id: "4", tenant: "Kwame Savings Group", product: "Susu", plan: "Pro", amount: 349, status: "Active", nextBilling: "2026-09-05" },
    { id: "5", tenant: "New Life Fellowship", product: "ChurchFlow", plan: "Starter", amount: 99, status: "Pending", nextBilling: "2026-09-12" },
  ];

  const invoices = [
    { id: "INV-001", tenant: "GRAG Church", amount: 299, status: "Paid", date: "2026-08-15" },
    { id: "INV-002", tenant: "Ashesi University", amount: 799, status: "Paid", date: "2026-08-20" },
    { id: "INV-003", tenant: "MindWell Counseling", amount: 199, status: "Paid", date: "2026-08-10" },
    { id: "INV-004", tenant: "Kwame Savings Group", amount: 349, status: "Paid", date: "2026-08-05" },
    { id: "INV-005", tenant: "New Life Fellowship", amount: 99, status: "Pending", date: "2026-08-12" },
  ];

  const totalMRR = subscriptions.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Billing & Subscriptions</h2>
        <p className="text-sm text-zinc-500">Manage platform-wide billing and subscriptions</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-500">Monthly Recurring Revenue</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">GHS {totalMRR.toLocaleString()}</p>
          <p className="text-xs text-emerald-600">+12% vs last month</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-500">Active Subscriptions</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{subscriptions.filter(s => s.status === "Active").length}</p>
          <p className="text-xs text-zinc-500">Across all products</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-500">Pending Payments</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">GHS 99</p>
          <p className="text-xs text-zinc-500">1 invoice pending</p>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">Active Subscriptions</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Tenant</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Product</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Plan</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Next Billing</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((sub) => (
              <tr key={sub.id} className="border-b border-zinc-50 last:border-0">
                <td className="px-4 py-3 text-sm font-medium text-zinc-900">{sub.tenant}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    {sub.product}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-600">{sub.plan}</td>
                <td className="px-4 py-3 text-sm font-medium text-zinc-900">GHS {sub.amount}/mo</td>
                <td className="px-4 py-3 text-sm text-zinc-500">{sub.nextBilling}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    sub.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}>
                    {sub.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">Recent Invoices</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Invoice</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Tenant</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-zinc-50 last:border-0">
                <td className="px-4 py-3 text-sm font-medium text-zinc-900">{inv.id}</td>
                <td className="px-4 py-3 text-sm text-zinc-600">{inv.tenant}</td>
                <td className="px-4 py-3 text-sm font-medium text-zinc-900">GHS {inv.amount}</td>
                <td className="px-4 py-3 text-sm text-zinc-500">{inv.date}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    inv.status === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}>
                    {inv.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
