export default function MembersPage() {
  const members = [
    { id: "1", name: "John Doe", email: "john@example.com", phone: "+233 24 123 4567", group: "Young Adults", status: "Active", initials: "JD", color: "bg-blue-600" },
    { id: "2", name: "Jane Smith", email: "jane@example.com", phone: "+233 20 987 6543", group: "Choir", status: "Active", initials: "JS", color: "bg-purple-600" },
    { id: "3", name: "Kwame Mensah", email: "kwame@example.com", phone: "+233 27 456 7890", group: "Prayer Warriors", status: "Active", initials: "KM", color: "bg-green-600" },
    { id: "4", name: "Ama Asante", email: "ama@example.com", phone: "+233 55 321 6540", group: "Women's Fellowship", status: "New", initials: "AA", color: "bg-pink-600" },
    { id: "5", name: "Kofi Darko", email: "kofi@example.com", phone: "+233 24 111 2222", group: "Young Adults", status: "Inactive", initials: "KD", color: "bg-orange-600" },
  ];

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your church members, their information, and group assignments.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500">
            + Add Member
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <input type="text" placeholder="Search members..." className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" />
        <select className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6">
          <option>All Groups</option>
          <option>Young Adults</option>
          <option>Choir</option>
          <option>Prayer Warriors</option>
        </select>
        <select className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6">
          <option>All Status</option>
          <option>Active</option>
          <option>Inactive</option>
          <option>New</option>
        </select>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className={`h-10 w-10 flex-shrink-0 inline-flex items-center justify-center rounded-full ${member.color}`}>
                      <span className="text-sm font-medium text-white">{member.initials}</span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{member.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{member.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{member.phone}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">{member.group}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${member.status === "Active" ? "bg-green-100 text-green-800" : member.status === "New" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"}`}>
                    {member.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-blue-600 hover:text-blue-900">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-700">Showing <span className="font-medium">1</span> to <span className="font-medium">5</span> of <span className="font-medium">245</span> results</p>
        <div className="flex gap-2">
          <button className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Previous</button>
          <button className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Next</button>
        </div>
      </div>
    </div>
  );
}
