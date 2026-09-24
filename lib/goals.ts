import { monthKey, roundMoney } from "@/lib/format";
import type { SavingsGoal } from "@/types/planning";

export function goalProgress(goal: SavingsGoal) {
  const remaining = roundMoney(Math.max(0, goal.targetAmount - goal.savedAmount));
  const ratio = goal.targetAmount > 0 ? Math.min(1, goal.savedAmount / goal.targetAmount) : 0;
  return {
    percent: Math.round(ratio * 100),
    remaining,
    complete: goal.savedAmount + 0.001 >= goal.targetAmount,
  };
}

export function monthsLeft(targetDate: string | null, today = new Date()): number | null {
  if (!targetDate) return null;
  const [year, month] = targetDate.split("-").map(Number);
  if (!year || !month) return null;
  return Math.max(0, (year - today.getFullYear()) * 12 + (month - (today.getMonth() + 1)));
}

export function neededMonthly(goal: SavingsGoal, today = new Date()): number | null {
  const months = monthsLeft(goal.targetDate, today);
  if (months === null) return null;
  const remaining = goal.targetAmount - goal.savedAmount;
  if (remaining <= 0) return 0;
  return roundMoney(remaining / Math.max(1, months));
}

export function allocatedThisMonth(goal: SavingsGoal, today = new Date()): boolean {
  return goal.lastAllocated === monthKey(today);
}
