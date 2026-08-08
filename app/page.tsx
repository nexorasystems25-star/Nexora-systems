"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { AttendanceSession, CareCase, ChurchEvent, FinanceFund, FinanceTransaction, Household, Member, modules, OrganisationUnit, Section, seedMembers, upcomingEvents } from "../lib/churchflow";
import { rolePolicies, type RoleKey } from "../lib/access";

const SESSION_KEY = "churchflow_supabase_session";
type SupabaseSession = { access_token: string; refresh_token?: string; expires_in?: number; user?: { email?: string } };

function getSession() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null") as SupabaseSession | null; } catch { return null; }
}

async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const session = getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set("authorization", `Bearer ${session.access_token}`);
  return window.fetch(input, { ...init, headers });
}

function signOut() {
  localStorage.removeItem(SESSION_KEY);
  window.location.reload();
}

type AccessProfile = {
  id: number;
  name: string;
  email: string;
  role: RoleKey;
  roleLabel: string;
  campus: string;
  status: string;
  memberId: number | null;
  permissions: readonly string[];
};

type SheetState = {
  title: string;
  eyebrow: string;
  description: string;
  items?: string[];
  actionLabel?: string;
} | null;

export default function Home() {
  const [section, setSection] = useState<Section>("Dashboard");
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState(seedMembers);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [campus, setCampus] = useState("Grace Centre");
  const [openMenu, setOpenMenu] = useState<"campus" | "notifications" | "profile" | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [selectedSheetItem, setSelectedSheetItem] = useState("");
  const [profileMember, setProfileMember] = useState<Member | null>(null);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [access, setAccess] = useState<AccessProfile | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const callbackToken = hash.get("access_token");
    if (callbackToken) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        access_token: callbackToken,
        refresh_token: hash.get("refresh_token") || undefined,
        expires_in: Number(hash.get("expires_in") || 3600),
      }));
      history.replaceState(null, "", window.location.pathname);
    }
    authFetch("/api/access")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
      .then((data: { user?: AccessProfile }) => {
        if (data.user) setAccess(data.user);
      })
      .catch(() => setAccess(null))
      .finally(() => setAccessChecked(true));
    authFetch("/api/members")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { members?: Member[] }) => {
        if (data.members?.length) setMembers(data.members);
      })
      .catch(() => {
        // The representative data remains available during local design preview.
      });
  }, []);

  const visibleMembers = useMemo(
    () =>
      members.filter((m) =>
        `${m.name} ${m.id} ${m.group}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [members, query],
  );

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function openSheet(title: string, eyebrow: string, description: string, items?: string[], actionLabel?: string) {
    setOpenMenu(null);
    setSelectedSheetItem("");
    setSheet({ title, eyebrow, description, items, actionLabel });
  }

  function navigate(target: Section) {
    setSection(target);
    setOpenMenu(null);
    setSheet(null);
  }

  function openMember(member: Member) {
    setSheet(null);
    setProfileMember(member);
  }

  function memberUpdated(member: Member) {
    setMembers((current) => current.map((item) => item.id === member.id ? member : item));
    setProfileMember(member);
    setEditMember(null);
    notify(`${member.name}’s profile was updated`);
  }

  function exportMembers() {
    const rows = [["churchId","name","group","phone","email","gender","birthDate","maritalStatus","weddingDate","membershipType","baptismStatus","status","joinedAt"], ...members.map((member) => [member.id,member.name,member.group,member.phone,member.email || "",member.gender || "",member.birthDate || "",member.maritalStatus || "",member.weddingDate || "",member.membershipType || "",member.baptismStatus || "",member.status,member.joined])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const anchor = document.createElement("a");
    anchor.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    anchor.download = "churchflow-members.csv";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    notify("Member directory exported");
    anchor.click();
    anchor.remove();
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const group = String(data.get("group") ?? "General");
    const phone = String(data.get("phone") ?? "");
    const email = String(data.get("email") ?? "");
    if (!name) return;
    const fallback: Member = {
      name,
      initials: name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      id: `CH-${String(400 + members.length + 1).padStart(4, "0")}`,
      group,
      phone,
      email,
      status: "Active",
      joined: "Today",
    };
    let member = fallback;
    try {
      const response = await authFetch("/api/members", { method: "POST", body: data });
      const result = (await response.json()) as { member?: Member; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to add member");
      if (result.member) member = result.member;
    } catch {
      // Preserve the interaction during local preview if D1 is unavailable.
    }
    setMembers((current) => [member, ...current]);
    setShowAdd(false);
    setPhotoPreview("");
    notify(`${name} was added successfully`);
  }

  if (!accessChecked) return <AccessScreen loading />;
  if (!access) return <AccessScreen />;
  if (access.role === "member") return <MemberPortal access={access} />;

  const title = section === "Care" ? "Welfare & Follow-up" : section;
  const can = (permission: string) => access.permissions.includes("*") || access.permissions.includes(permission);
  const visibleModules = modules.filter((item) => can(item.permission));

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">✦</div>
          <div><strong>ChurchFlow</strong><span>Management</span></div>
          <button className="close-nav" onClick={() => setMobileNav(false)}>×</button>
        </div>
        <nav>
          <p className="nav-title">WORKSPACE</p>
          {visibleModules.map((item) => (
            <button
              key={item.label}
              className={section === item.label ? "active" : ""}
              onClick={() => { setSection(item.label); setMobileNav(false); }}
            >
              <span className="nav-icon">{item.icon}</span>{item.label}
              {item.notificationCount && <em>{item.notificationCount}</em>}
            </button>
          ))}
        </nav>
        <button className="sidebar-help" onClick={() => openSheet("ChurchFlow quick guide", "HELP CENTRE", "Use this guide to complete the most common church administration tasks.", ["Add and update member records", "Take service attendance", "Record collections and expenses", "Assign pastoral follow-up"], "Open help centre")}>
          <span>?</span>
          <div><strong>Need help?</strong><small>Read the quick guide</small></div>
          <b>›</b>
        </button>
        <div className="account">
          <div className="avatar pastor">DA</div>
          <div><strong>{access.name}</strong><span>{access.roleLabel}</span></div>
          <button aria-label="Open account menu" onClick={() => setOpenMenu(openMenu === "profile" ? null : "profile")}>⋮</button>
          {openMenu === "profile" && <div className="side-popover"><button onClick={() => openSheet("Administrator profile", "ACCOUNT", "Review your administrator identity, assigned campus and security settings.", [access.name, access.roleLabel, access.email, campus], "Manage profile")}>Profile & security</button><button onClick={signOut}>Sign out</button></div>}
        </div>
      </aside>

      {mobileNav && <button className="backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

      <section className="workspace">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)}>☰</button>
          <div className="mobile-brand">ChurchFlow</div>
          <label className="global-search">
            <span>⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && query.trim()) navigate("Members"); }} placeholder="Search members, groups, records..." />
            <kbd>⌘ K</kbd>
          </label>
          <div className="top-actions">
            <div className="menu-anchor"><button className="campus-switcher" aria-expanded={openMenu === "campus"} onClick={() => setOpenMenu(openMenu === "campus" ? null : "campus")}><span>AG</span><b>{campus}</b><i>⌄</i></button>{openMenu === "campus" && <div className="top-popover campus-menu"><p>CHURCH CAMPUS</p>{["Grace Centre", "North Assembly", "Online Campus"].map((name) => <button className={campus === name ? "selected" : ""} key={name} onClick={() => { setCampus(name); setOpenMenu(null); notify(`Switched to ${name}`); }}><span>{name === campus ? "✓" : "○"}</span>{name}</button>)}</div>}</div>
            <div className="menu-anchor"><button aria-label="Notifications" aria-expanded={openMenu === "notifications"} onClick={() => setOpenMenu(openMenu === "notifications" ? null : "notifications")} className="notification">♢<i /></button>{openMenu === "notifications" && <div className="top-popover notification-menu"><div><strong>Notifications</strong><button onClick={() => notify("Notifications marked as read")}>Mark all read</button></div><button onClick={() => navigate("Care")}><i className="alert-dot" /><span><b>4 follow-ups are due</b><small>New converts · Before Friday</small></span></button><button onClick={() => navigate("Events")}><i className="info-dot" /><span><b>Sunday plan updated</b><small>Worship team · 12 minutes ago</small></span></button></div>}</div>
            <button className="quick-add" onClick={() => setShowAdd(true)}>＋ Quick add</button>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">CHURCH OPERATIONS</p>
              <h1>{title}</h1>
              <p>{section === "Dashboard" ? "Here’s what’s happening across the church today." : `Manage and review ${title.toLowerCase()} records.`}</p>
            </div>
            <div className="heading-actions"><span className="live-status"><i /> Ministry systems operational</span><div className="date-pill"><span>◫</span> Wednesday, 29 July 2026</div></div>
          </div>

          {section === "Dashboard" ? (
            <Dashboard members={members} setSection={navigate} setShowAdd={setShowAdd} notify={notify} openSheet={openSheet} openMember={openMember} />
          ) : (
            <ModuleView section={section} members={visibleMembers} query={query} setQuery={setQuery} setShowAdd={setShowAdd} notify={notify} openSheet={openSheet} openMember={openMember} exportMembers={exportMembers} access={access} />
          )}
        </div>
      </section>

      {showAdd && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Add member">
          <button className="modal-dismiss" onClick={() => setShowAdd(false)} aria-label="Close modal" />
          <form className="modal member-form" onSubmit={addMember}>
            <div className="modal-head"><div><p className="eyebrow">MEMBER RECORD</p><h2>Add a new member</h2><span>Create a complete, ministry-ready people record.</span></div><button type="button" onClick={() => { setShowAdd(false); setPhotoPreview(""); }}>×</button></div>
            <section className="photo-section">
              <div className="photo-preview">{photoPreview ? <img src={photoPreview} alt="Selected profile preview" /> : <><span>♙</span><small>No photo</small></>}</div>
              <div><strong>Profile photograph</strong><p>Use a clear head-and-shoulders image. JPG, PNG or WebP, up to 5 MB.</p><label className="upload-button">↑ Choose photo<input type="file" name="profilePhoto" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) { notify("Photo must be 5 MB or smaller"); event.target.value = ""; return; } setPhotoPreview(URL.createObjectURL(file)); }} /></label></div>
            </section>
            <FormSection title="Personal information" description="Identity and demographic details">
              <label>Full legal name *<input name="name" placeholder="e.g. Ama Serwaa" required autoFocus /></label>
              <label>Gender<select name="gender"><option value="">Select gender</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label>
              <label>Date of birth<input type="date" name="birthDate" /></label>
              <label>Marital status<select name="maritalStatus"><option value="">Select status</option><option>Single</option><option>Married</option><option>Widowed</option><option>Divorced</option></select></label>
              <label>Wedding anniversary<input type="date" name="weddingDate" /></label>
            </FormSection>
            <FormSection title="Contact and address" description="How the church can reach this member">
              <label>Phone number *<input name="phone" inputMode="tel" placeholder="024 000 0000" required /></label>
              <label>Email address<input type="email" name="email" placeholder="member@example.com" /></label>
              <label>Residential address<input name="address" placeholder="Community, street or landmark" /></label>
              <label>Hometown<input name="hometown" placeholder="Town and region" /></label>
              <label>Occupation<input name="occupation" placeholder="Profession or trade" /></label>
            </FormSection>
            <FormSection title="Church membership" description="Membership status and ministry connection">
              <label>Membership type<select name="membershipType"><option>Full member</option><option>Associate member</option><option>New convert</option><option>Visitor</option><option>Child member</option></select></label>
              <label>Baptism status<select name="baptismStatus"><option value="">Select status</option><option>Baptised by immersion</option><option>Pending baptism</option><option>Not recorded</option></select></label>
              <label>Group or department<select name="group"><option>General</option><option>Women’s Ministry</option><option>Men’s Ministry</option><option>Youth Ministry</option><option>Choir</option><option>Children’s Ministry</option><option>Ushers</option><option>Media Team</option></select></label>
            </FormSection>
            <FormSection title="Emergency and pastoral information" description="Used only by authorised church leaders">
              <label>Emergency contact name<input name="emergencyName" placeholder="Full name" /></label>
              <label>Emergency contact phone<input name="emergencyPhone" inputMode="tel" placeholder="024 000 0000" /></label>
              <label className="wide-field">Pastoral notes<textarea name="notes" placeholder="Optional care, follow-up or membership notes..." /></label>
            </FormSection>
            <div className="modal-note">The member receives a unique church ID. Login access can only be created later by an administrator.</div>
            <div className="modal-actions sticky-actions"><button type="button" onClick={() => { setShowAdd(false); setPhotoPreview(""); }}>Cancel</button><button className="primary" type="submit">Create member record</button></div>
          </form>
        </div>
      )}

      {profileMember && <MemberProfile member={profileMember} onClose={() => setProfileMember(null)} onEdit={() => setEditMember(profileMember)} />}
      {editMember && <MemberEditModal member={editMember} onClose={() => setEditMember(null)} onSaved={memberUpdated} notify={notify} />}

      {sheet && <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={sheet.title}><button className="drawer-dismiss" aria-label="Close panel" onClick={() => setSheet(null)} /><aside className="action-drawer"><div className="drawer-head"><div><p className="eyebrow">{sheet.eyebrow}</p><h2>{sheet.title}</h2></div><button onClick={() => setSheet(null)} aria-label="Close panel">×</button></div><p className="drawer-description">{sheet.description}</p>{sheet.items && <div className="drawer-list">{sheet.items.map((item, index) => <button type="button" className={selectedSheetItem === item ? "selected" : ""} aria-pressed={selectedSheetItem === item} onClick={() => setSelectedSheetItem(item)} key={item}><span>{selectedSheetItem === item ? "✓" : String(index + 1).padStart(2, "0")}</span><strong>{item}</strong><b>›</b></button>)}</div>}<div className="drawer-form"><label>Notes<textarea placeholder="Add optional details or instructions..." /></label><label>Assign to<select><option>Me</option><option>Pastoral Care Team</option><option>Church Administrator</option><option>Finance Team</option></select></label></div><div className="drawer-actions"><button onClick={() => setSheet(null)}>Cancel</button><button className="primary" disabled={sheet.eyebrow === "MEMBER ACTIONS" && !selectedSheetItem} onClick={() => { const savedAction = selectedSheetItem || sheet.actionLabel || "Action"; notify(`${savedAction} saved for ${sheet.title}`); setSheet(null); }}>{sheet.eyebrow === "MEMBER ACTIONS" ? (selectedSheetItem ? `Continue: ${selectedSheetItem}` : "Select an action") : (sheet.actionLabel ?? "Save changes")}</button></div></aside></div>}

      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}

function AccessScreen({ loading = false }: { loading?: boolean }) {
  const [mode, setMode] = useState<"password" | "otp" | "activate">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function config() {
    const response = await window.fetch("/api/auth-config");
    const value = await response.json() as { url?: string; anonKey?: string; error?: string };
    if (!response.ok || !value.url || !value.anonKey) throw new Error(value.error || "Authentication is unavailable");
    return value as { url: string; anonKey: string };
  }
  async function approved() {
    const response = await window.fetch("/api/auth-preflight", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const value = await response.json() as { approved?: boolean };
    if (!value.approved) throw new Error("This email has not been approved by a ChurchFlow administrator");
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await approved();
      const { url, anonKey } = await config();
      if (mode === "otp") {
        if (!otpSent) {
          const response = await window.fetch(`${url}/auth/v1/otp`, { method: "POST", headers: { apikey: anonKey, "content-type": "application/json" }, body: JSON.stringify({ email, create_user: true }) });
          if (!response.ok) throw new Error("Unable to send the email code");
          setOtpSent(true); setMessage("A six-digit code was sent to your email."); return;
        }
        const response = await window.fetch(`${url}/auth/v1/verify`, { method: "POST", headers: { apikey: anonKey, "content-type": "application/json" }, body: JSON.stringify({ email, token: otp, type: "email" }) });
        const session = await response.json() as SupabaseSession & { msg?: string };
        if (!response.ok || !session.access_token) throw new Error(session.msg || "The code is invalid or expired");
        localStorage.setItem(SESSION_KEY, JSON.stringify(session)); window.location.reload(); return;
      }
      const endpoint = mode === "activate" ? `${url}/auth/v1/signup` : `${url}/auth/v1/token?grant_type=password`;
      const response = await window.fetch(endpoint, { method: "POST", headers: { apikey: anonKey, "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const session = await response.json() as SupabaseSession & { msg?: string; error_description?: string };
      if (!response.ok) throw new Error(session.msg || session.error_description || "Sign-in failed");
      if (!session.access_token) { setMessage("Check your email to confirm and activate your account."); return; }
      localStorage.setItem(SESSION_KEY, JSON.stringify(session)); window.location.reload();
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Unable to sign in"); }
    finally { setBusy(false); }
  }
  async function google() {
    setBusy(true); setMessage("");
    try {
      await approved();
      const { url } = await config();
      window.location.href = `${url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.origin)}`;
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Google sign-in unavailable"); setBusy(false); }
  }
  if (loading) return <main className="access-screen"><section className="access-card"><div className="access-mark">✦</div><p className="eyebrow">CHURCHFLOW SECURE ACCESS</p><h1>Checking your access…</h1><p>Your approved role and permissions are being verified.</p><span className="access-loader" /></section></main>;
  return <main className="access-screen"><section className="access-card auth-card"><div className="access-mark">✦</div><p className="eyebrow">CHURCHFLOW SECURE ACCESS</p><h1>Welcome back</h1><p>Sign in with an administrator-approved church account.</p><div className="auth-tabs"><button className={mode==="password"?"active":""} onClick={()=>{setMode("password");setOtpSent(false);}}>Password</button><button className={mode==="otp"?"active":""} onClick={()=>{setMode("otp");setOtpSent(false);}}>Email code</button><button className={mode==="activate"?"active":""} onClick={()=>{setMode("activate");setOtpSent(false);}}>Activate</button></div><form className="auth-form" onSubmit={submit}><label>Email address<input type="email" required value={email} onChange={(event)=>setEmail(event.target.value)} placeholder="you@example.com" /></label>{mode==="otp"&&otpSent?<label>Six-digit code<input required inputMode="numeric" value={otp} onChange={(event)=>setOtp(event.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000" /></label>:mode!=="otp"?<label>{mode==="activate"?"Create password":"Password"}<input type="password" required minLength={8} value={password} onChange={(event)=>setPassword(event.target.value)} placeholder="At least 8 characters" /></label>:null}<button className="access-signin" disabled={busy}>{busy?"Please wait…":mode==="otp"?(otpSent?"Verify code":"Send email code"):mode==="activate"?"Activate account":"Sign in"}</button></form><div className="auth-divider"><span>or</span></div><button className="google-signin" onClick={google} disabled={busy}>G&nbsp; Continue with Google</button>{message&&<div className="auth-message">{message}</div>}<small>There is no public registration. Your email must first be approved by a ChurchFlow administrator.</small></section></main>;
}

type MemberPortalData = {
  profile: { churchId: string; name: string; initials: string; email?: string | null; phone: string; address?: string | null; group: string; membershipType?: string | null; baptismStatus?: string | null; status: string; joinedAt: string; profilePhotoUrl?: string | null };
  attendance: { id: number; title: string; serviceDate: string; startTime: string; venue: string; status: string; checkedInAt: string }[];
  events: { id: number; title: string; eventType: string; startDate: string; startTime: string; venue: string; campus: string; status: string }[];
  household: { householdName: string; householdCode: string; pastoralZone: string; relationship: string } | null;
};

function MemberPortal({ access }: { access: AccessProfile }) {
  const [data, setData] = useState<MemberPortalData | null>(null);
  const [active, setActive] = useState<"Home" | "Profile" | "Attendance" | "Events">("Home");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    authFetch("/api/member-portal").then(async (response) => {
      const result = await response.json() as MemberPortalData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load your portal");
      setData(result);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load your portal"));
  }, []);
  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await authFetch("/api/member-portal", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form.entries())) });
      const result = await response.json() as { updated?: boolean; phone?: string; address?: string; error?: string };
      if (!response.ok || !result.updated) throw new Error(result.error || "Unable to update profile");
      setData({ ...data, profile: { ...data.profile, phone: result.phone || data.profile.phone, address: result.address ?? data.profile.address } });
      setActive("Home");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update profile"); }
    finally { setSaving(false); }
  }
  if (error && !data) return <main className="access-screen"><section className="access-card"><div className="access-mark">!</div><h1>Portal unavailable</h1><p>{error}</p><button className="access-signin" onClick={signOut}>Sign out</button></section></main>;
  if (!data) return <AccessScreen loading />;
  const { profile, attendance, events, household } = data;
  return <main className="member-portal">
    <header className="member-topbar"><div className="member-brand"><span>✦</span><div><strong>ChurchFlow</strong><small>Member Portal</small></div></div><nav>{(["Home","Profile","Attendance","Events"] as const).map((item) => <button className={active === item ? "active" : ""} onClick={() => setActive(item)} key={item}>{item}</button>)}</nav><div className="member-account"><i>{profile.profilePhotoUrl ? <img src={profile.profilePhotoUrl} alt="" /> : profile.initials}</i><span><b>{profile.name}</b><small>{profile.churchId}</small></span><button onClick={signOut}>Sign out</button></div></header>
    <section className="member-content">
      <div className="member-welcome"><div><p className="eyebrow">WELCOME TO YOUR CHURCH HOME</p><h1>{active === "Home" ? `Hello, ${profile.name.split(" ")[0]}` : active}</h1><p>{active === "Home" ? "Stay connected with your membership journey, services and upcoming church life." : "Your private ChurchFlow member information."}</p></div><span><i /> Secure member access</span></div>
      {error && <div className="portal-error">{error}</div>}
      {active === "Home" && <><div className="member-summary"><article><span>MEMBERSHIP</span><strong>{profile.status}</strong><small>{profile.membershipType || "Church member"} · {profile.group}</small></article><article><span>ATTENDANCE</span><strong>{attendance.length}</strong><small>Recent recorded services</small></article><article><span>NEXT EVENT</span><strong>{events[0]?.startDate ? new Date(`${events[0].startDate}T00:00:00`).toLocaleDateString(undefined,{day:"numeric",month:"short"}) : "—"}</strong><small>{events[0]?.title || "No event scheduled"}</small></article><article><span>HOUSEHOLD</span><strong>{household?.householdName || "Not linked"}</strong><small>{household?.pastoralZone || "Ask the membership office"}</small></article></div><div className="member-grid"><section className="portal-panel"><div className="portal-head"><div><h2>Upcoming church life</h2><p>Services and events prepared for you</p></div><button onClick={() => setActive("Events")}>View all →</button></div>{events.slice(0,4).map((event) => <article className="portal-event" key={event.id}><time><b>{new Date(`${event.startDate}T00:00:00`).getDate()}</b><span>{new Date(`${event.startDate}T00:00:00`).toLocaleDateString(undefined,{month:"short"}).toUpperCase()}</span></time><div><strong>{event.title}</strong><small>{event.startTime} · {event.venue} · {event.campus}</small></div><i>{event.status}</i></article>)}</section><aside className="portal-panel member-card"><div className="member-card-head"><i>{profile.profilePhotoUrl ? <img src={profile.profilePhotoUrl} alt="" /> : profile.initials}</i><div><strong>{profile.name}</strong><small>{profile.churchId}</small></div></div><dl><div><dt>Ministry group</dt><dd>{profile.group}</dd></div><div><dt>Household</dt><dd>{household?.householdName || "Not linked"}</dd></div><div><dt>Baptism</dt><dd>{profile.baptismStatus || "Not recorded"}</dd></div></dl><button onClick={() => setActive("Profile")}>Review my profile</button></aside></div></>}
      {active === "Profile" && <form className="portal-panel portal-profile" onSubmit={updateProfile}><div className="portal-head"><div><h2>My member profile</h2><p>Identity details are maintained by the membership office. You can update your contact information.</p></div></div><div className="portal-profile-grid"><label>Full name<input value={profile.name} disabled /></label><label>Church ID<input value={profile.churchId} disabled /></label><label>Email address<input value={profile.email || access.email} disabled /></label><label>Ministry group<input value={profile.group} disabled /></label><label>Phone number *<input name="phone" required defaultValue={profile.phone} /></label><label>Residential address<input name="address" defaultValue={profile.address || ""} /></label></div><div className="portal-actions"><button type="button" onClick={() => setActive("Home")}>Cancel</button><button disabled={saving}>{saving ? "Saving…" : "Save contact details"}</button></div></form>}
      {active === "Attendance" && <section className="portal-panel"><div className="portal-head"><div><h2>My attendance</h2><p>Your most recent recorded services</p></div></div><div className="portal-list">{attendance.map((item) => <article key={item.id}><span className="portal-list-icon">✓</span><div><strong>{item.title}</strong><small>{new Date(`${item.serviceDate}T00:00:00`).toLocaleDateString()} · {item.startTime} · {item.venue}</small></div><i>{item.status}</i></article>)}{!attendance.length && <p className="portal-empty">No attendance has been recorded yet.</p>}</div></section>}
      {active === "Events" && <section className="portal-panel"><div className="portal-head"><div><h2>Upcoming events</h2><p>Church services, gatherings and ministry activities</p></div></div><div className="portal-list">{events.map((event) => <article key={event.id}><time><b>{new Date(`${event.startDate}T00:00:00`).getDate()}</b><span>{new Date(`${event.startDate}T00:00:00`).toLocaleDateString(undefined,{month:"short"}).toUpperCase()}</span></time><div><strong>{event.title}</strong><small>{event.eventType} · {event.startTime} · {event.venue} · {event.campus}</small></div><i>{event.status}</i></article>)}</div></section>}
    </section>
  </main>;
}

function Dashboard({ members, setSection, setShowAdd, notify, openSheet, openMember }: { members: Member[]; setSection: (s: Section) => void; setShowAdd: (v: boolean) => void; notify: (m: string) => void; openSheet: (title: string, eyebrow: string, description: string, items?: string[], actionLabel?: string) => void; openMember: (member: Member) => void }) {
  const stats = [
    { icon: "♙", label: "Total members", value: String(438 + members.length - 5), change: "12 this month", tone: "blue" },
    { icon: "✓", label: "Sunday attendance", value: "312", change: "71.2% attendance", tone: "green" },
    { icon: "₵", label: "July collections", value: "₵18,450", change: "8.4% from June", tone: "gold" },
    { icon: "♡", label: "New converts", value: "17", change: "4 need follow-up", tone: "purple" },
  ];
  return (
    <>
      <div className="stats-grid">
        {stats.map((stat) => <article className="stat-card" key={stat.label}><div className={`stat-icon ${stat.tone}`}>{stat.icon}</div><div><p>{stat.label}</p><strong>{stat.value}</strong><span className={stat.tone}>{stat.change}</span></div><button onClick={() => setSection(stat.label.includes("attendance") ? "Attendance" : stat.label.includes("collections") ? "Finance" : stat.label.includes("converts") ? "Care" : "Members")}>↗</button></article>)}
      </div>

      <section className="ministry-brief">
        <div className="brief-copy">
          <p className="eyebrow">SUNDAY READINESS · 4 DAYS</p>
          <h2>Ministry command brief</h2>
          <p>One coordinated view of people, service teams and pastoral priorities before Sunday.</p>
        </div>
        <div className="readiness">
          <div><span>Service plan</span><strong>92%</strong><i><b style={{ width: "92%" }} /></i></div>
          <div><span>Volunteer coverage</span><strong>84%</strong><i><b style={{ width: "84%" }} /></i></div>
          <div><span>Follow-up completion</span><strong>68%</strong><i><b style={{ width: "68%" }} /></i></div>
        </div>
        <div className="brief-priority"><span>Priority</span><strong>4 new-convert follow-ups</strong><small>Due before Friday, 5:00 PM</small><button onClick={() => setSection("Care")}>Open care queue →</button></div>
      </section>

      <div className="dashboard-grid">
        <section className="panel attendance-panel">
          <PanelHead title="Attendance overview" subtitle="Last 8 Sunday services" action="View report" onClick={() => setSection("Attendance")} />
          <div className="chart">
            <div className="chart-y"><span>400</span><span>300</span><span>200</span><span>100</span><span>0</span></div>
            <div className="bars">
              {[72, 78, 69, 84, 80, 88, 76, 92].map((height, i) => <div className="bar-wrap" key={i}><div className={`bar ${i === 7 ? "latest" : ""}`} style={{ height: `${height}%` }}><i>{[279, 295, 268, 318, 302, 335, 289, 312][i]}</i></div><span>{["14 Jun", "21 Jun", "28 Jun", "5 Jul", "12 Jul", "19 Jul", "26 Jul", "2 Aug"][i]}</span></div>)}
            </div>
          </div>
        </section>
        <section className="panel events-panel">
          <PanelHead title="Upcoming events" subtitle="Next 14 days" action="View calendar" onClick={() => setSection("Events")} />
          <div className="event-list">{upcomingEvents.map((event) => <div className="event" key={event.title}><div className={`event-date ${event.color}`}><strong>{event.date}</strong><span>{event.month}</span></div><div><strong>{event.title}</strong><span>{event.meta}</span></div><button aria-label={`Open ${event.title}`} onClick={() => openSheet(event.title, "EVENT DETAILS", event.meta, ["Service plan ready", "Volunteer coverage 84%", "Communications scheduled"], "Edit event")}>›</button></div>)}</div>
          <button className="outline-action" onClick={() => openSheet("Schedule an event", "EVENT PLANNING", "Create a service, programme or ministry event and assign its coordinating team.", undefined, "Create event")}>＋ Schedule an event</button>
        </section>
      </div>

      <div className="dashboard-grid lower">
        <section className="panel member-panel">
          <PanelHead title="Recent members" subtitle="Latest additions" action="View all members" onClick={() => setSection("Members")} />
          <div className="mini-table">
            {members.slice(0, 4).map((member) => <div className="member-row" key={member.id}><MemberAvatar member={member} /><div className="member-name"><strong>{member.name}</strong><span>{member.id} · {member.group}</span></div><span className={`status ${member.status.toLowerCase().replace(" ", "-")}`}>{member.status}</span><span className="joined">{member.joined}</span><button aria-label={`Open ${member.name}`} onClick={() => openMember(member)}>⋮</button></div>)}
          </div>
        </section>
        <section className="panel action-panel">
          <PanelHead title="Quick actions" subtitle="Common tasks" />
          <div className="action-grid">
            {[["＋", "Add member"], ["✓", "Take attendance"], ["₵", "Record collection"], ["♡", "Add new convert"], ["□", "Create event"], ["✦", "Send message"]].map(([icon, label]) => <button key={label} onClick={() => { if (label === "Add member") setShowAdd(true); else if (label === "Take attendance") setSection("Attendance"); else if (label === "Record collection") setSection("Finance"); else if (label === "Add new convert") setSection("Care"); else if (label === "Create event") setSection("Events"); else setSection("Communication"); }}><span>{icon}</span>{label}</button>)}
          </div>
        </section>
      </div>
    </>
  );
}

function ModuleView({ section, members, query, setQuery, setShowAdd, notify, openSheet, openMember, exportMembers, access }: { section: Section; members: Member[]; query: string; setQuery: (v: string) => void; setShowAdd: (v: boolean) => void; notify: (m: string) => void; openSheet: (title: string, eyebrow: string, description: string, items?: string[], actionLabel?: string) => void; openMember: (member: Member) => void; exportMembers: () => void; access: AccessProfile }) {
  const [groupFilter, setGroupFilter] = useState("All groups");
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const pageSize = 3;
  const filteredMembers = members.filter((member) => groupFilter === "All groups" || member.group === groupFilter);
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const firstIndex = (currentPage - 1) * pageSize;
  const paginatedMembers = filteredMembers.slice(firstIndex, firstIndex + pageSize);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  async function importMembers(file?: File) {
    if (!file) return;
    setImporting(true);
    try {
      const check = new FormData(); check.set("file", file); check.set("dryRun", "true");
      const previewResponse = await authFetch("/api/members-import", { method: "POST", body: check });
      const preview = await previewResponse.json() as { ready?: number; skippedDuplicates?: number; error?: string };
      if (!previewResponse.ok) throw new Error(preview.error || "Unable to validate member import");
      if (!window.confirm(`${preview.ready || 0} members are ready to import. ${preview.skippedDuplicates || 0} duplicate IDs will be skipped. Continue?`)) return;
      const commit = new FormData(); commit.set("file", file); commit.set("dryRun", "false");
      const response = await authFetch("/api/members-import", { method: "POST", body: commit });
      const result = await response.json() as { ready?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to import members");
      notify(`${result.ready || 0} member records imported successfully`);
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to import members"); }
    finally { setImporting(false); }
  }

  if (section === "Members") return <section className="panel module-panel"><div className="module-context"><div><span>PEOPLE DIRECTORY</span><strong>438 members across 12 ministry units</strong></div><div><b>12</b> added this month</div><div><b>94%</b> profile completeness</div></div><div className="module-toolbar"><div className="table-search">⌕<input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search members..." aria-label="Search members" /></div><select aria-label="Filter by group" value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }}><option>All groups</option><option>Youth Ministry</option><option>Women’s Ministry</option><option>Men’s Ministry</option><option>Choir</option><option>Children’s Ministry</option></select><label className="secondary-action import-action">{importing ? "Importing…" : "↑ Import CSV"}<input type="file" accept=".csv,text/csv" disabled={importing} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; importMembers(file); }} /></label><button className="secondary-action" onClick={exportMembers}>⇩ Export CSV</button><button className="primary" onClick={() => setShowAdd(true)}>＋ Add member</button></div><div className="table-scroll"><table className="members-table"><thead><tr><th scope="col">Member</th><th scope="col">Group</th><th scope="col">Phone</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{paginatedMembers.map((member) => <tr key={member.id}><td><button className="table-person person-button" onClick={() => openMember(member)}><MemberAvatar member={member} /><b>{member.name}<small>{member.id}</small></b></button></td><td>{member.group}</td><td>{member.phone}</td><td><i className={`status ${member.status.toLowerCase().replace(" ", "-")}`}>{member.status}</i></td><td>{member.joined}</td><td><button className="member-actions-button" aria-label={`Actions for ${member.name}`} onClick={() => openSheet(member.name, "MEMBER ACTIONS", "Choose the next workflow, add any instructions, then assign it to the right team.", ["View full profile", "Record attendance", "Add pastoral note"], "Save action")}>•••</button></td></tr>)}</tbody></table>{filteredMembers.length === 0 && <div className="empty-state"><span>⌕</span><strong>No members found</strong><p>Try another name or ministry filter.</p><button onClick={() => { setQuery(""); setGroupFilter("All groups"); setPage(1); }}>Clear filters</button></div>}</div><div className="table-footer"><span>{filteredMembers.length === 0 ? "No members to display" : `Showing ${firstIndex + 1}–${Math.min(firstIndex + pageSize, filteredMembers.length)} of ${filteredMembers.length} matching members`}</span><nav className="pagination" aria-label="Member directory pages"><button aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>←</button>{pageNumbers.map((number) => <button aria-label={`Page ${number}`} aria-current={currentPage === number ? "page" : undefined} className={currentPage === number ? "current-page" : ""} key={number} onClick={() => { setPage(number); notify(`Showing member page ${number} of ${totalPages}`); }}>{number}</button>)}<button aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>→</button></nav></div></section>;
  if (section === "Families") return <FamiliesView members={members} notify={notify} />;
  if (section === "Attendance") return <AttendanceView members={members} notify={notify} />;
  if (section === "Finance") return <FinanceView access={access} notify={notify} />;
  if (section === "Welfare Finance") return <WelfareFinanceView members={members} access={access} notify={notify} />;
  if (section === "Payroll") return <PayrollView members={members} access={access} notify={notify} />;
  if (section === "Records Studio") return <RecordsStudioView members={members} access={access} notify={notify} />;
  if (section === "Media Archive") return <MediaArchiveView access={access} notify={notify} />;
  if (section === "Reminders") return <RemindersView access={access} notify={notify} />;
  if (section === "Events") return <EventsView notify={notify} />;
  if (section === "Care") return <CareView members={members} access={access} notify={notify} />;
  if (section === "Ministries") return <OrganisationView notify={notify} />;
  if (section === "Leadership") return <LeadershipView members={members} access={access} notify={notify} />;
  if (section === "Volunteers") return <VolunteersView members={members} access={access} notify={notify} />;
  if (section === "Administration") return <AdministrationView access={access} notify={notify} />;
  if (section === "Communication") return <CommunicationView access={access} notify={notify} />;
  if (section === "Reports") return <ReportsView notify={notify} />;

  return null;
}

type LeadershipAppointment = {
  id: number; code: string; memberChurchId?: string | null; leaderName: string; title: string;
  leadershipLevel: string; ministry: string; campus: string; startDate: string;
  termEndDate?: string | null; status: "Active" | "On leave" | "Completed"; createdByName: string;
};

function LeadershipView({ members, access, notify }: { members: Member[]; access: AccessProfile; notify: (message: string) => void }) {
  const [appointments, setAppointments] = useState<LeadershipAppointment[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canManage = access.permissions.includes("*") || access.permissions.includes("leadership.manage");
  useEffect(() => { authFetch("/api/leadership").then((response) => response.ok ? response.json() : Promise.reject()).then((data: { appointments?: LeadershipAppointment[] }) => setAppointments(data.appointments || [])).catch(() => {}); }, []);

  async function createAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await authFetch("/api/leadership", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { appointment?: LeadershipAppointment; error?: string };
      if (!response.ok || !result.appointment) throw new Error(result.error || "Unable to create appointment");
      setAppointments((current) => [...current, result.appointment!]); setShowCreate(false);
      notify(`${result.appointment.leaderName} appointed as ${result.appointment.title}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create appointment"); }
    finally { setSaving(false); }
  }

  async function updateStatus(item: LeadershipAppointment, status: LeadershipAppointment["status"]) {
    const response = await authFetch("/api/leadership", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, status }) });
    const result = await response.json() as { appointment?: LeadershipAppointment; error?: string };
    if (!response.ok || !result.appointment) return notify(result.error || "Unable to update appointment");
    setAppointments((current) => current.map((record) => record.id === item.id ? result.appointment! : record)); notify(`${item.leaderName} marked ${status.toLowerCase()}`);
  }

  const active = appointments.filter((item) => item.status === "Active");
  return <div className="leadership-layout"><section className="people-command"><div><p className="eyebrow">LEADERSHIP GOVERNANCE</p><h2>Appointments with clear accountability</h2><p>Keep pastoral, executive, department, ministry and fellowship leadership separate from ordinary system access.</p></div><div className="people-kpis"><span><b>{active.length}</b> active leaders</span><span><b>{new Set(active.map((item) => item.ministry)).size}</b> areas covered</span><span><b>{appointments.filter((item) => item.status === "On leave").length}</b> on leave</span></div>{canManage && <button className="primary" onClick={() => setShowCreate(true)}>＋ New appointment</button>}</section><section className="panel leadership-panel"><PanelHead title="Leadership register" subtitle="Formal appointments and ministry accountability" /><div className="table-scroll"><table className="members-table leadership-table"><thead><tr><th>Leader</th><th>Appointment</th><th>Level</th><th>Campus</th><th>Term</th><th>Status</th></tr></thead><tbody>{appointments.map((item) => <tr key={item.id}><td><div className="table-person"><i className="avatar">{item.leaderName.split(/\s+/).map((part) => part[0]).join("").slice(0,2)}</i><b>{item.leaderName}<small>{item.memberChurchId || item.code}</small></b></div></td><td><b>{item.title}<small>{item.ministry}</small></b></td><td>{item.leadershipLevel}</td><td>{item.campus}</td><td>{item.startDate}<small>{item.termEndDate ? ` to ${item.termEndDate}` : " · Open term"}</small></td><td>{canManage ? <select value={item.status} aria-label={`Status for ${item.leaderName}`} onChange={(event) => updateStatus(item, event.target.value as LeadershipAppointment["status"])}><option>Active</option><option>On leave</option><option>Completed</option></select> : <i className="status">{item.status}</i>}</td></tr>)}</tbody></table></div></section>{showCreate && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Create leadership appointment"><button className="modal-dismiss" onClick={() => setShowCreate(false)} aria-label="Close appointment form" /><form className="modal leadership-form" onSubmit={createAppointment}><div className="modal-head"><div><p className="eyebrow">FORMAL APPOINTMENT</p><h2>Appoint a church leader</h2><span>Link the appointment to an existing trusted member record.</span></div><button type="button" onClick={() => setShowCreate(false)}>×</button></div>{error && <div className="form-error">{error}</div>}<div className="form-row"><label>Member *<select name="memberChurchId" required><option value="">Select member</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name} · {member.id}</option>)}</select></label><label>Leadership title *<input name="title" required placeholder="e.g. Youth Ministry President" /></label></div><div className="form-row"><label>Leadership level *<select name="leadershipLevel"><option>Executive</option><option>Pastoral</option><option>Department</option><option>Ministry</option><option>Fellowship</option></select></label><label>Ministry or area *<input name="ministry" required placeholder="Youth Ministry" /></label></div><div className="form-row"><label>Campus<select name="campus"><option>Grace Centre</option><option>North Assembly</option><option>Online Campus</option></select></label><label>Start date *<input type="date" name="startDate" required /></label></div><label>Term end date<input type="date" name="termEndDate" /></label><div className="modal-note">This records ministry responsibility only. Login permissions remain controlled separately under Administration.</div><div className="modal-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Creating appointment…" : "Create appointment"}</button></div></form></div>}</div>;
}

