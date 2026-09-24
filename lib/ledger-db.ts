import { saveReceiptItems } from "@/lib/price-intel";
import { DEFAULT_BUDGET } from "@/lib/seed";
import { getSupabase } from "@/lib/supabase";
import { CATEGORIES, DEFAULT_CURRENCY, type Category, type Expense, type ExpenseSource, type LineItem } from "@/types/expense";

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
    type: row.type === "income" ? "income" : "expense",
    source,
    receiptName: typeof metadata.receiptName === "string" ? metadata.receiptName : undefined,
    lineItems: lineItemsFrom(row.line_items, row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const LEDGER_ID = "00000000-0000-0000-0000-000000000001";

const LOCKED =
  "Run supabase/migrations/002_public_ledger.sql in the Supabase SQL editor, then reload. Anonymous sign-in is not used.";

function friendlyError(message: string): string {
  if (/anonymous sign-ins are disabled/i.test(message)) return LOCKED;
  if (/row-level security|permission denied|violates foreign key/i.test(message)) return LOCKED;
  return message;
}

function expenseToRow(expense: Expense) {
  const itemName = expense.lineItems[0]?.description || expense.vendor;
  return {
    id: expense.id,
    user_id: LEDGER_ID,
    item_name: itemName,
    shop_name: expense.vendor,
    amount: expense.amount,
    category: expense.category,
    type: expense.type,
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

export async function fetchRemoteLedger(): Promise<RemoteLedger> {
  const supabase = getSupabase();
  const [expensesResult, budgetResult] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("budgets").select("amount").eq("user_id", LEDGER_ID).maybeSingle(),
  ]);
  if (expensesResult.error) throw new Error(friendlyError(expensesResult.error.message));
  if (budgetResult.error) throw new Error(friendlyError(budgetResult.error.message));
  const expenses = ((expensesResult.data ?? []) as ExpenseRow[]).flatMap((row) => {
    const expense = rowToExpense(row);
    return expense ? [expense] : [];
  });
  const budgetValue = budgetResult.data?.amount;
  const budget = typeof budgetValue === "number" ? budgetValue : Number(budgetValue ?? DEFAULT_BUDGET);
  return { expenses, budget: Number.isFinite(budget) ? budget : DEFAULT_BUDGET };
}

export async function upsertExpenses(expenses: Expense[]) {
  if (expenses.length === 0) return;
  const supabase = getSupabase();
  const { error } = await supabase.from("expenses").upsert(expenses.map((expense) => expenseToRow(expense)));
  if (error) throw new Error(friendlyError(error.message));
  for (const expense of expenses) {
    if (expense.source === "ocr") await saveReceiptItems(expense);
  }
}

export async function deleteRemoteExpense(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw new Error(friendlyError(error.message));
}

export async function saveRemoteBudget(amount: number) {
  const supabase = getSupabase();
  const { error } = await supabase.from("budgets").upsert({
    user_id: LEDGER_ID,
    amount,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(friendlyError(error.message));
}

