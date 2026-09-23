import { monthKey, roundMoney } from "@/lib/format";
import type { Category, Expense } from "@/types/expense";

export function sortExpenses(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

export function expensesInMonth(expenses: Expense[], date = new Date()): Expense[] {
  const key = monthKey(date);
  return expenses.filter((expense) => expense.date.startsWith(key));
}

export function sumAmounts(expenses: Expense[]): number {
  return roundMoney(expenses.reduce((sum, expense) => sum + expense.amount, 0));
}

export function totalsByCategory(expenses: Expense[]): { category: Category; total: number }[] {
  const totals = new Map<Category, number>();
  for (const expense of expenses) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
  }
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total: roundMoney(total) }))
    .sort((a, b) => b.total - a.total);
}

export interface LedgerFilters {
  query: string;
  category: Category | "all";
  from: string;
  to: string;
}

export function filterExpenses(expenses: Expense[], filters: LedgerFilters): Expense[] {
  const query = filters.query.trim().toLowerCase();
  return sortExpenses(expenses).filter((expense) => {
    if (filters.category !== "all" && expense.category !== filters.category) return false;
    if (filters.from && expense.date < filters.from) return false;
    if (filters.to && expense.date > filters.to) return false;
    if (!query) return true;
    const haystack = [
      expense.vendor,
      expense.notes,
      expense.category,
      expense.receiptName ?? "",
      ...expense.lineItems.map((item) => item.description),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}
