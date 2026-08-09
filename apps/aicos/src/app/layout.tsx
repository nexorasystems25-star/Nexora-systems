export default function AicosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="bg-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">AICOS</h1>
            </div>
            <div className="flex items-center space-x-4">
              <a href="/agents" className="text-gray-300 hover:text-white">Agents</a>
              <a href="/products" className="text-gray-300 hover:text-white">Products</a>
              <a href="/governance" className="text-gray-300 hover:text-white">Governance</a>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 px-4">{children}</main>
    </div>
  );
}
