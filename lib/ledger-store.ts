import { isExpenseCategory, type CategoryLimits } from "@/lib/budget-status";
import { insertDailyBill, fetchDailyBills, type DailyBill } from "@/lib/daily-bills";
import { todayISO } from "@/lib/format";
import {
  clearRemoteLedger,
  deleteRemoteExpense,
  fetchRemoteLedger,
  saveRemoteBudget,
  upsertExpenses,
} from "@/lib/ledger-db";
import { deleteGoal, deleteRecurring, fetchPlanning, fetchSettings, goalFromInput, recurringFromInput, saveGoal, saveRecurring, saveSettings } from "@/lib/planning-db";
import { advanceDate, scheduleCatchUp } from "@/lib/recurring";
import { DEFAULT_BUDGET } from "@/lib/seed";
import { getSupabase, isSupabaseConfigured, ledgerOwnerId } from "@/lib/supabase";
import type { Category, Expense, ExpenseInput } from "@/types/expense";
import { DEFAULT_CURRENCY } from "@/types/expense";
import type { RecurringInput, RecurringItem, SavingsGoal, SavingsGoalInput } from "@/types/planning";

export interface LedgerSnapshot {
  expenses: Expense[];
  budget: number;
  categoryLimits: CategoryLimits;
  recurring: RecurringItem[];
  goals: SavingsGoal[];
  dailyBills: DailyBill[];
  planningMessage: string | null;
  userEmail: string | null;
  userName: string | null;
  dailyReminder: boolean;
  lastReminded: string | null;
  ready: boolean;
  saving: boolean;
  storageWarning: boolean;
  storageMessage: string | null;
}

const SERVER_SNAPSHOT: LedgerSnapshot = {
  expenses: [],
  budget: DEFAULT_BUDGET,
  categoryLimits: {},
  recurring: [],
  goals: [],
  dailyBills: [],
  planningMessage: null,
  userEmail: null,
  userName: null,
  dailyReminder: false,
  lastReminded: null,
  ready: false,
  saving: false,
  storageWarning: false,
  storageMessage: null,
};

const MISSING =
  "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then run supabase/migrations/001_expenses.sql.";

let snapshot: LedgerSnapshot = SERVER_SNAPSHOT;
let started = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function publish(next: LedgerSnapshot) {
  snapshot = next;
  notify();
}

