"use client";

import { useEffect, useState, useCallback } from "react";

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  organizationName: string;
  assignedTo: string | null;
  createdAt: string;
}
interface Message {
  id: string;
  authorScope: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  open: "bg-amber-50 text-amber-700 ring-amber-600/20",
  in_progress: "bg-blue-50 text-blue-700 ring-blue-600/20",
  waiting: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  closed: "bg-zinc-100 text-zinc-500 ring-zinc-500/20",
};
const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-red-50 text-red-700 ring-red-600/20",
  high: "bg-red-50 text-red-700 ring-red-600/20",
  medium: "bg-amber-50 text-amber-700 ring-amber-600/20",
  low: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
};
const STATUS_OPTIONS = ["open", "in_progress", "waiting", "resolved", "closed"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

function fmt(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupportConsole() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<{ ticket: Ticket; messages: Message[] } | null>(null);
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    const res = await fetch(`/api/aicos/support/tickets?${params.toString()}`);
    const data = await res.json();
    setTickets(data.tickets ?? []);
    setLoading(false);
  }, [status, q]);

  useEffect(() => {
    load();
  }, [load]);

  async function open(t: Ticket) {
    const res = await fetch(`/api/aicos/support/tickets/${t.id}`);
    const data = await res.json();
    setSelected({ ticket: t, messages: data.messages ?? [] });
  }

  async function send() {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    await fetch(`/api/aicos/support/tickets/${selected.ticket.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply, isInternal }),
    });
    setBusy(false);
    setReply("");
    setIsInternal(false);
    await open(selected.ticket);
  }

  async function patch(field: string, value: string) {
    if (!selected) return;
    setBusy(true);
    await fetch(`/api/aicos/support/tickets/${selected.ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setBusy(false);
    const res = await fetch(`/api/aicos/support/tickets/${selected.ticket.id}`);
    const data = await res.json();
    setSelected({ ticket: data.ticket, messages: data.messages ?? [] });
    load();
  }

  const stats = {
    open: tickets.filter((t) => t.status === "open").length,
    inProgress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved" || t.status === "closed").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Support Queue</h1>
        <p className="mt-1 text-sm text-zinc-500">Every tenant ticket across all Nexora products.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Open", value: stats.open, tint: "text-amber-600" },
          { label: "In progress", value: stats.inProgress, tint: "text-blue-600" },
          { label: "Resolved", value: stats.resolved, tint: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${s.tint}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search subject…"
          className="w-56 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-zinc-400">Loading…</td></tr>
              )}
              {!loading && tickets.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-zinc-400">No tickets match.</td></tr>
              )}
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => open(t)}
                  className={`cursor-pointer hover:bg-zinc-50 ${selected?.ticket.id === t.id ? "bg-emerald-50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{t.subject}</div>
                    <div className="text-xs text-zinc-400">{t.organizationName} · {fmt(t.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_BADGE[t.status] ?? ""}`}>{t.status.replace("_", " ")}</span></td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${PRIORITY_BADGE[t.priority] ?? ""}`}>{t.priority}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-400">Select a ticket to view the conversation.</div>
          ) : (
            <div className="flex h-full flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">{selected.ticket.subject}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={selected.ticket.status}
                    onChange={(e) => patch("status", e.target.value)}
                    disabled={busy}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs focus:outline-none"
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                  <select
                    value={selected.ticket.priority}
                    onChange={(e) => patch("priority", e.target.value)}
                    disabled={busy}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs focus:outline-none"
                  >
                    {PRIORITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto" style={{ maxHeight: "380px" }}>
                {selected.messages.length === 0 && (
                  <p className="text-sm text-zinc-400">No replies yet.</p>
                )}
                {selected.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg border p-3 ${m.authorScope === "platform" ? "bg-blue-50 border-blue-100" : "bg-zinc-50 border-zinc-200"} ${m.isInternal ? "ring-1 ring-amber-300" : ""}`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-700">
                        {m.authorScope === "platform" ? "Agent" : "Tenant"}
                        {m.isInternal ? " · internal" : ""}
                      </span>
                      <span className="text-zinc-400">{fmt(m.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">{m.body}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  disabled={busy}
                  placeholder="Reply to tenant…"
                  className="h-20 w-full rounded-lg border border-zinc-300 p-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-zinc-500">
                    <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} disabled={busy} />
                    Internal note (tenant can't see)
                  </label>
                  <button
                    onClick={send}
                    disabled={busy || !reply.trim()}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
