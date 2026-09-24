"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  addExpense,
  addGoal,
  addRecurring,
  addToGoal,
  deleteExpense,
  getLedgerSnapshot,
  getServerLedgerSnapshot,
  logRecurring,
  markReminded,
  removeGoal,
  removeRecurring,
  setBudget,
  setDailyReminder,
  signOut,
  subscribeLedger,
  updateExpense,
  updateGoal,
  updateRecurring,
} from "@/lib/ledger-store";
import type { Expense, ExpenseInput } from "@/types/expense";
import type { RecurringInput, RecurringItem, SavingsGoal, SavingsGoalInput } from "@/types/planning";

interface ExpenseContextValue {
  expenses: Expense[];
  budget: number;
  recurring: RecurringItem[];
  goals: SavingsGoal[];
  planningMessage: string | null;
  userEmail: string | null;
  userName: string | null;
  dailyReminder: boolean;
  lastReminded: string | null;
  hydrated: boolean;
  saving: boolean;
  storageWarning: boolean;
  storageMessage: string | null;
  addExpense: (input: ExpenseInput) => Promise<Expense>;
  updateExpense: (id: string, input: ExpenseInput) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  setBudget: (amount: number) => Promise<void>;
  addRecurring: (input: RecurringInput) => Promise<RecurringItem>;
  updateRecurring: (id: string, input: RecurringInput) => Promise<void>;
  removeRecurring: (id: string) => Promise<void>;
  logRecurring: (id: string) => Promise<void>;
  addGoal: (input: SavingsGoalInput) => Promise<SavingsGoal>;
  updateGoal: (id: string, input: SavingsGoalInput) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  addToGoal: (id: string, amount: number, monthly?: boolean) => Promise<void>;
  setDailyReminder: (enabled: boolean) => Promise<void>;
  markReminded: (day: string) => Promise<void>;
  signOut: () => Promise<void>;
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
      recurring: ledger.recurring,
      goals: ledger.goals,
      planningMessage: ledger.planningMessage,
      userEmail: ledger.userEmail,
      userName: ledger.userName,
      dailyReminder: ledger.dailyReminder,
      lastReminded: ledger.lastReminded,
      hydrated: ledger.ready,
      saving: ledger.saving,
      storageWarning: ledger.storageWarning,
      storageMessage: ledger.storageMessage,
      addExpense,
      updateExpense,
      deleteExpense,
      setBudget,
      addRecurring,
      updateRecurring,
      removeRecurring,
      logRecurring,
      addGoal,
      updateGoal,
      removeGoal,
      addToGoal,
      setDailyReminder,
      markReminded,
      signOut,
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
