"use client";

import { useEffect, useState, useCallback } from "react";

interface Ticket {
  id: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  created_at: string;
}

interface Message {
  id: string;
  author_scope: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  open: "badge-warning",
  in_progress: "badge-primary",
  waiting: "badge-default",
  resolved: "badge-success",
  closed: "badge-default",
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "badge-error",
  high: "badge-error",
  medium: "badge-warning",
  low: "badge-default",
};

function fmtDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ ticket: Ticket; messages: Message[] } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("general");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/support/tickets");
    const data = await res.json();
    setTickets(data.tickets ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  async function openTicket(ticket: Ticket) {
    const res = await fetch(`/api/support/tickets/${ticket.id}`);
    const data = await res.json();
    setSelected({ ticket, messages: data.messages ?? [] });
  }

  async function createTicket() {
    setError("");
    if (!subject.trim()) {
      setError("Subject is required");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, description, priority, category }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create ticket");
      return;
    }
    setModalOpen(false);
    setSubject("");
    setDescription("");
    setPriority("medium");
    setCategory("general");
    await loadTickets();
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/support/tickets/${selected.ticket.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reply }),
    });
    setBusy(false);
    if (res.ok) {
      setReply("");
      await openTicket(selected.ticket);
    }
  }

  return (
    <div className="space-y-lg">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Help &amp; Support</p>
          <h2>Support</h2>
          <p className="page-description">Open a request and track replies from the ChurchFlow team.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          New Ticket
        </button>
      </div>

      {loading ? (
        <div className="card">
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M3 12a9 9 0 0118 0v4a3 3 0 01-3 3H8l-4 4v-4a3 3 0 01-3-3v-4z" />
            </svg>
          </div>
          <p className="empty-state-title">No tickets yet</p>
          <p className="empty-state-text">When you need help, open a ticket and we will respond here.</p>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>New Ticket</button>
        </div>
      ) : (
        <div className="grid-2">
          <div className="table-container card-table">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    className={`table-row card-interactive ${selected?.ticket.id === t.id ? "table-row-selected" : ""}`}
                    onClick={() => openTicket(t)}
                  >
                    <td>
                      <div className="cell-bold">{t.subject}</div>
                      <div className="cell-muted">{fmtDate(t.created_at)}</div>
                    </td>
                    <td><span className={`badge ${STATUS_BADGE[t.status] ?? "badge-default"}`}>{t.status.replace("_", " ")}</span></td>
                    <td><span className={`badge ${PRIORITY_BADGE[t.priority] ?? "badge-default"}`}>{t.priority}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ minHeight: "320px" }}>
            {!selected ? (
              <div className="empty-state">
                <p className="empty-state-title">Select a ticket</p>
                <p className="empty-state-text">Choose a ticket from the list to view the conversation.</p>
              </div>
            ) : (
              <div className="flex-col gap-md" style={{ height: "100%" }}>
                <div>
                  <h3 style={{ fontSize: "var(--text-xl)" }}>{selected.ticket.subject}</h3>
                  <div className="flex gap-sm mt-sm">
                    <span className={`badge ${STATUS_BADGE[selected.ticket.status] ?? "badge-default"}`}>{selected.ticket.status.replace("_", " ")}</span>
                    <span className={`badge ${PRIORITY_BADGE[selected.ticket.priority] ?? "badge-default"}`}>{selected.ticket.priority}</span>
                  </div>
                </div>

                <div className="flex-col gap-sm" style={{ flex: 1, overflowY: "auto", maxHeight: "360px" }}>
                  {selected.messages.length === 0 && (
                    <p className="text-muted text-sm">No replies yet. We will respond shortly.</p>
                  )}
                  {selected.messages.map((m) => (
                    <div
                      key={m.id}
                      className="card"
                      style={{
                        background: m.author_scope === "platform" ? "var(--blue-pale)" : "var(--surface-hover)",
                        borderColor: m.is_internal ? "var(--gold)" : "var(--line)",
                      }}
                    >
                      <div className="flex justify-between">
                        <span className="cell-bold" style={{ textTransform: "capitalize" }}>
                          {m.author_scope === "platform" ? "ChurchFlow Team" : "You"}
                          {m.is_internal ? " · internal" : ""}
                        </span>
                        <span className="cell-muted text-sm">{fmtDate(m.created_at)}</span>
                      </div>
                      <p style={{ marginTop: "var(--space-xs)", whiteSpace: "pre-wrap" }}>{m.body}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-sm">
                  <textarea
                    className="input"
                    style={{ height: "64px", padding: "var(--space-sm)" }}
                    placeholder="Write a reply..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    disabled={busy}
                  />
                  <button className="btn btn-primary" onClick={sendReply} disabled={busy || !reply.trim()}>
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Support Ticket</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="modal-body flex-col gap-md">
              <div>
                <label className="label">Subject</label>
                <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary of the issue" />
              </div>
              <div>
                <label className="label">Details <span className="label-optional">optional</span></label>
                <textarea className="input" style={{ height: "96px", padding: "var(--space-sm)" }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Steps to reproduce, what you expected, etc." />
              </div>
              <div className="grid-2">
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="general">General</option>
                    <option value="billing">Billing</option>
                    <option value="technical">Technical</option>
                    <option value="feature">Feature request</option>
                    <option value="bug">Bug</option>
                    <option value="account">Account</option>
                  </select>
                </div>
              </div>
              {error && <p className="error-text">{error}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createTicket} disabled={busy}>Submit Ticket</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
