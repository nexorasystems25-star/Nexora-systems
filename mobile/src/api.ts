import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const API_URL = String(Constants.expoConfig?.extra?.apiUrl || "").replace(/\/$/, "");
const SUPABASE_URL = String(Constants.expoConfig?.extra?.supabaseUrl || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = String(Constants.expoConfig?.extra?.supabaseAnonKey || "");
const TOKEN_KEY = "churchflow_mobile_token";

export async function saveActivationToken(token: string) {
  if (!token.trim()) throw new Error("Authentication token is required");
  await SecureStore.setItemAsync(TOKEN_KEY, token.trim(), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function authRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as { access_token?: string; msg?: string; error_description?: string };
  if (!response.ok) throw new Error(data.msg || data.error_description || "Authentication failed");
  return data;
}

async function ensureApproved(email: string) {
  const response = await fetch(`${API_URL}/api/auth-preflight`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await response.json().catch(() => ({})) as { approved?: boolean; error?: string };
  if (!response.ok || !data.approved) throw new Error(data.error || "This email has not been approved by a ChurchFlow administrator");
}

export async function signInWithPassword(email: string, password: string) {
  await ensureApproved(email);
  const data = await authRequest("token?grant_type=password", { email, password });
  if (!data.access_token) throw new Error("Authentication did not return a session");
  await saveActivationToken(data.access_token);
}

export async function sendEmailOtp(email: string) {
  await ensureApproved(email);
  await authRequest("otp", { email, create_user: true });
}

export async function verifyEmailOtp(email: string, token: string) {
  const data = await authRequest("verify", { email, token, type: "email" });
  if (!data.access_token) throw new Error("The code is invalid or expired");
  await saveActivationToken(data.access_token);
}

export async function getActivationToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearActivationToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await Promise.all(
    ["cf.profile", "cf.dashboard", "cf.members", "cf.attendance", "cf.events", "cf.care", "cf.volunteers"].map((key) =>
      AsyncStorage.removeItem(key),
    ),
  );
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getActivationToken();
  if (!token) throw new Error("Sign in is required");
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (response.status === 401) throw new Error("Your session expired or this account was revoked");
  if (!response.ok) throw new Error(data.error || "ChurchFlow could not complete this request");
  return data;
}

export async function cached<T>(key: string, loader: () => Promise<T>) {
  try {
    const data = await loader();
    await AsyncStorage.setItem(key, JSON.stringify(data));
    return { data, offline: false };
  } catch (error) {
    const stored = await AsyncStorage.getItem(key);
    if (stored) return { data: JSON.parse(stored) as T, offline: true };
    throw error;
  }
}
