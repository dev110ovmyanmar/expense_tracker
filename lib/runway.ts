import { roundMoney } from "@/lib/format";
import type { Expense } from "@/types/expense";

const HORIZON = 30;
const LOOKBACK_DAYS = 90;
const WARNING_DAYS = 7;

export interface RunwayPoint {
  day: number;
  label: string;
  when: string;
  balance: number;
  low: boolean;
  payday: boolean;
}

export interface RunwayForecast {
  dailyExpense: number;
  totalIncome: number;
  monthlySalary: number;
  startingBalance: number;
  endingBalance: number;
  warningLevel: number;
  lowDay: number | null;
  payIncluded: boolean;
  payLabel: string | null;
  points: RunwayPoint[];
  ready: boolean;
}

function dayStamp(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function forecastRunway(expenses: Expense[], now = new Date()): RunwayForecast {
  const today = dayStamp(now);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (LOOKBACK_DAYS - 1));

  const spending = expenses.filter((expense) => expense.type === "expense");
  const recent = spending.filter((expense) => {
    const date = parseDay(expense.date);
    return date >= cutoff && date <= today;
  });
  const first = recent.reduce<string | null>(
    (earliest, expense) => (earliest === null || expense.date < earliest ? expense.date : earliest),
    null,
  );
  const spanDays = first
    ? Math.max(1, Math.round((today.getTime() - parseDay(first).getTime()) / 86_400_000) + 1)
    : 1;
  const recentTotal = recent.reduce((sum, expense) => sum + expense.amount, 0);
  const dailyExpense = recent.length > 0 ? roundMoney(recentTotal / spanDays) : 0;

  const incomeByMonth = new Map<string, number>();
  for (const expense of expenses) {
    if (expense.type !== "income") continue;
    const key = expense.date.slice(0, 7);
    incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + expense.amount);
  }
  const monthlyTotals = [...incomeByMonth.values()];
  const totalIncome = roundMoney(monthlyTotals.reduce((sum, amount) => sum + amount, 0));
  const latestMonthKey = [...incomeByMonth.keys()].sort().at(-1);
  const latestMonthIncome = latestMonthKey ? roundMoney(incomeByMonth.get(latestMonthKey) ?? 0) : 0;
  const totalSpent = roundMoney(spending.reduce((sum, expense) => sum + expense.amount, 0));
  const startingBalance = roundMoney(totalIncome - totalSpent);
  const warningLevel = dailyExpense > 0 ? roundMoney(dailyExpense * WARNING_DAYS) : 0;
  const pays = monthEndIncome(today, new Set(incomeByMonth.keys()), latestMonthIncome);

  let lowDay: number | null = null;
  const points: RunwayPoint[] = [];
  for (let day = 0; day <= HORIZON; day += 1) {
    const salary = pays.filter((pay) => pay.offset <= day).length * latestMonthIncome;
    const balance = roundMoney(startingBalance - day * dailyExpense + salary);
    const date = new Date(today);
    date.setDate(date.getDate() + day);
    const low = balance < warningLevel;
    if (low && lowDay === null) lowDay = day;
    points.push({
      day,
      label: day === 0 ? "Today" : date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      when: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      balance,
      low,
      payday: pays.some((pay) => pay.offset === day),
    });
  }

  return {
    dailyExpense,
    totalIncome,
    monthlySalary: latestMonthIncome,
    startingBalance,
    endingBalance: points[HORIZON]?.balance ?? startingBalance,
    warningLevel,
    lowDay,
    payIncluded: pays.length > 0,
    payLabel: pays.length > 0 ? pays.map((pay) => pay.label).join(" and ") : null,
    points,
    ready: spending.length > 0 || incomeByMonth.size > 0,
  };
}

function monthEndIncome(today: Date, loggedMonths: Set<string>, monthlySalary: number): { offset: number; label: string }[] {
  if (monthlySalary <= 0) return [];
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + HORIZON);
  const pays: { offset: number; label: string }[] = [];
  let monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  while (monthEnd <= horizon) {
    const monthKey = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}`;
    const offset = Math.round((dayStamp(monthEnd).getTime() - today.getTime()) / 86_400_000);
    if (offset >= 0 && offset <= HORIZON && !loggedMonths.has(monthKey)) {
      pays.push({
        offset,
        label: monthEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      });
    }
    monthEnd = new Date(monthEnd.getFullYear(), monthEnd.getMonth() + 2, 0);
  }
  return pays;
}
