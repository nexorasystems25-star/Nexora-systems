export default function AicosDashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">AICOS Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold">Active Agents</h3>
          <p className="text-3xl font-bold text-blue-400">4</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold">Products</h3>
          <p className="text-3xl font-bold text-green-400">4</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold">Governance Score</h3>
          <p className="text-3xl font-bold text-yellow-400">85%</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold">Active Tasks</h3>
          <p className="text-3xl font-bold text-purple-400">12</p>
        </div>
      </div>
    </div>
  );
}
