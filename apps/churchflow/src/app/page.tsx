import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <nav className="flex items-center justify-between p-6 lg:px-8 border-b">
        <div className="flex lg:flex-1">
          <span className="text-2xl font-bold text-blue-600">ChurchFlow</span>
        </div>
        <div className="flex gap-x-4">
          <Link href="/dashboard" className="text-sm font-semibold leading-6 text-gray-900 hover:text-blue-600">
            Dashboard
          </Link>
          <Link href="/members" className="text-sm font-semibold leading-6 text-gray-900 hover:text-blue-600">
            Members
          </Link>
          <Link href="/events" className="text-sm font-semibold leading-6 text-gray-900 hover:text-blue-600">
            Events
          </Link>
          <Link href="/finance" className="text-sm font-semibold leading-6 text-gray-900 hover:text-blue-600">
            Finance
          </Link>
          <Link href="/settings" className="text-sm font-semibold leading-6 text-gray-900 hover:text-blue-600">
            Settings
          </Link>
        </div>
      </nav>

      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              ChurchFlow
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              The complete church management platform for modern ministries.
              Manage members, events, finances, and communications — all in one place.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link href="/dashboard" className="rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500">
                Go to Dashboard
              </Link>
              <Link href="https://churchflow.app" className="text-sm font-semibold leading-6 text-gray-900">
                Visit Marketing Site <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <p className="text-center text-xs leading-5 text-gray-400">
            &copy; 2026 Nexora Systems. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
