import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { mobileDevices, users } from "../../db/schema";
import { hasPermission, type RoleKey, rolePolicies } from "../../lib/access";
import { apiJson, getRequestId } from "./_security";

const OWNER_EMAIL = "amanvid.da@gmail.com";

export type AccessUser = {
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

function readName(request: Request, email: string) {
  const encoded = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  if (encoded && encoding === "percent-encoded-utf-8") {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Fall back to a useful email-derived display name.
    }
  }
  return email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function getAccessUser(request: Request): Promise<AccessUser | null> {
  const authorization = request.headers.get("authorization")?.trim();
  if (authorization?.startsWith("Bearer cfm_")) {
    const rawToken = authorization.slice(7);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
    const tokenHash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const db = await getDb();
    const [device] = await db.select().from(mobileDevices).where(eq(mobileDevices.tokenHash, tokenHash)).limit(1);
    if (!device || device.status !== "Active" || Date.parse(device.expiresAt) <= Date.now()) return null;
    const [mobileUser] = await db.select().from(users).where(eq(users.id, device.userId)).limit(1);
    if (!mobileUser || mobileUser.status !== "Active" || !(mobileUser.role in rolePolicies)) return null;
    await db.update(mobileDevices).set({ lastUsedAt: new Date().toISOString() }).where(eq(mobileDevices.id, device.id));
    const role = mobileUser.role as RoleKey;
    return { id: mobileUser.id, name: mobileUser.name, email: mobileUser.email, role, roleLabel: rolePolicies[role].label, campus: mobileUser.campus, status: mobileUser.status, memberId: mobileUser.memberId, permissions: rolePolicies[role].permissions };
  }
  let supabaseEmail = "";
  if (authorization?.startsWith("Bearer ")) {
    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return null;
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, authorization },
    });
    if (!response.ok) return null;
    const identity = await response.json() as { email?: string };
    supabaseEmail = identity.email?.trim().toLowerCase() || "";
  }
  const email = supabaseEmail || request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  const isLocalPreview = new URL(request.url).hostname === "terminal.local";
  const resolvedEmail = email || (isLocalPreview ? OWNER_EMAIL : "");
  if (!resolvedEmail) return null;

  const db = await getDb();
  let [row] = await db.select().from(users).where(eq(users.email, resolvedEmail)).limit(1);
  if (!row && resolvedEmail === OWNER_EMAIL) {
    await db.insert(users).values({
      name: readName(request, resolvedEmail),
      email: resolvedEmail,
      role: "super_admin",
      campus: "Grace Centre",
      status: "Active",
      lastActiveAt: new Date().toISOString(),
    }).onConflictDoNothing();
    [row] = await db.select().from(users).where(eq(users.email, resolvedEmail)).limit(1);
  }
  if (!row || row.status !== "Active" || !(row.role in rolePolicies)) return null;

  const role = row.role as RoleKey;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role,
    roleLabel: rolePolicies[role].label,
    campus: row.campus,
    status: row.status,
    memberId: row.memberId,
    permissions: rolePolicies[role].permissions,
  };
}

export async function requirePermission(request: Request, permission: string) {
  const requestId = getRequestId(request);
  const user = await getAccessUser(request);
  if (!user) return { user: null, response: apiJson({ error: "Authentication required or account inactive", requestId }, 401, requestId) };
  if (!hasPermission(user.role, permission)) {
    return { user, response: apiJson({ error: "You do not have permission to perform this action", requestId }, 403, requestId) };
  }
  return { user, response: null };
}
