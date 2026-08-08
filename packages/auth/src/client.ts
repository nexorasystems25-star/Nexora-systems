import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { AuthConfig } from "./types";

export function createClient(config: AuthConfig) {
  return createSupabaseClient(config.supabaseUrl, config.supabaseAnonKey);
}

export function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL is required");
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error("SUPABASE_ANON_KEY is required");
  return key;
}
