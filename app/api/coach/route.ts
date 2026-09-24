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
  if (clean.length <= 280) return clean;
  return `${clean.slice(0, 277).trim()}…`;
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
              text: "You are Aura, a casual budget coach. Write one or two short sentences. Friendly and playful. No markdown, no lists, no emojis. Repeat amounts exactly as written, including Ks. If dining is the biggest spike, tease it lightly without inventing dishes or restaurants. If the month is empty, invite a salary or a receipt. Do not invent purchases.",
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
    return Response.json({ message: "I need this month’s income and expenses before I can coach." }, { status: 400 });
  }
  const fallback = localCoachMessage(body);
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!key) return Response.json({ message: fallback });
  try {
    const message = await askGemini(key, body);
    return Response.json({ message });
  } catch {
    return Response.json({ message: fallback });
  }
}
