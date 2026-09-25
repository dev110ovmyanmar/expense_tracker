import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let signedInUserId: string | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function setSignedInUser(userId: string | null) {
  signedInUserId = userId;
}

export function hasSignedInUser(): boolean {
  return Boolean(signedInUserId);
}

export function authLog(step: string, detail: Record<string, unknown> = {}) {
  console.info("[aura-auth]", step, detail);
}

export async function currentUserId(): Promise<string> {
  if (signedInUserId) return signedInUserId;
  const { data } = await getSupabase().auth.getSession();
  const id = data.session?.user?.id;
  if (id) {
    signedInUserId = id;
    return id;
  }
  throw new Error("Sign in to open your ledger.");
}

export function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  if (typeof window === "undefined") {
    throw new Error("Sign in from the browser to open your ledger.");
  }
  if (!client) {
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storage: window.localStorage,
        storageKey: "aura-auth",
      },
    });
  }
  return client;
}