type VolunteerProfile = {
  id: number; code: string; memberChurchId?: string | null; name: string; phone: string; skills: string;
  availability: string; ministryPreference: string; safeguardingStatus: string; status: "Active" | "Paused" | "Inactive";
  assignments: { id: number; assignmentDate: string; serviceName: string; teamName: string; role: string; callTime: string; status: string }[];
};

function VolunteersView({ members, access, notify }: { members: Member[]; access: AccessProfile; notify: (message: string) => void }) {
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [assigning, setAssigning] = useState<VolunteerProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canManage = access.permissions.includes("*") || access.permissions.includes("volunteers.manage");
  useEffect(() => { authFetch("/api/volunteers").then((response) => response.ok ? response.json() : Promise.reject()).then((data: { volunteers?: VolunteerProfile[] }) => setVolunteers(data.volunteers || [])).catch(() => {}); }, []);

  async function post(payload: Record<string, FormDataEntryValue | number>, success: string) {
    setSaving(true); setError("");
    try {
      const response = await authFetch("/api/volunteers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { volunteers?: VolunteerProfile[]; volunteer?: VolunteerProfile; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to save volunteer workflow");
      if (result.volunteers) setVolunteers(result.volunteers);
      if (result.volunteer) setVolunteers((current) => [...current, result.volunteer!]);
      setShowCreate(false); setAssigning(null); notify(success);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save volunteer workflow"); }
    finally { setSaving(false); }
  }
  async function updateStatus(item: VolunteerProfile, status: VolunteerProfile["status"]) {
    const response = await authFetch("/api/volunteers", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, status }) });
    const result = await response.json() as { volunteers?: VolunteerProfile[]; error?: string };
    if (!response.ok || !result.volunteers) return notify(result.error || "Unable to update volunteer");
    setVolunteers(result.volunteers); notify(`${item.name} marked ${status.toLowerCase()}`);
  }
  const active = volunteers.filter((item) => item.status === "Active");
  const upcoming = volunteers.flatMap((item) => item.assignments.map((assignment) => ({ ...assignment, volunteerName: item.name }))).filter((item) => item.assignmentDate >= new Date().toISOString().slice(0,10));
  return <div className="volunteer-layout"><section className="people-command volunteer-command"><div><p className="eyebrow">VOLUNTEER OPERATIONS</p><h2>Right people, right service, ready on time</h2><p>Match member skills and availability to service assignments while keeping safeguarding and participation status visible.</p></div><div className="people-kpis"><span><b>{active.length}</b> active volunteers</span><span><b>{upcoming.length}</b> upcoming assignments</span><span><b>{active.filter((item) => item.safeguardingStatus === "Verified").length}</b> verified</span></div>{canManage && <button className="primary" onClick={() => setShowCreate(true)}>＋ Add volunteer</button>}</section><section className="volunteer-grid"><div className="panel volunteer-roster"><PanelHead title="Volunteer roster" subtitle="Skills, availability and ministry fit" />{volunteers.map((item) => <article key={item.id}><i className="avatar">{item.name.split(/\s+/).map((part) => part[0]).join("").slice(0,2)}</i><div><strong>{item.name}</strong><span>{item.code} · {item.ministryPreference}</span><p>{item.skills || "General service"} · {item.availability}</p></div><em>{item.safeguardingStatus}</em>{canManage && <div><button disabled={item.status !== "Active"} onClick={() => setAssigning(item)}>Assign</button><select value={item.status} aria-label={`Status for ${item.name}`} onChange={(event) => updateStatus(item, event.target.value as VolunteerProfile["status"])}><option>Active</option><option>Paused</option><option>Inactive</option></select></div>}</article>)}</div><aside className="panel assignment-board"><PanelHead title="Service assignments" subtitle="Upcoming volunteer call times" />{upcoming.length ? upcoming.map((item) => <article key={item.id}><time>{item.assignmentDate}<b>{item.callTime}</b></time><div><strong>{item.volunteerName}</strong><span>{item.role} · {item.teamName}</span><small>{item.serviceName}</small></div><i>{item.status}</i></article>) : <div className="empty-state"><span>♧</span><strong>No upcoming assignments</strong><p>Assign an active volunteer to the next service.</p></div>}</aside></section>{showCreate && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Add volunteer"><button className="modal-dismiss" onClick={() => setShowCreate(false)} aria-label="Close volunteer form" /><form className="modal volunteer-form" onSubmit={(event) => { event.preventDefault(); post(Object.fromEntries(new FormData(event.currentTarget).entries()), "Volunteer profile created"); }}><div className="modal-head"><div><p className="eyebrow">VOLUNTEER PROFILE</p><h2>Add a member to service</h2><span>Skills and availability guide future assignments.</span></div><button type="button" onClick={() => setShowCreate(false)}>×</button></div>{error && <div className="form-error">{error}</div>}<label>Member *<select name="memberChurchId" required><option value="">Select member</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name} · {member.id}</option>)}</select></label><div className="form-row"><label>Skills<textarea name="skills" placeholder="Hospitality, sound, teaching, administration…" /></label><label>Availability<textarea name="availability" placeholder="Sundays, first Saturday, weekday evenings…" /></label></div><div className="form-row"><label>Preferred ministry<input name="ministryPreference" placeholder="Ushers" /></label><label>Safeguarding status<select name="safeguardingStatus"><option>Not required</option><option>Pending</option><option>Verified</option><option>Expired</option></select></label></div><div className="modal-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Creating profile…" : "Create volunteer profile"}</button></div></form></div>}{assigning && <div className="modal-layer" role="dialog" aria-modal="true" aria-label={`Assign ${assigning.name}`}><button className="modal-dismiss" onClick={() => setAssigning(null)} aria-label="Close assignment form" /><form className="modal assignment-form" onSubmit={(event) => { event.preventDefault(); post({ action: "assign", volunteerId: assigning.id, ...Object.fromEntries(new FormData(event.currentTarget).entries()) }, `${assigning.name} assigned to service`); }}><div className="modal-head"><div><p className="eyebrow">SERVICE ASSIGNMENT</p><h2>Schedule {assigning.name}</h2><span>{assigning.availability} · {assigning.skills}</span></div><button type="button" onClick={() => setAssigning(null)}>×</button></div>{error && <div className="form-error">{error}</div>}<div className="form-row"><label>Service date *<input type="date" name="assignmentDate" required /></label><label>Call time *<input type="time" name="callTime" required /></label></div><label>Service name *<input name="serviceName" required placeholder="Sunday Celebration Service" /></label><div className="form-row"><label>Team *<input name="teamName" required placeholder="Ushers" /></label><label>Role *<input name="role" required placeholder="Welcome desk" /></label></div><div className="modal-actions"><button type="button" onClick={() => setAssigning(null)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Assigning…" : "Confirm assignment"}</button></div></form></div>}</div>;
}

