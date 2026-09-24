import { localCoachMessage, type CoachSnapshot } from "@/lib/budget-coach";
import { formatMoney } from "@/lib/format";

export const runtime = "nodejs";

function isSnapshot(value: unknown): value is CoachSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.month === "string" &&
    typeof row.income === "number" &&
    typeof row.expenses === "number" &&
    typeof row.dining === "number" &&
    Array.isArray(row.categories)
  );
}

function clip(text: string): string {
  const clean = text.replace(/\s+/g, " ").replace(/^["']|["']$/g, "").trim();
  if (!/[\u1000-\u109F]/.test(clean)) return "";
  if (clean.length <= 360) return clean;
  return `${clean.slice(0, 357).trim()}…`;
}

function brief(snapshot: CoachSnapshot): string {
  const categories = snapshot.categories
    .map((row) => `${row.name} ${formatMoney(row.amount)}`)
    .join(", ");
  return [
    `${snapshot.month}, day ${snapshot.day} of ${snapshot.daysInMonth}.`,
    `Income ${formatMoney(snapshot.income)}. Expenses ${formatMoney(snapshot.expenses)}. Net ${formatMoney(snapshot.net)}.`,
    `Budget ${formatMoney(snapshot.budget)}. Projected spending ${formatMoney(snapshot.projected)}.`,
    `Dining ${formatMoney(snapshot.dining)}. Top category ${snapshot.topCategory ?? "none"} at ${formatMoney(snapshot.topAmount)}.`,
    categories ? `Categories: ${categories}.` : "No categories yet.",
  ].join(" ");
}

async function askGemini(key: string, snapshot: CoachSnapshot): Promise<string> {
  const model = process.env.GEMINI_VISION_MODEL?.trim() || "gemini-3.5-flash-lite";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "You are Aura, a warm Burmese friend who coaches a personal budget. Reply with one or two short sentences in casual spoken Burmese (Myanmar script) only. No English sentences, no markdown, no lists, no emojis. Keep every amount exactly as written, including Ks. If spending is on pace to pass the budget, tease them lightly. If they are under budget, praise them. If income is missing, remind them to log this month's salary. If the month is empty, invite a salary or a receipt. Do not invent purchases.",
            },
          ],
        },
        contents: [{ parts: [{ text: brief(snapshot) }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 120 },
      }),
    },
  );
  if (!response.ok) throw new Error("coach unavailable");
  const payload: unknown = await response.json();
  const parts =
    typeof payload === "object" && payload !== null && "candidates" in payload
      ? (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]
          ?.content?.parts
      : [];
  const text = (parts ?? []).map((part) => part.text ?? "").join(" ").trim();
  if (!text) throw new Error("empty coach reply");
  return clip(text);
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isSnapshot(body)) {
    return Response.json({ message: "ဒီလ ဝင်ငွေနဲ့ အသုံးစရိတ်ကို မမြင်ရသေးဘူး။ နည်းနည်းနေပြီး ပြန်ကြည့်ပါ။"}, { status: 400 });
  }
  const fallback = localCoachMessage(body);
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!key) return Response.json({ message: fallback });
  try {
    const message = await askGemini(key, body);
    return Response.json({ message: message || fallback });
  } catch {
    return Response.json({ message: fallback });
  }
}
