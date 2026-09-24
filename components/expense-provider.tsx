"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  addExpense,
  deleteExpense,
  getLedgerSnapshot,
  getServerLedgerSnapshot,
  restoreSampleMonth,
  setBudget,
  subscribeLedger,
  updateExpense,
} from "@/lib/ledger-store";
import type { Expense, ExpenseInput } from "@/types/expense";

interface ExpenseContextValue {
  expenses: Expense[];
  budget: number;
  hydrated: boolean;
  storageWarning: boolean;
  storageMessage: string | null;
  addExpense: (input: ExpenseInput) => Expense;
  updateExpense: (id: string, input: ExpenseInput) => void;
  deleteExpense: (id: string) => void;
  setBudget: (amount: number) => void;
  restoreSampleMonth: () => void;
}

const ExpenseContext = createContext<ExpenseContextValue | null>(null);

export function ExpenseProvider({ children }: { children: ReactNode }) {
  const ledger = useSyncExternalStore(
    subscribeLedger,
    getLedgerSnapshot,
    getServerLedgerSnapshot,
  );

  const value = useMemo<ExpenseContextValue>(
    () => ({
      expenses: ledger.expenses,
      budget: ledger.budget,
      hydrated: ledger.ready,
      storageWarning: ledger.storageWarning,
      storageMessage: ledger.storageMessage,
      addExpense,
      updateExpense,
      deleteExpense,
      setBudget,
      restoreSampleMonth,
    }),
    [ledger],
  );

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}

export function useExpenses() {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error("useExpenses must be used within ExpenseProvider");
  }
  return context;
}
