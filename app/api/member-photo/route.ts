import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { members } from "../../../db/schema";
import { requirePermission } from "../_access";

export async function GET(request: Request) {
  const access = await requirePermission(request, "members.read");
  if (access.response) return access.response;
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return new Response("Member ID is required", { status: 400 });
  const [member] = await (await getDb())
    .select({ profilePhotoKey: members.profilePhotoKey })
    .from(members)
    .where(eq(members.churchId, id))
    .limit(1);
  if (!member?.profilePhotoKey) return new Response("Profile photo not found", { status: 404 });

  const moduleName = ["cloudflare", "workers"].join(":");
  const { env } = (await import(/* @vite-ignore */ moduleName)) as typeof import("cloudflare:workers");
  const object = await env.BUCKET.get(member.profilePhotoKey);
  if (!object) return new Response("Profile photo not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=3600");
  return new Response(object.body, { headers });
}
