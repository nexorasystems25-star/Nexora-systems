"use client";

import { useEffect, useState } from "react";

interface Branch {
  id: string;
  name: string;
  slug: string;
  is_primary: boolean;
}

export default function BranchSwitcher() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [isOrgWide, setIsOrgWide] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/branch/select")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setBranches(d.branches ?? []);
        setActive(d.activeBranchId ?? null);
        setIsOrgWide(d.scope?.isOrgWide ?? true);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || branches.length === 0) return null;

  const onChange = async (value: string) => {
    const res = await fetch("/api/branch/select", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ branchId: value }),
    });
    if (res.ok) {
      setActive(value === "all" ? null : value);
      window.location.reload();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
        fontSize: "var(--text-base)",
        color: "var(--ink)",
      }}
      title="Switch campus"
    >
      <svg
        width="16"
        height="16"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        style={{ color: "var(--muted)" }}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm7.5 0c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
      <select
        value={active ?? "all"}
        onChange={(e) => onChange(e.target.value)}
        disabled={!isOrgWide && branches.length <= 1}
        className="input"
        style={{ width: "auto", height: "36px", fontSize: "var(--text-base)", cursor: "pointer", paddingRight: "1.5rem" }}
        aria-label="Active campus"
      >
        <option value="all">All campuses</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
            {b.is_primary ? " (main)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
