import { authLog, getSupabase } from "@/lib/supabase";

function profileName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const meta = user.user_metadata ?? {};
  const named = ["full_name", "user_name", "display_name", "name"]
    .map((key) => meta[key])
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return named?.trim() || user.email?.split("@")[0] || null;
}

export async function ensureProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  const row = {
    id: user.id,
    email: user.email ?? null,
    full_name: profileName(user),
    updated_at: new Date().toISOString(),
  };
  authLog("profile insert start", { userId: user.id, email: user.email ?? null });
  try {
    const { error } = await getSupabase().from("profiles").upsert(row, { onConflict: "id" });
    if (error) {
      console.warn("[aura-auth] profile insert failed", { userId: user.id, message: error.message, code: error.code });
      return error.message;
    }
    authLog("profile insert ok", { userId: user.id });
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The profile could not be saved.";
    console.warn("[aura-auth] profile insert threw", { userId: user.id, message });
    return message;
  }
}
