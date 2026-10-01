import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const buckets = new Map<string, { count: number; reset: number }>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

export function allowRequest(request: Request, bucket: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const key = `${bucket}:${clientKey(request)}`;
  const current = buckets.get(key);
  if (!current || current.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

export async function userFromBearer(request: Request): Promise<{ id: string; client: SupabaseClient } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token.length > 4096) return null;
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, client };
}

export function safeModel(value: string | undefined, fallback: string): string {
  const model = value?.trim() ?? "";
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(model) ? model : fallback;
}
