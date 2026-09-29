import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function isRow(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return Response.json({ error: "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." }, { status: 500 });
  }
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return Response.json({ error: "Sign in to open your ledger." }, { status: 401 });
  }
  const payload = (await request.json().catch(() => null)) as { rows?: unknown } | null;
  if (!payload || !Array.isArray(payload.rows) || payload.rows.length === 0 || !payload.rows.every(isRow)) {
    return Response.json({ error: "There is nothing to save." }, { status: 400 });
  }
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error: userError } = await supabase.auth.getUser(token);
  if (userError || !data.user) {
    return Response.json({ error: "Sign in to open your ledger." }, { status: 401 });
  }
  const rows = payload.rows.map((row) => ({ ...row, user_id: data.user.id }));
  const { error } = await supabase.from("expenses").upsert(rows);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
