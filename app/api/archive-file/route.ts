import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { archiveAssets } from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, safeApi } from "../_security";

export async function GET(request: Request) {
  return safeApi(request, "Unable to download archive file", async (requestId) => {
    const access = await requirePermission(request, "archive.read");
    if (access.response) return access.response;
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id)) throw new ApiError(400, "Archive item is required");
    const [asset] = await (await getDb()).select().from(archiveAssets).where(eq(archiveAssets.id, id)).limit(1);
    if (!asset?.fileKey) throw new ApiError(404, "Archive file not found");
    const moduleName = ["cloudflare", "workers"].join(":");
    const { env } = (await import(/* @vite-ignore */ moduleName)) as typeof import("cloudflare:workers");
    const object = await env.BUCKET.get(asset.fileKey);
    if (!object) throw new ApiError(404, "Archive file not found");
    await writeAudit(access.user!, "archive.asset.downloaded", "archive_asset", id, requestId, { assetCode: asset.assetCode, visibility: asset.visibility });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "private, no-store");
    headers.set("x-content-type-options", "nosniff");
    headers.set("content-disposition", `attachment; filename="${(asset.fileName || "churchflow-file").replaceAll('"', "")}"`);
    return new Response(object.body, { headers });
  });
}