type CommunicationCampaign = {
  id: number;
  campaignCode: string;
  name: string;
  channel: "SMS" | "Email" | "WhatsApp" | "In-app";
  audience: string;
  subject?: string | null;
  message: string;
  status: "Draft" | "Scheduled" | "Sent" | "Cancelled";
  scheduledAt?: string | null;
  sentAt?: string | null;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  createdByName: string;
  createdAt: string;
};

function CommunicationView({ access, notify }: { access: AccessProfile; notify: (message: string) => void }) {
  const [campaigns, setCampaigns] = useState<CommunicationCampaign[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [scheduling, setScheduling] = useState<CommunicationCampaign | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canManage = access.permissions.includes("*") || access.permissions.includes("communication.manage");

  useEffect(() => {
    authFetch("/api/communication").then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { campaigns?: CommunicationCampaign[] }) => setCampaigns(data.campaigns || []))
      .catch(() => {});
  }, []);

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await authFetch("/api/communication", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { campaign?: CommunicationCampaign; error?: string };
      if (!response.ok || !result.campaign) throw new Error(result.error || "Unable to save campaign");
      setCampaigns((current) => [result.campaign!, ...current]); setShowCreate(false);
      notify(`${result.campaign.name} saved as a draft`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save campaign"); }
    finally { setSaving(false); }
  }

  async function updateCampaign(campaign: CommunicationCampaign, status: "Scheduled" | "Cancelled", scheduledAt?: string) {
    setSaving(true); setError("");
    try {
      const response = await authFetch("/api/communication", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: campaign.id, status, scheduledAt }) });
      const result = await response.json() as { campaign?: CommunicationCampaign; error?: string };
      if (!response.ok || !result.campaign) throw new Error(result.error || "Unable to update campaign");
      setCampaigns((current) => current.map((item) => item.id === campaign.id ? result.campaign! : item));
      setScheduling(null); notify(`${campaign.name} ${status.toLowerCase()}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update campaign"); }
    finally { setSaving(false); }
  }

  const scheduled = campaigns.filter((item) => item.status === "Scheduled").length;
  const delivered = campaigns.reduce((sum, item) => sum + item.deliveredCount, 0);
  return <div className="communication-layout">
    <section className="communication-command"><div><p className="eyebrow">COMMUNICATION OPERATIONS</p><h2>Reach the right people, responsibly</h2><p>Prepare targeted SMS, email, WhatsApp and in-app notices with controlled scheduling and permanent campaign history.</p></div><div className="communication-kpis"><span><b>{campaigns.length}</b> campaigns<small>Across all channels</small></span><span><b>{scheduled}</b> scheduled<small>Awaiting delivery integration</small></span><span><b>{delivered}</b> delivered<small>Provider-confirmed messages</small></span></div>{canManage && <button className="primary" onClick={() => setShowCreate(true)}>＋ Compose campaign</button>}</section>
    <section className="channel-strip">{["SMS","Email","WhatsApp","In-app"].map((channel) => <article key={channel}><i>{channel === "SMS" ? "◫" : channel === "Email" ? "✉" : channel === "WhatsApp" ? "◎" : "✦"}</i><div><strong>{channel}</strong><span>{campaigns.filter((item) => item.channel === channel).length} campaigns</span></div></article>)}</section>
    <section className="panel campaign-panel"><PanelHead title="Campaign workspace" subtitle="Drafts, scheduled notices and delivery history" /><div className="campaign-grid">{campaigns.length ? campaigns.map((campaign) => <article className="campaign-card" key={campaign.id}><header><span>{campaign.channel}</span><i className={`campaign-status ${campaign.status.toLowerCase()}`}>{campaign.status}</i></header><strong>{campaign.name}</strong><p>{campaign.subject || campaign.message}</p><dl><div><dt>Audience</dt><dd>{campaign.audience}</dd></div><div><dt>Recipients</dt><dd>{campaign.recipientCount}</dd></div><div><dt>Owner</dt><dd>{campaign.createdByName}</dd></div><div><dt>Schedule</dt><dd>{campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString() : "Not scheduled"}</dd></div></dl>{canManage && campaign.status === "Draft" && <footer><button onClick={() => updateCampaign(campaign, "Cancelled")}>Cancel</button><button className="primary" onClick={() => setScheduling(campaign)}>Schedule</button></footer>}</article>) : <div className="empty-state"><span>✦</span><strong>No communication campaigns yet</strong><p>Create the first targeted message and keep it as a controlled draft until scheduled.</p>{canManage && <button onClick={() => setShowCreate(true)}>Compose campaign</button>}</div>}</div></section>
    {showCreate && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Compose campaign"><button className="modal-dismiss" onClick={() => setShowCreate(false)} aria-label="Close campaign form" /><form className="modal communication-form" onSubmit={createCampaign}><div className="modal-head"><div><p className="eyebrow">CONTROLLED OUTREACH</p><h2>Compose campaign</h2><span>Save a reviewed draft before scheduling any delivery.</span></div><button type="button" onClick={() => setShowCreate(false)}>×</button></div>{error && <div className="form-error">{error}</div>}<div className="form-row"><label>Campaign name *<input name="name" required autoFocus placeholder="Sunday service reminder" /></label><label>Channel *<select name="channel"><option>SMS</option><option>Email</option><option>WhatsApp</option><option>In-app</option></select></label></div><div className="form-row"><label>Audience *<select name="audience"><option>All Members</option><option>Active Members</option><option>New Converts</option><option>Follow-up</option><option>Youth Ministry</option><option>Women’s Ministry</option><option>Men’s Ministry</option><option>Choir</option></select></label><label>Subject<input name="subject" placeholder="Required for email campaigns" /></label></div><label>Message *<textarea name="message" required rows={6} placeholder="Write a clear, respectful church notice…" /></label><div className="modal-note">Saving does not contact anyone. Delivery remains a separate scheduled action and future provider integration will record confirmed delivery results.</div><div className="modal-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving draft…" : "Save campaign draft"}</button></div></form></div>}
    {scheduling && <div className="modal-layer" role="dialog" aria-modal="true" aria-label={`Schedule ${scheduling.name}`}><button className="modal-dismiss" onClick={() => setScheduling(null)} aria-label="Close scheduling form" /><form className="modal schedule-form" onSubmit={(event) => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get("scheduledAt") || ""); updateCampaign(scheduling, "Scheduled", value); }}><div className="modal-head"><div><p className="eyebrow">DELIVERY SCHEDULE</p><h2>Schedule campaign</h2><span>{scheduling.name} · {scheduling.recipientCount} intended recipients</span></div><button type="button" onClick={() => setScheduling(null)}>×</button></div>{error && <div className="form-error">{error}</div>}<label>Delivery date and time *<input type="datetime-local" name="scheduledAt" required /></label><div className="modal-note">ChurchFlow records the approved schedule now. Messages will only leave the system after a delivery provider is configured.</div><div className="modal-actions"><button type="button" onClick={() => setScheduling(null)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Scheduling…" : "Confirm schedule"}</button></div></form></div>}
  </div>;
}

type ReportsData = {
  generatedAt: string;
  membership: { total: number; active: number; newConverts: number; followUp: number; groups: { name: string; value: number }[]; monthlyGrowth: { month: string; value: number }[]; profileCompleteness: number };
  attendance: { average: number; sessions: { id: number; title: string; date: string; total: number; expected: number }[] };
  events: { total: number; planning: number; ready: number; completed: number };
  care: { open: number };
  finance: { income: number; expenses: number; balance: number; pending: number } | null;
  exportAllowed: boolean;
};

function ReportsView({ notify }: { notify: (message: string) => void }) {
  const [report, setReport] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    authFetch("/api/reports").then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: ReportsData) => setReport(data)).finally(() => setLoading(false));
  }, []);

  function exportReport() {
    if (!report?.exportAllowed) return notify("Your role has report viewing access only");
    const rows = [
      ["ChurchFlow operational report", new Date(report.generatedAt).toLocaleString()],
      ["Membership total", report.membership.total], ["Active members", report.membership.active],
      ["New converts", report.membership.newConverts], ["Follow-up", report.membership.followUp],
      ["Average attendance", report.attendance.average], ["Open care cases", report.care.open],
      ["Events total", report.events.total], ["Events ready", report.events.ready],
      ...(report.finance ? [["Approved income", report.finance.income], ["Approved expenses", report.finance.expenses], ["Available balance", report.finance.balance], ["Pending finance entries", report.finance.pending]] : []),
      [], ["Attendance session", "Date", "Total", "Expected"],
      ...report.attendance.sessions.map((item) => [item.title, item.date, item.total, item.expected]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"','""')}"`).join(",")).join("\n");
    const anchor = document.createElement("a"); anchor.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; anchor.download = "churchflow-operational-report.csv"; anchor.click();
    notify("Operational report exported");
  }

  if (loading) return <section className="panel module-panel"><div className="empty-state"><span>↗</span><strong>Generating trusted reports…</strong></div></section>;
  if (!report) return <section className="panel module-panel"><div className="empty-state"><span>!</span><strong>Reports are temporarily unavailable</strong><p>Try again after the service reconnects.</p></div></section>;
  const money = (value: number) => `₵${value.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
  return <div className="reports-layout">
    <section className="reports-command"><div><p className="eyebrow">MINISTRY INTELLIGENCE</p><h2>Operational reports</h2><p>Decision-ready membership, attendance, events, care and authorised finance insights from the live ChurchFlow database.</p></div><span>Generated {new Date(report.generatedAt).toLocaleString()}</span><button className="primary" onClick={exportReport} disabled={!report.exportAllowed}>⇩ Export report</button></section>
    <section className="report-kpis"><article><span>Membership</span><strong>{report.membership.total}</strong><p>{report.membership.active} active · {report.membership.newConverts} new converts</p></article><article><span>Average attendance</span><strong>{report.attendance.average}</strong><p>Across {report.attendance.sessions.length} recent services</p></article><article><span>Profile completeness</span><strong>{report.membership.profileCompleteness}%</strong><p>Birth date, phone and email recorded</p></article><article><span>Open care cases</span><strong>{report.care.open}</strong><p>Aggregate only; confidential details excluded</p></article><article><span>Events</span><strong>{report.events.total}</strong><p>{report.events.ready} ready · {report.events.planning} planning</p></article>{report.finance && <article className="finance-report-card"><span>Available balance</span><strong>{money(report.finance.balance)}</strong><p>{report.finance.pending} entries await independent approval</p></article>}</section>
    <section className="reports-grid"><div className="panel report-table"><PanelHead title="Attendance performance" subtitle="Recent service totals against expected attendance" /><div className="table-scroll"><table className="members-table"><thead><tr><th>Service</th><th>Date</th><th>Total</th><th>Expected</th><th>Rate</th></tr></thead><tbody>{report.attendance.sessions.map((item) => <tr key={item.id}><td><b>{item.title}</b></td><td>{item.date}</td><td>{item.total}</td><td>{item.expected}</td><td><i className="status">{item.expected ? `${Math.round((item.total / item.expected) * 100)}%` : "—"}</i></td></tr>)}</tbody></table></div></div><aside className="panel group-report"><PanelHead title="Membership distribution" subtitle="Largest ministry connections" />{report.membership.groups.slice(0,8).map((group) => <div key={group.name}><span>{group.name}</span><strong>{group.value}</strong><i><b style={{ width: `${Math.max(8, Math.round((group.value / Math.max(1, report.membership.total)) * 100))}%` }} /></i></div>)}</aside><div className="panel growth-report"><PanelHead title="Membership growth" subtitle="New member records by month" /><div>{report.membership.monthlyGrowth.map((month) => <article key={month.month}><span>{month.month}</span><i><b style={{height:`${Math.max(10,Math.round((month.value / Math.max(1,...report.membership.monthlyGrowth.map((item) => item.value))) * 100))}%`}} /></i><strong>{month.value}</strong></article>)}</div></div></section>
  </div>;
}

const fallbackCareCases: CareCase[] = [
  { id: 1, code: "CARE-2607-001", memberChurchId: "CH-0397", personName: "Abena Boateng", personPhone: "020 771 1904", personType: "New Convert", caseType: "New Convert Follow-up", source: "Sunday altar call", priority: "High", stage: "First Contact", assignedTo: "Rev. Lydia Owusu", nextActionDate: "2026-07-31", summary: "Welcome call and foundation class introduction required.", isConfidential: false, status: "Open", createdAt: "2026-07-29", activities: [{ id: 1, activityType: "Phone call", note: "Initial welcome call completed.", outcome: "Accepted foundation class invitation", completedBy: "David Amankwaah", completedAt: "2026-07-29" }] },
  { id: 2, code: "CARE-2607-002", memberChurchId: "CH-0374", personName: "Kofi Asare", personPhone: "027 120 3301", personType: "Member", caseType: "Pastoral Follow-up", source: "Church office", priority: "Normal", stage: "Visit Scheduled", assignedTo: "Pastor Daniel Asante", nextActionDate: "2026-08-01", summary: "Home visit requested after extended absence.", sensitiveNotes: "Discuss privately with the assigned pastor.", isConfidential: true, status: "Open", createdAt: "2026-07-28", activities: [] },
  { id: 3, code: "CARE-2607-003", personName: "Yaa Serwaa", personPhone: "050 410 2219", personType: "Visitor", caseType: "Visitor Follow-up", source: "Invited by Akosua Mensah", priority: "Normal", stage: "Second Contact", assignedTo: "Membership Team", nextActionDate: "2026-08-02", summary: "Interested in the women’s fellowship and membership class.", isConfidential: false, status: "Open", createdAt: "2026-07-27", activities: [] },
  { id: 4, code: "CARE-2607-004", personName: "Mensah Household", personPhone: "024 000 1842", personType: "Household", caseType: "Welfare Request", source: "Church office", priority: "Urgent", stage: "Assessment", assignedTo: "Welfare Committee", nextActionDate: "2026-07-30", summary: "Short-term household support assessment pending.", sensitiveNotes: "Financial circumstances restricted to pastoral and welfare leadership.", isConfidential: true, status: "Open", createdAt: "2026-07-29", activities: [] },
];

function CareView({ members, access, notify }: { members: Member[]; access: AccessProfile; notify: (message: string) => void }) {
  const [cases, setCases] = useState(fallbackCareCases);
  const [selectedId, setSelectedId] = useState(fallbackCareCases[0].id);
  const [filter, setFilter] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confidentialAccess, setConfidentialAccess] = useState(access.permissions.includes("*") || access.permissions.includes("care.confidential.read"));
  const canManage = access.permissions.includes("*") || access.permissions.includes("care.manage");
  const selected = cases.find((item) => item.id === selectedId) || cases[0];
  useEffect(() => {
    authFetch("/api/care").then((response) => response.ok ? response.json() : Promise.reject()).then((data: { cases?: CareCase[]; confidentialAccess?: boolean }) => {
      if (data.cases?.length) { setCases(data.cases); setSelectedId(data.cases[0].id); }
      setConfidentialAccess(Boolean(data.confidentialAccess));
    }).catch(() => {});
  }, []);
  const visible = cases.filter((item) => filter === "All" || item.personType === filter || item.caseType === filter);
  const overdue = cases.filter((item) => item.status === "Open" && item.nextActionDate && item.nextActionDate < "2026-07-30").length;
  const urgent = cases.filter((item) => item.priority === "Urgent" || item.priority === "High").length;
  const journeys = cases.filter((item) => item.personType === "New Convert" || item.personType === "Visitor").length;

  function replaceAll(next: CareCase[]) {
    setCases(next);
    if (!next.some((item) => item.id === selectedId) && next[0]) setSelectedId(next[0].id);
  }
  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries()) as Record<string, FormDataEntryValue | boolean>;
    payload.isConfidential = form.get("isConfidential") === "on";
    const member = members.find((item) => item.id === form.get("memberChurchId"));
    if (member) { payload.personName = member.name; payload.personPhone = member.phone; }
    try {
      const response = await authFetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { case?: CareCase; error?: string };
      if (!response.ok || !result.case) throw new Error(result.error || "Unable to create care record");
      setCases((current) => [result.case!, ...current]); setSelectedId(result.case.id); setShowCreate(false);
      notify(`${result.case.code} opened and assigned`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create care record"); }
    finally { setSaving(false); }
  }
  async function addActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const payload = { ...Object.fromEntries(new FormData(event.currentTarget).entries()), action: "activity", caseId: selected.id };
    try {
      const response = await authFetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { cases?: CareCase[]; error?: string };
      if (!response.ok || !result.cases) throw new Error(result.error || "Unable to save follow-up");
      replaceAll(result.cases); setShowActivity(false); notify("Follow-up activity recorded");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save follow-up"); }
    finally { setSaving(false); }
  }
  async function resolveCase() {
    try {
      const response = await authFetch("/api/care", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: selected.id, status: "Resolved", stage: "Outcome Recorded" }) });
      const result = await response.json() as { cases?: CareCase[]; error?: string };
      if (!response.ok || !result.cases) throw new Error(result.error || "Unable to resolve case");
      replaceAll(result.cases); notify(`${selected.code} resolved`);
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Unable to resolve case"); }
  }

  return <div className="care-layout">
    <section className="care-command"><div><p className="eyebrow">PASTORAL CARE OPERATIONS</p><h2>People journey and care centre</h2><p>Coordinate confidential pastoral care, welfare, visitors and new-convert follow-up.</p></div><div className="care-kpis"><span><b>{cases.filter((item) => item.status === "Open").length}</b> open cases<small>{urgent} high-priority matters</small></span><span className={overdue ? "attention" : ""}><b>{overdue}</b> overdue actions<small>Past the next-action date</small></span><span><b>{journeys}</b> active journeys<small>Visitors and new converts</small></span><span><b>{cases.filter((item) => item.caseType === "Welfare Request").length}</b> welfare cases<small>Privacy controlled</small></span></div>{canManage ? <button className="primary" onClick={() => setShowCreate(true)}>＋ Open care record</button> : <span className="restricted-label">Read-only access</span>}</section>
    <section className="care-workspace"><aside className="panel care-queue"><div className="care-filter-head"><PanelHead title="Care queue" subtitle={`${visible.length} active records`} /><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter care queue"><option>All</option><option>New Convert</option><option>Visitor</option><option>Member</option><option>Household</option><option>Welfare Request</option></select></div>{visible.map((item) => <button className={item.id === selected.id ? "active" : ""} key={item.id} onClick={() => setSelectedId(item.id)}><span className={`care-priority ${item.priority.toLowerCase()}`}>{item.priority.slice(0,1)}</span><div><strong>{item.personName}{item.isConfidential ? " · 🔒" : ""}</strong><span>{item.caseType}</span><small>{item.stage} · {item.assignedTo}</small></div><time className={item.nextActionDate && item.nextActionDate < "2026-07-30" ? "overdue" : ""}>{item.nextActionDate || "No due date"}</time></button>)}</aside>
      <section className="panel care-case"><header><div><p className="eyebrow">{selected.code} · {selected.personType}</p><h2>{selected.personName}</h2><span>{selected.caseType} · Opened {selected.createdAt.slice(0,10)}</span></div><div>{canManage && <><button className="secondary-action" onClick={() => setShowActivity(true)}>＋ Log follow-up</button><button className="resolve-action" onClick={resolveCase} disabled={selected.status === "Resolved"}>{selected.status === "Resolved" ? "✓ Resolved" : "Resolve case"}</button></>}</div></header><div className="case-metadata"><div><span>Priority</span><strong className={selected.priority.toLowerCase()}>{selected.priority}</strong></div><div><span>Stage</span><strong>{selected.stage}</strong></div><div><span>Assigned leader</span><strong>{selected.assignedTo}</strong></div><div><span>Next action</span><strong>{selected.nextActionDate || "Not scheduled"}</strong></div></div>
        <article className="case-summary"><div><span>CARE SUMMARY</span>{selected.isConfidential && <i>🔒 Confidential</i>}</div><p>{selected.summary}</p><dl><div><dt>Source</dt><dd>{selected.source}</dd></div><div><dt>Contact</dt><dd>{selected.personPhone || (selected.isConfidential ? "Restricted" : "Not recorded")}</dd></div><div><dt>Church record</dt><dd>{selected.memberChurchId || "Not yet a member"}</dd></div></dl>{selected.isConfidential && <aside><strong>Pastoral notes</strong><p>{confidentialAccess ? selected.sensitiveNotes || "No confidential notes recorded." : "Your role does not permit confidential pastoral notes."}</p></aside>}</article>
        <div className="case-timeline"><div><strong>Care timeline</strong><span>{selected.activities.length} recorded activities</span></div>{selected.activities.length ? selected.activities.map((activity) => <article key={activity.id}><i>✓</i><div><strong>{activity.activityType}</strong><p>{activity.note}</p>{activity.outcome && <span>Outcome · {activity.outcome}</span>}<small>{activity.completedBy} · {activity.completedAt.slice(0,16).replace("T"," ")}</small></div></article>) : <div className="timeline-empty">No follow-up activity has been recorded yet.</div>}</div>
      </section>
      <aside className="panel journey-board"><PanelHead title="Journey pipeline" subtitle="Visitors and new converts" />{["Visitor","New Convert"].map((type) => <div className="journey-group" key={type}><header><strong>{type}s</strong><span>{cases.filter((item) => item.personType === type).length}</span></header>{cases.filter((item) => item.personType === type).map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)}><i>{item.personName.split(/\s+/).map((part) => part[0]).join("").slice(0,2)}</i><div><strong>{item.personName}</strong><span>{item.stage}</span></div><b>›</b></button>)}</div>)}<div className="privacy-note"><strong>Privacy boundary active</strong><p>Confidential notes and contact details are returned only to authorised pastoral roles. Care changes are audit logged.</p></div></aside>
    </section>
    {showCreate && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Open care record"><button className="modal-dismiss" onClick={() => setShowCreate(false)} aria-label="Close care form" /><form className="modal care-form" onSubmit={createCase}><div className="modal-head"><div><p className="eyebrow">CARE INTAKE</p><h2>Open a care record</h2><span>Record only the information required for responsible follow-up.</span></div><button type="button" onClick={() => setShowCreate(false)}>×</button></div>{error && <div className="form-error">{error}</div>}<div className="form-row"><label>Person type<select name="personType"><option>Member</option><option>New Convert</option><option>Visitor</option><option>Household</option></select></label><label>Link member<select name="memberChurchId"><option value="">Not linked</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name} · {member.id}</option>)}</select></label></div><div className="form-row"><label>Person or household name *<input name="personName" required /></label><label>Contact phone<input name="personPhone" /></label></div><div className="form-row"><label>Case type *<select name="caseType"><option>Pastoral Follow-up</option><option>New Convert Follow-up</option><option>Visitor Follow-up</option><option>Welfare Request</option><option>Counselling</option><option>Hospital Visit</option><option>Bereavement</option></select></label><label>Priority<select name="priority"><option>Normal</option><option>High</option><option>Urgent</option><option>Low</option></select></label></div><div className="form-row"><label>Assigned leader<input name="assignedTo" defaultValue="Pastoral Care Team" /></label><label>Next action date<input name="nextActionDate" type="date" /></label></div><label>Source<input name="source" placeholder="Church office, event, invitation or referral" /></label><label>Care summary *<textarea name="summary" required placeholder="Brief, factual and ministry-relevant summary" /></label>{confidentialAccess && <><label className="confidential-check"><input name="isConfidential" type="checkbox" /><span><strong>Restrict this record</strong><small>Contact details and pastoral notes become available only to confidential-care roles.</small></span></label><label>Restricted pastoral notes<textarea name="sensitiveNotes" placeholder="Avoid unnecessary personal detail" /></label></>}<div className="modal-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Opening record…" : "Open care record"}</button></div></form></div>}
    {showActivity && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Record care follow-up"><button className="modal-dismiss" onClick={() => setShowActivity(false)} aria-label="Close follow-up form" /><form className="modal activity-form" onSubmit={addActivity}><div className="modal-head"><div><p className="eyebrow">{selected.code}</p><h2>Log follow-up activity</h2><span>Add a clear outcome and schedule the next responsible action.</span></div><button type="button" onClick={() => setShowActivity(false)}>×</button></div>{error && <div className="form-error">{error}</div>}<div className="form-row"><label>Activity type<select name="activityType"><option>Phone call</option><option>Home visit</option><option>Hospital visit</option><option>Counselling</option><option>Prayer</option><option>Foundation class</option><option>Welfare assessment</option></select></label><label>Updated stage<select name="stage"><option>Follow-up</option><option>First Contact</option><option>Second Contact</option><option>Visit Scheduled</option><option>Foundation Class</option><option>Baptism Pending</option><option>Assessment</option><option>Outcome Recorded</option></select></label></div><label>Follow-up note *<textarea name="note" required /></label><label>Outcome<input name="outcome" /></label><label>Next action date<input name="nextActionDate" type="date" /></label><div className="modal-actions"><button type="button" onClick={() => setShowActivity(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving activity…" : "Save follow-up"}</button></div></form></div>}
  </div>;
}

const fallbackChurchEvents: ChurchEvent[] = [
  { id: 1, code: "EVT-260802-01", title: "Sunday Celebration Service", eventType: "Service", startDate: "2026-08-02", startTime: "08:30", endTime: "11:00", campus: "Grace Centre", venue: "Main Auditorium", coordinator: "Pastor Daniel Asante", expectedAttendance: 420, status: "Ready", attendanceSessionId: 1, notes: "Main Sunday worship gathering", programme: [
    { id: 1, sequence: 1, title: "Opening prayer", owner: "Prayer Team", durationMinutes: 10, status: "Ready" },
    { id: 2, sequence: 2, title: "Praise and worship", owner: "Worship Team", durationMinutes: 35, status: "Ready" },
    { id: 3, sequence: 3, title: "Church announcements", owner: "Communications", durationMinutes: 10, status: "Ready" },
    { id: 4, sequence: 4, title: "Sermon and ministry", owner: "Pastor Daniel Asante", durationMinutes: 55, status: "Ready" },
  ], assignments: [
    { id: 1, teamName: "Ushers", leaderName: "Kwame Owusu", requiredCount: 12, confirmedCount: 10, status: "Partial" },
    { id: 2, teamName: "Worship Team", leaderName: "Emmanuel Frimpong", requiredCount: 8, confirmedCount: 8, status: "Confirmed" },
    { id: 3, teamName: "Media Team", leaderName: "Nana Boakye", requiredCount: 6, confirmedCount: 5, status: "Partial" },
  ]},
  { id: 2, code: "EVT-260805-02", title: "Midweek Bible Teaching", eventType: "Service", startDate: "2026-08-05", startTime: "18:00", endTime: "19:30", campus: "Grace Centre", venue: "Chapel", coordinator: "Rev. Lydia Owusu", expectedAttendance: 180, status: "Planning", programme: [], assignments: [] },
  { id: 3, code: "EVT-260809-03", title: "Youth Empowerment Summit", eventType: "Conference", startDate: "2026-08-09", startTime: "10:00", endTime: "16:00", campus: "Grace Centre", venue: "Main Auditorium", coordinator: "Priscilla Agyeman", expectedAttendance: 260, status: "Planning", programme: [], assignments: [] },
];

function EventsView({ notify }: { notify: (message: string) => void }) {
  const [events, setEvents] = useState(fallbackChurchEvents);
  const [selectedId, setSelectedId] = useState(fallbackChurchEvents[0].id);
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<"Agenda" | "Teams">("Agenda");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = events.find((event) => event.id === selectedId) || events[0];
  useEffect(() => {
    authFetch("/api/events").then((response) => response.ok ? response.json() : Promise.reject()).then((data: { events?: ChurchEvent[] }) => {
      if (data.events?.length) { setEvents(data.events); setSelectedId(data.events[0].id); }
    }).catch(() => {});
  }, []);
  const readyCount = events.filter((event) => event.status === "Ready").length;
  const confirmed = selected.assignments.reduce((sum, team) => sum + team.confirmedCount, 0);
  const required = selected.assignments.reduce((sum, team) => sum + team.requiredCount, 0);
  const coverage = required ? Math.round((confirmed / required) * 100) : 0;

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries()) as Record<string, FormDataEntryValue | boolean>;
    payload.createAttendance = form.get("createAttendance") === "on";
    try {
      const response = await authFetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { event?: ChurchEvent; error?: string };
      if (!response.ok || !result.event) throw new Error(result.error || "Unable to create event");
      setEvents((current) => [...current, result.event!].sort((a,b) => a.startDate.localeCompare(b.startDate)));
      setSelectedId(result.event.id); setShowCreate(false); notify(`${result.event.title} was scheduled`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create event"); }
    finally { setSaving(false); }
  }
  async function updateStatus(status: ChurchEvent["status"]) {
    try {
      const response = await authFetch("/api/events", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: selected.id, status }) });
      const result = await response.json() as { event?: ChurchEvent; error?: string };
      if (!response.ok || !result.event) throw new Error(result.error || "Unable to update event");
      setEvents((current) => current.map((event) => event.id === selected.id ? result.event! : event));
      notify(`${selected.title} marked ${status.toLowerCase()}`);
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Unable to update event"); }
  }

  return <div className="events-layout">
    <section className="events-command"><div><p className="eyebrow">MINISTRY CALENDAR</p><h2>Events and service planning</h2><p>Coordinate programme flow, teams, venues and attendance from one operational plan.</p></div><div className="events-kpis"><span><b>{events.length}</b> upcoming plans<small>{readyCount} ready for ministry</small></span><span><b>{events.reduce((sum,event) => sum + event.expectedAttendance,0)}</b> expected people<small>Across every scheduled gathering</small></span><span><b>{coverage}%</b> team coverage<small>{confirmed} of {required || 0} roles confirmed</small></span></div><button className="primary" onClick={() => setShowCreate(true)}>＋ Schedule event</button></section>
    <section className="event-workspace"><aside className="panel event-rail"><PanelHead title="Upcoming calendar" subtitle="August 2026" />{events.map((event) => { const date = new Date(`${event.startDate}T00:00:00`); return <button className={event.id === selected.id ? "active" : ""} onClick={() => setSelectedId(event.id)} key={event.id}><time><b>{String(date.getDate()).padStart(2,"0")}</b><span>{date.toLocaleDateString("en",{month:"short"}).toUpperCase()}</span></time><div><strong>{event.title}</strong><span>{event.startTime} · {event.venue}</span><small>{event.eventType} · {event.campus}</small></div><i className={event.status.toLowerCase().replace(" ","-")}>{event.status}</i></button>; })}</aside>
      <section className="panel event-plan"><header><div><p className="eyebrow">{selected.code} · {selected.eventType}</p><h2>{selected.title}</h2><span>{selected.startDate} · {selected.startTime}{selected.endTime ? `–${selected.endTime}` : ""} · {selected.venue}</span></div><div><select value={selected.status} onChange={(event) => updateStatus(event.target.value as ChurchEvent["status"])} aria-label="Event status"><option>Planning</option><option>Ready</option><option>Completed</option><option>Cancelled</option></select><button onClick={() => notify(selected.attendanceSessionId ? "Connected attendance session opened" : "Create this event with attendance enabled to connect check-in")}>✓ Attendance {selected.attendanceSessionId ? "connected" : "not linked"}</button></div></header>
        <div className="plan-health"><div><span>Coordinator</span><strong>{selected.coordinator}</strong></div><div><span>Expected attendance</span><strong>{selected.expectedAttendance || "Not set"}</strong></div><div><span>Team readiness</span><strong>{coverage}%</strong><i><b style={{width:`${coverage}%`}} /></i></div></div>
        <nav className="plan-tabs"><button className={view === "Agenda" ? "active" : ""} onClick={() => setView("Agenda")}>Service programme</button><button className={view === "Teams" ? "active" : ""} onClick={() => setView("Teams")}>Teams and volunteers</button></nav>
        {view === "Agenda" ? <div className="programme-list">{selected.programme.length ? selected.programme.map((item) => <article key={item.id}><span>{String(item.sequence).padStart(2,"0")}</span><div><strong>{item.title}</strong><small>{item.owner}</small></div><time>{item.durationMinutes} min</time><i>{item.status}</i></article>) : <div className="plan-empty"><span>□</span><strong>No programme items yet</strong><p>Add the order of service when programme editing is enabled.</p></div>}</div> : <div className="assignment-list">{selected.assignments.length ? selected.assignments.map((team) => { const percent = Math.round((team.confirmedCount / team.requiredCount) * 100); return <article key={team.id}><div><strong>{team.teamName}</strong><span>Leader · {team.leaderName}</span></div><b>{team.confirmedCount}/{team.requiredCount}</b><i><span style={{width:`${percent}%`}} /></i><em className={team.status.toLowerCase()}>{team.status}</em></article>; }) : <div className="plan-empty"><span>♙</span><strong>No teams assigned</strong><p>Volunteer assignments will appear here.</p></div>}</div>}
      </section>
      <aside className="panel event-brief"><PanelHead title="Planning brief" subtitle="Operational readiness" /><div className="brief-score"><span>{selected.status === "Ready" ? "92" : "64"}%</span><div><strong>{selected.status === "Ready" ? "Ready for service" : "Planning in progress"}</strong><small>Based on programme, team and attendance setup</small></div></div><dl><div><dt>Programme</dt><dd>{selected.programme.length} items</dd></div><div><dt>Volunteer teams</dt><dd>{selected.assignments.length} assigned</dd></div><div><dt>Attendance</dt><dd>{selected.attendanceSessionId ? "Connected" : "Not connected"}</dd></div><div><dt>Coordinator</dt><dd>{selected.coordinator}</dd></div></dl><div className="planning-note"><strong>Next action</strong><p>{selected.status === "Ready" ? "Confirm the remaining team positions and final service notes." : "Add the programme flow and assign responsible ministry teams."}</p></div></aside>
    </section>
    {showCreate && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Schedule church event"><button className="modal-dismiss" onClick={() => setShowCreate(false)} aria-label="Close event form" /><form className="modal event-form" onSubmit={createEvent}><div className="modal-head"><div><p className="eyebrow">NEW MINISTRY PLAN</p><h2>Schedule an event</h2><span>Create the operational record that programme, teams and attendance will use.</span></div><button type="button" onClick={() => setShowCreate(false)}>×</button></div>{error && <div className="form-error">{error}</div>}<div className="form-row"><label>Event title *<input name="title" required autoFocus /></label><label>Event type<select name="eventType"><option>Service</option><option>Conference</option><option>Prayer Meeting</option><option>Fellowship</option><option>Outreach</option><option>Training</option><option>Ceremony</option></select></label></div><div className="form-row"><label>Date *<input name="startDate" type="date" required /></label><label>Start time *<input name="startTime" type="time" required /></label></div><div className="form-row"><label>End time<input name="endTime" type="time" /></label><label>Expected attendance<input name="expectedAttendance" type="number" min="0" /></label></div><div className="form-row"><label>Campus<select name="campus"><option>Grace Centre</option><option>North Assembly</option><option>Online Campus</option></select></label><label>Venue<input name="venue" defaultValue="Main Auditorium" /></label></div><label>Coordinator<input name="coordinator" placeholder="Responsible leader" /></label><label>Planning notes<textarea name="notes" placeholder="Purpose, requirements or special instructions" /></label><label className="attendance-link"><input name="createAttendance" type="checkbox" defaultChecked /><span><strong>Create connected attendance session</strong><small>Prepares this event for desk, QR and future mobile check-in.</small></span></label><div className="modal-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Scheduling event…" : "Schedule event"}</button></div></form></div>}
  </div>;
}

const fallbackFunds: FinanceFund[] = [
  { id: 1, name: "General Fund", code: "GF", purpose: "Core church operations and administration", status: "Active", income: 14170, expenses: 0, balance: 14170 },
  { id: 2, name: "Missions Fund", code: "MF", purpose: "Missions, outreach and evangelism", status: "Active", income: 2140, expenses: 0, balance: 2140 },
  { id: 3, name: "Welfare Fund", code: "WF", purpose: "Member care and welfare support", status: "Active", income: 0, expenses: 0, balance: 0 },
  { id: 4, name: "Building Fund", code: "BF", purpose: "Facilities and capital projects", status: "Active", income: 0, expenses: 0, balance: 0 },
];
const fallbackTransactions: FinanceTransaction[] = [
  { id: 1, reference: "CF-INC-260729-001", type: "Income", category: "Tithe", fundId: 1, fundName: "General Fund", amount: 9350, transactionDate: "2026-07-29", paymentMethod: "Bank transfer", description: "Weekly tithe deposits", receiptNumber: "RC-1048", status: "Approved", recordedBy: "David Amankwaah", createdAt: "2026-07-29" },
  { id: 2, reference: "CF-INC-260727-002", type: "Income", category: "Sunday Offering", fundId: 1, fundName: "General Fund", amount: 4820, transactionDate: "2026-07-27", paymentMethod: "Cash", description: "Sunday celebration offering", receiptNumber: "RC-1047", status: "Approved", recordedBy: "David Amankwaah", createdAt: "2026-07-27" },
  { id: 3, reference: "CF-EXP-260728-003", type: "Expense", category: "Utilities", fundId: 1, fundName: "General Fund", amount: 1265, transactionDate: "2026-07-28", paymentMethod: "Mobile Money", description: "Electricity and water", payerPayee: "Utility providers", status: "Pending", recordedBy: "David Amankwaah", recordedByUserId: 1, recordedByEmail: "amanvid.da@gmail.com", createdAt: "2026-07-28" },
  { id: 4, reference: "CF-INC-260726-004", type: "Income", category: "Missions Offering", fundId: 2, fundName: "Missions Fund", amount: 2140, transactionDate: "2026-07-26", paymentMethod: "Cash", description: "Monthly missions contribution", receiptNumber: "RC-1046", status: "Approved", recordedBy: "David Amankwaah", createdAt: "2026-07-26" },
];

function FinanceView({ access, notify }: { access: AccessProfile; notify: (message: string) => void }) {
  const [funds, setFunds] = useState(fallbackFunds);
  const [transactions, setTransactions] = useState(fallbackTransactions);
  const [filter, setFilter] = useState("All");
  const [showRecord, setShowRecord] = useState(false);
  const [saving, setSaving] = useState(false);
  const [decidingId, setDecidingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const can = (permission: string) => access.permissions.includes("*") || access.permissions.includes(permission);
  const canCreate = can("finance.create");
  const canApprove = can("finance.approve");
  const canReverse = can("finance.reverse");
  useEffect(() => {
    authFetch("/api/finance").then((response) => response.ok ? response.json() : Promise.reject()).then((data: { funds?: FinanceFund[]; transactions?: FinanceTransaction[] }) => {
      if (data.funds?.length) setFunds(data.funds);
      if (data.transactions?.length) setTransactions(data.transactions);
    }).catch(() => {});
  }, []);

  const approved = transactions.filter((item) => item.status === "Approved");
  const income = approved.filter((item) => item.type === "Income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = approved.filter((item) => item.type === "Expense").reduce((sum, item) => sum + item.amount, 0);
  const pending = transactions.filter((item) => item.status === "Pending");
  const visible = transactions.filter((item) => filter === "All" || item.type === filter || item.status === filter);
  const money = (value: number) => `₵${value.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;

  async function recordTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await authFetch("/api/finance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { funds?: FinanceFund[]; transactions?: FinanceTransaction[]; transaction?: FinanceTransaction; error?: string };
      if (!response.ok || !result.transaction) throw new Error(result.error || "Unable to record transaction");
      setFunds(result.funds || funds); setTransactions(result.transactions || transactions); setShowRecord(false);
      notify(`${result.transaction.reference} recorded for approval`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to record transaction"); }
    finally { setSaving(false); }
  }

  async function decide(transaction: FinanceTransaction, status: "Approved" | "Rejected") {
    const reason = status === "Rejected" ? window.prompt("Give the reason for rejecting this transaction:") : "";
    if (status === "Rejected" && !reason?.trim()) return;
    setDecidingId(transaction.id);
    try {
      const response = await authFetch("/api/finance", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: transaction.id, status, reason }) });
      const result = await response.json() as { funds?: FinanceFund[]; transactions?: FinanceTransaction[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to update transaction");
      if (result.funds) setFunds(result.funds); if (result.transactions) setTransactions(result.transactions);
      notify(`${transaction.reference} ${status.toLowerCase()}`);
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Unable to update transaction"); }
    finally { setDecidingId(null); }
  }

  async function requestReversal(transaction: FinanceTransaction) {
    const reason = window.prompt(`Explain why ${transaction.reference} must be reversed (minimum 10 characters):`);
    if (!reason?.trim()) return;
    setDecidingId(transaction.id);
    try {
      const response = await authFetch("/api/finance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reverse", id: transaction.id, reason }) });
      const result = await response.json() as { funds?: FinanceFund[]; transactions?: FinanceTransaction[]; transaction?: FinanceTransaction; error?: string };
      if (!response.ok || !result.transaction) throw new Error(result.error || "Unable to request reversal");
      if (result.funds) setFunds(result.funds); if (result.transactions) setTransactions(result.transactions);
      notify(`${result.transaction.reference} created for independent approval`);
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Unable to request reversal"); }
    finally { setDecidingId(null); }
  }

  function exportLedger() {
    const rows = [["Reference","Date","Type","Category","Fund","Amount (GHS)","Method","Status","Recorded by","Approved by","Decision time","Reversal of","Description"], ...transactions.map((item) => [item.reference,item.transactionDate,item.type,item.category,item.fundName,item.amount.toFixed(2),item.paymentMethod,item.status,item.recordedBy,item.approvedBy || "",item.approvedAt || "",item.reversalOfId || "",item.description])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"','""')}"`).join(",")).join("\n");
    const anchor = document.createElement("a"); anchor.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; anchor.download = "churchflow-finance-ledger.csv"; anchor.click();
    notify("Finance ledger exported");
  }

  return <div className="finance-layout">
    <section className="finance-command"><div><p className="eyebrow">FINANCIAL STEWARDSHIP</p><h2>Finance control centre</h2><p>Track every cedi by fund, source, approval and receipt.</p></div><div className="finance-kpis"><span><small>Approved income</small><b>{money(income)}</b><em>Across {funds.length} active funds</em></span><span><small>Approved expenses</small><b>{money(expenses)}</b><em>{income ? Math.round((expenses / income) * 100) : 0}% of recorded income</em></span><span><small>Available balance</small><b>{money(income - expenses)}</b><em>Excludes pending entries</em></span><span className={pending.length ? "attention" : ""}><small>Awaiting approval</small><b>{pending.length}</b><em>Requires independent review</em></span></div>{canCreate && <button className="primary" onClick={() => setShowRecord(true)}>＋ Record transaction</button>}</section>
    <section className="fund-strip">{funds.map((fund) => <article key={fund.id}><div><i>{fund.code}</i><span>{fund.status}</span></div><strong>{fund.name}</strong><p>{fund.purpose}</p><footer><span>Balance</span><b>{money(fund.balance)}</b></footer></article>)}</section>
    <section className="finance-grid"><div className="panel ledger-panel"><div className="ledger-toolbar"><PanelHead title="Financial ledger" subtitle="Auditable income and expense activity" /><div><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter transactions"><option>All</option><option>Income</option><option>Expense</option><option>Pending</option><option>Approved</option><option>Rejected</option></select><button className="secondary-action" onClick={exportLedger}>⇩ Export ledger</button></div></div><div className="table-scroll"><table className="members-table finance-table"><thead><tr><th>Transaction</th><th>Fund</th><th>Method</th><th>Amount</th><th>Status</th><th>Control</th></tr></thead><tbody>{visible.map((item) => { const ownEntry = item.recordedByUserId === access.id || item.recordedByEmail === access.email; return <tr key={item.id}><td><div className="finance-reference"><i className={item.type.toLowerCase()}>{item.type === "Income" ? "↓" : "↑"}</i><b>{item.description}<small>{item.reference} · {item.transactionDate}{item.reversalOfId ? ` · Reversal of #${item.reversalOfId}` : ""}</small></b></div></td><td><b className="fund-name">{item.fundName}<small>{item.category}</small></b></td><td>{item.paymentMethod}</td><td><strong className={item.type.toLowerCase()}>{item.type === "Expense" ? "−" : "+"}{money(item.amount)}</strong></td><td><i className={`finance-status ${item.status.toLowerCase()}`}>{item.status}</i></td><td>{item.status === "Pending" ? (canApprove && !ownEntry ? <div className="approval-actions"><button disabled={decidingId === item.id} onClick={() => decide(item,"Approved")}>Approve</button><button disabled={decidingId === item.id} onClick={() => decide(item,"Rejected")}>Reject</button></div> : <span className="reviewed">{ownEntry ? "Awaiting independent approver" : "Approval restricted"}</span>) : item.status === "Approved" && canReverse && !item.reversalOfId ? <button className="secondary-action" disabled={decidingId === item.id} onClick={() => requestReversal(item)}>Request reversal</button> : <span className="reviewed">✓ Immutable</span>}</td></tr>; })}</tbody></table></div></div>
      <aside className="panel approval-panel"><PanelHead title="Approval queue" subtitle={`${pending.length} transactions awaiting review`} />{pending.length ? pending.map((item) => { const ownEntry = item.recordedByUserId === access.id || item.recordedByEmail === access.email; return <article key={item.id}><div><span>{item.reversalOfId ? "Reversal" : item.type} · {item.fundName}</span><strong>{money(item.amount)}</strong></div><p>{item.description}</p><small>Recorded by {item.recordedBy} · {item.paymentMethod}</small>{canApprove && !ownEntry ? <footer><button disabled={decidingId === item.id} onClick={() => decide(item,"Rejected")}>Reject</button><button disabled={decidingId === item.id} onClick={() => decide(item,"Approved")}>Approve</button></footer> : <footer><span className="reviewed">{ownEntry ? "Awaiting independent approver" : "Read-only queue"}</span></footer>}</article>; }) : <div className="queue-empty"><span>✓</span><strong>Queue is clear</strong><p>No finance entries need review.</p></div>}<div className="control-note"><b>Dual control enforced</b><p>Creators cannot approve their own entries. Approved records stay immutable; corrections use independently approved reversals.</p></div></aside>
    </section>
    {showRecord && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Record finance transaction"><button className="modal-dismiss" onClick={() => setShowRecord(false)} aria-label="Close transaction form" /><form className="modal finance-form" onSubmit={recordTransaction}><div className="modal-head"><div><p className="eyebrow">NEW LEDGER ENTRY</p><h2>Record a transaction</h2><span>The entry will remain pending until an authorised finance review.</span></div><button type="button" onClick={() => setShowRecord(false)}>×</button></div>{error && <div className="form-error">{error}</div>}<div className="form-row"><label>Transaction type *<select name="type"><option>Income</option><option>Expense</option></select></label><label>Fund *<select name="fundId">{funds.map((fund) => <option value={fund.id} key={fund.id}>{fund.name}</option>)}</select></label></div><div className="form-row"><label>Category *<select name="category"><option>Tithe</option><option>Sunday Offering</option><option>Special Offering</option><option>Missions Offering</option><option>Welfare Contribution</option><option>Utilities</option><option>Programme Expense</option><option>Welfare Support</option><option>Maintenance</option><option>Payroll</option><option>Other</option></select></label><label>Amount (GHS) *<input name="amount" type="number" min=".01" step=".01" required /></label></div><div className="form-row"><label>Transaction date *<input name="transactionDate" type="date" required /></label><label>Payment method<select name="paymentMethod"><option>Cash</option><option>Mobile Money</option><option>Bank transfer</option><option>Cheque</option><option>Card</option></select></label></div><label>Description *<input name="description" required placeholder="Purpose or source of this transaction" /></label><div className="form-row"><label>Payer or payee<input name="payerPayee" placeholder="Optional individual or organisation" /></label><label>Receipt or document no.<input name="receiptNumber" placeholder="Optional reference" /></label></div><div className="modal-note">Amounts are stored as exact pesewa values to avoid accounting rounding errors. The audit reference is generated automatically.</div><div className="modal-actions"><button type="button" onClick={() => setShowRecord(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Recording transaction…" : "Record for approval"}</button></div></form></div>}
  </div>;
}

