"use client";
import { useState, useEffect } from "react";

interface Transaction {
  id: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  member_name: string;
  payment_method: string;
  created_at: string;
}

interface FinanceSummary {
  total_income: number;
  total_expenses: number;
  net_balance: number;
}

interface FinanceResponse {
  transactions: Transaction[];
  funds: unknown[];
  summary: FinanceSummary;
  pagination: { page: number; limit: number; total: number; pages: number };
}

export default function FinancePage() {
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/finance?limit=20");
        if (!res.ok) throw new Error("Failed to fetch finance data");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const summary = data?.summary;
  const transactions = data?.transactions || [];

  const formatCurrency = (amount: number) => `GHS ${amount.toLocaleString()}`;
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (loading) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--space-xl)" }}>
          <div>
            <h1 style={{ marginBottom: "var(--space-xs)" }}>Finance</h1>
            <p style={{ color: "var(--muted)", fontSize: "var(--text-lg)" }}>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--space-xl)" }}>
          <div>
            <h1 style={{ marginBottom: "var(--space-xs)" }}>Finance</h1>
          </div>
        </div>
        <div className="card card-padding" style={{ color: "var(--error)" }}>{error}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Page heading */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--space-xl)" }}>
        <div>
          <h1 style={{ marginBottom: "var(--space-xs)" }}>Finance</h1>
          <p style={{ color: "var(--muted)", fontSize: "var(--text-lg)" }}>
            Record tithes, offerings, and expenses. Generate reports and manage budgets.
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <button className="btn btn-secondary">Export Report</button>
          <button className="btn btn-primary">+ Record Transaction</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="card">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>Total Income</p>
          <p style={{ fontSize: "var(--text-4xl)", fontWeight: 700, color: "var(--success)", marginTop: "var(--space-xs)" }}>
            {formatCurrency(summary?.total_income ?? 0)}
          </p>
        </div>
        <div className="card">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>Total Expenses</p>
          <p style={{ fontSize: "var(--text-4xl)", fontWeight: 700, color: "var(--error)", marginTop: "var(--space-xs)" }}>
            {formatCurrency(summary?.total_expenses ?? 0)}
          </p>
        </div>
        <div className="card">
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>Net Balance</p>
          <p style={{ fontSize: "var(--text-4xl)", fontWeight: 700, marginTop: "var(--space-xs)" }}>
            {formatCurrency(summary?.net_balance ?? 0)}
          </p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="section-header">
        <h2 className="section-title">Recent Transactions</h2>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Method</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: "var(--space-xl)" }}>
                  No transactions found
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="table-row">
                  <td style={{ fontSize: "var(--text-base)" }}>{formatDate(tx.created_at)}</td>
                  <td>
                    <span className={`badge ${tx.type === "income" ? "badge-success" : "badge-error"}`}>
                      {tx.category}
                    </span>
                  </td>
                  <td style={{ fontSize: "var(--text-base)" }}>{tx.description || tx.member_name || "—"}</td>
                  <td style={{ fontSize: "var(--text-base)", color: "var(--muted)" }}>{tx.payment_method || "—"}</td>
                  <td style={{ textAlign: "right", fontSize: "var(--text-base)", fontWeight: 600, color: tx.type === "income" ? "var(--success)" : "var(--error)" }}>
                    {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
