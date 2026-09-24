import {
  deleteRemoteExpense,
  fetchRemoteLedger,
  saveRemoteBudget,
  upsertExpenses,
} from "@/lib/ledger-db";
import { DEFAULT_BUDGET } from "@/lib/seed";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Expense, ExpenseInput } from "@/types/expense";

export interface LedgerSnapshot {
  expenses: Expense[];
  budget: number;
  ready: boolean;
  saving: boolean;
  storageWarning: boolean;
  storageMessage: string | null;
}

const SERVER_SNAPSHOT: LedgerSnapshot = {
  expenses: [],
  budget: DEFAULT_BUDGET,
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

function fail(message: string) {
  publish({ ...snapshot, ready: true, saving: false, storageWarning: true, storageMessage: message });
}

async function load() {
  if (!isSupabaseConfigured()) {
    fail(MISSING);
    return;
  }
  try {
    const ledger = await fetchRemoteLedger();
    publish({
      expenses: sortExpenses(ledger.expenses),
      budget: ledger.budget,
      ready: true,
      saving: false,
      storageWarning: false,
      storageMessage: null,
    });
  } catch (error) {
    fail(error instanceof Error ? error.message : "The ledger could not be loaded.");
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  void load();
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
    await saveRemoteBudget(budget);
    publish({ ...snapshot, budget, saving: false, storageWarning: false, storageMessage: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The budget could not be saved.";
    publish({ ...snapshot, saving: false, storageWarning: true, storageMessage: message });
    throw new Error(message);
  }
}

