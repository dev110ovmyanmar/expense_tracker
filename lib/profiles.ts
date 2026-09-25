import { authLog, getSupabase } from "@/lib/supabase";

export async function ensureProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  const meta = user.user_metadata ?? {};
  const named = ["full_name", "user_name", "display_name", "name"]
    .map((key) => meta[key])
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  const fullName = named?.trim() || user.email?.split("@")[0] || null;
  const { error } = await getSupabase().from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name: fullName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) {
    authLog("profile upsert skipped, session kept", { message: error.message, userId: user.id });
  }
}