type WelfareRequest = {
  id: number; code: string; memberChurchId?: string | null; beneficiaryName: string; beneficiaryPhone?: string | null;
  supportType: string; amountRequested: number; amountApproved?: number | null; urgency: string; assessmentSummary: string;
  assignedCommittee: string; status: string; requestedByUserId?: number | null; requestedByName: string;
  reviewedByName?: string | null; financeTransactionId?: number | null; createdAt: string;
};
const fallbackWelfare: WelfareRequest[] = [
  { id: 1, code: "WFR-2607-001", memberChurchId: "CH-0241", beneficiaryName: "Akosua Mensah", supportType: "Medical assistance", amountRequested: 1800, urgency: "High", assessmentSummary: "Short-term medical support request awaiting committee review.", assignedCommittee: "Welfare Committee", status: "Pending assessment", requestedByUserId: 2, requestedByName: "Church Administrator", createdAt: "2026-07-29" },
  { id: 2, code: "WFR-2607-002", memberChurchId: "CH-0318", beneficiaryName: "Kwame Owusu", supportType: "Emergency household support", amountRequested: 950, amountApproved: 800, urgency: "Urgent", assessmentSummary: "Committee-approved emergency household support.", assignedCommittee: "Welfare Committee", status: "Disbursement pending", requestedByName: "Church Administrator", reviewedByName: "Welfare Chair", financeTransactionId: 12, createdAt: "2026-07-28" },
];

