import { buildCoachSnapshot, type CoachSnapshot } from "@/lib/budget-coach";
import { expensesInMonth, ofType, totalsByCategory } from "@/lib/expenses";
import { formatMoney } from "@/lib/format";
import { fetchRemoteLedger } from "@/lib/ledger-db";
import { isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

function clip(text: string): string {
  const clean = text
    .replace(/[A-Za-z]+/g, "")
    .replace(/[^\u1000-\u109F\uAA60-\uAA7F0-9,.\s။၊!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!/[\u1000-\u109F]/.test(clean)) return "";
  const sentences = clean.split(/(?<=[။!?])/).map((part) => part.trim()).filter(Boolean);
  const short = (sentences.length > 2 ? sentences.slice(0, 2).join(" ") : clean).trim();
  if (short.length <= 280) return short;
  return `${short.slice(0, 277).trim()}…`;
}

function brief(snapshot: CoachSnapshot): string {
  const remaining = snapshot.budget - snapshot.expenses;
  const categories = snapshot.categories.map((row) => `${row.name} ${formatMoney(row.amount)}`).join(", ");
  return [
    `${snapshot.month}, day ${snapshot.day} of ${snapshot.daysInMonth}.`,
    `Total income ${formatMoney(snapshot.income)}.`,
    `Total expenses ${formatMoney(snapshot.expenses)}.`,
    `Remaining budget ${formatMoney(remaining)}. Monthly budget ${formatMoney(snapshot.budget)}.`,
    `Projected spending if this pace continues ${formatMoney(snapshot.projected)}.`,
    categories ? `Recent spending categories: ${categories}.` : "No spending categories yet.",
  ].join(" ");
}

async function askGemini(key: string, snapshot: CoachSnapshot): Promise<string> {
  const model = process.env.GEMINI_COACH_MODEL?.trim() || "gemini-3.5-flash-lite";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "You are Aura, a polite financial coach. Speak like a supportive friend and a calm professional advisor. Write only in respectful, natural Burmese, Myanmar script. Use complete grammatical sentences. Keep polite particles correct and separate. One or two short sentences, and nothing else. Be warm, encouraging, and practical. Never be bossy, sarcastic, teasing, rude, slangy, or playful at their expense. Do not scold, joke, or give orders. If spending is ahead of the budget, gently suggest one calm way to ease the pace. If they are within budget, thank them and encourage them to continue. If income arrived, welcome it kindly. If the month is empty, invite them warmly to add a salary or a receipt. Focus only on helpful financial encouragement. Do not invent shops, items, or numbers. Do not use English words. The only non-Burmese text allowed is a number plus Ks, copied exactly from the summary.",
            },
          ],
        },
        contents: [{ parts: [{ text: brief(snapshot) }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 160 },
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
  const texts = (parts ?? []).map((part) => part.text ?? "").filter((part) => part.trim());
  const text = texts.sort((left, right) => (right.match(/[\u1000-\u109F]/g)?.length ?? 0) - (left.match(/[\u1000-\u109F]/g)?.length ?? 0))[0] ?? "";
  const message = clip(text);
  if (message) return message;
  throw new Error("empty coach reply");
}

async function monthSnapshot(): Promise<CoachSnapshot> {
  const ledger = await fetchRemoteLedger();
  const month = expensesInMonth(ledger.expenses);
  const snapshot = buildCoachSnapshot(month, ledger.budget);
  const categories = totalsByCategory(ofType(month, "expense")).slice(0, 5);
  return {
    ...snapshot,
    categories: categories.map((row) => ({ name: row.category, amount: row.total })),
  };
}

export async function GET() {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!key) {
    return Response.json({ message: "အကြံပေးရန် ချိတ်ဆက်မှု မပြည့်စုံသေးပါ။" }, { status: 503 });
  }
  try {
    const snapshot = isSupabaseConfigured() ? await monthSnapshot() : buildCoachSnapshot([], 0);
    let message = "";
    for (let attempt = 0; attempt < 2 && !message; attempt += 1) {
      try {
        message = await askGemini(key, snapshot);
      } catch {
        message = "";
      }
    }
    if (!message) {
      return Response.json(
        { message: "အခု ခဏအကြံမပေးနိုင်သေးပါ။ ခဏနေပြီး ပြန်ကြည့်ပေးပါ။" },
        { status: 502 },
      );
    }
    return Response.json({ message });
  } catch {
    return Response.json(
      { message: "အခု ခဏအကြံမပေးနိုင်သေးပါ။ ခဏနေပြီး ပြန်ကြည့်ပေးပါ။" },
      { status: 502 },
    );
  }
}
