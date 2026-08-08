export default function FinancePage() {
  const transactions = [
    { id: "1", type: "Income", category: "Tithes", amount: 2500, member: "John Doe", date: "2026-08-05", method: "Mobile Money" },
    { id: "2", type: "Income", category: "Offerings", amount: 850, member: "Sunday Service", date: "2026-08-04", method: "Cash" },
    { id: "3", type: "Expense", category: "Utilities", amount: 420, member: "Electric Bill", date: "2026-08-03", method: "Bank Transfer" },
    { id: "4", type: "Income", category: "Tithes", amount: 500, member: "Jane Smith", date: "2026-08-02", method: "Bank Transfer" },
    { id: "5", type: "Expense", category: "Maintenance", amount: 1200, member: "Roof Repair", date: "2026-08-01", method: "Cash" },
  ];

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="mt-2 text-sm text-gray-700">
            Record tithes, offerings, and expenses. Generate reports and manage budgets.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          <button className="inline-flex items-center justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
            Export Report
          </button>
          <button className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500">
            + Record Transaction
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Total Income (This Month)</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-green-600">GHS 12,450</dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Total Expenses (This Month)</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-red-600">GHS 3,200</dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Net Balance</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">GHS 9,250</dd>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-lg bg-white shadow">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900">Recent Transactions</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tx.date}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tx.type === "Income" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {tx.category}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tx.member}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tx.method}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${tx.type === "Income" ? "text-green-600" : "text-red-600"}`}>
                  {tx.type === "Income" ? "+" : "-"}GHS {tx.amount.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
