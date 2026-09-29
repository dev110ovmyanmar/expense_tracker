import { getSupabase } from "@/lib/supabase";

export async function seedProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  const meta = user.user_metadata ?? {};
  const named = ["full_name", "user_name", "display_name", "name"]
    .map((key) => meta[key])
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  const supabase = getSupabase();
  const row = {
    id: user.id,
    user_id: user.id,
    email: user.email ?? null,
    full_name: named?.trim() || user.email?.split("@")[0] || null,
    updated_at: new Date().toISOString(),
  };
  const saved = await supabase.from("profiles").upsert(row, { onConflict: "id" });
  if (!saved.error) return null;
  if (!/user_id/i.test(saved.error.message)) return saved.error.message;
  const { user_id: _owner, ...withoutOwner } = row;
  void _owner;
  const retry = await supabase.from("profiles").upsert(withoutOwner, { onConflict: "id" });
  return retry.error?.message ?? null;
}
