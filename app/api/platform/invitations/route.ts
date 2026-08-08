import { eq, and, gt } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  memberships,
  identities,
  organizations,
  auditEvents,
} from "../../../db/schema-platform";
import {
  resolveTenantUser,
  type TenantUser,
} from "../../../lib/auth-platform";
import { apiJson, getRequestId, readJson, ApiError } from "../../_security";

// ============================================================================
// INVITATIONS API
// ============================================================================
// Manages user invitations within a tenant
// ============================================================================

interface InvitePayload {
  email: string;
  name?: string;
  role: string;
}

// Generate a secure invitation token
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// POST /api/platform/invitations - Create invitation
export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await resolveTenantUser(request);

    if (!user) {
      throw new ApiError(401, "Authentication required");
    }

    // Must have tenant_admin or client_admin role
    if (!["tenant_admin", "client_admin", "owner"].includes(user.role)) {
      throw new ApiError(403, "Only administrators can invite users");
    }

    const payload = await readJson<InvitePayload>(request);

    // Validate email
    if (!payload.email?.trim() || !payload.email.includes("@")) {
      throw new ApiError(400, "Valid email address is required");
    }

    // Validate role
    const validRoles = ["admin", "manager", "leader", "member", "viewer"];
    if (payload.role && !validRoles.includes(payload.role)) {
      throw new ApiError(400, "Invalid role");
    }

    const db = await getDb();
    const targetRole = payload.role || "member";

    // Check if user is already a member
    const [existingIdentity] = await db
      .select({ id: identities.id })
      .from(identities)
      .where(eq(identities.email, payload.email.toLowerCase()))
      .limit(1);

    if (existingIdentity) {
      const [existingMembership] = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.identityId, existingIdentity.id),
            eq(memberships.organizationId, user.tenantId),
            eq(memberships.status, "active")
          )
        )
        .limit(1);

      if (existingMembership) {
        throw new ApiError(409, "User is already a member of this organization");
      }
    }

    // Generate invitation token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    // Create invitation record (we use memberships table with pending status)
    const [invitation] = await db
      .insert(memberships)
      .values({
        identityId: existingIdentity?.id || crypto.randomUUID(),
        organizationId: user.tenantId,
        role: targetRole,
        scope: "tenant",
        status: "invited",
        invitedBy: user.identityId,
        invitedAt: new Date().toISOString(),
        inviteExpiresAt: expiresAt,
        inviteToken: token,
      })
      .returning();

    // In production, send email here
    console.log("Invitation created:", {
      email: payload.email,
      role: targetRole,
      token,
      expiresAt,
    });

    // Audit log
    await db.insert(auditEvents).values({
      organizationId: user.tenantId,
      actorId: user.identityId,
      actorEmail: user.email,
      action: "member.invite",
      entityType: "membership",
      entityId: invitation.id,
      payload: {
        email: payload.email,
        role: targetRole,
        invitedBy: user.email,
      },
    });

    return apiJson(
      {
        success: true,
        invitation: {
          id: invitation.id,
          email: payload.email,
          role: targetRole,
          expiresAt,
          status: "pending",
        },
      },
      201,
      requestId
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return apiJson({ error: error.publicMessage }, error.status, requestId);
    }
    console.error("Invitation failed:", error);
    return apiJson({ error: "Failed to create invitation" }, 500, requestId);
  }
}

// GET /api/platform/invitations - List pending invitations
export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await resolveTenantUser(request);

    if (!user) {
      throw new ApiError(401, "Authentication required");
    }

    const db = await getDb();

    // Get pending invitations for this tenant
    const pendingInvitations = await db
      .select({
        id: memberships.id,
        role: memberships.role,
        status: memberships.status,
        invitedAt: memberships.invitedAt,
        inviteExpiresAt: memberships.inviteExpiresAt,
        organizationId: memberships.organizationId,
      })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, user.tenantId),
          eq(memberships.status, "invited"),
          gt(memberships.inviteExpiresAt, new Date().toISOString())
        )
      );

    return apiJson(
      {
        invitations: pendingInvitations.map((inv) => ({
          id: inv.id,
          role: inv.role,
          status: inv.status,
          invitedAt: inv.invitedAt,
          expiresAt: inv.inviteExpiresAt,
        })),
      },
      200,
      requestId
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return apiJson({ error: error.publicMessage }, error.status, requestId);
    }
    console.error("Failed to list invitations:", error);
    return apiJson({ error: "Failed to list invitations" }, 500, requestId);
  }
}