function WelfareFinanceView({ members, access, notify }: { members: Member[]; access: AccessProfile; notify: (message: string) => void }) {
  const [requests, setRequests] = useState(fallbackWelfare);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const can = (permission: string) => access.permissions.includes("*") || access.permissions.includes(permission);
  useEffect(() => { authFetch("/api/welfare-finance").then((r) => r.ok ? r.json() : Promise.reject()).then((data: { requests?: WelfareRequest[] }) => data.requests?.length && setRequests(data.requests)).catch(() => {}); }, []);
  const pending = requests.filter((item) => item.status === "Pending assessment");
  const committed = requests.filter((item) => item.status === "Disbursement pending").reduce((sum, item) => sum + (item.amountApproved || 0), 0);
  const money = (value: number) => `₵${value.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await authFetch("/api/welfare-finance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { requests?: WelfareRequest[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to create welfare request");
      if (result.requests) setRequests(result.requests); setShowCreate(false); notify("Welfare request submitted for assessment");
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to create welfare request"); } finally { setSaving(false); }
  }
  async function review(item: WelfareRequest, decision: "Approved" | "Rejected") {
    const amountApproved = decision === "Approved" ? window.prompt("Approved amount (GHS):", String(item.amountRequested)) : "";
    const reason = decision === "Rejected" ? window.prompt("Reason for rejection:") : "";
    if ((decision === "Approved" && !amountApproved) || (decision === "Rejected" && !reason)) return;
    try {
      const response = await authFetch("/api/welfare-finance", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, decision, amountApproved, reason, paymentMethod: "Mobile Money" }) });
      const result = await response.json() as { requests?: WelfareRequest[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to review request");
      if (result.requests) setRequests(result.requests); notify(`${item.code} ${decision.toLowerCase()}; finance review is ${decision === "Approved" ? "still required" : "complete"}`);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to review request"); }
  }
  return <div className="welfare-layout">
    <section className="operations-command welfare-command"><div><p className="eyebrow">COMPASSION WITH ACCOUNTABILITY</p><h2>Welfare finance desk</h2><p>Assess support needs privately, approve assistance independently and route every disbursement through the church ledger.</p></div><div className="operations-kpis"><span><small>Open assessments</small><b>{pending.length}</b></span><span><small>Requests this cycle</small><b>{requests.length}</b></span><span><small>Approved commitment</small><b>{money(committed)}</b></span><span><small>Ledger-linked</small><b>{requests.filter((item) => item.financeTransactionId).length}</b></span></div>{can("welfare.manage") && <button className="primary" onClick={() => setShowCreate(true)}>＋ New request</button>}</section>
    <section className="operations-grid"><div className="panel operations-register"><PanelHead title="Assistance register" subtitle="Financial summary only; confidential pastoral notes stay protected" /><div className="table-scroll"><table className="members-table welfare-table"><thead><tr><th>Beneficiary</th><th>Need</th><th>Requested</th><th>Urgency</th><th>Status</th><th>Control</th></tr></thead><tbody>{requests.map((item) => <tr key={item.id}><td><b>{item.beneficiaryName}<small>{item.code} · {item.memberChurchId || "Community support"}</small></b></td><td><b>{item.supportType}<small>{item.assessmentSummary}</small></b></td><td><strong>{money(item.amountApproved ?? item.amountRequested)}</strong></td><td><i className={`urgency ${item.urgency.toLowerCase()}`}>{item.urgency}</i></td><td><i className="finance-status pending">{item.status}</i></td><td>{item.status === "Pending assessment" && can("welfare.approve") && item.requestedByUserId !== access.id ? <div className="approval-actions"><button onClick={() => review(item, "Approved")}>Approve</button><button onClick={() => review(item, "Rejected")}>Reject</button></div> : <span className="reviewed">{item.financeTransactionId ? "Ledger approval pending" : item.requestedByUserId === access.id ? "Independent review required" : "Recorded"}</span>}</td></tr>)}</tbody></table></div></div>
      <aside className="panel governance-panel"><PanelHead title="Welfare controls" subtitle="Two-stage financial protection" /><ol><li><b>1</b><span><strong>Needs assessment</strong><small>Committee records a non-confidential financial summary.</small></span></li><li><b>2</b><span><strong>Independent decision</strong><small>The request creator cannot approve assistance.</small></span></li><li><b>3</b><span><strong>Ledger review</strong><small>Approval creates a pending Welfare Fund expense—not a payment.</small></span></li></ol><div className="control-note"><b>Privacy boundary</b><p>Sensitive pastoral details remain in Care and are never exposed here.</p></div></aside>
    </section>
    {showCreate && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-dismiss" onClick={() => setShowCreate(false)} aria-label="Close welfare form" /><form className="modal finance-form" onSubmit={createRequest}><div className="modal-head"><div><p className="eyebrow">WELFARE ASSESSMENT</p><h2>Record assistance request</h2><span>Capture only the financial summary needed by the welfare committee.</span></div><button type="button" onClick={() => setShowCreate(false)}>×</button></div><div className="form-row"><label>Church member<select name="memberChurchId"><option value="">Community / non-member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.id}</option>)}</select></label><label>Beneficiary name<input name="beneficiaryName" placeholder="Required for a non-member" /></label></div><div className="form-row"><label>Support type *<select name="supportType"><option>Medical assistance</option><option>Emergency household support</option><option>Education support</option><option>Bereavement support</option><option>Food support</option><option>Other</option></select></label><label>Requested amount (GHS) *<input name="amountRequested" type="number" min=".01" step=".01" required /></label></div><div className="form-row"><label>Urgency<select name="urgency"><option>Normal</option><option>High</option><option>Urgent</option></select></label><label>Assigned committee<input name="assignedCommittee" defaultValue="Welfare Committee" /></label></div><label>Assessment summary *<input name="assessmentSummary" required maxLength={600} placeholder="Non-confidential summary and intended support" /></label><div className="modal-note">Do not enter medical diagnoses, counselling notes or other sensitive pastoral information here.</div><div className="modal-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Submitting…" : "Submit for assessment"}</button></div></form></div>}
  </div>;
}

type PayrollStaff = { id: number; code: string; fullName: string; jobTitle: string; department: string; employmentType: string; bankName?: string; paymentAccount: string; baseSalary: number; recurringAllowance: number; recurringDeduction: number; status: string };
type PayrollRun = { id: number; code: string; payPeriod: string; paymentDate: string; status: string; gross: number; deductions: number; net: number; preparedByUserId?: number | null; preparedByName: string; approvedByName?: string | null; financeTransactionId?: number | null; itemCount: number };
const fallbackPayrollStaff: PayrollStaff[] = [
  { id: 1, code: "STF-001", fullName: "Akosua Mensah", jobTitle: "Church Administrator", department: "Administration", employmentType: "Full-time", bankName: "GCB Bank", paymentAccount: "•••• 4821", baseSalary: 3200, recurringAllowance: 350, recurringDeduction: 180, status: "Active" },
  { id: 2, code: "STF-002", fullName: "Kwame Owusu", jobTitle: "Facilities Coordinator", department: "Operations", employmentType: "Part-time", paymentAccount: "•••• 8821", baseSalary: 1800, recurringAllowance: 150, recurringDeduction: 50, status: "Active" },
];

function PayrollView({ members, access, notify }: { members: Member[]; access: AccessProfile; notify: (message: string) => void }) {
  const [staff, setStaff] = useState(fallbackPayrollStaff);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [showStaff, setShowStaff] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [saving, setSaving] = useState(false);
  const can = (permission: string) => access.permissions.includes("*") || access.permissions.includes(permission);
  const money = (value: number) => `₵${value.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
  const reload = (data: { staff?: PayrollStaff[]; runs?: PayrollRun[] }) => { if (data.staff) setStaff(data.staff); if (data.runs) setRuns(data.runs); };
  useEffect(() => { authFetch("/api/payroll").then((r) => r.ok ? r.json() : Promise.reject()).then(reload).catch(() => {}); }, []);
  async function submit(event: FormEvent<HTMLFormElement>, action?: "createRun") {
    event.preventDefault(); setSaving(true);
    const payload = { ...Object.fromEntries(new FormData(event.currentTarget).entries()), action };
    try { const response = await authFetch("/api/payroll", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json() as { staff?: PayrollStaff[]; runs?: PayrollRun[]; error?: string }; if (!response.ok) throw new Error(result.error || "Unable to update payroll"); reload(result); setShowStaff(false); setShowRun(false); notify(action ? "Payroll prepared for independent approval" : "Staff payroll profile added"); } catch (error) { notify(error instanceof Error ? error.message : "Unable to update payroll"); } finally { setSaving(false); }
  }
  async function review(run: PayrollRun, decision: "Approved" | "Rejected") {
    const reason = decision === "Rejected" ? window.prompt("Reason for rejection:") : "";
    if (decision === "Rejected" && !reason) return;
    try { const response = await authFetch("/api/payroll", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: run.id, decision, reason }) }); const result = await response.json() as { staff?: PayrollStaff[]; runs?: PayrollRun[]; error?: string }; if (!response.ok) throw new Error(result.error || "Unable to review payroll"); reload(result); notify(`${run.code} ${decision.toLowerCase()}; ${decision === "Approved" ? "ledger approval is still required" : "returned to payroll"}`); } catch (error) { notify(error instanceof Error ? error.message : "Unable to review payroll"); }
  }
  const active = staff.filter((item) => item.status === "Active");
  const monthlyNet = active.reduce((sum, item) => sum + item.baseSalary + item.recurringAllowance - item.recurringDeduction, 0);
  return <div className="payroll-layout">
    <section className="operations-command payroll-command"><div><p className="eyebrow">STAFF COMPENSATION</p><h2>Payroll operations</h2><p>Maintain staff compensation, calculate monthly pay and enforce independent review before any amount reaches the ledger.</p></div><div className="operations-kpis"><span><small>Active staff</small><b>{active.length}</b></span><span><small>Estimated net</small><b>{money(monthlyNet)}</b></span><span><small>Pending review</small><b>{runs.filter((run) => run.status === "Pending").length}</b></span><span><small>Ledger-linked</small><b>{runs.filter((run) => run.financeTransactionId).length}</b></span></div>{can("payroll.manage") && <div className="command-actions"><button onClick={() => setShowStaff(true)}>＋ Add staff</button><button className="primary" onClick={() => setShowRun(true)}>Prepare payroll</button></div>}</section>
    <section className="operations-grid payroll-grid"><div className="panel operations-register"><div className="ledger-toolbar"><PanelHead title="Staff compensation register" subtitle="Payment details are masked in every list and export" /></div><div className="table-scroll"><table className="members-table payroll-table"><thead><tr><th>Staff member</th><th>Employment</th><th>Payment</th><th>Base</th><th>Estimated net</th><th>Status</th></tr></thead><tbody>{staff.map((item) => <tr key={item.id}><td><b>{item.fullName}<small>{item.code} · {item.jobTitle}</small></b></td><td><b>{item.department}<small>{item.employmentType}</small></b></td><td><b>{item.bankName || "Mobile Money"}<small>{item.paymentAccount}</small></b></td><td>{money(item.baseSalary)}</td><td><strong>{money(item.baseSalary + item.recurringAllowance - item.recurringDeduction)}</strong></td><td><i className="status active">{item.status}</i></td></tr>)}</tbody></table></div></div>
      <aside className="panel payroll-runs"><PanelHead title="Payroll runs" subtitle="Preparation, approval and ledger status" />{runs.length ? runs.map((run) => <article key={run.id}><header><span>{run.payPeriod}</span><i className="finance-status pending">{run.status}</i></header><strong>{money(run.net)}</strong><p>{run.itemCount} staff · Pay date {run.paymentDate}</p><small>{run.code} · Prepared by {run.preparedByName}</small>{run.status === "Pending" && can("payroll.approve") && run.preparedByUserId !== access.id ? <footer><button onClick={() => review(run, "Rejected")}>Reject</button><button onClick={() => review(run, "Approved")}>Approve</button></footer> : <footer><span className="reviewed">{run.financeTransactionId ? "Finance approval pending" : run.preparedByUserId === access.id ? "Independent review required" : run.status}</span></footer>}</article>) : <div className="queue-empty"><span>▤</span><strong>No payroll runs</strong><p>Prepare the first monthly payroll when staff profiles are ready.</p></div>}<div className="control-note"><b>Maker-checker enforced</b><p>The preparer cannot approve the run. Approval creates a pending General Fund expense; it does not mark salaries paid.</p></div></aside>
    </section>
    {showStaff && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-dismiss" onClick={() => setShowStaff(false)} aria-label="Close staff form" /><form className="modal finance-form" onSubmit={(event) => submit(event)}><div className="modal-head"><div><p className="eyebrow">STAFF PROFILE</p><h2>Add payroll staff</h2><span>Store only the minimum payment information required for payroll operations.</span></div><button type="button" onClick={() => setShowStaff(false)}>×</button></div><div className="form-row"><label>Church member<select name="memberChurchId"><option value="">External staff member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.id}</option>)}</select></label><label>Full name<input name="fullName" placeholder="Required for external staff" /></label></div><div className="form-row"><label>Job title *<input name="jobTitle" required /></label><label>Department *<input name="department" required /></label></div><div className="form-row"><label>Employment type<select name="employmentType"><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Stipend</option></select></label><label>Base salary (GHS) *<input name="baseSalary" type="number" min=".01" step=".01" required /></label></div><div className="form-row"><label>Recurring allowance<input name="recurringAllowance" type="number" min="0" step=".01" defaultValue="0" /></label><label>Recurring deduction<input name="recurringDeduction" type="number" min="0" step=".01" defaultValue="0" /></label></div><div className="form-row"><label>Bank name<input name="bankName" /></label><label>Account last 4 digits<input name="bankAccountLast4" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" /></label></div><label>Mobile Money number<input name="mobileMoneyNumber" /></label><div className="modal-note">Full bank account numbers and statutory identifiers are intentionally not displayed in ChurchFlow lists.</div><div className="modal-actions"><button type="button" onClick={() => setShowStaff(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : "Add staff profile"}</button></div></form></div>}
    {showRun && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-dismiss" onClick={() => setShowRun(false)} aria-label="Close payroll form" /><form className="modal finance-form" onSubmit={(event) => submit(event, "createRun")}><div className="modal-head"><div><p className="eyebrow">MONTHLY PAY RUN</p><h2>Prepare payroll</h2><span>ChurchFlow will snapshot all active staff compensation for independent review.</span></div><button type="button" onClick={() => setShowRun(false)}>×</button></div><div className="form-row"><label>Pay period *<input name="payPeriod" type="month" required /></label><label>Payment date *<input name="paymentDate" type="date" required /></label></div><div className="payroll-preview"><span><small>Active staff</small><b>{active.length}</b></span><span><small>Estimated net payroll</small><b>{money(monthlyNet)}</b></span></div><div className="modal-note">Preparing a run does not pay staff. A separate payroll approver and finance approver must complete their reviews.</div><div className="modal-actions"><button type="button" onClick={() => setShowRun(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Preparing…" : "Prepare for approval"}</button></div></form></div>}
  </div>;
}

