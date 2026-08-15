import { apiJson, getRequestId, readJson, ApiError } from "../../../../../lib/guard";
import { requirePlatformStaff, requirePermission } from "../../../../../lib/guard";
import { aicosDb } from "../../../../../lib/db";
import { productMemberships, identities, products } from "@nexora/db";
import { desc, eq } from "drizzle-orm";

const PRODUCT_ROLES = ["product_owner", "product_admin", "product_support"];

// Superadmin console for product super-admins (e.g. ChurchFlow product owners).
// Gated on product:read / product:manage — only platform owners (and any role
// granted product perms) may view or mutate these cross-tenant grants.
export async function GET(request: Request) {
  const user = await requirePlatformStaff(request);
  requirePermission(user, "product:read");
  const requestId = getRequestId(request);
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId") || undefined;

  const rows = await aicosDb
    .select({
      membership: productMemberships,
      productName: products.name,
      identityEmail: identities.email,
      identityName: identities.fullName,
    })
    .from(productMemberships)
    .leftJoin(products, eq(productMemberships.productId, products.id))
    .leftJoin(identities, eq(productMemberships.identityId, identities.id))
    .where(productId ? eq(productMemberships.productId, productId) : undefined)
    .orderBy(desc(productMemberships.createdAt));

  return apiJson({ memberships: rows }, 200, requestId);
}

export async function POST(request: Request) {
  const user = await requirePlatformStaff(request);
  requirePermission(user, "product:manage");
  const requestId = getRequestId(request);
  const body = await readJson<{ email?: string; productId?: string; role?: string }>(request);

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const productId = typeof body.productId === "string" ? body.productId : "";
  const role = PRODUCT_ROLES.includes(body.role ?? "") ? (body.role as string) : null;
  if (!email || !productId || !role) {
    throw new ApiError(422, "email, productId and a valid role are required");
  }

  const [identity] = await aicosDb
    .select()
    .from(identities)
    .where(eq(identities.email, email))
    .limit(1);
  if (!identity) throw new ApiError(422, "No identity found for that email");

  const [membership] = await aicosDb
    .insert(productMemberships)
    .values({
      productId,
      identityId: identity.id,
      role,
      grantedBy: user.identityId,
      status: "active",
    })
    .onConflictDoUpdate({
      target: [productMemberships.productId, productMemberships.identityId],
      set: { role, status: "active", grantedBy: user.identityId },
    })
    .returning();

  return apiJson({ membership }, 201, requestId);
}
