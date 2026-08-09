import { Suspense } from "react";

// ============================================================================
// OWNER PORTAL — Approvals Page
// ============================================================================
// Lists pending approval requests
// ============================================================================

async function getPendingApprovals() {
  // In production, fetch from API or database
  return [
    { id: "1", type: "offboarding", requestedBy: "admin@gragchurch.com", organizationName: "GRAG Church", status: "pending", createdAt: "2024-08-01", expiresAt: "2024-08-02" },
    { id: "2", type: "suspension", requestedBy: "admin@graceacademy.com", organizationName: "Grace Academy", status: "pending", createdAt: "2024-08-02", expiresAt: "2024-08-03" },
  ];
}

function ApprovalsTable({ approvals }: { approvals: any[] }) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-4 border-b">
        <h3 className="text-lg font-medium">Pending Approvals</h3>
      </div>
      {approvals.length === 0 ? (
        <div className="p-4 text-center text-gray-500">No pending approvals</div>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested By</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {approvals.map((approval) => (
              <tr key={approval.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{approval.type}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{approval.organizationName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{approval.requestedBy}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{approval.createdAt}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{approval.expiresAt}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button className="text-green-600 hover:text-green-900 mr-3">Approve</button>
                  <button className="text-red-600 hover:text-red-900">Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default async function ApprovalsPage() {
  const approvals = await getPendingApprovals();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Approvals</h2>
      <Suspense fallback={<div>Loading approvals...</div>}>
        <ApprovalsTable approvals={approvals} />
      </Suspense>
    </div>
  );
}
