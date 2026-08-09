import { Suspense } from "react";

// ============================================================================
// OWNER PORTAL — Organizations Page
// ============================================================================
// Lists all organizations on the platform
// ============================================================================

async function getOrganizations() {
  // In production, fetch from API or database
  // For now, return placeholder data
  return [
    { id: "1", name: "GRAG Church", slug: "grag", status: "active", sector: "church", createdAt: "2024-01-15" },
    { id: "2", name: "Grace Academy", slug: "grace-academy", status: "active", sector: "school", createdAt: "2024-03-20" },
    { id: "3", name: "Hope Counseling", slug: "hope-counseling", status: "active", sector: "counseling", createdAt: "2024-06-10" },
  ];
}

function OrganizationsTable({ organizations }: { organizations: any[] }) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-4 border-b">
        <h3 className="text-lg font-medium">All Organizations</h3>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sector</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {organizations.map((org) => (
            <tr key={org.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{org.name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{org.slug}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{org.sector}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${org.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {org.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{org.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function OrganizationsPage() {
  const organizations = await getOrganizations();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Organizations</h2>
      <Suspense fallback={<div>Loading organizations...</div>}>
        <OrganizationsTable organizations={organizations} />
      </Suspense>
    </div>
  );
}
