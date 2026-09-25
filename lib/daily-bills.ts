import { currentUserId, getSupabase } from "@/lib/supabase";
import { EXPENSE_CATEGORIES, type Category } from "@/types/expense";

export interface DailyBill {
  id: string;
  title: string;
  amount: number;
  category: Category;
  date: string;
  expenseId: string | null;
}

const MISSING = "Run supabase/migrations/007_daily_bills.sql in the Supabase SQL editor, then reload.";

function missingTable(message: string): boolean {
  return /daily_bills|schema cache|does not exist/i.test(message);
}

function asCategory(value: string): Category {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value) ? (value as Category) : "Other";
}

export async function fetchDailyBills(): Promise<DailyBill[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("daily_bills")
    .select("id, title, amount, category, date, expense_id")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    if (missingTable(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).flatMap((row) => {
    const amount = typeof row.amount === "number" ? row.amount : Number(row.amount);
    if (!row.id || !row.title || !row.date || !Number.isFinite(amount)) return [];
    return [{
      id: row.id,
      title: row.title,
      amount,
      category: asCategory(String(row.category)),
      date: row.date,
      expenseId: row.expense_id ?? null,
    }];
  });
}

export async function insertDailyBill(bill: DailyBill) {
  const supabase = getSupabase();
  const { error } = await supabase.from("daily_bills").insert({
    id: bill.id,
    user_id: await currentUserId(),
    title: bill.title,
    amount: bill.amount,
    category: bill.category,
    date: bill.date,
    expense_id: bill.expenseId,
  });
  if (error) throw new Error(missingTable(error.message) ? MISSING : error.message);
}
