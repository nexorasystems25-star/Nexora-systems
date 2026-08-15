"use client";
import { useState, useEffect } from "react";

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  group_id: string;
  status: string;
}

interface MembersResponse {
  members: Member[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export default function MembersPage() {
  const [data, setData] = useState<MembersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);
        if (groupFilter) params.set("group", groupFilter);
        const res = await fetch(`/api/members?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch members");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [page, search, statusFilter, groupFilter]);

  const getInitials = (m: Member) =>
    `${(m.first_name || "").charAt(0)}${(m.last_name || "").charAt(0)}`.toUpperCase();

  const members = data?.members || [];
  const activeCount = members.filter((m) => m.status === "active").length;
  const newCount = members.filter((m) => m.status === "new").length;

  return (
    <div>
      {/* Page heading */}
      <div className="page-header">
        <div>
          <p className="page-eyebrow">PEOPLE DIRECTORY</p>
          <h1 style={{ marginBottom: "var(--space-xs)" }}>Members</h1>
          <p className="page-description">Manage your church members, their information, and group assignments.</p>
        </div>
        <button className="btn btn-primary">+ Add Member</button>
      </div>

      {/* Stats grid */}
      <div className="kpi-grid" style={{ marginBottom: "var(--space-lg)" }}>
        <div className="card stat-card">
          <div className="stat-card-icon" style={{ background: "var(--blue-pale)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <p className="stat-card-label">Total Members</p>
            <p className="stat-card-value">{data?.pagination.total ?? 0}</p>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-icon" style={{ background: "var(--success-pale)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div>
            <p className="stat-card-label">Active</p>
            <p className="stat-card-value">{activeCount}</p>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-card-icon" style={{ background: "var(--warning-pale)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <p className="stat-card-label">New Members</p>
            <p className="stat-card-value">{newCount}</p>
          </div>
        </div>
      </div>

      {/* Members table */}
      <div className="card card-table">
        <div className="table-toolbar">
          <div className="input-search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              className="input"
              type="text"
              placeholder="Search members..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="input input-auto"
            value={groupFilter}
            onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Groups</option>
            <option value="young-adults">Young Adults</option>
            <option value="choir">Choir</option>
            <option value="prayer-warriors">Prayer Warriors</option>
          </select>
          <select
            className="input input-auto"
            style={{ minWidth: "130px" }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="new">New</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: "var(--space-xl)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                  <div className="skeleton skeleton-avatar" />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton skeleton-text" style={{ width: "140px", marginBottom: "var(--space-xs)" }} />
                    <div className="skeleton skeleton-text" style={{ width: "200px" }} />
                  </div>
                  <div className="skeleton skeleton-text" style={{ width: "80px" }} />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: "var(--space-xl)", textAlign: "center", color: "var(--error)" }}>{error}</div>
        ) : members.length === 0 ? (
          /* Empty State */
          <div className="empty-state">
            <div className="empty-state-icon" style={{ color: "var(--muted)", opacity: 0.4 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="empty-state-title">No members yet</h3>
            <p className="empty-state-text">
              Add your first church member to get started. You can import from a spreadsheet or add them one by one.
            </p>
            <button className="btn btn-primary">+ Add Member</button>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Group</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="table-row">
                      <td>
                        <div className="cell-with-avatar">
                          <div className="avatar">{getInitials(member)}</div>
                          <span className="cell-bold">{member.first_name} {member.last_name}</span>
                        </div>
                      </td>
                      <td className="cell-muted">{member.email || "—"}</td>
                      <td className="cell-muted">{member.phone || "—"}</td>
                      <td>
                        <span className="badge badge-default">{member.group_id || "Unassigned"}</span>
                      </td>
                      <td>
                        <span className={`badge ${member.status === "active" ? "badge-success" : member.status === "new" ? "badge-primary" : "badge-warning"}`}>
                          {member.status}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm btn-icon-only" aria-label={`Actions for ${member.first_name}`}>
                          ⋮
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              <span className="table-footer-text">
                Showing {members.length > 0 ? (page - 1) * 20 + 1 : 0} to {Math.min(page * 20, data?.pagination.total ?? 0)} of {data?.pagination.total ?? 0} results
              </span>
              <div className="pagination">
                <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
                <button className="btn btn-primary btn-sm">{page}</button>
                <button className="btn btn-secondary btn-sm" disabled={page >= (data?.pagination.pages ?? 1)} onClick={() => setPage((p) => p + 1)}>→</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
