import { asc, count } from "drizzle-orm";
import { getDb } from "../../../db";
import { archiveAssets } from "../../../db/schema";
import { requirePermission } from "../_access";
import { writeAudit } from "../_audit";
import { ApiError, apiJson, assertBodySize, assertSameOriginWrite, safeApi } from "../_security";

const TYPES = ["Document", "Sermon", "Audio", "Video", "Photo"] as const;
const ALLOWED = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword", "audio/mpeg", "audio/mp4", "video/mp4", "image/jpeg", "image/png", "image/webp"];
const text = (value: FormDataEntryValue | null, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

async function seedIfEmpty(actorId: number, actorName: string) {
  const db = await getDb();
  const [total] = await db.select({ value: count() }).from(archiveAssets);
  if (total.value) return;
  await db.insert(archiveAssets).values([
    { assetCode: "ARC-SER-001", assetType: "Sermon", title: "Unfeigned Faith", description: "Sunday teaching on practical faith and Christian living.", speakerAuthor: "Senior Pastor", ministry: "Church-wide", eventDate: "2026-07-26", scriptureReference: "Hebrews 11:1", tags: "faith,sunday service", externalUrl: "https://www.youtube.com/", visibility: "Internal", uploadedByUserId: actorId, uploadedByName: actorName },
    { assetCode: "ARC-DOC-002", assetType: "Document", title: "Membership Orientation Guide", description: "Approved guide for new members and new converts.", speakerAuthor: "Church Office", ministry: "Membership", eventDate: "2026-07-15", tags: "membership,orientation", visibility: "Internal", uploadedByUserId: actorId, uploadedByName: actorName },
    { assetCode: "ARC-AUD-003", assetType: "Audio", title: "Midweek Bible Teaching", description: "Audio archive entry awaiting source upload.", speakerAuthor: "Teaching Ministry", ministry: "Christian Education", eventDate: "2026-07-29", scriptureReference: "Romans 12:1–2", tags: "bible study,audio", visibility: "Internal", status: "Draft", uploadedByUserId: actorId, uploadedByName: actorName },
  ]);
}

async function listAssets() {
  const db = await getDb();
  const rows = await db.select().from(archiveAssets).orderBy(asc(archiveAssets.assetType), asc(archiveAssets.title));
  return rows.map((asset) => ({
    id: asset.id, code: asset.assetCode, assetType: asset.assetType, title: asset.title,
    description: asset.description, speakerAuthor: asset.speakerAuthor, ministry: asset.ministry,
    eventDate: asset.eventDate, scriptureReference: asset.scriptureReference, tags: asset.tags,
    fileName: asset.fileName, fileSize: asset.fileSize, externalUrl: asset.externalUrl,
    visibility: asset.visibility, status: asset.status, uploadedByName: asset.uploadedByName,
    createdAt: asset.createdAt, downloadUrl: asset.fileKey ? `/api/archive-file?id=${asset.id}` : null,
  }));
}

export async function GET(request: Request) {
  return safeApi(request, "Unable to load archive", async (requestId) => {
    const access = await requirePermission(request, "archive.read");
    if (access.response) return access.response;
    await seedIfEmpty(access.user!.id, access.user!.name);
    return apiJson({ assets: await listAssets(), types: TYPES }, 200, requestId);
  });
}

export async function POST(request: Request) {
  return safeApi(request, "Unable to add archive item", async (requestId) => {
    const access = await requirePermission(request, "archive.manage");
    if (access.response) return access.response;
    assertSameOriginWrite(request);
    assertBodySize(request, 26 * 1024 * 1024);
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) throw new ApiError(415, "This endpoint requires a form upload");
    const form = await request.formData();
    const assetType = text(form.get("assetType"), 30);
    const title = text(form.get("title"), 160);
    if (!TYPES.includes(assetType as typeof TYPES[number]) || !title) throw new ApiError(400, "Asset type and title are required");
    const candidate = form.get("file");
    const file = candidate instanceof File && candidate.size > 0 ? candidate : null;
    const externalUrl = text(form.get("externalUrl"), 500);
    if (!file && !externalUrl) throw new ApiError(400, "Upload a file or provide an external media link");
    if (file && externalUrl) throw new ApiError(400, "Choose either a file upload or an external link, not both");
    if (file && file.size > 25 * 1024 * 1024) throw new ApiError(400, "Archive files must be 25 MB or smaller");
    if (file && !ALLOWED.includes(file.type)) throw new ApiError(400, "Use PDF, Word, MP3, MP4, JPG, PNG or WebP files");
    if (externalUrl) {
      let parsed: URL;
      try { parsed = new URL(externalUrl); } catch { throw new ApiError(400, "Enter a valid external link"); }
      if (!["https:"].includes(parsed.protocol)) throw new ApiError(400, "External links must use HTTPS");
    }
    let fileKey: string | null = null;
    if (file) {
      const moduleName = ["cloudflare", "workers"].join(":");
      const { env } = (await import(/* @vite-ignore */ moduleName)) as typeof import("cloudflare:workers");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100);
      fileKey = `archive/${assetType.toLowerCase()}/${crypto.randomUUID()}-${safeName}`;
      await env.BUCKET.put(fileKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type, contentDisposition: `attachment; filename="${safeName}"` } });
    }
    const db = await getDb();
    const assetCode = `ARC-${assetType.slice(0, 3).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const [created] = await db.insert(archiveAssets).values({
      assetCode, assetType, title, description: text(form.get("description"), 1000) || null,
      speakerAuthor: text(form.get("speakerAuthor"), 120) || null, ministry: text(form.get("ministry"), 120) || "Church-wide",
      eventDate: text(form.get("eventDate"), 10) || null, scriptureReference: text(form.get("scriptureReference"), 120) || null,
      tags: text(form.get("tags"), 300), fileKey, fileName: file?.name || null, contentType: file?.type || null,
      fileSize: file?.size || null, externalUrl: externalUrl || null, visibility: text(form.get("visibility"), 20) === "Public" ? "Public" : "Internal",
      uploadedByUserId: access.user!.id, uploadedByName: access.user!.name,
    }).returning({ id: archiveAssets.id });
    await writeAudit(access.user!, "archive.asset.created", "archive_asset", created.id, requestId, { assetCode, assetType, hasFile: Boolean(file), hasExternalLink: Boolean(externalUrl) });
    return apiJson({ assets: await listAssets() }, 201, requestId);
  });
}
