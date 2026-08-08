const MAX_JSON_BYTES = 64 * 1024;

export class ApiError extends Error {
  constructor(public status: number, public publicMessage: string) {
    super(publicMessage);
  }
}

export function getRequestId(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[a-zA-Z0-9._:-]{1,100}$/.test(supplied) ? supplied : crypto.randomUUID();
}

export function apiJson(data: unknown, status = 200, requestId?: string) {
  const headers = new Headers({ "cache-control": "no-store" });
  if (requestId) headers.set("x-request-id", requestId);
  return Response.json(data, { status, headers });
}

export function assertSameOriginWrite(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") throw new ApiError(403, "Cross-site requests are not allowed");
  const origin = request.headers.get("origin");
  if (!origin) return;
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) {
      throw new ApiError(403, "Cross-site requests are not allowed");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(403, "Cross-site requests are not allowed");
  }
}

export function assertBodySize(request: Request, maxBytes: number) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new ApiError(413, "Request body is too large");
}

export async function readJson<T>(request: Request): Promise<T> {
  assertSameOriginWrite(request);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "This endpoint requires JSON");
  }
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_JSON_BYTES) throw new ApiError(413, "Request body is too large");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BYTES) {
    throw new ApiError(413, "Request body is too large");
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ApiError(400, "Request body contains invalid JSON");
  }
}

export async function safeApi(
  request: Request,
  fallback: string,
  handler: (requestId: string) => Promise<Response>,
) {
  const requestId = getRequestId(request);
  try {
    return await handler(requestId);
  } catch (error) {
    if (error instanceof ApiError) return apiJson({ error: error.publicMessage, requestId }, error.status, requestId);
    console.error(JSON.stringify({
      level: "error",
      requestId,
      route: new URL(request.url).pathname,
      method: request.method,
      error: error instanceof Error ? error.name : "UnknownError",
    }));
    return apiJson({ error: fallback, requestId }, 500, requestId);
  }
}
