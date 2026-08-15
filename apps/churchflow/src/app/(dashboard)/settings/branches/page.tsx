"use client";
import { useState, useEffect, useCallback } from "react";

interface Branch {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  timezone: string | null;
  is_primary: boolean;
  created_at: string;
}

interface FormState {
  name: string;
  slug: string;
  city: string;
  timezone: string;
}

const EMPTY_FORM: FormState = { name: "", slug: "", city: "", timezone: "Africa/Accra" };

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [multiCampusEnabled, setMultiCampusEnabled] = useState(true);
  const [upgradeBanner, setUpgradeBanner] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [cloneFrom, setCloneFrom] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/branches");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load branches");
      }
      const json = await res.json();
      setBranches(json.branches ?? []);
      setMultiCampusEnabled(json.multiCampusEnabled !== false);
      if (json.branches?.length > 0 && json.multiCampusEnabled === false) {
        setUpgradeBanner(
          "Multi-campus is not enabled on your current plan. Ask your plan administrator to enable the Multi-campus add-on to add more campuses."
        );
      } else {
        setUpgradeBanner(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load branches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setCloneFrom("");
    setFormOpen(true);
  };

  const openEdit = (b: Branch) => {
    setEditingId(b.id);
    setForm({
      name: b.name,
      slug: b.slug ?? "",
      city: b.city ?? "",
      timezone: b.timezone ?? "Africa/Accra",
    });
    setFormError(null);
    setFormOpen(true);
  };

  const cancelForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setCloneFrom("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Branch name is required");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        city: form.city.trim() || null,
        timezone: form.timezone.trim() || "Africa/Accra",
        ...(editingId ? {} : { clone_from: cloneFrom || undefined }),
      };
      const res = editingId
        ? await fetch(`/api/admin/branches/${editingId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/branches", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.upgradeRequired) {
          setFormError(body.error || "Upgrade required to add more campuses");
          setUpgradeBanner(
            body.error ||
              "Multi-campus is not enabled on your current plan. Ask your plan administrator to enable the Multi-campus add-on."
          );
          return; // keep the form open so the message is visible
        }
        throw new Error(body.error || "Failed to save branch");
      }
      cancelForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save branch");
    } finally {
      setSaving(false);
    }
  };

  const setPrimary = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/branches/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ setPrimary: true }),
      });
      if (!res.ok) throw new Error("Failed to set primary branch");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set primary branch");
    }
  };

  const remove = async (b: Branch) => {
    if (!window.confirm(`Delete "${b.name}"? Its data stays (branch link cleared) but the campus is removed.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/branches/${b.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete branch");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete branch");
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--space-md)",
          marginBottom: "var(--space-xl)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "var(--space-xs)" }}>Campuses / Branches</h1>
          <p style={{ color: "var(--muted)", fontSize: "var(--text-lg)" }}>
            Organize your church into locations. Assign data and team roles per campus.
          </p>
        </div>
        {!formOpen && (
          <button
            className="btn btn-primary"
            onClick={openCreate}
            disabled={branches.length > 0 && !multiCampusEnabled}
            title={
              branches.length > 0 && !multiCampusEnabled
                ? "Multi-campus is not enabled on your plan"
                : undefined
            }
          >
            + New Campus
          </button>
        )}
      </div>

      {error && (
        <div className="card card-padding" style={{ color: "var(--error)", marginBottom: "var(--space-lg)" }}>
          {error}
        </div>
      )}

      {upgradeBanner && (
        <div
          className="card card-padding"
          style={{
            color: "var(--blue-deep)",
            background: "var(--blue-pale)",
            border: "1px solid var(--blue)",
            marginBottom: "var(--space-lg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-md)",
          }}
        >
          <span>{upgradeBanner}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setUpgradeBanner(null)}>
            Dismiss
          </button>
        </div>
      )}

      {formOpen && (
        <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
          <h3 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: "var(--space-lg)" }}>
            {editingId ? "Edit Campus" : "New Campus"}
          </h3>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <div className="grid-2">
              <div>
                <label className="label">Name *</label>
                <input
                  className="input"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Tema Campus"
                  required
                />
              </div>
              <div>
                <label className="label">Slug</label>
                <input
                  className="input"
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="auto from name"
                />
              </div>
              <div>
                <label className="label">City</label>
                <input
                  className="input"
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Accra"
                />
              </div>
              <div>
                <label className="label">Timezone</label>
                <input
                  className="input"
                  type="text"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  placeholder="Africa/Accra"
                />
              </div>
            </div>
            {!editingId && branches.length > 0 && (
              <div>
                <label className="label">Copy setup from</label>
                <select
                  className="input"
                  value={cloneFrom}
                  onChange={(e) => setCloneFrom(e.target.value)}
                >
                  <option value="">Start empty (no templates)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — copy giving funds
                    </option>
                  ))}
                </select>
                <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-2xs)" }}>
                  Clones the selected campus&apos;s giving fund definitions into the new campus. People and
                  events are not copied.
                </p>
              </div>
            )}
            {formError && <p style={{ color: "var(--error)", fontSize: "var(--text-sm)" }}>{formError}</p>}
            <div style={{ display: "flex", gap: "var(--space-sm)" }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create Campus"}
              </button>
              <button className="btn btn-ghost" type="button" onClick={cancelForm} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card card-padding" style={{ color: "var(--muted)" }}>Loading campuses...</div>
      ) : branches.length === 0 ? (
        <div className="card card-padding" style={{ color: "var(--muted)" }}>
          No campuses yet. Create your first campus to start organizing data by location.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {branches.map((b) => (
            <div key={b.id} className="card card-padding" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-md)", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "12px",
                    background: "var(--blue-pale)",
                    color: "var(--blue-dark)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "var(--text-md)",
                  }}
                >
                  {(b.name || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                    <span style={{ fontWeight: 600, color: "var(--ink)", fontSize: "var(--text-lg)" }}>{b.name}</span>
                    {b.is_primary && <span className="badge badge-success">Primary</span>}
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>
                    {[b.city, b.timezone, b.slug].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                {!b.is_primary && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setPrimary(b.id)}>
                    Set primary
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(b)}>
                  Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(b)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
