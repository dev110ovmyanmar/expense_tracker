import { formatMoney, parseMoney, roundMoney } from "@/lib/format";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Expense, ExpenseDraft } from "@/types/expense";

export interface PriceQuote {
  text: string;
  tone: "up" | "down" | "same";
}

interface PriceRow {
  shopName: string;
  itemName: string;
  unitPrice: number;
  date: string;
  expenseId?: string;
}

export function itemKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function priceQuote(current: number, previous: number, previousDate: string, today = new Date()): PriceQuote {
  const delta = roundMoney(current - previous);
  if (Math.abs(delta) < 0.5) return { text: "Same price as last visit", tone: "same" };
  const sign = delta > 0 ? "+" : "−";
  return {
    text: `${sign}${formatMoney(Math.abs(delta))} compared to ${whenPhrase(previousDate, today)}`,
    tone: delta > 0 ? "up" : "down",
  };
}

function whenPhrase(iso: string, today: Date): string {
  const [year, month] = iso.split("-").map(Number);
  if (!year || !month) return "last visit";
  const months = (today.getFullYear() - year) * 12 + (today.getMonth() + 1 - month);
  if (months >= 1) return months === 1 ? "last month" : "an earlier visit";
  return "last visit";
}

function unitPriceOf(item: { amount: number; quantity?: number; unitPrice?: number }): number | null {
  if (typeof item.unitPrice === "number" && item.unitPrice >= 0) return item.unitPrice;
  if (item.quantity && item.quantity > 0 && item.amount >= 0) return roundMoney(item.amount / item.quantity);
  return item.amount > 0 ? item.amount : null;
}

export function rowsFromExpenses(expenses: Expense[]): PriceRow[] {
  return expenses.flatMap((expense) =>
    expense.lineItems.flatMap((item) => {
      const unitPrice = unitPriceOf(item);
      if (!item.description.trim() || unitPrice === null) return [];
      return [{ shopName: expense.vendor, itemName: item.description, unitPrice, date: expense.date, expenseId: expense.id }];
    }),
  );
}

export async function fetchShopPrices(shopName: string): Promise<PriceRow[]> {
  if (!isSupabaseConfigured() || !itemKey(shopName)) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("receipt_items")
    .select("expense_id, shop_name, item_name, unit_price, date")
    .ilike("shop_name", shopName.trim())
    .order("date", { ascending: false });
  if (error || !data) return [];
  return data.flatMap((row) => {
    const unitPrice = typeof row.unit_price === "number" ? row.unit_price : Number(row.unit_price);
    if (!row.item_name || !row.date || !Number.isFinite(unitPrice)) return [];
    return [{
      shopName: String(row.shop_name),
      itemName: String(row.item_name),
      unitPrice,
      date: String(row.date).slice(0, 10),
      expenseId: typeof row.expense_id === "string" ? row.expense_id : undefined,
    }];
  });
}

export async function saveReceiptItems(expense: Expense) {
  if (!isSupabaseConfigured() || expense.source !== "ocr") return;
  const rows = expense.lineItems.flatMap((item) => {
    const unitPrice = unitPriceOf(item);
    if (!item.description.trim() || unitPrice === null) return [];
    return [{
      expense_id: expense.id,
      shop_name: expense.vendor,
      item_name: item.description,
      unit_price: unitPrice,
      date: expense.date,
    }];
  });
  const supabase = getSupabase();
  await supabase.from("receipt_items").delete().eq("expense_id", expense.id);
  if (rows.length === 0) return;
  const { error } = await supabase.from("receipt_items").insert(rows);
  if (error && !/receipt_items|schema cache|does not exist/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export async function quotesForDraft(draft: ExpenseDraft, history: Expense[]): Promise<Record<string, PriceQuote>> {
  const shop = itemKey(draft.vendor);
  if (!shop) return {};
  const remote = await fetchShopPrices(draft.vendor);
  const rows = [...remote, ...rowsFromExpenses(history)].filter((row) => itemKey(row.shopName) === shop);
  const quotes: Record<string, PriceQuote> = {};
  for (const line of draft.lineItems) {
    const name = itemKey(line.description);
    const amount = parseMoney(line.amount) ?? 0;
    const quantity = parseMoney(line.quantity);
    const typedUnit = parseMoney(line.unitPrice);
    const current = unitPriceOf({
      amount,
      ...(quantity !== null && quantity > 0 ? { quantity } : {}),
      ...(typedUnit !== null ? { unitPrice: typedUnit } : {}),
    });
    if (!name || current === null) continue;
    const prior = rows
      .filter((row) => itemKey(row.itemName) === name && row.date <= draft.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!prior) continue;
    quotes[line.id] = priceQuote(current, prior.unitPrice, prior.date);
  }
  return quotes;
}
