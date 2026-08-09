export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Nexora Platform Owner</h1>
            </div>
            <div className="flex items-center space-x-4">
              <a href="/owner/organizations" className="text-gray-700 hover:text-gray-900">Organizations</a>
              <a href="/owner/subscriptions" className="text-gray-700 hover:text-gray-900">Subscriptions</a>
              <a href="/owner/approvals" className="text-gray-700 hover:text-gray-900">Approvals</a>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 px-4">{children}</main>
    </div>
  );
}
