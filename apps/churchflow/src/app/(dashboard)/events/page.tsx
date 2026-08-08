export default function EventsPage() {
  const events = [
    { id: "1", title: "Sunday Service", date: "2026-08-10", time: "09:00 AM", location: "Main Sanctuary", attendees: 180, status: "Upcoming" },
    { id: "2", title: "Bible Study", date: "2026-08-07", time: "06:30 PM", location: "Fellowship Hall", attendees: 45, status: "Upcoming" },
    { id: "3", title: "Youth Conference", date: "2026-08-15", time: "10:00 AM", location: "Youth Center", attendees: 120, status: "Upcoming" },
    { id: "4", title: "Choir Practice", date: "2026-08-08", time: "05:00 PM", location: "Music Room", attendees: 25, status: "Upcoming" },
    { id: "5", title: "Prayer Meeting", date: "2026-08-06", time: "06:00 AM", location: "Prayer Room", attendees: 30, status: "Today" },
  ];

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="mt-2 text-sm text-gray-700">
            Schedule services, conferences, and activities. Track attendance and manage volunteers.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500">
            + Create Event
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">This Week</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">5</dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">This Month</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">12</dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Total Attendees</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">400</dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500">Volunteers</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">18</dd>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900">Upcoming Events</h2>
        <div className="mt-4 space-y-4">
          {events.map((event) => (
            <div key={event.id} className="overflow-hidden rounded-lg bg-white shadow">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{event.title}</h3>
                    <p className="mt-1 text-sm text-gray-500">{event.date} at {event.time}</p>
                    <p className="mt-1 text-sm text-gray-500">{event.location}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${event.status === "Today" ? "bg-yellow-100 text-yellow-800" : "bg-blue-100 text-blue-800"}`}>
                      {event.status}
                    </span>
                    <p className="mt-2 text-sm text-gray-500">{event.attendees} expected</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
