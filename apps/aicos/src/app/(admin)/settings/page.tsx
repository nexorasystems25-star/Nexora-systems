export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Platform Settings</h2>
        <p className="text-sm text-zinc-500">Configure platform-wide settings and preferences</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">General</h3>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Platform Name</label>
            <input type="text" defaultValue="Nexora" className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Support Email</label>
            <input type="email" defaultValue="support@nexora.com" className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Default Timezone</label>
            <select className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option>Africa/Accra (GMT)</option>
              <option>UTC</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">Security</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-700">Enforce MFA for Platform Owners</p>
              <p className="text-xs text-zinc-500">Require multi-factor authentication for all platform owner accounts</p>
            </div>
            <button className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-emerald-500 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
              <span className="translate-x-5 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-700">Session Timeout</p>
              <p className="text-xs text-zinc-500">Automatically log out inactive users after a period of time</p>
            </div>
            <select className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option>30 minutes</option>
              <option>1 hour</option>
              <option>4 hours</option>
              <option>24 hours</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">Billing</h3>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Stripe Secret Key</label>
            <input type="password" defaultValue="sk_live_xxxxxxxxxxxx" className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Webhook Endpoint</label>
            <div className="mt-1 flex rounded-lg border border-zinc-300">
              <input type="text" defaultValue="https://api.nexora.com/webhooks/stripe" readOnly className="flex-1 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 rounded-l-lg" />
              <button className="rounded-r-lg border-l border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100">Copy</button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          Save Changes
        </button>
      </div>
    </div>
  );
}
