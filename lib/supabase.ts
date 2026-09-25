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

let recoveryTokens: { access_token: string; refresh_token: string } | null = null;

export function rememberRecoverySession(session: { access_token?: string; refresh_token?: string; user?: { id: string } } | null) {
  if (!session?.access_token || !session.refresh_token || !session.user) return;
  recoveryTokens = { access_token: session.access_token, refresh_token: session.refresh_token };
  setSignedInUser(session.user.id);
}

function urlParam(url: URL, hash: URLSearchParams, key: string) {
  return url.searchParams.get(key) || hash.get(key);
}

function clearRecoveryUrl(url: URL) {
  url.searchParams.delete("code");
  url.searchParams.delete("sb_flow_id");
  url.searchParams.delete("token_hash");
  url.searchParams.delete("type");
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  window.history.replaceState({}, "", url.pathname + url.search);
}

export async function establishRecoverySession(): Promise<boolean> {
  const supabase = getSupabase();
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const linkError = urlParam(url, hash, "error_description") || urlParam(url, hash, "error");
  try {
    if (recoveryTokens) {
      const restored = await supabase.auth.setSession(recoveryTokens);
      if (restored.data.session?.user) {
        rememberRecoverySession(restored.data.session);
        authLog("recovery remembered session", { userId: restored.data.session.user.id });
        return true;
      }
    }

    const accessToken = urlParam(url, hash, "access_token");
    const refreshToken = urlParam(url, hash, "refresh_token");
    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      authLog("recovery hash", { ok: Boolean(data.session), error: error?.message ?? null });
      if (error) console.warn("[aura-auth] recovery hash failed", { message: error.message });
      if (data.session?.user) {
        rememberRecoverySession(data.session);
        clearRecoveryUrl(url);
        return true;
      }
    }

    const tokenHash = urlParam(url, hash, "token_hash");
    const otpType = urlParam(url, hash, "type");
    if (tokenHash) {
      const type = otpType === "signup" || otpType === "invite" || otpType === "magiclink" || otpType === "email_change" || otpType === "email"
        ? otpType
        : "recovery";
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      authLog("recovery otp", { ok: Boolean(data.session), error: error?.message ?? null });
      if (error) console.warn("[aura-auth] recovery otp failed", { message: error.message });
      if (data.session?.user) {
        rememberRecoverySession(data.session);
        clearRecoveryUrl(url);
        return true;
      }
    }

    const code = urlParam(url, hash, "code");
    if (code) {
      const flowId = urlParam(url, hash, "sb_flow_id") ?? undefined;
      const { data, error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      authLog("recovery code", { ok: Boolean(data.session), flowId: flowId ?? null, error: error?.message ?? null });
      if (error) console.warn("[aura-auth] recovery code failed", { message: error.message });
      if (data.session?.user) {
        rememberRecoverySession(data.session);
        clearRecoveryUrl(url);
        return true;
      }
    }

    const existing = await supabase.auth.getSession();
    if (existing.error) console.warn("[aura-auth] recovery session read failed", { message: existing.error.message });
    if (existing.data.session?.user) {
      rememberRecoverySession(existing.data.session);
      clearRecoveryUrl(url);
      authLog("recovery existing session", { userId: existing.data.session.user.id });
      return true;
    }
    if (linkError) console.warn("[aura-auth] recovery link error", { message: linkError });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The reset session could not be opened.";
    console.warn("[aura-auth] recovery session threw", { message });
  }
  authLog("recovery session missing", { linkError });
  return false;
}

export async function currentUserId(): Promise<string> {
  if (signedInUserId) return signedInUserId;
  const { data, error } = await getSupabase().auth.getSession();
  if (error) authLog("session read failed", { message: error.message });
  const id = data.session?.user?.id ?? signedInUserId;
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
        detectSessionInUrl: false,
        flowType: "pkce",
        storage: window.localStorage,
        storageKey: "aura-auth",
      },
    });
  }
  return client;
}
