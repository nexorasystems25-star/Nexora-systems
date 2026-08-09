export default function OwnerDashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Platform Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold">Organizations</h3>
          <p className="text-3xl font-bold text-blue-600">--</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold">Active Subscriptions</h3>
          <p className="text-3xl font-bold text-green-600">--</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold">Pending Approvals</h3>
          <p className="text-3xl font-bold text-yellow-600">--</p>
        </div>
      </div>
    </div>
  );
}
