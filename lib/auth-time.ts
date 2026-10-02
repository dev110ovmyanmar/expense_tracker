const STORAGE_KEY = "aura-auth";

export function isFutureJwtError(message: string): boolean {
  return /issued at future|used before issued|not valid yet/i.test(message);
}

export function explainAuthError(message: string): string {
  if (!isFutureJwtError(message)) return message;
  return "The sign-in clock is a little ahead. Set the phone's date and time to automatic, then try again.";
}

export function jwtIssuedAt(token: string): number | null {
  const segment = token.split(".")[1];
  if (!segment) return null;
  try {
    const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(padded)) as { iat?: unknown };
    return typeof json.iat === "number" && Number.isFinite(json.iat) ? json.iat : null;
  } catch {
    return null;
  }
}

export function skewWaitMs(token: string | null, now = Date.now()): number {
  if (!token) return 1200;
  const issuedAt = jwtIssuedAt(token);
  if (issuedAt === null) return 1200;
  const ahead = issuedAt * 1000 - now;
  if (ahead <= 0) return 1200;
  return Math.min(4000, Math.max(1200, ahead + 250));
}

function bearerToken(init?: RequestInit): string | null {
  const headers = new Headers(init?.headers);
  const value = headers.get("authorization") ?? headers.get("Authorization");
  if (!value) return null;
  const token = value.replace(/^Bearer\s+/i, "").trim();
  return token || null;
}

export function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init).then(async (response) => {
    if (response.ok) return response;
    let body = "";
    try {
      body = await response.clone().text();
    } catch {
      return response;
    }
    if (!isFutureJwtError(body)) return response;
    await new Promise((resolve) => setTimeout(resolve, skewWaitMs(bearerToken(init))));
    return fetch(input, init);
  });
}

export function readStoredSession(): {
  access_token: string;
  refresh_token: string;
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
} | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      access_token?: unknown;
      refresh_token?: unknown;
      user?: { id?: unknown; email?: string; user_metadata?: Record<string, unknown> };
    };
    if (typeof parsed.access_token !== "string" || typeof parsed.refresh_token !== "string") return null;
    if (!parsed.user || typeof parsed.user.id !== "string") return null;
    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      user: parsed.user as { id: string; email?: string; user_metadata?: Record<string, unknown> },
    };
  } catch {
    return null;
  }
}

export const AUTH_STORAGE_KEY = STORAGE_KEY;
