import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
const OWNER_KEY = "aura-owner";

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function ledgerOwnerId(): string {
  if (typeof window === "undefined") return "00000000-0000-4000-8000-000000000001";
  const existing = window.localStorage.getItem(OWNER_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(OWNER_KEY, id);
  return id;
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
    const memory = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    client = createClient(url, key, {
      accessToken: async () => key,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: memory,
      },
    });
  }
  return client;
}
