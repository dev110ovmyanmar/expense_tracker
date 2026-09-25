import { currentUserId, getSupabase } from "@/lib/supabase";
import { CATEGORIES, type Category } from "@/types/expense";
import type { Frequency, RecurringInput, RecurringItem, SavingsGoal, SavingsGoalInput } from "@/types/planning";

const MISSING_TABLE =
  "Run supabase/migrations/004_recurring_and_goals.sql in the Supabase SQL editor, then reload.";

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

function money(value: number | string): number {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function missingTable(message: string): boolean {
  return /recurring_items|savings_goals|schema cache|does not exist/i.test(message);
}

interface RecurringRow {
  id: string;
  name: string;
  amount: number | string;
  category: string;
  type: string;
  frequency: string;
  next_due: string;
  auto_log: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface GoalRow {
  id: string;
  name: string;
  target_amount: number | string;
  target_date: string | null;
  monthly_allocation: number | string;
  saved_amount: number | string;
  last_allocated: string | null;
  created_at: string;
  updated_at: string;
}

function rowToRecurring(row: RecurringRow): RecurringItem | null {
  if (!isCategory(row.category)) return null;
  if (row.frequency !== "daily" && row.frequency !== "weekly" && row.frequency !== "monthly") return null;
  const amount = money(row.amount);
  if (!row.name || amount <= 0) return null;
  return {
    id: row.id,
    name: row.name,
    amount,
    category: row.category,
    type: row.type === "income" ? "income" : "expense",
    frequency: row.frequency,
    nextDue: row.next_due.slice(0, 10),
    autoLog: Boolean(row.auto_log),
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToGoal(row: GoalRow): SavingsGoal | null {
  const target = money(row.target_amount);
  if (!row.name || target <= 0) return null;
  return {
    id: row.id,
    name: row.name,
    targetAmount: target,
    targetDate: row.target_date ? row.target_date.slice(0, 10) : null,
    monthlyAllocation: Math.max(0, money(row.monthly_allocation)),
    savedAmount: Math.max(0, money(row.saved_amount)),
    lastAllocated: row.last_allocated,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchPlanning(): Promise<{
  recurring: RecurringItem[];
  goals: SavingsGoal[];
  message: string | null;
}> {
  const supabase = getSupabase();
  const [recurringResult, goalsResult] = await Promise.all([
    supabase.from("recurring_items").select("*").order("next_due", { ascending: true }),
    supabase.from("savings_goals").select("*").order("created_at", { ascending: true }),
  ]);
  const recurringError = recurringResult.error?.message ?? "";
  const goalsError = goalsResult.error?.message ?? "";
  if ((recurringResult.error && missingTable(recurringError)) || (goalsResult.error && missingTable(goalsError))) {
    return { recurring: [], goals: [], message: MISSING_TABLE };
  }
  if (recurringResult.error) throw new Error(recurringError);
  if (goalsResult.error) throw new Error(goalsError);
  return {
    recurring: ((recurringResult.data ?? []) as RecurringRow[]).flatMap((row) => {
      const item = rowToRecurring(row);
      return item ? [item] : [];
    }),
    goals: ((goalsResult.data ?? []) as GoalRow[]).flatMap((row) => {
      const goal = rowToGoal(row);
      return goal ? [goal] : [];
    }),
    message: null,
  };
}

async function recurringRow(item: RecurringItem) {
  return {
    id: item.id,
    user_id: await currentUserId(),
    name: item.name,
    amount: item.amount,
    category: item.category,
    type: item.type,
    frequency: item.frequency satisfies Frequency,
    next_due: item.nextDue,
    auto_log: item.autoLog,
    active: item.active,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export async function saveRecurring(item: RecurringItem) {
  const supabase = getSupabase();
  const { error } = await supabase.from("recurring_items").upsert(await recurringRow(item));
  if (error) throw new Error(missingTable(error.message) ? MISSING_TABLE : error.message);
}

export async function deleteRecurring(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("recurring_items").delete().eq("id", id);
  if (error) throw new Error(missingTable(error.message) ? MISSING_TABLE : error.message);
}

export function recurringFromInput(id: string, input: RecurringInput, createdAt: string, updatedAt: string): RecurringItem {
  return { id, ...input, createdAt, updatedAt };
}

async function goalRow(goal: SavingsGoal) {
  return {
    id: goal.id,
    user_id: await currentUserId(),
    name: goal.name,
    target_amount: goal.targetAmount,
    target_date: goal.targetDate,
    monthly_allocation: goal.monthlyAllocation,
    saved_amount: goal.savedAmount,
    last_allocated: goal.lastAllocated,
    created_at: goal.createdAt,
    updated_at: goal.updatedAt,
  };
}

export async function saveGoal(goal: SavingsGoal) {
  const supabase = getSupabase();
  const { error } = await supabase.from("savings_goals").upsert(await goalRow(goal));
  if (error) throw new Error(missingTable(error.message) ? MISSING_TABLE : error.message);
}

export async function deleteGoal(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("savings_goals").delete().eq("id", id);
  if (error) throw new Error(missingTable(error.message) ? MISSING_TABLE : error.message);
}

export interface UserSettings {
  dailyReminder: boolean;
  lastReminded: string | null;
}

export async function fetchSettings(): Promise<UserSettings> {
  const supabase = getSupabase();
  let userId: string;
  try {
    userId = await currentUserId();
  } catch {
    return { dailyReminder: false, lastReminded: null };
  }
  const { data, error } = await supabase.from("user_settings").select("daily_reminder, last_reminded").eq("user_id", userId).maybeSingle();
  if (error) {
    if (/user_settings|schema cache|does not exist/i.test(error.message)) return { dailyReminder: false, lastReminded: null };
    throw new Error(error.message);
  }
  return {
    dailyReminder: Boolean(data?.daily_reminder),
    lastReminded: data?.last_reminded ? String(data.last_reminded).slice(0, 10) : null,
  };
}

export async function saveSettings(settings: UserSettings) {
  const supabase = getSupabase();
  const { error } = await supabase.from("user_settings").upsert({
    user_id: await currentUserId(),
    daily_reminder: settings.dailyReminder,
    last_reminded: settings.lastReminded,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(/user_settings|schema cache|does not exist/i.test(error.message) ? "Run supabase/migrations/005_user_auth.sql, then try the reminder again." : error.message);
}

export function goalFromInput(id: string, input: SavingsGoalInput, createdAt: string, updatedAt: string, lastAllocated: string | null): SavingsGoal {
  return { id, ...input, lastAllocated, createdAt, updatedAt };
}
