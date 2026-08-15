"use client";
import { useState, useEffect, useCallback } from "react";

interface CampusRow {
  branchId: string;
  name: string;
  isPrimary: boolean;
  income: number;
  expense: number;
  net: number;
  members: number;
  events: number;
  incomeFmt: string;
  expenseFmt: string;
  netFmt: string;
}

interface Rollup {
  range: { from: string; to: string };
  consolidated: {
    income: number;
    expense: number;
    net: number;
    members: number;
    events: number;
    incomeFmt: string;
    expenseFmt: string;
    netFmt: string;
  };
  byCampus: CampusRow[];
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card card-padding">
      <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)", marginBottom: "var(--space-2xs)" }}>{label}</p>
      <p style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: accent || "var(--ink)" }}>{value}</p>
    </div>
  );
}

export default function ReportsPage() {
  const [rollup, setRollup] = useState<Rollup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(
    new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/rollup?from=${from}&to=${to}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load roll-up");
      }
      setRollup(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roll-up");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const reportCards = [
    { title: "Membership Report", description: "Total members, new joins, inactive members, and demographics", href: "/reports/membership", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
    { title: "Attendance Report", description: "Sunday service and midweek attendance trends", href: "/reports/attendance", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", },
    { title: "Financial Summary", description: "Income, expenses, and fund balances for this period", href: "/reports/financial", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    { title: "Giving Report", description: "Tithes, offerings, and donations breakdown", href: "/reports/giving", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
    { title: "Events Report", description: "Upcoming and past events with attendance metrics", href: "/reports/events", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { title: "Growth Report", description: "Year-over-year membership and attendance growth", href: "/reports/growth", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
  ];

  return (
    <div>
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h1 style={{ marginBottom: "var(--space-xs)" }}>Reports</h1>
        <p style={{ color: "var(--muted)", fontSize: "var(--text-lg)" }}>
          Cross-campus roll-ups. Totals respect the campus selector in the top bar (All campuses vs a
          single campus).
        </p>
      </div>

      {error && (
        <div className="card card-padding" style={{ color: "var(--error)", marginBottom: "var(--space-lg)" }}>
          {error}
        </div>
      )}

      <div className="card card-padding" style={{ marginBottom: "var(--space-lg)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "var(--space-md)",
            flexWrap: "wrap",
            marginBottom: "var(--space-md)",
          }}
        >
          <h3 style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>Campus Roll-up</h3>
          <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>
              From{" "}
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: "auto", height: "34px", display: "inline-block" }} />
            </label>
            <label style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>
              To{" "}
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: "auto", height: "34px", display: "inline-block" }} />
            </label>
            <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {loading && !rollup ? (
          <p style={{ color: "var(--muted)" }}>Loading roll-up…</p>
        ) : rollup ? (
          <>
            <div className="grid-3" style={{ marginBottom: "var(--space-lg)" }}>
              <StatCard label="Total Income" value={rollup.consolidated.incomeFmt} accent="var(--success)" />
              <StatCard label="Total Expenses" value={rollup.consolidated.expenseFmt} accent="var(--error)" />
              <StatCard label="Net" value={rollup.consolidated.netFmt} />
              <StatCard label="Active Members" value={rollup.consolidated.members.toLocaleString()} />
              <StatCard label="Events" value={rollup.consolidated.events.toLocaleString()} />
              <StatCard label="Campuses" value={String(rollup.byCampus.filter((c) => c.branchId !== "shared").length)} />
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "var(--space-sm)" }}>Campus</th>
                    <th style={{ textAlign: "right", padding: "var(--space-sm)" }}>Income</th>
                    <th style={{ textAlign: "right", padding: "var(--space-sm)" }}>Expenses</th>
                    <th style={{ textAlign: "right", padding: "var(--space-sm)" }}>Net</th>
                    <th style={{ textAlign: "right", padding: "var(--space-sm)" }}>Members</th>
                    <th style={{ textAlign: "right", padding: "var(--space-sm)" }}>Events</th>
                  </tr>
                </thead>
                <tbody>
                  {rollup.byCampus.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "var(--space-md)", color: "var(--muted)" }}>
                        No data in this period.
                      </td>
                    </tr>
                  ) : (
                    rollup.byCampus.map((c) => (
                      <tr key={c.branchId} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "var(--space-sm)", fontWeight: 600 }}>
                          {c.name}
                          {c.isPrimary && <span className="badge badge-success" style={{ marginLeft: "0.4rem" }}>Primary</span>}
                        </td>
                        <td style={{ textAlign: "right", padding: "var(--space-sm)", color: "var(--success)" }}>{c.incomeFmt}</td>
                        <td style={{ textAlign: "right", padding: "var(--space-sm)", color: "var(--error)" }}>{c.expenseFmt}</td>
                        <td style={{ textAlign: "right", padding: "var(--space-sm)" }}>{c.netFmt}</td>
                        <td style={{ textAlign: "right", padding: "var(--space-sm)" }}>{c.members.toLocaleString()}</td>
                        <td style={{ textAlign: "right", padding: "var(--space-sm)" }}>{c.events.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>

      <div className="grid-3">
        {reportCards.map((report) => (
          <a key={report.title} href={report.href} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card card-interactive">
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", marginBottom: "var(--space-md)" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "var(--radius-md)", background: "var(--blue-pale)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg style={{ width: "20px", height: "20px", color: "var(--blue)" }} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={report.icon} />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{report.title}</h3>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>{report.description}</p>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
