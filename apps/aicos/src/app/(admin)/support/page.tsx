export default function SupportPage() {
  const tickets = [
    { id: "T-001", tenant: "GRAG Church", subject: "Cannot access finance module", priority: "High", status: "Open", created: "2026-08-05", assignee: "Sandra" },
    { id: "T-002", tenant: "Ashesi University", subject: "Bulk student import failing", priority: "Medium", status: "Open", created: "2026-08-04", assignee: "Unassigned" },
    { id: "T-003", tenant: "MindWell Counseling", subject: "Session scheduling conflict", priority: "Low", status: "In Progress", created: "2026-08-03", assignee: "Sandra" },
    { id: "T-004", tenant: "Kwame Savings Group", subject: "Mobile money integration error", priority: "High", status: "Open", created: "2026-08-02", assignee: "Unassigned" },
    { id: "T-005", tenant: "New Life Fellowship", subject: "Help setting up first event", priority: "Low", status: "Resolved", created: "2026-08-01", assignee: "Sandra" },
  ];

  const stats = {
    open: 3,
    inProgress: 1,
    resolved: 1,
    avgResponseTime: "2.4 hours",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Support Tickets</h2>
        <p className="text-sm text-zinc-500">Manage tenant support requests and issues</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-500">Open</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{stats.open}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-500">In Progress</p>
          <p className="mt-1 text-2xl font-semibold text-blue-600">{stats.inProgress}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-500">Resolved</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{stats.resolved}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-medium text-zinc-500">Avg Response</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{stats.avgResponseTime}</p>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">All Tickets</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Tenant</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Subject</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Assignee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50 cursor-pointer">
                <td className="px-4 py-3 text-sm font-medium text-zinc-900">{ticket.id}</td>
                <td className="px-4 py-3 text-sm text-zinc-600">{ticket.tenant}</td>
                <td className="px-4 py-3 text-sm text-zinc-900">{ticket.subject}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    ticket.priority === "High" ? "bg-red-50 text-red-700" :
                    ticket.priority === "Medium" ? "bg-amber-50 text-amber-700" :
                    "bg-zinc-100 text-zinc-700"
                  }`}>
                    {ticket.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-600">{ticket.assignee}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    ticket.status === "Open" ? "bg-amber-50 text-amber-700" :
                    ticket.status === "In Progress" ? "bg-blue-50 text-blue-700" :
                    "bg-emerald-50 text-emerald-700"
                  }`}>
                    {ticket.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-500">{ticket.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
