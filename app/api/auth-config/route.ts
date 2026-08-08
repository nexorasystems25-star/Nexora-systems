import { apiJson, getRequestId } from "../_security";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || "";
  if (!url || !anonKey) return apiJson({ error: "Authentication is not configured" }, 503, requestId);
  return apiJson({ url, anonKey }, 200, requestId);
}
