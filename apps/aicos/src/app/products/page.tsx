export default function ProductsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Product Registry</h2>
      <div className="bg-gray-800 shadow rounded-lg">
        <div className="p-4 border-b border-gray-700">
          <p className="text-gray-400">All products managed by Nexora</p>
        </div>
        <div className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
              <div>
                <h4 className="font-semibold">ChurchFlow</h4>
                <p className="text-sm text-gray-400">Church management SaaS</p>
              </div>
              <span className="px-2 py-1 bg-green-600 rounded text-sm">Active</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
              <div>
                <h4 className="font-semibold">School Suite</h4>
                <p className="text-sm text-gray-400">Education management</p>
              </div>
              <span className="px-2 py-1 bg-yellow-600 rounded text-sm">Development</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
              <div>
                <h4 className="font-semibold">Counseling</h4>
                <p className="text-sm text-gray-400">Therapy platform</p>
              </div>
              <span className="px-2 py-1 bg-yellow-600 rounded text-sm">Development</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
              <div>
                <h4 className="font-semibold">Susu</h4>
                <p className="text-sm text-gray-400">Community finance</p>
              </div>
              <span className="px-2 py-1 bg-yellow-600 rounded text-sm">Development</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
