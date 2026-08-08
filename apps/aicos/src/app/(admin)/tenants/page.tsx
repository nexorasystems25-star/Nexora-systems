export default function TenantsPage() {
  const tenants = [
    { id: "1", name: "GRAG Church", slug: "grag-church", product: "ChurchFlow", plan: "Pro", status: "Active", users: 45, revenue: 299, createdAt: "2026-01-15" },
    { id: "2", name: "Ashesi University", slug: "ashesi-university", product: "School Suite", plan: "Enterprise", status: "Active", users: 120, revenue: 799, createdAt: "2026-02-20" },
    { id: "3", name: "MindWell Counseling", slug: "mindwell", product: "Counseling", plan: "Starter", status: "Active", users: 8, revenue: 199, createdAt: "2026-03-10" },
    { id: "4", name: "Kwame Savings Group", slug: "kwame-savings", product: "Susu", plan: "Pro", status: "Active", users: 32, revenue: 349, createdAt: "2026-04-05" },
    { id: "5", name: "New Life Fellowship", slug: "new-life", product: "ChurchFlow", plan: "Starter", status: "Pending", users: 12, revenue: 99, createdAt: "2026-05-12" },
    { id: "6", name: "Accra Technical Institute", slug: "accra-tech", product: "School Suite", plan: "Pro", status: "Active", users: 85, revenue: 399, createdAt: "2026-05-18" },
    { id: "7", name: "Peace Counseling Center", slug: "peace-counseling", product: "Counseling", plan: "Pro", status: "Active", users: 15, revenue: 499, createdAt: "2026-06-01" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">All Tenants</h2>
          <p className="text-sm text-zinc-500">Manage all tenant organizations across products</p>
        </div>
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          Add Tenant
        </button>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search tenants..."
          className="w-64 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <select className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
          <option>All Products</option>
          <option>ChurchFlow</option>
          <option>School Suite</option>
          <option>Counseling</option>
          <option>Susu</option>
        </select>
        <select className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
          <option>All Status</option>
          <option>Active</option>
          <option>Pending</option>
          <option>Suspended</option>
        </select>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Organization</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Product</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Plan</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Users</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Revenue</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Created</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{tenant.name}</p>
                    <p className="text-xs text-zinc-500">{tenant.slug}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    {tenant.product}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-600">{tenant.plan}</td>
                <td className="px-4 py-3 text-sm text-zinc-600">{tenant.users}</td>
                <td className="px-4 py-3 text-sm font-medium text-zinc-900">GHS {tenant.revenue}/mo</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    tenant.status === "Active" ? "bg-emerald-50 text-emerald-700" :
                    tenant.status === "Pending" ? "bg-amber-50 text-amber-700" :
                    "bg-red-50 text-red-700"
                  }`}>
                    {tenant.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-500">{tenant.createdAt}</td>
                <td className="px-4 py-3 text-right">
                  <button className="text-sm font-medium text-emerald-600 hover:text-emerald-700">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">Showing 7 tenants</p>
        <div className="flex gap-2">
          <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Previous</button>
          <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Next</button>
        </div>
      </div>
    </div>
  );
}
