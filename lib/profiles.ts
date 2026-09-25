import { getSupabase } from "@/lib/supabase";

export async function seedProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  const meta = user.user_metadata ?? {};
  const named = ["full_name", "user_name", "display_name", "name"]
    .map((key) => meta[key])
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  const { error } = await getSupabase().from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name: named?.trim() || user.email?.split("@")[0] || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) return error.message;
  return null;
}
