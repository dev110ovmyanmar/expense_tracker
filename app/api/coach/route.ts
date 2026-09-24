import { createClient } from "@supabase/supabase-js";
import { CATEGORY_BURMESE, budgetLevel, budgetPercent, parseCategoryLimits } from "@/lib/budget-status";
import { buildCoachSnapshot, coachInsight, type CoachSnapshot } from "@/lib/budget-coach";
import { expensesInMonth } from "@/lib/expenses";
import type { Expense } from "@/types/expense";
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
  const level = budgetLevel(snapshot.expenses, snapshot.budget);
  const categories = snapshot.categories.map((row) => {
    const burmese = CATEGORY_BURMESE[row.name as keyof typeof CATEGORY_BURMESE] ?? row.name;
    const status = row.limit > 0 ? `${budgetPercent(row.amount, row.limit)}% of its limit, ${budgetLevel(row.amount, row.limit)}` : "no category limit";
    return `${burmese} spent ${formatMoney(row.amount)}${row.limit > 0 ? ` of ${formatMoney(row.limit)}` : ""} (${status})`;
  }).join(". ");
  return [
    `${snapshot.month}, day ${snapshot.day} of ${snapshot.daysInMonth}.`,
    `Total income ${formatMoney(snapshot.income)}.`,
    `Total expenses ${formatMoney(snapshot.expenses)}.`,
    `Net ${formatMoney(snapshot.net)}.`,
    `Monthly budget ${formatMoney(snapshot.budget)}. Remaining ${formatMoney(remaining)}. Used ${budgetPercent(snapshot.expenses, snapshot.budget)}% (${level ?? "no budget"}). Orange starts at 80%. Red starts at 100%.`,
    `Projected spending if this pace continues ${formatMoney(snapshot.projected)}.`,
    categories ? `Categories: ${categories}.` : "No spending categories yet.",
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
              text: "You are Aura, a polite financial coach. Speak like a supportive friend and a calm professional advisor. Write only in respectful, natural Burmese, Myanmar script. Use complete grammatical sentences. Keep polite particles correct and separate. One or two short sentences, and nothing else. Compare this month's spending with income and with the monthly budget and category limits in the summary. If a category or the total is at 80% or more, mention that Burmese category name kindly. If a limit is reached, give one calm way to ease the rest of the month. If they are within budget, thank them and encourage them to continue. If income is below spending, say so gently. If the month is empty, invite them warmly to add a salary or a receipt. Be warm and practical. Never be bossy, sarcastic, teasing, rude, slangy, or playful at their expense. Do not scold, joke, or give orders. Do not invent shops, items, or numbers. Do not use English words. The only non-Burmese text allowed is a number plus Ks, copied exactly from the summary.",
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

async function monthSnapshot(request: Request): Promise<CoachSnapshot> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const client = token && url && key
    ? createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } })
    : undefined;
  const ledger = client ? await fetchRemoteLedger(client) : { expenses: [], budget: 0, categoryLimits: {} };
  const month = expensesInMonth(ledger.expenses);
  return buildCoachSnapshot(month, ledger.budget, new Date(), ledger.categoryLimits);
}

function snapshotFromBody(body: unknown): CoachSnapshot | null {
  if (!body || typeof body !== "object") return null;
  const row = body as { expenses?: unknown; budget?: unknown; categoryLimits?: unknown };
  if (!Array.isArray(row.expenses) || typeof row.budget !== "number") return null;
  const expenses = row.expenses.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as { type?: unknown; amount?: unknown; category?: unknown; date?: unknown };
    if (entry.type !== "income" && entry.type !== "expense") return [];
    if (typeof entry.amount !== "number" || !Number.isFinite(entry.amount) || entry.amount <= 0) return [];
    if (typeof entry.category !== "string" || typeof entry.date !== "string") return [];
    return [{
      id: "coach",
      type: entry.type as Expense["type"],
      amount: entry.amount,
      category: entry.category as Expense["category"],
      date: entry.date,
      vendor: "",
      notes: "",
      currency: "MMK" as const,
      source: "manual" as const,
      lineItems: [],
      createdAt: entry.date,
      updatedAt: entry.date,
    }];
  }).slice(0, 500);
  return buildCoachSnapshot(expenses, row.budget, new Date(), parseCategoryLimits(row.categoryLimits));
}

async function reply(snapshot: CoachSnapshot) {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!key) return Response.json({ message: coachInsight(snapshot) });
  let message = "";
  for (let attempt = 0; attempt < 2 && !message; attempt += 1) {
    try {
      message = await askGemini(key, snapshot);
    } catch {
      message = "";
    }
  }
  return Response.json({ message: message || coachInsight(snapshot) });
}

export async function POST(request: Request) {
  try {
    const snapshot = snapshotFromBody(await request.json().catch(() => null));
    if (!snapshot) return Response.json({ message: coachInsight(buildCoachSnapshot([], 0)) });
    return await reply(snapshot);
  } catch {
    return Response.json({ message: coachInsight(buildCoachSnapshot([], 0)) }, { status: 200 });
  }
}

export async function GET(request: Request) {
  try {
    const snapshot = isSupabaseConfigured() ? await monthSnapshot(request) : buildCoachSnapshot([], 0);
    return await reply(snapshot);
  } catch {
    return Response.json({ message: coachInsight(buildCoachSnapshot([], 0)) });
  }
}
