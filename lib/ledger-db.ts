import { saveReceiptItems } from "@/lib/price-intel";
import { DEFAULT_BUDGET } from "@/lib/seed";
import { getSupabase, ledgerOwnerId } from "@/lib/supabase";
import { parseCategoryLimits, type CategoryLimits } from "@/lib/budget-status";
import { CATEGORIES, DEFAULT_CURRENCY, type Category, type Expense, type ExpenseSource, type LineItem } from "@/types/expense";

export interface RemoteLedger {
  expenses: Expense[];
  budget: number;
  categoryLimits: CategoryLimits;
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

const OWN_LEDGER =
  "Run supabase/migrations/011_own_ledger.sql in the Supabase SQL editor, then reload.";
const LIMITS_MISSING =
  "Run supabase/migrations/006_category_budgets.sql in the Supabase SQL editor, then reload.";

function friendlyError(message: string): string {
  if (/category_limits/i.test(message)) return LIMITS_MISSING;
  if (/anonymous sign-ins are disabled/i.test(message)) return "Sign in to open your ledger.";
  if (/violates foreign key/i.test(message)) return OWN_LEDGER;
  if (/row-level security|permission denied/i.test(message)) return OWN_LEDGER;
  return message;
}

function expenseToRow(expense: Expense, userId: string) {
  const itemName = expense.lineItems[0]?.description || expense.vendor;
  return {
    id: expense.id,
    user_id: userId,
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

export async function fetchRemoteLedger(supabase = getSupabase()): Promise<RemoteLedger> {
  const userId = ledgerOwnerId();
  const [expensesResult, budgetResult] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("budgets").select("amount, category_limits").eq("user_id", userId).maybeSingle(),
  ]);
  if (expensesResult.error) throw new Error(friendlyError(expensesResult.error.message));
  if (budgetResult.error && /category_limits/i.test(budgetResult.error.message)) {
    const plain = await supabase.from("budgets").select("amount").eq("user_id", userId).maybeSingle();
    if (plain.error) throw new Error(friendlyError(plain.error.message));
    const budgetValue = plain.data?.amount;
    const budget = typeof budgetValue === "number" ? budgetValue : Number(budgetValue ?? DEFAULT_BUDGET);
    const expenses = ((expensesResult.data ?? []) as ExpenseRow[]).flatMap((row) => {
      const expense = rowToExpense(row);
      return expense ? [expense] : [];
    });
    return { expenses, budget: Number.isFinite(budget) ? budget : DEFAULT_BUDGET, categoryLimits: {} };
  }
  if (budgetResult.error) throw new Error(friendlyError(budgetResult.error.message));
  const expenses = ((expensesResult.data ?? []) as ExpenseRow[]).flatMap((row) => {
    const expense = rowToExpense(row);
    return expense ? [expense] : [];
  });
  const budgetValue = budgetResult.data?.amount;
  const budget = typeof budgetValue === "number" ? budgetValue : Number(budgetValue ?? DEFAULT_BUDGET);
  return {
    expenses,
    budget: Number.isFinite(budget) ? budget : DEFAULT_BUDGET,
    categoryLimits: parseCategoryLimits(budgetResult.data?.category_limits),
  };
}

function networkFailure(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof Error && /load failed|failed to fetch|network/i.test(error.message));
}

export async function upsertExpenses(expenses: Expense[]) {
  if (expenses.length === 0) return;
  const supabase = getSupabase();
  const rows = expenses.map((expense) => expenseToRow(expense, ledgerOwnerId()));
  try {
    const { error } = await supabase.from("expenses").upsert(rows);
    if (error) throw new Error(friendlyError(error.message));
  } catch (error) {
    if (!networkFailure(error)) throw error instanceof Error ? error : new Error("The expense could not be saved.");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sign in to open your ledger.");
    const response = await fetch("/api/ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rows }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) throw new Error(friendlyError(body?.error || "The ledger could not reach Supabase. Check the connection and try again."));
  }
  for (const expense of expenses) {
    if (expense.source === "ocr") await saveReceiptItems(expense);
  }
}

export async function deleteRemoteExpense(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("expenses").delete().eq("id", id).eq("user_id", ledgerOwnerId());
  if (error) throw new Error(friendlyError(error.message));
}

function optionalTable(message: string): boolean {
  return /schema cache|does not exist|could not find the table|PGRST205/i.test(message);
}

async function deleteOwned(table: "daily_bills" | "recurring_items" | "savings_goals" | "expenses", userId: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from(table).delete().eq("user_id", userId);
  if (!error) return;
  if (table !== "expenses" && optionalTable(error.message)) return;
  throw new Error(friendlyError(error.message));
}

export async function clearRemoteLedger() {
  const supabase = getSupabase();
  const userId = ledgerOwnerId();
  const listed = await supabase.from("expenses").select("id").eq("user_id", userId);
  if (listed.error) throw new Error(friendlyError(listed.error.message));
  const expenseIds = (listed.data ?? []).map((row) => row.id).filter((id): id is string => typeof id === "string");
  for (let index = 0; index < expenseIds.length; index += 100) {
    const chunk = expenseIds.slice(index, index + 100);
    const removed = await supabase.from("receipt_items").delete().in("expense_id", chunk).eq("user_id", userId);
    if (removed.error && !optionalTable(removed.error.message)) throw new Error(friendlyError(removed.error.message));
  }
  await deleteOwned("daily_bills", userId);
  await deleteOwned("recurring_items", userId);
  await deleteOwned("savings_goals", userId);
  await deleteOwned("expenses", userId);
  try {
    await saveRemoteBudget(DEFAULT_BUDGET, {});
  } catch (error) {
    if (!(error instanceof Error) || !/category_limits/i.test(error.message)) throw error;
    const { error: budgetError } = await getSupabase().from("budgets").upsert({
      user_id: userId,
      amount: DEFAULT_BUDGET,
      updated_at: new Date().toISOString(),
    });
    if (budgetError) throw new Error(friendlyError(budgetError.message));
  }
}

export async function saveRemoteBudget(amount: number, categoryLimits: CategoryLimits = {}) {
  const supabase = getSupabase();
  const { error } = await supabase.from("budgets").upsert({
    user_id: ledgerOwnerId(),
    amount,
    category_limits: categoryLimits,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(friendlyError(error.message));
}

