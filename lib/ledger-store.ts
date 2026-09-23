import { createSeedExpenses, DEFAULT_BUDGET } from "@/lib/seed";
import { readLedger, STORAGE_KEY, writeLedger, type PersistedLedger } from "@/lib/storage";
import type { Expense, ExpenseInput } from "@/types/expense";

export interface LedgerSnapshot {
  expenses: Expense[];
  budget: number;
  ready: boolean;
  storageWarning: boolean;
}

const SERVER_SNAPSHOT: LedgerSnapshot = {
  expenses: [],
  budget: DEFAULT_BUDGET,
  ready: false,
  storageWarning: false,
};

let snapshot: LedgerSnapshot = SERVER_SNAPSHOT;
let loaded = false;
const listeners = new Set<() => void>();

function loadFromBrowser(): LedgerSnapshot {
  const stored = readLedger();
  if (stored) {
    return {
      expenses: stored.expenses,
      budget: stored.budget,
      ready: true,
      storageWarning: false,
    };
  }
  const seeded: PersistedLedger = {
    expenses: createSeedExpenses(),
    budget: DEFAULT_BUDGET,
  };
  return {
    expenses: seeded.expenses,
    budget: seeded.budget,
    ready: true,
    storageWarning: !writeLedger(seeded),
  };
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    snapshot = loadFromBrowser();
  } catch {
    snapshot = {
      expenses: createSeedExpenses(),
      budget: DEFAULT_BUDGET,
      ready: true,
      storageWarning: true,
    };
  }
}

function commit(next: Pick<LedgerSnapshot, "expenses" | "budget">) {
  const ok = writeLedger({ expenses: next.expenses, budget: next.budget });
  snapshot = {
    expenses: next.expenses,
    budget: next.budget,
    ready: true,
    storageWarning: !ok,
  };
  listeners.forEach((listener) => listener());
}

export function subscribeLedger(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    const stored = readLedger();
    if (!stored) return;
    snapshot = {
      expenses: stored.expenses,
      budget: stored.budget,
      ready: true,
      storageWarning: false,
    };
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getLedgerSnapshot(): LedgerSnapshot {
  ensureLoaded();
  return snapshot;
}

export function getServerLedgerSnapshot(): LedgerSnapshot {
  return SERVER_SNAPSHOT;
}

export function addExpense(input: ExpenseInput): Expense {
  ensureLoaded();
  const now = new Date().toISOString();
  const expense: Expense = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  commit({ expenses: [expense, ...snapshot.expenses], budget: snapshot.budget });
  return expense;
}

export function updateExpense(id: string, input: ExpenseInput) {
  ensureLoaded();
  commit({
    budget: snapshot.budget,
    expenses: snapshot.expenses.map((expense) =>
      expense.id === id ? { ...expense, ...input, updatedAt: new Date().toISOString() } : expense,
    ),
  });
}

export function deleteExpense(id: string) {
  ensureLoaded();
  commit({
    budget: snapshot.budget,
    expenses: snapshot.expenses.filter((expense) => expense.id !== id),
  });
}

export function setBudget(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) return;
  ensureLoaded();
  commit({
    expenses: snapshot.expenses,
    budget: Math.round(amount * 100) / 100,
  });
}

export function restoreSampleMonth() {
  commit({ expenses: createSeedExpenses(), budget: DEFAULT_BUDGET });
}
