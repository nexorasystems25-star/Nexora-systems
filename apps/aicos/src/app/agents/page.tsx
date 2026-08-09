export default function AgentsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">AI Agent Hierarchy</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold">Chief Executive Agent</h3>
          <p className="text-gray-400">Strategy, governance, resource allocation</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold">COO Agent</h3>
          <p className="text-gray-400">Operations, process optimization, monitoring</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold">CPO Agent</h3>
          <p className="text-gray-400">Product strategy, roadmap, user research</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold">CTO Agent</h3>
          <p className="text-gray-400">Architecture, technology strategy, security</p>
        </div>
      </div>
    </div>
  );
}