type ChurchRecord = { id: number; code: string; recordType: string; templateType: string; memberChurchId?: string | null; subjectName: string; eventDate?: string | null; fields: Record<string,string>; status: string; issuedAt?: string | null; issuedByName?: string | null; createdByName: string; createdAt: string };
const fallbackRecords: ChurchRecord[] = [
  { id: 1, code: "REC-CERT-001", recordType: "Certificate", templateType: "Membership Certificate", memberChurchId: "CH-0241", subjectName: "Akosua Mensah", eventDate: "2026-07-20", fields: { officiant: "Senior Pastor", campus: "Grace Centre" }, status: "Issued", issuedAt: "2026-07-20", issuedByName: "David Amankwaah", createdByName: "David Amankwaah", createdAt: "2026-07-20" },
  { id: 2, code: "REC-ID-002", recordType: "ID Card", templateType: "Member ID Card", memberChurchId: "CH-0318", subjectName: "Kwame Owusu", fields: { campus: "Grace Centre", validUntil: "2027-07-31" }, status: "Draft", createdByName: "David Amankwaah", createdAt: "2026-07-29" },
];
const recordTemplates = ["Membership Form","Child Dedication Form","Wedding Form","Funeral Form","Welfare Form","Membership Certificate","Child Dedication Certificate","Wedding Certificate","Member ID Card","Staff ID Card"];

function RecordsStudioView({ members, access, notify }: { members: Member[]; access: AccessProfile; notify: (message: string) => void }) {
  const [records, setRecords] = useState(fallbackRecords);
  const [filter, setFilter] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [preview, setPreview] = useState<ChurchRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const can = (permission: string) => access.permissions.includes("*") || access.permissions.includes(permission);
  useEffect(() => { authFetch("/api/records").then((r) => r.ok ? r.json() : Promise.reject()).then((data: { records?: ChurchRecord[] }) => data.records?.length && setRecords(data.records)).catch(() => {}); }, []);
  const visible = records.filter((item) => filter === "All" || item.recordType === filter);
  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try { const response = await authFetch("/api/records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json() as { records?: ChurchRecord[]; error?: string }; if (!response.ok) throw new Error(result.error || "Unable to create record"); if (result.records) setRecords(result.records); setShowCreate(false); notify("Record draft created"); } catch (error) { notify(error instanceof Error ? error.message : "Unable to create record"); } finally { setSaving(false); }
  }
  async function issue(item: ChurchRecord) {
    try { const response = await authFetch("/api/records", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id }) }); const result = await response.json() as { records?: ChurchRecord[]; error?: string }; if (!response.ok) throw new Error(result.error || "Unable to issue record"); if (result.records) { setRecords(result.records); setPreview(result.records.find((record) => record.id === item.id) || item); } notify(`${item.code} issued and locked`); } catch (error) { notify(error instanceof Error ? error.message : "Unable to issue record"); }
  }
  return <div className="records-layout">
    <section className="records-command"><div><p className="eyebrow">OFFICIAL RECORDS</p><h2>Records and identity studio</h2><p>Prepare church forms, issue formal certificates and produce secure member or staff identity cards from governed templates.</p></div><div className="records-kpis"><span><small>Available templates</small><b>{recordTemplates.length}</b></span><span><small>Draft records</small><b>{records.filter((item) => item.status === "Draft").length}</b></span><span><small>Issued records</small><b>{records.filter((item) => item.status === "Issued").length}</b></span><span><small>ID cards</small><b>{records.filter((item) => item.recordType === "ID Card").length}</b></span></div>{can("records.manage") && <button className="primary" onClick={() => setShowCreate(true)}>＋ Create record</button>}</section>
    <section className="template-strip">{[["▱","Forms","Membership, dedication, wedding, funeral and welfare"],["✦","Certificates","Membership, dedication and wedding certificates"],["▧","ID Cards","Member and staff identification cards"]].map(([icon,title,description]) => <article key={title}><i>{icon}</i><div><strong>{title}</strong><p>{description}</p></div><button onClick={() => setFilter(title === "Forms" ? "Form" : title === "Certificates" ? "Certificate" : "ID Card")}>View {title.toLowerCase()} →</button></article>)}</section>
    <section className="panel records-register"><div className="ledger-toolbar"><PanelHead title="Record register" subtitle="Issued records are locked; corrections require a new version" /><div><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter record type"><option>All</option><option>Form</option><option>Certificate</option><option>ID Card</option></select></div></div><div className="record-cards">{visible.map((item) => <article key={item.id}><div className={`record-icon ${item.recordType.toLowerCase().replace(" ","-")}`}>{item.recordType === "Certificate" ? "✦" : item.recordType === "ID Card" ? "▧" : "▱"}</div><div><span>{item.templateType}</span><strong>{item.subjectName}</strong><small>{item.code} · {item.memberChurchId || "External record"}</small></div><i className={`record-state ${item.status.toLowerCase()}`}>{item.status}</i><footer><button onClick={() => setPreview(item)}>Preview</button>{item.status === "Draft" && can("records.issue") && <button onClick={() => issue(item)}>Issue</button>}</footer></article>)}</div></section>
    {showCreate && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-dismiss" onClick={() => setShowCreate(false)} aria-label="Close record form" /><form className="modal finance-form" onSubmit={createRecord}><div className="modal-head"><div><p className="eyebrow">NEW OFFICIAL RECORD</p><h2>Create from template</h2><span>Start as a draft, verify the details, then issue and print.</span></div><button type="button" onClick={() => setShowCreate(false)}>×</button></div><div className="form-row"><label>Record type *<select name="recordType"><option>Form</option><option>Certificate</option><option>ID Card</option></select></label><label>Template *<select name="templateType">{recordTemplates.map((template) => <option key={template}>{template}</option>)}</select></label></div><div className="form-row"><label>Church member<select name="memberChurchId"><option value="">External / unlinked subject</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.id}</option>)}</select></label><label>Subject name<input name="subjectName" placeholder="Required when not linked to a member" /></label></div><div className="form-row"><label>Event or issue date<input name="eventDate" type="date" /></label><label>Valid until<input name="validUntil" type="date" /></label></div><div className="form-row"><label>Officiant<input name="officiant" /></label><label>Campus<input name="campus" defaultValue="Grace Centre" /></label></div><label>Notes<input name="notes" maxLength={500} /></label><div className="modal-note">Drafts remain editable in a later workflow. Issuing locks the official record and records the issuer.</div><div className="modal-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Creating…" : "Create draft"}</button></div></form></div>}
    {preview && <div className="modal-layer record-preview-layer" role="dialog" aria-modal="true"><button className="modal-dismiss" onClick={() => setPreview(null)} aria-label="Close preview" /><div className="modal record-preview"><div className="modal-head"><div><p className="eyebrow">PRINT PREVIEW</p><h2>{preview.templateType}</h2></div><button onClick={() => setPreview(null)}>×</button></div>{preview.recordType === "ID Card" ? <div className="member-id-card"><header><span>✦</span><div><b>ChurchFlow</b><small>GRACE CENTRE</small></div></header><main><div className="id-photo">{members.find((member) => member.id === preview.memberChurchId)?.profilePhotoUrl ? <img src={members.find((member) => member.id === preview.memberChurchId)?.profilePhotoUrl} alt="" /> : preview.subjectName.split(" ").map((part) => part[0]).join("").slice(0,2)}</div><div><h3>{preview.subjectName}</h3><p>{preview.memberChurchId || "STAFF"}</p><small>Valid until {preview.fields.validUntil || "Not specified"}</small></div></main><footer><b>{preview.code}</b><span>Authorised identification</span></footer></div> : <div className="certificate-sheet"><span className="cert-mark">✦</span><p>GRACE CENTRE</p><h3>{preview.templateType}</h3><em>This official record is presented to</em><strong>{preview.subjectName}</strong><small>{preview.eventDate ? `Recorded on ${preview.eventDate}` : "Prepared by the Church Office"}</small><div><span>________________<small>{preview.fields.officiant || "Authorised minister"}</small></span><span>{preview.code}<small>Verification reference</small></span></div></div>}<div className="modal-actions"><button onClick={() => setPreview(null)}>Close</button>{preview.status === "Issued" ? <button className="primary" onClick={() => window.print()}>Print / Save PDF</button> : can("records.issue") && <button className="primary" onClick={() => issue(preview)}>Issue record</button>}</div></div></div>}
  </div>;
}

type ArchiveAsset = { id: number; code: string; assetType: string; title: string; description?: string | null; speakerAuthor?: string | null; ministry: string; eventDate?: string | null; scriptureReference?: string | null; tags: string; fileName?: string | null; fileSize?: number | null; externalUrl?: string | null; visibility: string; status: string; uploadedByName: string; downloadUrl?: string | null };
const fallbackArchive: ArchiveAsset[] = [
  { id: 1, code: "ARC-SER-001", assetType: "Sermon", title: "Unfeigned Faith", description: "Sunday teaching on practical faith and Christian living.", speakerAuthor: "Senior Pastor", ministry: "Church-wide", eventDate: "2026-07-26", scriptureReference: "Hebrews 11:1", tags: "faith,sunday service", externalUrl: "https://www.youtube.com/", visibility: "Internal", status: "Published", uploadedByName: "David Amankwaah" },
  { id: 2, code: "ARC-DOC-002", assetType: "Document", title: "Membership Orientation Guide", description: "Approved guide for new members and new converts.", speakerAuthor: "Church Office", ministry: "Membership", eventDate: "2026-07-15", tags: "membership,orientation", visibility: "Internal", status: "Published", uploadedByName: "David Amankwaah" },
];

