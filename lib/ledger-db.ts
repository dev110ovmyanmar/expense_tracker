import { DEFAULT_BUDGET } from "@/lib/seed";
import { readLedger } from "@/lib/storage";
import { getSupabase } from "@/lib/supabase";
import { CATEGORIES, DEFAULT_CURRENCY, type Category, type Expense, type ExpenseSource, type LineItem } from "@/types/expense";

const MIGRATED_KEY = "aura.ledger.migrated";

export interface RemoteLedger {
  expenses: Expense[];
  budget: number;
}

interface ExpenseRow {
  id: string;
  item_name: string;
  shop_name: string;
  amount: number | string;
  category: string;
  type: string;
  date: string;
  line_items: unknown;
  metadata: unknown;
  created_at: string;
  updated_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

function lineItemsFrom(value: unknown, expenseId: string): LineItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const description = typeof item.description === "string" ? item.description.trim() : "";
    const amount = typeof item.amount === "number" ? item.amount : Number(item.amount);
    if (!description || !Number.isFinite(amount) || amount < 0) return [];
    const quantity = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : undefined;
    const unitPrice = typeof item.unitPrice === "number" && item.unitPrice >= 0 ? item.unitPrice : undefined;
    return [
      {
        id: typeof item.id === "string" && item.id ? item.id : `${expenseId}-line-${index + 1}`,
        description,
        amount,
        ...(quantity !== undefined ? { quantity } : {}),
        ...(unitPrice !== undefined ? { unitPrice } : {}),
      },
    ];
  });
}

function rowToExpense(row: ExpenseRow): Expense | null {
  if (!isCategory(row.category)) return null;
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const source: ExpenseSource = metadata.source === "ocr" ? "ocr" : "manual";
  const amount = typeof row.amount === "number" ? row.amount : Number(row.amount);
  if (!row.shop_name || !Number.isFinite(amount) || amount <= 0) return null;
  return {
    id: row.id,
    vendor: row.shop_name,
    amount,
    currency: DEFAULT_CURRENCY,
    category: row.category,
    date: row.date.slice(0, 10),
    notes: typeof metadata.notes === "string" ? metadata.notes : "",
    source,
    receiptName: typeof metadata.receiptName === "string" ? metadata.receiptName : undefined,
    lineItems: lineItemsFrom(row.line_items, row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function expenseToRow(userId: string, expense: Expense) {
  const itemName = expense.lineItems[0]?.description || expense.vendor;
  return {
    id: expense.id,
    user_id: userId,
    item_name: itemName,
    shop_name: expense.vendor,
    amount: expense.amount,
    category: expense.category,
    type: "expense",
    date: expense.date,
    line_items: expense.lineItems,
    metadata: {
      notes: expense.notes,
      currency: expense.currency,
      source: expense.source,
      receiptName: expense.receiptName ?? null,
    },
    created_at: expense.createdAt,
    updated_at: expense.updatedAt,
  };
}

export async function ensureUserId(): Promise<string> {
  const supabase = getSupabase();
  const existing = await supabase.auth.getSession();
  if (existing.data.session?.user.id) return existing.data.session.user.id;
  const created = await supabase.auth.signInAnonymously();
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message || "Turn on anonymous sign-in in Supabase Authentication.");
  }
  return created.data.user.id;
}

export async function fetchRemoteLedger(userId: string): Promise<RemoteLedger> {
  const supabase = getSupabase();
  const [expensesResult, budgetResult] = await Promise.all([
    supabase.from("expenses").select("*").eq("user_id", userId).order("date", { ascending: false }),
    supabase.from("budgets").select("amount").eq("user_id", userId).maybeSingle(),
  ]);
  if (expensesResult.error) throw new Error(expensesResult.error.message);
  if (budgetResult.error) throw new Error(budgetResult.error.message);
  const expenses = ((expensesResult.data ?? []) as ExpenseRow[]).flatMap((row) => {
    const expense = rowToExpense(row);
    return expense ? [expense] : [];
  });
  const budgetValue = budgetResult.data?.amount;
  const budget = typeof budgetValue === "number" ? budgetValue : Number(budgetValue ?? DEFAULT_BUDGET);
  return { expenses, budget: Number.isFinite(budget) ? budget : DEFAULT_BUDGET };
}

export async function upsertExpenses(userId: string, expenses: Expense[]) {
  if (expenses.length === 0) return;
  const supabase = getSupabase();
  const { error } = await supabase.from("expenses").upsert(expenses.map((expense) => expenseToRow(userId, expense)));
  if (error) throw new Error(error.message);
}

export async function deleteRemoteExpense(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function saveRemoteBudget(userId: string, amount: number) {
  const supabase = getSupabase();
  const { error } = await supabase.from("budgets").upsert({
    user_id: userId,
    amount,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function migrateLocalLedger(userId: string, remote: RemoteLedger): Promise<RemoteLedger> {
  if (typeof window === "undefined" || window.localStorage.getItem(MIGRATED_KEY)) return remote;
  const local = readLedger();
  if (!local || (local.expenses.length === 0 && remote.expenses.length > 0)) {
    window.localStorage.setItem(MIGRATED_KEY, "1");
    return remote;
  }
  if (remote.expenses.length > 0) {
    window.localStorage.setItem(MIGRATED_KEY, "1");
    return remote;
  }
  const expenses = local.expenses.map((expense) => ({
    ...expense,
    id: crypto.randomUUID(),
  }));
  await upsertExpenses(userId, expenses);
  await saveRemoteBudget(userId, local.budget);
  window.localStorage.setItem(MIGRATED_KEY, "1");
  return { expenses, budget: local.budget };
}
