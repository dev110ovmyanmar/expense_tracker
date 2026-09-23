import { DEFAULT_BUDGET } from "@/lib/seed";
import { CATEGORIES, DEFAULT_CURRENCY, type Category, type Expense, type ExpenseSource, type LineItem } from "@/types/expense";

export const STORAGE_KEY = "folio.ledger.v2";

export interface PersistedLedger {
  expenses: Expense[];
  budget: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

function isSource(value: unknown): value is ExpenseSource {
  return value === "manual" || value === "ocr";
}

function sanitizeLineItems(value: unknown, expenseId: string): LineItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const description = typeof item.description === "string" ? item.description.trim() : "";
    const amount = typeof item.amount === "number" ? item.amount : Number.NaN;
    if (!description || !Number.isFinite(amount) || amount < 0) return [];
    const id = typeof item.id === "string" && item.id ? item.id : `${expenseId}-line-${index + 1}`;
    return [{ id, description, amount: Math.round(amount * 100) / 100 }];
  });
}

function sanitizeExpense(value: unknown): Expense | null {
  if (!isRecord(value)) return null;
  const vendor = typeof value.vendor === "string" ? value.vendor.trim() : "";
  const amount = typeof value.amount === "number" ? value.amount : Number.NaN;
  const date = typeof value.date === "string" ? value.date : "";
  if (!vendor || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  if (!isCategory(value.category)) return null;
  const id =
    typeof value.id === "string" && value.id
      ? value.id
      : `expense-${date}-${vendor.toLowerCase().replace(/\s+/g, "-")}`;
  const tax = typeof value.tax === "number" && Number.isFinite(value.tax) ? Math.max(0, value.tax) : 0;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString();
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;
  return {
    id,
    vendor,
    amount: Math.round(amount * 100) / 100,
    tax: Math.min(Math.round(tax * 100) / 100, Math.round(amount * 100) / 100),
    currency: DEFAULT_CURRENCY,
    category: value.category,
    date,
    notes: typeof value.notes === "string" ? value.notes.slice(0, 400) : "",
    source: isSource(value.source) ? value.source : "manual",
    receiptName: typeof value.receiptName === "string" ? value.receiptName : undefined,
    lineItems: sanitizeLineItems(value.lineItems, id),
    createdAt,
    updatedAt,
  };
}

export function readLedger(): PersistedLedger | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.expenses)) {
      return { expenses: [], budget: DEFAULT_BUDGET };
    }
    const budget =
      typeof parsed.budget === "number" && Number.isFinite(parsed.budget)
        ? Math.max(0, parsed.budget)
        : DEFAULT_BUDGET;
    return {
      expenses: parsed.expenses.flatMap((expense) => {
        const clean = sanitizeExpense(expense);
        return clean ? [clean] : [];
      }),
      budget,
    };
  } catch {
    return { expenses: [], budget: DEFAULT_BUDGET };
  }
}

export function writeLedger(ledger: PersistedLedger): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
    return true;
  } catch {
    return false;
  }
}