function MediaArchiveView({ access, notify }: { access: AccessProfile; notify: (message: string) => void }) {
  const [assets, setAssets] = useState(fallbackArchive);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [saving, setSaving] = useState(false);
  const can = (permission: string) => access.permissions.includes("*") || access.permissions.includes(permission);
  useEffect(() => { authFetch("/api/archive").then((r) => r.ok ? r.json() : Promise.reject()).then((data: { assets?: ArchiveAsset[] }) => data.assets?.length && setAssets(data.assets)).catch(() => {}); }, []);
  const visible = assets.filter((item) => (filter === "All" || item.assetType === filter) && `${item.title} ${item.speakerAuthor} ${item.ministry} ${item.tags}`.toLowerCase().includes(query.toLowerCase()));
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try { const response = await authFetch("/api/archive", { method: "POST", body: new FormData(event.currentTarget) }); const result = await response.json() as { assets?: ArchiveAsset[]; error?: string }; if (!response.ok) throw new Error(result.error || "Unable to add archive item"); if (result.assets) setAssets(result.assets); setShowUpload(false); notify("Archive item added securely"); } catch (error) { notify(error instanceof Error ? error.message : "Unable to add archive item"); } finally { setSaving(false); }
  }
  function openAsset(item: ArchiveAsset) {
    const url = item.downloadUrl || item.externalUrl;
    if (!url) return notify("This draft has no media source yet");
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return <div className="archive-layout">
    <section className="archive-command"><div><p className="eyebrow">MINISTRY KNOWLEDGE</p><h2>Sermons and media archive</h2><p>Preserve approved documents, teachings, audio, video and event photography in one searchable ministry library.</p></div><div className="archive-kpis"><span><b>{assets.length}</b><small>Total assets</small></span><span><b>{assets.filter((item) => item.assetType === "Sermon").length}</b><small>Sermons</small></span><span><b>{assets.filter((item) => item.assetType === "Document").length}</b><small>Documents</small></span><span><b>{assets.filter((item) => item.visibility === "Public").length}</b><small>Public items</small></span></div>{can("archive.manage") && <button className="primary" onClick={() => setShowUpload(true)}>↑ Add to archive</button>}</section>
    <section className="archive-toolbar"><div className="table-search">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, speaker, ministry or tags…" /></div><nav>{["All","Document","Sermon","Audio","Video","Photo"].map((type) => <button className={filter === type ? "active" : ""} onClick={() => setFilter(type)} key={type}>{type}</button>)}</nav></section>
    <section className="archive-grid">{visible.map((item) => <article className="panel" key={item.id}><div className={`asset-cover ${item.assetType.toLowerCase()}`}><span>{item.assetType === "Sermon" ? "✦" : item.assetType === "Document" ? "▱" : item.assetType === "Audio" ? "♪" : item.assetType === "Video" ? "▶" : "◉"}</span><i>{item.assetType}</i></div><div className="asset-body"><div><span>{item.ministry}</span><i>{item.visibility}</i></div><h3>{item.title}</h3><p>{item.description || "No description supplied."}</p><dl><div><dt>Speaker / author</dt><dd>{item.speakerAuthor || "Church Office"}</dd></div>{item.scriptureReference && <div><dt>Scripture</dt><dd>{item.scriptureReference}</dd></div>}<div><dt>Date</dt><dd>{item.eventDate || "Archive record"}</dd></div></dl><footer><small>{item.code} · {item.status}</small><button onClick={() => openAsset(item)}>{item.downloadUrl ? "Download" : item.externalUrl ? "Open media" : "No source"}</button></footer></div></article>)}</section>
    {!visible.length && <div className="panel queue-empty"><span>⌕</span><strong>No archive items found</strong><p>Try another type or search phrase.</p></div>}
    {showUpload && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-dismiss" onClick={() => setShowUpload(false)} aria-label="Close archive form" /><form className="modal archive-form" onSubmit={upload}><div className="modal-head"><div><p className="eyebrow">ARCHIVE INTAKE</p><h2>Add ministry content</h2><span>Upload an approved file or register an HTTPS media link.</span></div><button type="button" onClick={() => setShowUpload(false)}>×</button></div><div className="form-row"><label>Content type *<select name="assetType"><option>Document</option><option>Sermon</option><option>Audio</option><option>Video</option><option>Photo</option></select></label><label>Title *<input name="title" required /></label></div><div className="form-row"><label>Speaker or author<input name="speakerAuthor" /></label><label>Ministry<input name="ministry" defaultValue="Church-wide" /></label></div><div className="form-row"><label>Event date<input name="eventDate" type="date" /></label><label>Scripture reference<input name="scriptureReference" placeholder="e.g. Hebrews 11:1" /></label></div><label>Description<textarea name="description" maxLength={1000} /></label><div className="form-row"><label>Tags<input name="tags" placeholder="faith, youth, sunday service" /></label><label>Visibility<select name="visibility"><option>Internal</option><option>Public</option></select></label></div><section className="archive-source"><label>Upload file<input name="file" type="file" accept=".pdf,.doc,.docx,.mp3,.m4a,.mp4,.jpg,.jpeg,.png,.webp" /><small>PDF, Word, MP3, MP4 or image · maximum 25 MB</small></label><span>OR</span><label>External HTTPS link<input name="externalUrl" type="url" placeholder="https://youtube.com/…" /></label></section><div className="modal-actions"><button type="button" onClick={() => setShowUpload(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Adding to archive…" : "Add to archive"}</button></div></form></div>}
  </div>;
}

type CelebrationReminder = { memberId: number; churchId: string; name: string; phone?: string; email?: string; group: string; type: "Birthday" | "Wedding Anniversary"; occurrenceDate: string; daysUntil: number; years: number };
type PreparedReminder = { id: number; memberId: number; celebrationType: string; occurrenceDate: string; channel: string; status: string; campaignId?: number | null };

function RemindersView({ access, notify }: { access: AccessProfile; notify: (message: string) => void }) {
  const [reminders, setReminders] = useState<CelebrationReminder[]>([]);
  const [prepared, setPrepared] = useState<PreparedReminder[]>([]);
  const [filter, setFilter] = useState("All");
  const [working, setWorking] = useState("");
  const canManage = access.permissions.includes("*") || access.permissions.includes("reminders.manage");
  const load = (data: { reminders?: CelebrationReminder[]; prepared?: PreparedReminder[] }) => { if (data.reminders) setReminders(data.reminders); if (data.prepared) setPrepared(data.prepared); };
  useEffect(() => { authFetch("/api/reminders").then((response) => response.ok ? response.json() : Promise.reject()).then(load).catch(() => {}); }, []);
  const key = (item: CelebrationReminder) => `${item.memberId}-${item.type}-${item.occurrenceDate}`;
  const isPrepared = (item: CelebrationReminder) => prepared.some((done) => done.memberId === item.memberId && done.celebrationType === item.type && done.occurrenceDate === item.occurrenceDate);
  const visible = reminders.filter((item) => filter === "All" || item.type === filter);
  async function prepare(item: CelebrationReminder, channel: string) {
    setWorking(key(item));
    try {
      const response = await authFetch("/api/reminders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: item.memberId, celebrationType: item.type, occurrenceDate: item.occurrenceDate, channel }) });
      const result = await response.json() as { reminders?: CelebrationReminder[]; prepared?: PreparedReminder[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to prepare reminder");
      load(result); notify(`${item.type} message prepared as a controlled ${channel} draft`);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to prepare reminder"); } finally { setWorking(""); }
  }
  const thisWeek = reminders.filter((item) => item.daysUntil <= 7).length;
  return <div className="reminders-layout">
    <section className="reminders-command"><div><p className="eyebrow">MEMBER CELEBRATIONS</p><h2>Celebration reminders</h2><p>ChurchFlow continuously calculates the next 45 days from member profiles and prepares personal outreach through the controlled communication workflow.</p></div><div className="reminder-kpis"><span><small>Upcoming 45 days</small><b>{reminders.length}</b></span><span><small>This week</small><b>{thisWeek}</b></span><span><small>Birthdays</small><b>{reminders.filter((item) => item.type === "Birthday").length}</b></span><span><small>Prepared drafts</small><b>{prepared.length}</b></span></div></section>
    <section className="reminder-workspace"><div className="panel reminder-register"><div className="ledger-toolbar"><PanelHead title="Upcoming celebrations" subtitle="Calculated automatically from date of birth and wedding anniversary fields" /><div><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>Birthday</option><option>Wedding Anniversary</option></select></div></div>{visible.length ? <div className="reminder-list">{visible.map((item) => <article key={key(item)}><time><b>{new Date(`${item.occurrenceDate}T00:00:00`).getDate()}</b><span>{new Date(`${item.occurrenceDate}T00:00:00`).toLocaleDateString("en",{month:"short"}).toUpperCase()}</span></time><div className="reminder-person"><i>{item.name.split(" ").map((part) => part[0]).join("").slice(0,2)}</i><div><strong>{item.name}</strong><span>{item.churchId} · {item.group}</span><small>{item.type} · {item.years} {item.type === "Birthday" ? "years" : "years married"}</small></div></div><em className={item.daysUntil <= 7 ? "soon" : ""}>{item.daysUntil === 0 ? "Today" : item.daysUntil === 1 ? "Tomorrow" : `In ${item.daysUntil} days`}</em><div className="reminder-actions">{isPrepared(item) ? <span>✓ Draft prepared</span> : canManage ? <><button disabled={working === key(item)} onClick={() => prepare(item, item.email ? "Email" : "In-app")}>{working === key(item) ? "Preparing…" : "Prepare message"}</button><select aria-label={`Channel for ${item.name}`} defaultValue={item.email ? "Email" : "In-app"} onChange={(event) => { if (event.target.value) prepare(item,event.target.value); }}><option>Email</option><option>SMS</option><option>WhatsApp</option><option>In-app</option></select></> : <span>Read only</span>}</div></article>)}</div> : <div className="queue-empty"><span>◫</span><strong>No celebrations in the next 45 days</strong><p>Add complete birth dates and wedding anniversary dates to member profiles.</p></div>}</div>
      <aside className="panel reminder-policy"><PanelHead title="Automation policy" subtitle="Safe, reviewable outreach" /><div className="automation-flow"><article><b>01</b><div><strong>Profile dates</strong><p>Birthdays and anniversaries are calculated from member records.</p></div></article><article><b>02</b><div><strong>45-day window</strong><p>Upcoming celebrations appear automatically without manual searching.</p></div></article><article><b>03</b><div><strong>Controlled draft</strong><p>Preparing creates a personalised campaign draft; it does not send immediately.</p></div></article><article><b>04</b><div><strong>Delivery review</strong><p>Communication officers review and schedule the final channel.</p></div></article></div><div className="control-note"><b>No surprise messages</b><p>ChurchFlow never claims delivery until a configured provider confirms it.</p></div></aside>
    </section>
  </div>;
}

const fallbackAttendance: AttendanceSession[] = [
  { id: 1, code: "ATT-260802-01", title: "Sunday Celebration Service", serviceType: "Sunday Service", serviceDate: "2026-08-02", startTime: "08:30", campus: "Grace Centre", venue: "Main Auditorium", status: "Open", expectedCount: 420, memberCount: 3, visitorCount: 1, records: [
    { id: 1, churchId: "CH-0241", name: "Akosua Mensah", initials: "AM", personType: "Member", attendanceStatus: "Present", checkInMethod: "Manual", checkedInAt: "08:12" },
    { id: 2, churchId: "CH-0318", name: "Kwame Owusu", initials: "KO", personType: "Member", attendanceStatus: "Present", checkInMethod: "Manual", checkedInAt: "08:18" },
    { id: 3, churchId: "CH-0397", name: "Abena Boateng", initials: "AB", personType: "Member", attendanceStatus: "Late", checkInMethod: "Manual", checkedInAt: "08:37" },
    { id: 4, name: "Guest visitor", initials: "GV", personType: "Visitor", attendanceStatus: "Present", checkInMethod: "Manual", checkedInAt: "08:21" },
  ]},
  { id: 2, code: "ATT-260729-01", title: "Midweek Bible Teaching", serviceType: "Midweek Service", serviceDate: "2026-07-29", startTime: "18:00", campus: "Grace Centre", venue: "Chapel", status: "Completed", expectedCount: 180, memberCount: 146, visitorCount: 9, records: [] },
  { id: 3, code: "ATT-260726-01", title: "Sunday Celebration Service", serviceType: "Sunday Service", serviceDate: "2026-07-26", startTime: "08:30", campus: "Grace Centre", venue: "Main Auditorium", status: "Completed", expectedCount: 400, memberCount: 312, visitorCount: 24, records: [] },
];

function AttendanceView({ members, notify }: { members: Member[]; notify: (message: string) => void }) {
  const [sessions, setSessions] = useState(fallbackAttendance);
  const [selectedId, setSelectedId] = useState(fallbackAttendance[0].id);
  const [memberQuery, setMemberQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showVisitor, setShowVisitor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = sessions.find((item) => item.id === selectedId) || sessions[0];

  useEffect(() => {
    authFetch("/api/attendance").then((response) => response.ok ? response.json() : Promise.reject()).then((data: { sessions?: AttendanceSession[] }) => {
      if (data.sessions?.length) { setSessions(data.sessions); setSelectedId(data.sessions.find((item) => item.status === "Open")?.id || data.sessions[0].id); }
    }).catch(() => {});
  }, []);

  const checkedIds = new Set(selected.records.filter((record) => record.churchId).map((record) => record.churchId));
  const roster = members.filter((member) => `${member.name} ${member.id} ${member.phone}`.toLowerCase().includes(memberQuery.toLowerCase()));
  const total = selected.memberCount + selected.visitorCount;
  const rate = selected.expectedCount ? Math.min(100, Math.round((total / selected.expectedCount) * 100)) : 0;

  function replaceSession(session: AttendanceSession) {
    setSessions((current) => current.map((item) => item.id === session.id ? session : item));
  }

  async function checkInMember(member: Member) {
    if (selected.status !== "Open" || checkedIds.has(member.id)) return;
    setSaving(true);
    const fallbackRecord = { id: Date.now(), churchId: member.id, name: member.name, initials: member.initials, personType: "Member" as const, attendanceStatus: "Present" as const, checkInMethod: "Manual" as const, checkedInAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    try {
      const response = await authFetch("/api/attendance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: selected.id, churchId: member.id, personType: "Member", attendanceStatus: "Present", checkInMethod: "Manual" }) });
      const result = await response.json() as { session?: AttendanceSession; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to check in member");
      if (result.session) replaceSession(result.session);
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("already")) notify(caught.message);
      else replaceSession({ ...selected, memberCount: selected.memberCount + 1, records: [fallbackRecord, ...selected.records] });
    } finally {
      setSaving(false);
    }
    notify(`${member.name} checked in`);
  }

  async function addVisitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    setSaving(true);
    try {
      const response = await authFetch("/api/attendance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, action: "check-in", sessionId: selected.id, personType: "Visitor" }) });
      const result = await response.json() as { session?: AttendanceSession; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to add visitor");
      if (result.session) replaceSession(result.session);
    } catch {
      const name = String(payload.visitorName || "Guest visitor");
      replaceSession({ ...selected, visitorCount: selected.visitorCount + 1, records: [{ id: Date.now(), name, initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0,2), personType: "Visitor", attendanceStatus: "Present", checkInMethod: "Manual", checkedInAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }, ...selected.records] });
    } finally { setSaving(false); setShowVisitor(false); }
    notify("Visitor attendance recorded");
  }

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await authFetch("/api/attendance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, action: "create-session", status: "Open" }) });
      const result = await response.json() as { session?: AttendanceSession; error?: string };
      if (!response.ok || !result.session) throw new Error(result.error || "Unable to create service");
      setSessions((current) => [result.session!, ...current]); setSelectedId(result.session.id); setShowCreate(false);
      notify(`${result.session.title} is open for check-in`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create service"); }
    finally { setSaving(false); }
  }

  async function toggleSession() {
    const status = selected.status === "Open" ? "Completed" : "Open";
    try {
      const response = await authFetch("/api/attendance", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: selected.id, status }) });
      const result = await response.json() as { session?: AttendanceSession };
      if (result.session) replaceSession(result.session); else replaceSession({ ...selected, status });
    } catch { replaceSession({ ...selected, status }); }
    notify(status === "Completed" ? "Service attendance completed" : "Service check-in reopened");
  }

  return <div className="attendance-layout">
    <section className="attendance-command"><div><p className="eyebrow">SERVICE OPERATIONS</p><h2>Attendance command centre</h2><p>Run member and visitor check-in from one trusted service record.</p></div><div className="attendance-kpis"><span><b>{total}</b> checked in<small>{selected.memberCount} members · {selected.visitorCount} visitors</small></span><span><b>{rate}%</b> of expected<small>{selected.expectedCount || "No"} expected attendance</small></span><span><b className={selected.status === "Open" ? "live" : ""}>{selected.status}</b> session<small>{selected.startTime} · {selected.venue}</small></span></div><button className="primary" onClick={() => setShowCreate(true)}>＋ New service session</button></section>
    <section className="attendance-workspace">
      <aside className="panel session-rail"><PanelHead title="Service records" subtitle="Select a session" />{sessions.map((session) => <button className={session.id === selected.id ? "active" : ""} onClick={() => setSelectedId(session.id)} key={session.id}><i className={session.status.toLowerCase()}>{session.status === "Open" ? "●" : "✓"}</i><div><strong>{session.title}</strong><span>{session.serviceDate} · {session.startTime}</span><small>{session.memberCount + session.visitorCount} total · {session.campus}</small></div><b>›</b></button>)}</aside>
      <section className="panel checkin-panel"><div className="checkin-head"><div><p className="eyebrow">{selected.code}</p><h2>{selected.title}</h2><span>{selected.serviceDate} · {selected.startTime} · {selected.venue}</span></div><div><button className="secondary-action" onClick={() => setShowVisitor(true)} disabled={selected.status !== "Open"}>＋ Add visitor</button><button className={selected.status === "Open" ? "complete-action" : "reopen-action"} onClick={toggleSession}>{selected.status === "Open" ? "Complete session" : "Reopen session"}</button></div></div>
        {selected.status === "Open" ? <><div className="checkin-tools"><label>⌕<input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Search name, church ID or phone…" /></label><span><i /> Live desk</span><button onClick={() => notify("QR check-in is ready for the mobile integration phase")}>▦ QR readiness</button></div><div className="roster-list">{roster.map((member) => { const checked = checkedIds.has(member.id); return <div key={member.id}><MemberAvatar member={member} /><div><strong>{member.name}</strong><span>{member.id} · {member.group}</span></div><small>{member.phone}</small><button disabled={checked || saving} className={checked ? "checked" : ""} onClick={() => checkInMember(member)}>{checked ? "✓ Checked in" : "Check in"}</button></div>; })}</div></> : <div className="session-closed"><span>✓</span><h3>This attendance record is complete</h3><p>Reopen it only when an authorised correction is required.</p><div><b>{selected.memberCount}</b> members <b>{selected.visitorCount}</b> visitors <b>{total}</b> total</div></div>}
      </section>
      <aside className="panel live-log"><PanelHead title="Live attendance" subtitle="Most recent check-ins" /><div>{selected.records.length ? selected.records.slice(0,8).map((record) => <article key={record.id}><i>{record.initials}</i><div><strong>{record.name}</strong><span>{record.personType} · {record.checkInMethod}</span></div><small>{record.checkedInAt.includes("T") ? new Date(record.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : record.checkedInAt}</small></article>) : <p className="log-empty">No individual check-ins are available for this service.</p>}</div></aside>
    </section>
    {showVisitor && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-dismiss" onClick={() => setShowVisitor(false)} aria-label="Close visitor form" /><form className="modal visitor-form" onSubmit={addVisitor}><div className="modal-head"><div><p className="eyebrow">VISITOR CHECK-IN</p><h2>Welcome a guest</h2><span>Record a name when known, or keep the default anonymous guest.</span></div><button type="button" onClick={() => setShowVisitor(false)}>×</button></div><label>Visitor name<input name="visitorName" autoFocus placeholder="Guest visitor" /></label><label>Attendance status<select name="attendanceStatus"><option>Present</option><option>Late</option><option>Excused</option></select></label><div className="modal-actions"><button type="button" onClick={() => setShowVisitor(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Recording…" : "Record visitor"}</button></div></form></div>}
    {showCreate && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-dismiss" onClick={() => setShowCreate(false)} aria-label="Close service form" /><form className="modal attendance-form" onSubmit={createSession}><div className="modal-head"><div><p className="eyebrow">SERVICE RECORD</p><h2>Open an attendance session</h2><span>One service record powers desk, QR and future mobile check-in.</span></div><button type="button" onClick={() => setShowCreate(false)}>×</button></div>{error && <div className="form-error">{error}</div>}<div className="form-row"><label>Service title *<input name="title" required autoFocus placeholder="Sunday Celebration Service" /></label><label>Service type<select name="serviceType"><option>Sunday Service</option><option>Midweek Service</option><option>Prayer Meeting</option><option>Special Event</option><option>Ministry Meeting</option></select></label></div><div className="form-row"><label>Date *<input name="serviceDate" type="date" required /></label><label>Start time *<input name="startTime" type="time" required /></label></div><div className="form-row"><label>Campus<select name="campus"><option>Grace Centre</option><option>North Assembly</option><option>Online Campus</option></select></label><label>Venue<input name="venue" defaultValue="Main Auditorium" /></label></div><label>Expected attendance<input name="expectedCount" type="number" min="0" placeholder="e.g. 420" /></label><div className="modal-note">The session opens immediately. Completion locks routine check-in but authorised users can reopen it for corrections.</div><div className="modal-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Opening service…" : "Open service session"}</button></div></form></div>}
  </div>;
}

const fallbackHouseholds: Household[] = [
  { id: 1, code: "HH-0101", name: "Mensah Household", address: "Ahodwo, Kumasi", primaryPhone: "024 000 1842", campus: "Grace Centre", pastoralZone: "Central Zone", status: "Active", memberCount: 3, headName: "Akosua Mensah" },
  { id: 2, code: "HH-0102", name: "Owusu Household", address: "Asokwa, Kumasi", primaryPhone: "055 410 8821", campus: "Grace Centre", pastoralZone: "East Zone", status: "Active", memberCount: 4, headName: "Kwame Owusu" },
  { id: 3, code: "HH-0103", name: "Boateng Household", address: "Santasi, Kumasi", primaryPhone: "020 771 1904", campus: "North Assembly", pastoralZone: "West Zone", status: "Active", memberCount: 2, headName: "Abena Boateng" },
];

function FamiliesView({ members, notify }: { members: Member[]; notify: (message: string) => void }) {
  const [households, setHouseholds] = useState(fallbackHouseholds);
  const [selected, setSelected] = useState<Household | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    authFetch("/api/households").then((response) => response.ok ? response.json() : Promise.reject()).then((data: { households?: Household[] }) => {
      if (data.households?.length) setHouseholds(data.households);
    }).catch(() => {});
  }, []);

  async function createHousehold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await authFetch("/api/households", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { household?: Household; error?: string };
      if (!response.ok || !result.household) throw new Error(result.error || "Unable to create household");
      setHouseholds((current) => [...current, result.household!].sort((a,b) => a.name.localeCompare(b.name)));
      setShowCreate(false);
      notify(`${result.household.name} was created`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create household");
    } finally {
      setSaving(false);
    }
  }

  const totalLinked = households.reduce((sum, household) => sum + household.memberCount, 0);
  return <div className="family-layout">
    <section className="family-command"><div><p className="eyebrow">FAMILY & HOUSEHOLD CARE</p><h2>Connected homes, better ministry</h2><p>Link people into households while every individual keeps one trusted member record.</p></div><div className="family-command-stats"><span><b>{households.length}</b> households</span><span><b>{totalLinked}</b> linked people</span><span><b>{new Set(households.map((item) => item.pastoralZone)).size}</b> pastoral zones</span></div><button className="primary" onClick={() => setShowCreate(true)}>＋ Create household</button></section>
    <section className="panel household-panel"><PanelHead title="Household directory" subtitle="Family units and pastoral coverage" /><div className="household-grid">{households.map((household) => <button className="household-card" onClick={() => setSelected(household)} key={household.id}><div className="household-icon">⌂</div><div><span>{household.code} · {household.pastoralZone}</span><strong>{household.name}</strong><p>{household.address || "Address not recorded"}</p><div><b>{household.memberCount} linked {household.memberCount === 1 ? "person" : "people"}</b><small>{household.headName || "No household head linked"}</small></div></div><em>›</em></button>)}</div></section>
    {selected && <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={selected.name}><button className="drawer-dismiss" onClick={() => setSelected(null)} aria-label="Close household" /><aside className="action-drawer household-drawer"><div className="drawer-head"><div><p className="eyebrow">HOUSEHOLD PROFILE</p><h2>{selected.name}</h2></div><button onClick={() => setSelected(null)}>×</button></div><div className="household-summary"><span>{selected.code}</span><strong>{selected.memberCount} linked people</strong><p>{selected.address}</p></div><div className="profile-details"><div><span>Household head</span><strong>{selected.headName || "Not linked"}</strong></div><div><span>Primary phone</span><strong>{selected.primaryPhone || "Not recorded"}</strong></div><div><span>Campus</span><strong>{selected.campus}</strong></div><div><span>Pastoral zone</span><strong>{selected.pastoralZone}</strong></div></div><div className="household-next"><strong>Household relationships</strong><p>Spouse, child, dependant and guardian links will appear here as members are added to this household.</p><button disabled>＋ Link another member</button></div><div className="drawer-actions"><button onClick={() => setSelected(null)}>Close</button><button className="primary" onClick={() => notify("Household editing is prepared for the relationship workflow")}>Manage household</button></div></aside></div>}
    {showCreate && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Create household"><button className="modal-dismiss" onClick={() => setShowCreate(false)} aria-label="Close household form" /><form className="modal household-form" onSubmit={createHousehold}><div className="modal-head"><div><p className="eyebrow">NEW HOUSEHOLD</p><h2>Create a family record</h2><span>Start with the home and optionally link an existing member as its head.</span></div><button type="button" onClick={() => setShowCreate(false)}>×</button></div>{error && <div className="form-error">{error}</div>}<div className="form-row"><label>Household name *<input name="name" required autoFocus placeholder="e.g. Asante Household" /></label><label>Household head<select name="headChurchId"><option value="">Link later</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name} · {member.id}</option>)}</select></label></div><div className="form-row"><label>Primary phone<input name="primaryPhone" /></label><label>Pastoral zone<select name="pastoralZone"><option>Central Zone</option><option>East Zone</option><option>West Zone</option><option>North Zone</option><option>Unassigned</option></select></label></div><label>Residential address<input name="address" placeholder="Community, street or landmark" /></label><div className="form-row"><label>Campus<select name="campus"><option>Grace Centre</option><option>North Assembly</option><option>Online Campus</option></select></label></div><div className="modal-note">Members remain independent records. Household links can be changed later without losing attendance, giving or pastoral history.</div><div className="modal-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Creating household…" : "Create household"}</button></div></form></div>}
  </div>;
}

const fallbackUnits: OrganisationUnit[] = [
  { id: 1, name: "Youth Ministry", type: "Ministry", leaderName: "Priscilla Agyeman", memberCount: 86, meetingSchedule: "Saturdays · 4:00 PM", campus: "Grace Centre", status: "Active" },
  { id: 2, name: "Women’s Ministry", type: "Fellowship", leaderName: "Deaconess Lydia Owusu", memberCount: 124, meetingSchedule: "Tuesdays · 5:30 PM", campus: "Grace Centre", status: "Active" },
  { id: 3, name: "Finance Department", type: "Department", leaderName: "Daniel Asante", memberCount: 8, meetingSchedule: "First Monday monthly", campus: "Grace Centre", status: "Active" },
  { id: 4, name: "Choir", type: "Ministry", leaderName: "Emmanuel Frimpong", memberCount: 34, meetingSchedule: "Thursdays · 6:00 PM", campus: "Grace Centre", status: "Active" },
];

function OrganisationView({ notify }: { notify: (message: string) => void }) {
  const [units, setUnits] = useState(fallbackUnits);
  const [filter, setFilter] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    authFetch("/api/organisation-units").then((response) => response.ok ? response.json() : Promise.reject()).then((data: { units?: OrganisationUnit[] }) => {
      if (data.units?.length) setUnits(data.units);
    }).catch(() => {});
  }, []);
  async function createUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await authFetch("/api/organisation-units", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { unit?: OrganisationUnit; error?: string };
      if (!response.ok || !result.unit) throw new Error(result.error || "Unable to create unit");
      setUnits((current) => [...current, result.unit!].sort((a,b) => a.name.localeCompare(b.name)));
      setShowCreate(false);
      notify(`${result.unit.name} was created`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create unit");
    } finally {
      setSaving(false);
    }
  }
  const visible = units.filter((unit) => filter === "All" || unit.type === filter);
  return <div className="organisation-layout"><section className="organisation-head"><div><p className="eyebrow">MINISTRY STRUCTURE</p><h2>Groups and departments</h2><p>Fellowships, ministry teams and administrative departments remain distinct while sharing the same people directory.</p></div><button className="primary" onClick={() => setShowCreate(true)}>＋ Create unit</button></section><nav className="unit-filters" aria-label="Organisation unit types">{["All","Ministry","Fellowship","Department"].map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}<span>{item === "All" ? units.length : units.filter((unit) => unit.type === item).length}</span></button>)}</nav><section className="unit-grid">{visible.map((unit) => <article className="unit-card" key={unit.id}><div className={`unit-type ${unit.type.toLowerCase()}`}>{unit.type.slice(0,1)}</div><div className="unit-card-head"><span>{unit.type} · {unit.campus}</span><i className="status">{unit.status}</i></div><h3>{unit.name}</h3><div className="unit-leader"><span>Leader</span><strong>{unit.leaderName}</strong></div><div className="unit-card-foot"><span><b>{unit.memberCount}</b> members</span><span><b>◫</b> {unit.meetingSchedule}</span></div><button onClick={() => notify(`${unit.name} workspace opened`)}>Open unit workspace →</button></article>)}</section>{showCreate && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Create organisation unit"><button className="modal-dismiss" onClick={() => setShowCreate(false)} aria-label="Close unit form" /><form className="modal unit-form" onSubmit={createUnit}><div className="modal-head"><div><p className="eyebrow">ORGANISATION UNIT</p><h2>Create a group or department</h2><span>Choose the correct structure so reports and permissions remain accurate.</span></div><button type="button" onClick={() => setShowCreate(false)}>×</button></div>{error && <div className="form-error">{error}</div>}<div className="form-row"><label>Unit name *<input name="name" required autoFocus /></label><label>Unit type *<select name="type"><option>Ministry</option><option>Fellowship</option><option>Department</option></select></label></div><div className="form-row"><label>Leader name<input name="leaderName" placeholder="Assign now or later" /></label><label>Meeting schedule<input name="meetingSchedule" placeholder="e.g. Saturdays · 4:00 PM" /></label></div><label>Campus<select name="campus"><option>Grace Centre</option><option>North Assembly</option><option>Online Campus</option></select></label><div className="modal-note">A ministry supports service and spiritual work, a fellowship groups members, and a department handles administration.</div><div className="modal-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Creating unit…" : "Create organisation unit"}</button></div></form></div>}</div>;
}

function MemberProfile({ member, onClose, onEdit }: { member: Member; onClose: () => void; onEdit: () => void }) {
  const [tab, setTab] = useState<"Overview" | "Membership" | "Pastoral" | "Activity">("Overview");
  const fields = [member.phone, member.email, member.gender, member.birthDate, member.maritalStatus, member.weddingDate, member.address, member.hometown, member.occupation, member.membershipType, member.baptismStatus, member.emergencyName, member.emergencyPhone];
  const completeness = Math.round((fields.filter(Boolean).length / fields.length) * 100);
  const detail = (label: string, value?: string) => <div><span>{label}</span><strong>{value || "Not recorded"}</strong></div>;

  return <div className="drawer-layer member-profile-layer" role="dialog" aria-modal="true" aria-label={`${member.name} profile`}><button className="drawer-dismiss" aria-label="Close member profile" onClick={onClose} /><aside className="member-profile-drawer">
    <header className="profile-hero">
      <button className="profile-close" onClick={onClose} aria-label="Close member profile">×</button>
      <MemberAvatar member={member} />
      <div><p className="eyebrow">MEMBER PROFILE</p><h2>{member.name}</h2><span>{member.id} · Joined {member.joined}</span><div><i className={`status ${member.status.toLowerCase().replace(" ", "-")}`}>{member.status}</i><b>{member.group}</b></div></div>
      <button className="primary" onClick={onEdit}>✎ Edit profile</button>
    </header>
    <div className="profile-health"><div><span>Profile completeness</span><strong>{completeness}%</strong><i><b style={{ width: `${completeness}%` }} /></i></div><div><span>Member standing</span><strong>In good standing</strong><small>No restrictions recorded</small></div><div><span>Last activity</span><strong>Sunday service</strong><small>26 July 2026</small></div></div>
    <nav className="profile-tabs" aria-label="Member profile sections">{(["Overview", "Membership", "Pastoral", "Activity"] as const).map((item) => <button className={tab === item ? "active" : ""} aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)} key={item}>{item}</button>)}</nav>
    <div className="profile-content">
      {tab === "Overview" && <><section className="profile-section"><div className="profile-section-head"><div><span>01</span><h3>Personal information</h3></div><small>Identity and contact</small></div><div className="profile-details">{detail("Phone number", member.phone)}{detail("Email address", member.email)}{detail("Gender", member.gender)}{detail("Date of birth", member.birthDate)}{detail("Marital status", member.maritalStatus)}{detail("Wedding anniversary", member.weddingDate)}{detail("Occupation", member.occupation)}{detail("Residential address", member.address)}{detail("Hometown", member.hometown)}</div></section><section className="profile-section future-foundation"><div className="profile-section-head"><div><span>02</span><h3>Family and household</h3></div><small>Ready for next phase</small></div><p>Household relationships connect spouses, children, guardians and shared contact information without duplicating this member record.</p><button disabled>＋ Link family member</button></section></>}
      {tab === "Membership" && <section className="profile-section"><div className="profile-section-head"><div><span>02</span><h3>Church membership</h3></div><small>Membership journey</small></div><div className="profile-details">{detail("Church ID", member.id)}{detail("Membership type", member.membershipType)}{detail("Current status", member.status)}{detail("Baptism status", member.baptismStatus)}{detail("Ministry or group", member.group)}{detail("Date joined", member.joined)}</div></section>}
      {tab === "Pastoral" && <><section className="profile-section"><div className="profile-section-head"><div><span>03</span><h3>Emergency and pastoral care</h3></div><small>Authorised leaders only</small></div><div className="profile-details">{detail("Emergency contact", member.emergencyName)}{detail("Emergency phone", member.emergencyPhone)}</div><div className="pastoral-note"><span>Pastoral notes</span><p>{member.notes || "No pastoral notes have been recorded for this member."}</p></div></section></>}
      {tab === "Activity" && <section className="profile-section"><div className="profile-section-head"><div><span>04</span><h3>Connected activity</h3></div><small>Cross-module timeline</small></div><div className="activity-foundations">{["Attendance history", "Giving history", "Care records", "Documents"].map((item) => <div key={item}><span>◇</span><div><strong>{item}</strong><small>Ready to connect when this module is implemented</small></div><b>—</b></div>)}</div></section>}
    </div>
  </aside></div>;
}

function MemberEditModal({ member, onClose, onSaved, notify }: { member: Member; onClose: () => void; onSaved: (member: Member) => void; notify: (message: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(member.profilePhotoUrl || "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    form.set("id", member.id);
    try {
      const response = await authFetch("/api/members", { method: "PATCH", body: form });
      const result = await response.json() as { member?: Member; error?: string };
      if (!response.ok || !result.member) throw new Error(result.error || "Unable to update member");
      onSaved(result.member);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update member");
    } finally {
      setSaving(false);
    }
  }

  return <div className="modal-layer edit-member-layer" role="dialog" aria-modal="true" aria-label={`Edit ${member.name}`}><button className="modal-dismiss" onClick={onClose} aria-label="Close edit member form" /><form className="modal member-form" onSubmit={submit}>
    <div className="modal-head"><div><p className="eyebrow">MEMBER RECORD · {member.id}</p><h2>Edit member profile</h2><span>Changes are applied across every connected ChurchFlow module.</span></div><button type="button" onClick={onClose}>×</button></div>
    {error && <div className="form-error edit-error">{error}</div>}
    <section className="photo-section"><div className="photo-preview">{preview ? <img src={preview} alt={`${member.name} profile preview`} /> : <><span>♙</span><small>No photo</small></>}</div><div><strong>Profile photograph</strong><p>Replace the current image with a JPG, PNG or WebP file up to 5 MB.</p><label className="upload-button">↑ Replace photo<input type="file" name="profilePhoto" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) { notify("Photo must be 5 MB or smaller"); event.target.value = ""; return; } setPreview(URL.createObjectURL(file)); }} /></label></div></section>
    <FormSection title="Personal information" description="Identity and demographic details"><label>Full legal name *<input name="name" required defaultValue={member.name} autoFocus /></label><label>Gender<select name="gender" defaultValue={member.gender || ""}><option value="">Select gender</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label><label>Date of birth<input type="date" name="birthDate" defaultValue={member.birthDate || ""} /></label><label>Marital status<select name="maritalStatus" defaultValue={member.maritalStatus || ""}><option value="">Select status</option><option>Single</option><option>Married</option><option>Widowed</option><option>Divorced</option></select></label><label>Wedding anniversary<input type="date" name="weddingDate" defaultValue={member.weddingDate || ""} /></label></FormSection>
    <FormSection title="Contact and address" description="How the church can reach this member"><label>Phone number *<input name="phone" required defaultValue={member.phone} /></label><label>Email address<input type="email" name="email" defaultValue={member.email || ""} /></label><label>Residential address<input name="address" defaultValue={member.address || ""} /></label><label>Hometown<input name="hometown" defaultValue={member.hometown || ""} /></label><label>Occupation<input name="occupation" defaultValue={member.occupation || ""} /></label></FormSection>
    <FormSection title="Church membership" description="Membership status and ministry connection"><label>Membership type<select name="membershipType" defaultValue={member.membershipType || ""}><option value="">Select type</option><option>Full member</option><option>Associate member</option><option>New convert</option><option>Visitor</option><option>Child member</option></select></label><label>Member status<select name="status" defaultValue={member.status}><option>Active</option><option>New convert</option><option>Follow-up</option></select></label><label>Baptism status<select name="baptismStatus" defaultValue={member.baptismStatus || ""}><option value="">Select status</option><option>Baptised by immersion</option><option>Pending baptism</option><option>Not recorded</option></select></label><label>Group or department<select name="group" defaultValue={member.group}><option>General</option><option>Women’s Ministry</option><option>Men’s Ministry</option><option>Youth Ministry</option><option>Choir</option><option>Children’s Ministry</option><option>Ushers</option><option>Media Team</option></select></label></FormSection>
    <FormSection title="Emergency and pastoral information" description="Restricted to authorised church leaders"><label>Emergency contact name<input name="emergencyName" defaultValue={member.emergencyName || ""} /></label><label>Emergency contact phone<input name="emergencyPhone" defaultValue={member.emergencyPhone || ""} /></label><label className="wide-field">Pastoral notes<textarea name="notes" defaultValue={member.notes || ""} /></label></FormSection>
    <div className="modal-actions sticky-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving changes…" : "Save member profile"}</button></div>
  </form></div>;
}

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: RoleKey;
  roleLabel: string;
  campus: string;
  status: string;
  memberId?: number | null;
  memberChurchId?: string | null;
  createdAt: string;
  lastActiveAt?: string | null;
};

