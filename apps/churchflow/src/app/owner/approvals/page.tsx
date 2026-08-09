export default function ApprovalsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Pending Approvals</h2>
      <div className="bg-white shadow rounded-lg">
        <div className="p-4 border-b">
          <p className="text-gray-500">Review and approve pending requests</p>
        </div>
        <div className="p-4">
          <p className="text-gray-400">Approval queue will be loaded here</p>
        </div>
      </div>
    </div>
  );
}