function sortExpenses(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function displayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  for (const key of ["full_name", "user_name", "display_name", "name"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return user.email?.split("@")[0]?.trim() || null;
}

function fail(message: string) {
  publish({ ...snapshot, ready: true, saving: false, storageWarning: true, storageMessage: message });
}

async function load(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  if (!isSupabaseConfigured()) {
    fail(MISSING);
    return;
  }
  const userName = displayName(user);
  try {
    const [ledger, planning, settings, dailyBills] = await Promise.all([
      fetchRemoteLedger(),
      fetchPlanning(),
      fetchSettings(),
      fetchDailyBills(),
    ]);
    const logged = planning.message ? { expenses: [], recurring: planning.recurring } : await applyAutoLog(planning.recurring);
    publish({
      expenses: sortExpenses([...logged.expenses, ...ledger.expenses]),
      budget: ledger.budget,
      categoryLimits: ledger.categoryLimits,
      recurring: logged.recurring,
      goals: planning.goals,
      dailyBills,
      planningMessage: planning.message,
      userEmail: user.email ?? null,
      userName,
      dailyReminder: settings.dailyReminder,
      lastReminded: settings.lastReminded,
      ready: true,
      saving: false,
      storageWarning: false,
      storageMessage: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The ledger could not be loaded.";
    publish({
      ...snapshot,
      ready: true,
      saving: false,
      storageWarning: true,
      storageMessage: message,
      userEmail: user.email ?? null,
      userName,
    });
  }
}

export function syncLedgerSession(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  if (!isSupabaseConfigured()) return;
  if (!user) {
    publish({ ...SERVER_SNAPSHOT, ready: true });
    return;
  }
  void load(user);
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!isSupabaseConfigured()) fail(MISSING);
}

function requireReady() {
  if (!isSupabaseConfigured()) throw new Error(MISSING);
  if (!snapshot.ready) throw new Error(snapshot.storageMessage || "The ledger is still loading.");
}

export function subscribeLedger(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
  };
}

export function getLedgerSnapshot(): LedgerSnapshot {
  return snapshot;
}

export function getServerLedgerSnapshot(): LedgerSnapshot {
  return SERVER_SNAPSHOT;
}

async function commitChange(next: LedgerSnapshot, work: () => Promise<void>, fallback: string) {
  requireReady();
  const previous = snapshot;
  publish({ ...next, saving: true, storageWarning: false, storageMessage: null });
  try {
    await work();
    publish({ ...snapshot, saving: false, storageWarning: false, storageMessage: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : fallback;
    publish({ ...previous, saving: false, storageWarning: true, storageMessage: message });
    throw new Error(message);
  }
}

export async function addExpense(input: ExpenseInput): Promise<Expense> {
  const now = new Date().toISOString();
  const expense: Expense = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  await commitChange(
    { ...snapshot, expenses: sortExpenses([expense, ...snapshot.expenses]) },
    () => upsertExpenses([expense]),
    "The expense could not be saved.",
  );
  return expense;
}

export async function updateExpense(id: string, input: ExpenseInput) {
  const current = snapshot.expenses.find((expense) => expense.id === id);
  if (!current) throw new Error("That expense is no longer in the ledger.");
  const updated: Expense = { ...current, ...input, updatedAt: new Date().toISOString() };
  await commitChange(
    {
      ...snapshot,
      expenses: sortExpenses(snapshot.expenses.map((expense) => (expense.id === id ? updated : expense))),
    },
    () => upsertExpenses([updated]),
    "The expense could not be updated.",
  );
}

export async function deleteExpense(id: string) {
  await commitChange(
    { ...snapshot, expenses: snapshot.expenses.filter((expense) => expense.id !== id) },
    () => deleteRemoteExpense(id),
    "The expense could not be deleted.",
  );
}

export async function setBudget(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) return;
  const budget = Math.round(amount * 100) / 100;
  const limits = snapshot.categoryLimits;
  await commitChange({ ...snapshot, budget }, () => saveRemoteBudget(budget, limits), "The budget could not be saved.");
}

export async function setCategoryLimit(category: Category, amount: number) {
  if (!isExpenseCategory(category)) return;
  const categoryLimits = { ...snapshot.categoryLimits };
  if (!Number.isFinite(amount) || amount <= 0) delete categoryLimits[category];
  else categoryLimits[category] = Math.round(amount * 100) / 100;
  const budget = snapshot.budget;
  await commitChange(
    { ...snapshot, categoryLimits },
    () => saveRemoteBudget(budget, categoryLimits),
    "The category limit could not be saved.",
  );
}

export async function addDailyBill(input: { title: string; amount: number; category: Category; date: string; autoDaily?: boolean }) {
  const title = input.title.trim();
  const amount = Math.round(input.amount * 100) / 100;
  if (!title) throw new Error("Add a name for the bill.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount has to be a number above zero.");
  requireReady();
  const now = new Date().toISOString();
  const expenseId = crypto.randomUUID();
  const expense: Expense = {
    id: expenseId,
    type: "expense",
    vendor: title,
    amount,
    currency: DEFAULT_CURRENCY,
    category: input.category,
    date: input.date,
    notes: "Daily bill",
    source: "manual",
    lineItems: [],
    createdAt: now,
    updatedAt: now,
  };
  const bill: DailyBill = {
    id: crypto.randomUUID(),
    title,
    amount,
    category: input.category,
    date: input.date,
    expenseId,
  };
  const recurring = input.autoDaily
    ? recurringFromInput(crypto.randomUUID(), {
        name: title,
        amount,
        category: input.category,
        type: "expense",
        frequency: "daily",
        nextDue: advanceDate(input.date, "daily"),
        autoLog: true,
        active: true,
      }, now, now)
    : null;
  await commitChange(
    {
      ...snapshot,
      expenses: sortExpenses([expense, ...snapshot.expenses]),
      dailyBills: [bill, ...snapshot.dailyBills],
      recurring: recurring
        ? [...snapshot.recurring, recurring].sort((a, b) => a.nextDue.localeCompare(b.nextDue))
        : snapshot.recurring,
    },
    async () => {
      await upsertExpenses([expense]);
      await insertDailyBill(bill);
      if (recurring) await saveRecurring(recurring);
    },
    "The bill could not be saved.",
  );
}

function chargesFor(item: RecurringItem, dates: string[]): Expense[] {
  const now = new Date().toISOString();
  return dates.map((date) => ({
    id: crypto.randomUUID(),
    type: item.type,
    vendor: item.name,
    amount: item.amount,
    currency: DEFAULT_CURRENCY,
    category: item.category,
    date,
    notes: item.frequency === "daily" ? "Daily recurring" : item.frequency === "weekly" ? "Weekly recurring" : "Monthly recurring",
    source: "manual" as const,
    lineItems: [],
    createdAt: now,
    updatedAt: now,
  }));
}

async function applyAutoLog(items: RecurringItem[]) {
  const today = todayISO();
  const created: Expense[] = [];
  const recurring: RecurringItem[] = [];
  for (const item of items) {
    const due = item.active && item.autoLog ? scheduleCatchUp(item.nextDue, item.frequency, today) : { dates: [], nextDue: item.nextDue };
    if (due.dates.length === 0) {
      recurring.push(item);
      continue;
    }
    const expenses = chargesFor(item, due.dates);
    const updated = { ...item, nextDue: due.nextDue, updatedAt: new Date().toISOString() };
    try {
      await upsertExpenses(expenses);
      await saveRecurring(updated);
      created.push(...expenses);
      recurring.push(updated);
    } catch {
      recurring.push(item);
    }
  }
  return { expenses: created, recurring };
}

export async function addRecurring(input: RecurringInput) {
  const now = new Date().toISOString();
  const item = recurringFromInput(crypto.randomUUID(), input, now, now);
  await commitChange(
    {
      ...snapshot,
      recurring: [...snapshot.recurring, item].sort((a, b) => a.nextDue.localeCompare(b.nextDue)),
    },
    () => saveRecurring(item),
    "The bill could not be saved.",
  );
  return item;
}

export async function updateRecurring(id: string, input: RecurringInput) {
  const current = snapshot.recurring.find((item) => item.id === id);
  if (!current) throw new Error("That bill is no longer on the schedule.");
  const updated = { ...current, ...input, updatedAt: new Date().toISOString() };
  await commitChange(
    {
      ...snapshot,
      recurring: snapshot.recurring
        .map((item) => (item.id === id ? updated : item))
        .sort((a, b) => a.nextDue.localeCompare(b.nextDue)),
    },
    () => saveRecurring(updated),
    "The bill could not be updated.",
  );
}

export async function removeRecurring(id: string) {
  await commitChange(
    { ...snapshot, recurring: snapshot.recurring.filter((item) => item.id !== id) },
    () => deleteRecurring(id),
    "The bill could not be removed.",
  );
}

export async function logRecurring(id: string) {
  const item = snapshot.recurring.find((entry) => entry.id === id);
  if (!item || !item.active) return;
  const due = scheduleCatchUp(item.nextDue, item.frequency, todayISO());
  if (due.dates.length === 0) return;
  const expenses = chargesFor(item, due.dates);
  const updated = { ...item, nextDue: due.nextDue, updatedAt: new Date().toISOString() };
  await commitChange(
    {
      ...snapshot,
      expenses: sortExpenses([...expenses, ...snapshot.expenses]),
      recurring: snapshot.recurring.map((entry) => (entry.id === id ? updated : entry)),
    },
    async () => {
      await upsertExpenses(expenses);
      await saveRecurring(updated);
    },
    "The bill could not be logged.",
  );
}

export async function addGoal(input: SavingsGoalInput) {
  const now = new Date().toISOString();
  const goal = goalFromInput(crypto.randomUUID(), input, now, now, null);
  await commitChange(
    { ...snapshot, goals: [...snapshot.goals, goal] },
    () => saveGoal(goal),
    "The goal could not be saved.",
  );
  return goal;
}

export async function updateGoal(id: string, input: SavingsGoalInput) {
  const current = snapshot.goals.find((goal) => goal.id === id);
  if (!current) throw new Error("That goal is no longer here.");
  const updated = { ...current, ...input, updatedAt: new Date().toISOString() };
  await commitChange(
    { ...snapshot, goals: snapshot.goals.map((goal) => (goal.id === id ? updated : goal)) },
    () => saveGoal(updated),
    "The goal could not be updated.",
  );
}

export async function removeGoal(id: string) {
  await commitChange(
    { ...snapshot, goals: snapshot.goals.filter((goal) => goal.id !== id) },
    () => deleteGoal(id),
    "The goal could not be removed.",
  );
}

export async function addToGoal(id: string, amount: number, monthly = false) {
  const goal = snapshot.goals.find((entry) => entry.id === id);
  if (!goal || !Number.isFinite(amount) || amount <= 0) return;
  const month = todayISO().slice(0, 7);
  if (monthly && goal.lastAllocated === month) return;
  const updated: SavingsGoal = {
    ...goal,
    savedAmount: Math.round((goal.savedAmount + amount) * 100) / 100,
    lastAllocated: monthly ? month : goal.lastAllocated,
    updatedAt: new Date().toISOString(),
  };
  await commitChange(
    { ...snapshot, goals: snapshot.goals.map((entry) => (entry.id === id ? updated : entry)) },
    () => saveGoal(updated),
    "The savings could not be added.",
  );
}

export async function setDailyReminder(enabled: boolean) {
  const next = { dailyReminder: enabled, lastReminded: enabled ? snapshot.lastReminded : null };
  await commitChange({ ...snapshot, ...next }, () => saveSettings(next), "The reminder could not be saved.");
}

export async function markReminded(day: string) {
  const next = { dailyReminder: snapshot.dailyReminder, lastReminded: day };
  try {
    await saveSettings(next);
    publish({ ...snapshot, lastReminded: day });
  } catch {
    publish({ ...snapshot, lastReminded: day });
  }
}

export async function clearLedger() {
  await commitChange(
    {
      ...snapshot,
      expenses: [],
      budget: DEFAULT_BUDGET,
      categoryLimits: {},
      recurring: [],
      goals: [],
      dailyBills: [],
    },
    () => clearRemoteLedger(),
    "The ledger could not be cleared.",
  );
}

export async function updateDisplayName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Add a user name.");
  if (trimmed.length > 40) throw new Error("Keep the user name under 40 characters.");
  const previous = snapshot.userName;
  publish({ ...snapshot, userName: trimmed, saving: true, storageWarning: false, storageMessage: null });
  try {
    const supabase = getSupabase();
    const { error } = await supabase.auth.updateUser({ data: { full_name: trimmed, user_name: trimmed } });
    if (error) throw new Error(error.message);
    const userId = ledgerOwnerId();
    const updatedAt = new Date().toISOString();
    const owned = await supabase
      .from("profiles")
      .update({ full_name: trimmed, user_id: userId, updated_at: updatedAt })
      .eq("id", userId)
      .eq("user_id", userId);
    if (owned.error && /user_id|schema cache|column/i.test(owned.error.message)) {
      await supabase.from("profiles").update({ full_name: trimmed, updated_at: updatedAt }).eq("id", userId);
    }
    publish({ ...snapshot, userName: trimmed, saving: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The name could not be saved.";
    publish({ ...snapshot, userName: previous, saving: false, storageWarning: true, storageMessage: message });
    throw new Error(message);
  }
}

