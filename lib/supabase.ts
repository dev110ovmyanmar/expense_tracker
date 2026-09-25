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

function rememberSession(userId: string) {
  setSignedInUser(userId);
}

function stripAuthParams(url: URL) {
  url.searchParams.delete("code");
  url.searchParams.delete("token_hash");
  url.searchParams.delete("type");
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}

export async function establishRecoverySession(): Promise<boolean> {
  const supabase = getSupabase();
  const url = new URL(window.location.href);
  try {
    const existing = await supabase.auth.getSession();
    if (existing.error) console.error("[aura-auth] recovery session read failed", { message: existing.error.message });
    if (existing.data.session?.user) {
      rememberSession(existing.data.session.user.id);
      stripAuthParams(url);
      authLog("recovery existing session", { userId: existing.data.session.user.id });
      return true;
    }

    const tokenHash = url.searchParams.get("token_hash");
    const otpType = url.searchParams.get("type");
    if (tokenHash) {
      const type = otpType === "signup" || otpType === "invite" || otpType === "magiclink" || otpType === "email_change" || otpType === "email"
        ? otpType
        : "recovery";
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      authLog("recovery otp", { ok: Boolean(data.session), error: error?.message ?? null });
      if (error) console.error("[aura-auth] recovery otp failed", { message: error.message });
      if (data.session?.user) {
        rememberSession(data.session.user.id);
        stripAuthParams(url);
        return true;
      }
    }

    const code = url.searchParams.get("code");
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      authLog("recovery code", { ok: Boolean(data.session), error: error?.message ?? null });
      if (error && !/already|code verifier/i.test(error.message)) {
        console.error("[aura-auth] recovery code failed", { message: error.message });
      }
      if (data.session?.user) {
        rememberSession(data.session.user.id);
        stripAuthParams(url);
        return true;
      }
    }

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      authLog("recovery hash", { ok: Boolean(data.session), error: error?.message ?? null });
      if (error) console.error("[aura-auth] recovery hash failed", { message: error.message });
      if (data.session?.user) {
        rememberSession(data.session.user.id);
        window.history.replaceState({}, "", `${url.pathname}${url.search}`);
        return true;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The reset session could not be opened.";
    console.error("[aura-auth] recovery session threw", { message });
  }
  authLog("recovery session missing", {});
  return false;
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
