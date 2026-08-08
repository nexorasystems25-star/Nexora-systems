import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Susu Platform - Digital Susu Management
        </p>
      </div>

      <div className="relative z-10 flex place-items-center">
        <h1 className="text-4xl font-bold text-center">Welcome to Susu Platform</h1>
      </div>

      <div className="mb-32 grid text-center lg:max-w-4xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left mt-8">
        <Link
          href="/dashboard"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100"
        >
          <h2 className="mb-3 text-2xl font-semibold">
            Dashboard <span className="inline-block transition-transform group-hover:translate-x-1">-&gt;</span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Access your susu dashboard and manage collections, members, and payouts.
          </p>
        </Link>

        <Link
          href="/groups"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100"
        >
          <h2 className="mb-3 text-2xl font-semibold">
            Groups <span className="inline-block transition-transform group-hover:translate-x-1">-&gt;</span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Create and manage susu groups with members and contribution schedules.
          </p>
        </Link>

        <Link
          href="/collections"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100"
        >
          <h2 className="mb-3 text-2xl font-semibold">
            Collections <span className="inline-block transition-transform group-hover:translate-x-1">-&gt;</span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Track daily collections, mobile money payments, and cash contributions.
          </p>
        </Link>

        <Link
          href="/payouts"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100"
        >
          <h2 className="mb-3 text-2xl font-semibold">
            Payouts <span className="inline-block transition-transform group-hover:translate-x-1">-&gt;</span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Process member payouts, track disbursements, and manage schedules.
          </p>
        </Link>
      </div>
    </main>
  );
}
