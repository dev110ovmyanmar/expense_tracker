import { totalsByCategory } from "@/lib/expenses";
import { formatMoney, formatMonth, roundMoney } from "@/lib/format";
import type { Expense } from "@/types/expense";

export interface CoachCategory {
  name: string;
  amount: number;
}

export interface CoachSnapshot {
  month: string;
  day: number;
  daysInMonth: number;
  income: number;
  expenses: number;
  net: number;
  budget: number;
  projected: number;
  dining: number;
  topCategory: string | null;
  topAmount: number;
  categories: CoachCategory[];
}

const DINING = new Set(["Food & Beverages", "Food"]);

export function buildCoachSnapshot(expenses: Expense[], budget: number, now = new Date()): CoachSnapshot {
  const income = roundMoney(
    expenses.filter((expense) => expense.type === "income").reduce((sum, expense) => sum + expense.amount, 0),
  );
  const spending = expenses.filter((expense) => expense.type === "expense");
  const expenseTotal = roundMoney(spending.reduce((sum, expense) => sum + expense.amount, 0));
  const categories = totalsByCategory(spending).map((row) => ({ name: row.category, amount: row.total }));
  const dining = roundMoney(
    categories.filter((row) => DINING.has(row.name)).reduce((sum, row) => sum + row.amount, 0),
  );
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projected = day > 0 ? roundMoney((expenseTotal / day) * daysInMonth) : 0;
  const top = categories[0];
  return {
    month: formatMonth(now),
    day,
    daysInMonth,
    income,
    expenses: expenseTotal,
    net: roundMoney(income - expenseTotal),
    budget,
    projected,
    dining,
    topCategory: top?.name ?? null,
    topAmount: top?.amount ?? 0,
    categories: categories.slice(0, 6),
  };
}

export function localCoachMessage(snapshot: CoachSnapshot): string {
  const { income, expenses, net, budget, projected, dining, topCategory, topAmount, month } = snapshot;
  if (income === 0 && expenses === 0) {
    return `Nothing on the books for ${month} yet. Log a salary or the first receipt and I’ll tell you if the pace is chill or chaotic.`;
  }
  if (expenses > 0 && dining >= topAmount && dining > 0 && (expenses === 0 || dining / expenses >= 0.35)) {
    return `Dining is doing the most. ${formatMoney(dining)} has already gone to meals out, the loudest part of ${formatMoney(expenses)}. Next round can be tea at home.`;
  }
  if (income === 0 && expenses > 0) {
    return `${formatMoney(expenses)} is already out the door and no income is logged. Add Monthly Salary so this number has something to lean on.`;
  }
  if (budget > 0 && projected > budget) {
    return `This pace runs hot. Keep it up and ${month} lands near ${formatMoney(projected)}, past the ${formatMoney(budget)} budget. Worth a slower week.`;
  }
  if (net < 0) {
    return `Net is upside down: ${formatMoney(expenses)} out against ${formatMoney(income)} in. Not a lecture, just a nudge before the month gets away.`;
  }
  if (topCategory && topAmount > 0) {
    return `The vibe is steady. ${formatMoney(income)} in, ${formatMoney(expenses)} out, and ${topCategory} is the main tab at ${formatMoney(topAmount)}. Room to keep it this easy.`;
  }
  return `${formatMoney(income)} in and nothing spent yet. Pocket the win, or go log the first receipt when it shows up.`;
}
