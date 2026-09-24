import { isExpenseCategory, type CategoryLimits } from "@/lib/budget-status";
import { todayISO } from "@/lib/format";
import {
  deleteRemoteExpense,
  fetchRemoteLedger,
  saveRemoteBudget,
  upsertExpenses,
} from "@/lib/ledger-db";
import { deleteGoal, deleteRecurring, fetchPlanning, fetchSettings, goalFromInput, recurringFromInput, saveGoal, saveRecurring, saveSettings } from "@/lib/planning-db";
import { scheduleCatchUp } from "@/lib/recurring";
import { DEFAULT_BUDGET } from "@/lib/seed";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Category, Expense, ExpenseInput } from "@/types/expense";
import { DEFAULT_CURRENCY } from "@/types/expense";
import type { RecurringInput, RecurringItem, SavingsGoal, SavingsGoalInput } from "@/types/planning";

export interface LedgerSnapshot {
  expenses: Expense[];
  budget: number;
  categoryLimits: CategoryLimits;
  recurring: RecurringItem[];
  goals: SavingsGoal[];
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

function accountName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  for (const key of ["full_name", "user_name", "display_name", "name"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const username = user.email?.split("@")[0]?.trim();
  return username || null;
}

function fail(message: string) {
  publish({ ...snapshot, ready: true, saving: false, storageWarning: true, storageMessage: message });
}

async function load() {
  if (!isSupabaseConfigured()) {
    fail(MISSING);
    return;
  }
  try {
    const [{ data: userData }, ledger, planning, settings] = await Promise.all([
      getSupabase().auth.getUser(),
      fetchRemoteLedger(),
      fetchPlanning(),
      fetchSettings(),
    ]);
    const logged = planning.message ? { expenses: [], recurring: planning.recurring } : await applyAutoLog(planning.recurring);
    publish({
      expenses: sortExpenses([...logged.expenses, ...ledger.expenses]),
      budget: ledger.budget,
      categoryLimits: ledger.categoryLimits,
      recurring: logged.recurring,
      goals: planning.goals,
      planningMessage: planning.message,
      userEmail: userData.user?.email ?? null,
      userName: accountName(userData.user),
      dailyReminder: settings.dailyReminder,
      lastReminded: settings.lastReminded,
      ready: true,
      saving: false,
      storageWarning: false,
      storageMessage: null,
    });
  } catch (error) {
    fail(error instanceof Error ? error.message : "The ledger could not be loaded.");
  }
}

function signedOut() {
  publish({
    ...SERVER_SNAPSHOT,
    ready: true,
    userEmail: null,
  });
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!isSupabaseConfigured()) {
    fail(MISSING);
    return;
  }
  const supabase = getSupabase();
  void supabase.auth.getSession().then(({ data }) => {
    if (data.session) void load();
    else signedOut();
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) void load();
    else signedOut();
  });
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

export async function addExpense(input: ExpenseInput): Promise<Expense> {
  requireReady();
  const now = new Date().toISOString();
  const expense: Expense = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  publish({ ...snapshot, saving: true });
  try {
    await upsertExpenses([expense]);
    publish({
      ...snapshot,
      expenses: sortExpenses([expense, ...snapshot.expenses]),
      saving: false,
      storageWarning: false,
      storageMessage: null,
    });
    return expense;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The expense could not be saved.";
    publish({ ...snapshot, saving: false, storageWarning: true, storageMessage: message });
    throw new Error(message);
  }
}

export async function updateExpense(id: string, input: ExpenseInput) {
  requireReady();
  const current = snapshot.expenses.find((expense) => expense.id === id);
  if (!current) throw new Error("That expense is no longer in the ledger.");
  const updated: Expense = { ...current, ...input, updatedAt: new Date().toISOString() };
  publish({ ...snapshot, saving: true });
  try {
    await upsertExpenses([updated]);
    publish({
      ...snapshot,
      expenses: sortExpenses(snapshot.expenses.map((expense) => (expense.id === id ? updated : expense))),
      saving: false,
      storageWarning: false,
      storageMessage: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The expense could not be updated.";
    publish({ ...snapshot, saving: false, storageWarning: true, storageMessage: message });
    throw new Error(message);
  }
}

export async function deleteExpense(id: string) {
  requireReady();
  publish({ ...snapshot, saving: true });
  try {
    await deleteRemoteExpense(id);
    publish({
      ...snapshot,
      expenses: snapshot.expenses.filter((expense) => expense.id !== id),
      saving: false,
      storageWarning: false,
      storageMessage: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The expense could not be deleted.";
    publish({ ...snapshot, saving: false, storageWarning: true, storageMessage: message });
    throw new Error(message);
  }
}

export async function setBudget(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) return;
  requireReady();
  const budget = Math.round(amount * 100) / 100;
  publish({ ...snapshot, saving: true });
  try {
    await saveRemoteBudget(budget, snapshot.categoryLimits);
    publish({ ...snapshot, budget, saving: false, storageWarning: false, storageMessage: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The budget could not be saved.";
    publish({ ...snapshot, saving: false, storageWarning: true, storageMessage: message });
    throw new Error(message);
  }
}

export async function setCategoryLimit(category: Category, amount: number) {
  if (!isExpenseCategory(category)) return;
  requireReady();
  const categoryLimits = { ...snapshot.categoryLimits };
  if (!Number.isFinite(amount) || amount <= 0) delete categoryLimits[category];
  else categoryLimits[category] = Math.round(amount * 100) / 100;
  publish({ ...snapshot, saving: true });
  try {
    await saveRemoteBudget(snapshot.budget, categoryLimits);
    publish({ ...snapshot, categoryLimits, saving: false, storageWarning: false, storageMessage: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The category limit could not be saved.";
    publish({ ...snapshot, saving: false, storageWarning: true, storageMessage: message });
    throw new Error(message);
  }
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
    notes: item.frequency === "weekly" ? "Weekly recurring" : "Monthly recurring",
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

async function writePlanning<T>(work: () => Promise<T>, fallback: string): Promise<T> {
  requireReady();
  publish({ ...snapshot, saving: true });
  try {
    const result = await work();
    publish({ ...snapshot, saving: false, storageWarning: false, storageMessage: null });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : fallback;
    publish({ ...snapshot, saving: false, storageWarning: true, storageMessage: message });
    throw new Error(message);
  }
}

export async function addRecurring(input: RecurringInput) {
  const now = new Date().toISOString();
  const item = recurringFromInput(crypto.randomUUID(), input, now, now);
  await writePlanning(async () => {
    await saveRecurring(item);
    snapshot = { ...snapshot, recurring: [...snapshot.recurring, item].sort((a, b) => a.nextDue.localeCompare(b.nextDue)) };
  }, "The bill could not be saved.");
  return item;
}

export async function updateRecurring(id: string, input: RecurringInput) {
  const current = snapshot.recurring.find((item) => item.id === id);
  if (!current) throw new Error("That bill is no longer on the schedule.");
  const updated = { ...current, ...input, updatedAt: new Date().toISOString() };
  await writePlanning(async () => {
    await saveRecurring(updated);
    snapshot = {
      ...snapshot,
      recurring: snapshot.recurring
        .map((item) => (item.id === id ? updated : item))
        .sort((a, b) => a.nextDue.localeCompare(b.nextDue)),
    };
  }, "The bill could not be updated.");
}

export async function removeRecurring(id: string) {
  await writePlanning(async () => {
    await deleteRecurring(id);
    snapshot = { ...snapshot, recurring: snapshot.recurring.filter((item) => item.id !== id) };
  }, "The bill could not be removed.");
}

export async function logRecurring(id: string) {
  const item = snapshot.recurring.find((entry) => entry.id === id);
  if (!item || !item.active) return;
  const due = scheduleCatchUp(item.nextDue, item.frequency, todayISO());
  if (due.dates.length === 0) return;
  const expenses = chargesFor(item, due.dates);
  const updated = { ...item, nextDue: due.nextDue, updatedAt: new Date().toISOString() };
  await writePlanning(async () => {
    await upsertExpenses(expenses);
    await saveRecurring(updated);
    snapshot = {
      ...snapshot,
      expenses: sortExpenses([...expenses, ...snapshot.expenses]),
      recurring: snapshot.recurring.map((entry) => (entry.id === id ? updated : entry)),
    };
  }, "The bill could not be logged.");
}

export async function addGoal(input: SavingsGoalInput) {
  const now = new Date().toISOString();
  const goal = goalFromInput(crypto.randomUUID(), input, now, now, null);
  await writePlanning(async () => {
    await saveGoal(goal);
    snapshot = { ...snapshot, goals: [...snapshot.goals, goal] };
  }, "The goal could not be saved.");
  return goal;
}

export async function updateGoal(id: string, input: SavingsGoalInput) {
  const current = snapshot.goals.find((goal) => goal.id === id);
  if (!current) throw new Error("That goal is no longer here.");
  const updated = { ...current, ...input, updatedAt: new Date().toISOString() };
  await writePlanning(async () => {
    await saveGoal(updated);
    snapshot = { ...snapshot, goals: snapshot.goals.map((goal) => (goal.id === id ? updated : goal)) };
  }, "The goal could not be updated.");
}

export async function removeGoal(id: string) {
  await writePlanning(async () => {
    await deleteGoal(id);
    snapshot = { ...snapshot, goals: snapshot.goals.filter((goal) => goal.id !== id) };
  }, "The goal could not be removed.");
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
  await writePlanning(async () => {
    await saveGoal(updated);
    snapshot = { ...snapshot, goals: snapshot.goals.map((entry) => (entry.id === id ? updated : entry)) };
  }, "The savings could not be added.");
}

export async function setDailyReminder(enabled: boolean) {
  requireReady();
  const next = { dailyReminder: enabled, lastReminded: enabled ? snapshot.lastReminded : null };
  publish({ ...snapshot, saving: true, dailyReminder: enabled });
  try {
    await saveSettings(next);
    publish({ ...snapshot, ...next, saving: false, storageWarning: false, storageMessage: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The reminder could not be saved.";
    publish({ ...snapshot, saving: false, storageWarning: true, storageMessage: message });
    throw new Error(message);
  }
}

export async function markReminded(day: string) {
  if (!snapshot.userEmail) return;
  const next = { dailyReminder: snapshot.dailyReminder, lastReminded: day };
  try {
    await saveSettings(next);
    publish({ ...snapshot, lastReminded: day });
  } catch {
    publish({ ...snapshot, lastReminded: day });
  }
}

export async function updateDisplayName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Add a user name.");
  if (trimmed.length > 40) throw new Error("Keep the user name under 40 characters.");
  if (!isSupabaseConfigured()) throw new Error(MISSING);
  const { data, error } = await getSupabase().auth.updateUser({
    data: { full_name: trimmed, user_name: trimmed },
  });
  if (error) throw new Error(error.message);
  publish({
    ...snapshot,
    userName: accountName(data.user) ?? trimmed,
    userEmail: data.user?.email ?? snapshot.userEmail,
  });
}

export async function signOut() {
  if (!isSupabaseConfigured()) return;
  await getSupabase().auth.signOut();
}