type AuditEntry = {
  id: number;
  actorName: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId?: string | null;
  createdAt: string;
};

function AdministrationView({ access, notify }: { access: AccessProfile; notify: (message: string) => void }) {
  const [users, setUsers] = useState<AdminUser[]>([{
    id: access.id,
    name: access.name,
    email: access.email,
    role: access.role,
    roleLabel: access.roleLabel,
    campus: access.campus,
    status: access.status,
    createdAt: "System owner",
    lastActiveAt: "Active now",
  }]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [mobileGrant, setMobileGrant] = useState<{ token: string; userName: string; expiresAt: string } | null>(null);
  const [createRole, setCreateRole] = useState<RoleKey>("ministry_leader");

  useEffect(() => {
    authFetch("/api/users")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { users?: AdminUser[] }) => {
        if (data.users?.length) setUsers(data.users);
      })
      .catch(() => {
        // The owner row remains visible in local preview.
      });
    authFetch("/api/audit")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { logs?: AuditEntry[] }) => setAuditEntries(data.logs || []))
      .catch(() => {});
  }, []);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await authFetch("/api/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { user?: AdminUser; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error || "Unable to create user");
      setUsers((current) => [...current, result.user!].sort((a, b) => a.name.localeCompare(b.name)));
      setShowCreate(false);
      notify(`${result.user.name} can now access ChurchFlow`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create user");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(user: AdminUser, changes: { role?: RoleKey; status?: string }) {
    try {
      const response = await authFetch("/api/users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: user.id, ...changes }) });
      const result = await response.json() as { user?: AdminUser; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error || "Unable to update user");
      setUsers((current) => current.map((item) => item.id === user.id ? result.user! : item));
      notify(`${result.user.name} was updated`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to update user");
    }
  }

  async function issueMobileAccess(user: AdminUser) {
    try {
      const response = await authFetch("/api/mobile-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: user.id, deviceName: `${user.name} mobile device` }) });
      const result = await response.json() as { activationToken?: string; expiresAt?: string; error?: string };
      if (!response.ok || !result.activationToken || !result.expiresAt) throw new Error(result.error || "Unable to issue mobile access");
      setMobileGrant({ token: result.activationToken, userName: user.name, expiresAt: result.expiresAt });
      notify(`Mobile access prepared for ${user.name}`);
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Unable to issue mobile access"); }
  }

  const activeUsers = users.filter((user) => user.status === "Active").length;
  return <div className="admin-layout">
    <section className="security-brief">
      <div><p className="eyebrow">IDENTITY & ACCESS</p><h2>Secure ministry operations</h2><p>Every worker receives only the modules and actions required for their responsibility.</p></div>
      <div className="security-metrics"><span><b>{activeUsers}</b> active users</span><span><b>{Object.keys(rolePolicies).length}</b> controlled roles</span><span><b>100%</b> administrator-created</span></div>
      <button className="primary" onClick={() => setShowCreate(true)}>＋ Add authorised user</button>
    </section>

    <section className="panel user-panel">
      <PanelHead title="Users and access" subtitle="Authorised ChurchFlow accounts" />
      <div className="table-scroll"><table className="members-table user-table"><thead><tr><th>User</th><th>Role</th><th>Campus</th><th>Status</th><th>Access control</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><div className="table-person"><i className="avatar">{user.name.split(/\s+/).map((part) => part[0]).join("").slice(0,2)}</i><b>{user.name}<small>{user.email}</small></b></div></td><td><select aria-label={`Role for ${user.name}`} value={user.role} onChange={(event) => updateUser(user, { role: event.target.value as RoleKey })}>{Object.entries(rolePolicies).map(([key, role]) => <option value={key} key={key}>{role.label}</option>)}</select></td><td>{user.campus}</td><td><i className={`status ${user.status === "Active" ? "" : "inactive"}`}>{user.status}</i></td><td><div className="user-control-actions"><button className="user-status-action" disabled={user.id === access.id} onClick={() => updateUser(user, { status: user.status === "Active" ? "Inactive" : "Active" })}>{user.status === "Active" ? "Deactivate" : "Reactivate"}</button><button className="user-status-action mobile-access-action" disabled={user.status !== "Active"} onClick={() => issueMobileAccess(user)}>Issue mobile access</button></div></td></tr>)}</tbody></table></div>
    </section>

    <section className="panel user-panel audit-panel">
      <PanelHead title="Security and audit activity" subtitle="Latest 100 protected actions across ChurchFlow" />
      <div className="table-scroll"><table className="members-table user-table"><thead><tr><th>Action</th><th>Actor</th><th>Record</th><th>Time</th><th>Request</th></tr></thead><tbody>{auditEntries.map((entry) => <tr key={entry.id}><td><b>{entry.action.split(".").join(" ")}<small>{entry.entityType}</small></b></td><td><b>{entry.actorName}<small>{entry.actorEmail}</small></b></td><td>{entry.entityId}</td><td>{new Date(entry.createdAt).toLocaleString()}</td><td><code>{entry.requestId?.slice(0, 12) || "Legacy"}</code></td></tr>)}</tbody></table>{auditEntries.length === 0 && <div className="empty-state"><span>✓</span><strong>No audit activity yet</strong><p>Protected changes will appear here automatically.</p></div>}</div>
    </section>

    <section className="role-grid">{Object.entries(rolePolicies).map(([key, role]) => {
      const permissions = role.permissions as readonly string[];
      const fullAccess = permissions.includes("*");
      return <article className="role-card" key={key}><div><span>{fullAccess ? "Full access" : `${permissions.length} permissions`}</span><strong>{role.label}</strong><p>{role.description}</p></div><small>{fullAccess ? "All ChurchFlow modules and controls" : permissions.slice(0,3).map((item) => item.split(".")[0]).join(" · ")}</small></article>;
    })}</section>

    {showCreate && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Add authorised user"><button className="modal-dismiss" onClick={() => setShowCreate(false)} aria-label="Close modal" /><form className="modal access-form" onSubmit={createUser}><div className="modal-head"><div><p className="eyebrow">ADMIN-CREATED ACCESS</p><h2>Add authorised user</h2><span>The email must match the person’s ChurchFlow sign-in email.</span></div><button type="button" onClick={() => setShowCreate(false)}>×</button></div>{error && <div className="form-error">{error}</div>}<div className="form-row"><label>Full name *<input name="name" required autoFocus placeholder="e.g. Grace Owusu" /></label><label>Email address *<input name="email" required type="email" placeholder="user@example.com" /></label></div><div className="form-row"><label>Role *<select name="role" value={createRole} onChange={(event)=>setCreateRole(event.target.value as RoleKey)}>{Object.entries(rolePolicies).map(([key, role]) => <option value={key} key={key}>{role.label}</option>)}</select></label><label>Campus<select name="campus"><option>Grace Centre</option><option>North Assembly</option><option>Online Campus</option></select></label></div>{createRole === "member" && <label className="member-link-field">Member church ID *<input name="memberChurchId" required placeholder="e.g. CH-0241" /><small>This links the login to exactly one existing active member profile. The emails must match.</small></label>}<div className="modal-note">No public registration is available. Access becomes active only for this approved email and can be revoked at any time.</div><div className="modal-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Creating access…" : createRole === "member" ? "Create member portal access" : "Create user access"}</button></div></form></div>}
    {mobileGrant && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Mobile activation code"><button className="modal-dismiss" onClick={() => setMobileGrant(null)} aria-label="Close mobile access" /><div className="modal mobile-grant"><div className="modal-head"><div><p className="eyebrow">ONE-TIME MOBILE ACTIVATION</p><h2>Connect {mobileGrant.userName}</h2><span>This code is shown once and replaces any earlier active mobile code for this user.</span></div><button onClick={() => setMobileGrant(null)}>×</button></div><label>Activation code<input readOnly value={mobileGrant.token} onFocus={(event) => event.currentTarget.select()} /></label><div className="mobile-grant-meta"><span>Expires</span><strong>{new Date(mobileGrant.expiresAt).toLocaleDateString()}</strong></div><div className="modal-note">Send this code to the authorised worker through a secure channel. ChurchFlow stores only its cryptographic hash.</div><div className="modal-actions"><button onClick={() => setMobileGrant(null)}>Done</button><button className="primary" onClick={() => navigator.clipboard.writeText(mobileGrant.token).then(() => notify("Activation code copied"))}>Copy activation code</button></div></div></div>}
  </div>;
}

function PanelHead({ title, subtitle, action, onClick }: { title: string; subtitle: string; action?: string; onClick?: () => void }) {
  return <div className="panel-head"><div><h2>{title}</h2><p>{subtitle}</p></div>{action && <button onClick={onClick}>{action} <span>→</span></button>}</div>;
}

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <fieldset className="form-section"><legend><strong>{title}</strong><span>{description}</span></legend><div className="form-fields">{children}</div></fieldset>;
}

function MemberAvatar({ member }: { member: Member }) {
  return <i className={`avatar ${member.profilePhotoUrl ? "has-photo" : ""}`}>{member.profilePhotoUrl ? <img src={member.profilePhotoUrl} alt="" /> : member.initials}</i>;
}
