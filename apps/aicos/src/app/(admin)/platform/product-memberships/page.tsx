"use client";

import { useEffect, useState, useCallback } from "react";

interface Membership {
  membership: {
    id: string;
    productId: string;
    identityId: string;
    role: string;
    status: string;
    createdAt: string;
  };
  productName: string | null;
  identityEmail: string | null;
  identityName: string | null;
}

const ROLES = ["product_owner", "product_admin", "product_support"];

export default function ProductMembershipsConsole() {
  const [rows, setRows] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [productId, setProductId] = useState("");
  const [role, setRole] = useState("product_support");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (productId) params.set("productId", productId);
    const res = await fetch(`/api/aicos/platform/product-memberships?${params.toString()}`);
    const data = await res.json();
    setRows(data.memberships ?? []);
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    setError("");
    if (!email.trim() || !productId.trim()) {
      setError("Email and product id are required");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/aicos/platform/product-memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, productId, role }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to add membership");
      return;
    }
    setEmail("");
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this product membership?")) return;
    setBusy(true);
    await fetch(`/api/aicos/platform/product-memberships/${id}`, { method: "DELETE" });
    setBusy(false);
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Product Memberships</h1>
        <p className="mt-1 text-sm text-zinc-500">Cross-tenant product super-admins (e.g. ChurchFlow owners & support).</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-700">Add membership</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@church.com"
              className="w-56 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Product ID</label>
            <input
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="prod_…"
              className="w-56 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
            </select>
          </div>
          <button
            onClick={add}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-400">Loading…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-400">No memberships.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.membership.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900">{r.identityName ?? r.identityEmail ?? "—"}</div>
                  <div className="text-xs text-zinc-400">{r.identityEmail}</div>
                </td>
                <td className="px-4 py-3 text-zinc-600">{r.productName ?? r.membership.productId}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">{r.membership.role.replace("_", " ")}</span></td>
                <td className="px-4 py-3 text-xs text-zinc-500">{r.membership.status}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => remove(r.membership.id)}
                    disabled={busy}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
