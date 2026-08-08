export default function AdminDashboardPage() {
  const stats = [
    { label: "Total Tenants", value: "12", change: "+2 this month", trend: "up" },
    { label: "Active Users", value: "847", change: "+126 this month", trend: "up" },
    { label: "Monthly Revenue", value: "GHS 28,450", change: "+18% vs last month", trend: "up" },
    { label: "Support Tickets", value: "7", change: "3 pending", trend: "neutral" },
  ];

  const recentTenants = [
    { id: "1", name: "GRAG Church", product: "ChurchFlow", plan: "Pro", status: "Active", users: 45 },
    { id: "2", name: "Ashesi University", product: "School Suite", plan: "Enterprise", status: "Active", users: 120 },
    { id: "3", name: "MindWell Counseling", product: "Counseling", plan: "Starter", status: "Active", users: 8 },
    { id: "4", name: "Kwame Savings Group", product: "Susu", plan: "Pro", status: "Active", users: 32 },
    { id: "5", name: "New Life Fellowship", product: "ChurchFlow", plan: "Starter", status: "Pending", users: 12 },
  ];

  const productBreakdown = [
    { product: "ChurchFlow", tenants: 5, revenue: 12450, users: 420 },
    { product: "School Suite", tenants: 3, revenue: 8900, users: 280 },
    { product: "Counseling", tenants: 2, revenue: 4200, users: 45 },
    { product: "Susu", tenants: 2, revenue: 2900, users: 102 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-sm font-medium text-zinc-500">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{stat.value}</p>
            <p className={`mt-1 text-xs ${stat.trend === "up" ? "text-emerald-600" : "text-zinc-500"}`}>
              {stat.change}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Recent Tenants</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Users</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentTenants.map((tenant) => (
                <tr key={tenant.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900">{tenant.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {tenant.product}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{tenant.plan}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{tenant.users}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      tenant.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {tenant.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Product Breakdown</h2>
          </div>
          <div className="p-4 space-y-4">
            {productBreakdown.map((item) => (
              <div key={item.product} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-700">{item.product}</span>
                  <span className="text-sm text-zinc-500">{item.tenants} tenants</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${(item.users / 420) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{item.users} users</span>
                  <span>GHS {item.revenue.toLocaleString()}/mo</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Platform Health</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
          <div className="rounded-lg bg-zinc-50 p-4">
            <p className="text-sm font-medium text-zinc-600">API Uptime</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-600">99.9%</p>
            <p className="text-xs text-zinc-500">Last 30 days</p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-4">
            <p className="text-sm font-medium text-zinc-600">Avg Response Time</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">142ms</p>
            <p className="text-xs text-zinc-500">Across all endpoints</p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-4">
            <p className="text-sm font-medium text-zinc-600">Error Rate</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-600">0.3%</p>
            <p className="text-xs text-zinc-500">Last 24 hours</p>
          </div>
        </div>
      </div>
    </div>
  );
}
