"use client";
import { useState, useEffect, useCallback } from "react";

interface Branch {
  id: string;
  name: string;
  is_primary: boolean;
}

interface Membership {
  id: string;
  userId: string;
  role: string | null;
  status: string | null;
  branchId: string | null;
  user: { name: string; email: string };
}

const ROLE_OPTIONS = ["admin", "manager", "staff", "viewer"];

export default function TeamPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, bRes] = await Promise.all([
        fetch("/api/admin/memberships"),
        fetch("/api/admin/branches"),
      ]);
      if (!mRes.ok) {
        const body = await mRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load team");
      }
      const mJson = await mRes.json();
      const bJson = bRes.ok ? await bRes.json() : { branches: [] };
      setMemberships(mJson.memberships ?? []);
      setBranches(bJson.branches ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id: string, payload: Record<string, unknown>) => {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/memberships/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update member");
      }
      const json = await res.json();
      setMemberships((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, role: json.membership.role, branchId: json.membership.branchId }
            : m
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update member");
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (m: Membership) => {
    if (!window.confirm(`Remove ${m.user.name} from this organization?`)) return;
    try {
      const res = await fetch(`/api/admin/memberships/${m.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to remove member");
      }
      setMemberships((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const roleOptions = (current?: string | null) =>
    Array.from(new Set([...(current ? [current] : []), ...ROLE_OPTIONS]));

  return (
    <div>
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h1 style={{ marginBottom: "var(--space-xs)" }}>Team &amp; Roles</h1>
        <p style={{ color: "var(--muted)", fontSize: "var(--text-lg)" }}>
          Assign each team member a role and a campus scope. A scope of “All campuses” grants
          org-wide access; choosing a campus limits their role to that location.
        </p>
      </div>

      {error && (
        <div className="card card-padding" style={{ color: "var(--error)", marginBottom: "var(--space-lg)" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="card card-padding" style={{ color: "var(--muted)" }}>Loading team...</div>
      ) : memberships.length === 0 ? (
        <div className="card card-padding" style={{ color: "var(--muted)" }}>
          No team members found for this organization.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {memberships.map((m) => (
            <div
              key={m.id}
              className="card card-padding"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-md)", flexWrap: "wrap" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    background: "var(--gold)",
                    color: "var(--blue-deep)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "var(--text-sm)",
                  }}
                >
                  {(m.user.name || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontWeight: 600, color: "var(--ink)", fontSize: "var(--text-lg)" }}>
                    {m.user.name}
                    {m.status && m.status !== "active" && (
                      <span className="badge badge-warning" style={{ marginLeft: "0.5rem" }}>{m.status}</span>
                    )}
                  </p>
                  <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>{m.user.email}</p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                <select
                  className="input"
                  style={{ width: "auto", height: "36px", fontSize: "var(--text-base)", cursor: "pointer" }}
                  value={m.role ?? ""}
                  disabled={savingId === m.id}
                  onChange={(e) => patch(m.id, { role: e.target.value })}
                  aria-label={`Role for ${m.user.name}`}
                >
                  {roleOptions(m.role).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <select
                  className="input"
                  style={{ width: "auto", height: "36px", fontSize: "var(--text-base)", cursor: "pointer" }}
                  value={m.branchId ?? "all"}
                  disabled={savingId === m.id}
                  onChange={(e) => patch(m.id, { branch_id: e.target.value === "all" ? null : e.target.value })}
                  aria-label={`Campus scope for ${m.user.name}`}
                >
                  <option value="all">All campuses</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.is_primary ? " (main)" : ""}
                    </option>
                  ))}
                </select>

                <button
                  className="btn btn-danger btn-sm"
                  disabled={savingId === m.id}
                  onClick={() => remove(m)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {savingId && (
            <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>Saving…</p>
          )}
        </div>
      )}
    </div>
  );
}
