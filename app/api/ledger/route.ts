import { allowRequest, userFromBearer } from "@/lib/api-guard";
import { CATEGORIES } from "@/types/expense";

export const runtime = "nodejs";

const MAX_ROWS = 100;
const MAX_AMOUNT = 100_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function lineItems(value: unknown) {
  if (!Array.isArray(value) || value.length > 40) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const description = text(item.description, 160);
    const amount = typeof item.amount === "number" ? item.amount : Number(item.amount);
    if (!description || !Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) return [];
    const quantity = typeof item.quantity === "number" && item.quantity > 0 && item.quantity <= 10_000 ? item.quantity : undefined;
    const unitPrice = typeof item.unitPrice === "number" && item.unitPrice >= 0 && item.unitPrice <= MAX_AMOUNT ? item.unitPrice : undefined;
    return [{
      id: text(item.id, 80) ?? crypto.randomUUID(),
      description,
      amount,
      ...(quantity !== undefined ? { quantity } : {}),
      ...(unitPrice !== undefined ? { unitPrice } : {}),
    }];
  });
}

function expenseRow(value: unknown, userId: string) {
  if (!isRecord(value)) return null;
  const id = text(value.id, 80);
  const shop = text(value.shop_name, 160);
  const item = text(value.item_name, 160);
  const category = text(value.category, 40);
  const date = text(value.date, 10);
  const amount = typeof value.amount === "number" ? value.amount : Number(value.amount);
  const created = text(value.created_at, 40);
  const updated = text(value.updated_at, 40);
  if (!id || !UUID.test(id) || !shop || !item || !category || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!(CATEGORIES as readonly string[]).includes(category)) return null;
  if (value.type !== "income" && value.type !== "expense") return null;
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;
  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const notes = typeof metadata.notes === "string" ? metadata.notes.slice(0, 500) : "";
  const receiptName = typeof metadata.receiptName === "string" ? metadata.receiptName.slice(0, 180) : null;
  return {
    id,
    user_id: userId,
    item_name: item,
    shop_name: shop,
    amount,
    category,
    type: value.type,
    date,
    line_items: lineItems(value.line_items),
    metadata: {
      notes,
      currency: "MMK",
      source: metadata.source === "ocr" ? "ocr" : "manual",
      receiptName,
    },
    created_at: created && !Number.isNaN(Date.parse(created)) ? created : new Date().toISOString(),
    updated_at: updated && !Number.isNaN(Date.parse(updated)) ? updated : new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  if (!allowRequest(request, "ledger", 60, 60_000)) {
    return Response.json({ error: "Too many saves. Wait a moment and try again." }, { status: 429 });
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > 512_000) {
    return Response.json({ error: "That update is too large." }, { status: 413 });
  }
  const user = await userFromBearer(request);
  if (!user) {
    return Response.json({ error: "Sign in to open your ledger." }, { status: 401 });
  }
  const payload = (await request.json().catch(() => null)) as { rows?: unknown } | null;
  if (!payload || !Array.isArray(payload.rows) || payload.rows.length === 0 || payload.rows.length > MAX_ROWS) {
    return Response.json({ error: "There is nothing to save." }, { status: 400 });
  }
  const rows = payload.rows.flatMap((row) => {
    const next = expenseRow(row, user.id);
    return next ? [next] : [];
  });
  if (rows.length !== payload.rows.length) {
    return Response.json({ error: "That expense could not be saved." }, { status: 400 });
  }
  const { error } = await user.client.from("expenses").upsert(rows);
  if (error) {
    console.error("[ledger] save failed");
    return Response.json({ error: "The ledger could not be saved." }, { status: 400 });
  }
  return Response.json({ ok: true });
}
