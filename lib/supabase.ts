import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AUTH_STORAGE_KEY, authFetch } from "@/lib/auth-time";

let client: SupabaseClient | null = null;
let activeUserId: string | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function setActiveUser(userId: string | null) {
  activeUserId = userId;
}

export function ledgerOwnerId(): string {
  if (activeUserId) return activeUserId;
  throw new Error("Sign in to open your ledger.");
}

export function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  if (typeof window === "undefined") {
    throw new Error("Open the ledger in the browser.");
  }
  if (!client) {
    client = createClient(url, key, {
      global: { fetch: authFetch },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storage: window.localStorage,
        storageKey: AUTH_STORAGE_KEY,
        lock: async (_name, _acquireTimeout, fn) => fn(),
      },
    });
  }
  return client;
}
