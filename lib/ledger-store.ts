import {
  deleteRemoteExpense,
  ensureUserId,
  fetchRemoteLedger,
  migrateLocalLedger,
  saveRemoteBudget,
  upsertExpenses,
} from "@/lib/ledger-db";
import { createSeedExpenses, DEFAULT_BUDGET } from "@/lib/seed";
import { readLedger, writeLedger, type PersistedLedger } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Expense, ExpenseInput } from "@/types/expense";

export interface LedgerSnapshot {
  expenses: Expense[];
  budget: number;
  ready: boolean;
  storageWarning: boolean;
  storageMessage: string | null;
}

const SERVER_SNAPSHOT: LedgerSnapshot = {
  expenses: [],
  budget: DEFAULT_BUDGET,
  ready: false,
  storageWarning: false,
  storageMessage: null,
};

const LOCAL_ONLY =
  "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then run supabase/migrations/001_expenses.sql. This browser copy is temporary.";

let snapshot: LedgerSnapshot = SERVER_SNAPSHOT;
let started = false;
let userId: string | null = null;
let remote = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function publish(next: LedgerSnapshot) {
  snapshot = next;
  notify();
}

function localLedger(): PersistedLedger {
  return readLedger() ?? { expenses: createSeedExpenses(), budget: DEFAULT_BUDGET };
}

function keepLocal(message: string | null) {
  const stored = localLedger();
  if (!readLedger()) writeLedger(stored);
  remote = false;
  userId = null;
  publish({
    expenses: stored.expenses,
    budget: stored.budget,
    ready: true,
    storageWarning: Boolean(message),
    storageMessage: message,
  });
}

async function load() {
  if (!isSupabaseConfigured()) {
    keepLocal(LOCAL_ONLY);
    return;
  }
  try {
    userId = await ensureUserId();
    remote = true;
    let ledger = await fetchRemoteLedger(userId);
    ledger = await migrateLocalLedger(userId, ledger);
    if (ledger.expenses.length === 0) {
      const seeded = { expenses: createSeedExpenses().map((expense) => ({ ...expense, id: crypto.randomUUID() })), budget: DEFAULT_BUDGET };
      await upsertExpenses(userId, seeded.expenses);
      await saveRemoteBudget(userId, seeded.budget);
      ledger = seeded;
    }
    publish({
      expenses: ledger.expenses,
      budget: ledger.budget,
      ready: true,
      storageWarning: false,
      storageMessage: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The ledger could not be loaded.";
    keepLocal(message);
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  void load();
}

function rememberLocal() {
  if (remote) return;
  writeLedger({ expenses: snapshot.expenses, budget: snapshot.budget });
}

async function persist(action: () => Promise<void>) {
  if (!remote || !userId) {
    rememberLocal();
    return;
  }
  try {
    await action();
    if (snapshot.storageWarning) {
      publish({ ...snapshot, storageWarning: false, storageMessage: null });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The change could not be saved.";
    publish({ ...snapshot, storageWarning: true, storageMessage: message });
  }
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

export function addExpense(input: ExpenseInput): Expense {
  const now = new Date().toISOString();
  const expense: Expense = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  publish({ ...snapshot, expenses: [expense, ...snapshot.expenses] });
  void persist(async () => {
    if (!userId) return;
    await upsertExpenses(userId, [expense]);
  });
  return expense;
}

export function updateExpense(id: string, input: ExpenseInput) {
  const expenses = snapshot.expenses.map((expense) =>
    expense.id === id ? { ...expense, ...input, updatedAt: new Date().toISOString() } : expense,
  );
  publish({ ...snapshot, expenses });
  const updated = expenses.find((expense) => expense.id === id);
  void persist(async () => {
    if (!userId || !updated) return;
    await upsertExpenses(userId, [updated]);
  });
}

export function deleteExpense(id: string) {
  publish({ ...snapshot, expenses: snapshot.expenses.filter((expense) => expense.id !== id) });
  void persist(async () => {
    await deleteRemoteExpense(id);
  });
}

export function setBudget(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) return;
  const budget = Math.round(amount * 100) / 100;
  publish({ ...snapshot, budget });
  void persist(async () => {
    if (!userId) return;
    await saveRemoteBudget(userId, budget);
  });
}

export function restoreSampleMonth() {
  const expenses = createSeedExpenses().map((expense) => ({ ...expense, id: crypto.randomUUID() }));
  const previous = snapshot.expenses;
  publish({ ...snapshot, expenses, budget: DEFAULT_BUDGET });
  void persist(async () => {
    if (!userId) return;
    await Promise.all(previous.map((expense) => deleteRemoteExpense(expense.id)));
    await upsertExpenses(userId, expenses);
    await saveRemoteBudget(userId, DEFAULT_BUDGET);
  });
}
