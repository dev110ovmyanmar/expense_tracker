import type { CategoryLimits } from "@/lib/budget-status";
import type { DailyBill } from "@/lib/daily-bills";
import { DEFAULT_BUDGET } from "@/lib/seed";
import type { Expense } from "@/types/expense";
import type { RecurringItem, SavingsGoal } from "@/types/planning";

const VERSION = 1;

export interface DeviceLedger {
  version: 1;
  expenses: Expense[];
  budget: number;
  categoryLimits: CategoryLimits;
  recurring: RecurringItem[];
  goals: SavingsGoal[];
  dailyBills: DailyBill[];
  dailyReminder: boolean;
  lastReminded: string | null;
  userName: string | null;
  pending: boolean;
  syncedExpenseIds: string[];
}

export function deviceLedgerKey(userId: string | null): string {
  return `aura-device-ledger:${userId ?? "local"}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readDeviceLedger(userId: string | null): DeviceLedger | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(deviceLedgerKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== VERSION || !Array.isArray(parsed.expenses)) return null;
    const budget = typeof parsed.budget === "number" && parsed.budget >= 0 ? parsed.budget : DEFAULT_BUDGET;
    return {
      version: VERSION,
      expenses: parsed.expenses as Expense[],
      budget,
      categoryLimits: isRecord(parsed.categoryLimits) ? (parsed.categoryLimits as CategoryLimits) : {},
      recurring: Array.isArray(parsed.recurring) ? (parsed.recurring as RecurringItem[]) : [],
      goals: Array.isArray(parsed.goals) ? (parsed.goals as SavingsGoal[]) : [],
      dailyBills: Array.isArray(parsed.dailyBills) ? (parsed.dailyBills as DailyBill[]) : [],
      dailyReminder: parsed.dailyReminder === true,
      lastReminded: typeof parsed.lastReminded === "string" ? parsed.lastReminded : null,
      userName: typeof parsed.userName === "string" ? parsed.userName : null,
      pending: parsed.pending === true,
      syncedExpenseIds: Array.isArray(parsed.syncedExpenseIds)
        ? parsed.syncedExpenseIds.filter((id): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return null;
  }
}

export function writeDeviceLedger(userId: string | null, ledger: DeviceLedger) {
  localStorage.setItem(deviceLedgerKey(userId), JSON.stringify(ledger));
}

export function offlineNow(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function isOfflineError(error: unknown): boolean {
  if (offlineNow()) return true;
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) return true;
  const message = error instanceof Error ? error.message : "";
  return /failed to fetch|network request failed|networkerror|offline|load failed/i.test(message);
}
