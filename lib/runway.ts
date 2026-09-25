import { roundMoney } from "@/lib/format";
import type { Expense } from "@/types/expense";

const HORIZON = 30;
const LOOKBACK_DAYS = 30;
const WARNING_DAYS = 7;

export interface ScheduledIncome {
  date: Date;
  amount: number;
}

export interface RunwayDatum {
  day: number;
  date: Date;
  projectedBalance: number;
  label: string;
  when: string;
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
  points: RunwayDatum[];
  ready: boolean;
}

function dayStamp(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function averageDailySpend(expenses: Expense[], now = new Date(), days = LOOKBACK_DAYS): number {
  const today = dayStamp(now);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const recent = expenses.filter((expense) => {
    if (expense.type !== "expense") return false;
    const date = parseDay(expense.date);
    return date >= cutoff && date <= today;
  });
  if (recent.length === 0) return 0;
  const total = recent.reduce((sum, expense) => sum + expense.amount, 0);
  return roundMoney(total / days);
}

export function generateRunwayData(
  currentBalance: number,
  avgDailySpend: number,
  scheduledIncomes: ScheduledIncome[],
  now = new Date(),
): RunwayDatum[] {
  const today = dayStamp(now);
  const incomeByDay = new Map<string, number>();
  for (const income of scheduledIncomes) {
    const key = isoDate(dayStamp(income.date));
    incomeByDay.set(key, (incomeByDay.get(key) ?? 0) + income.amount);
  }
  const warningLevel = avgDailySpend > 0 ? roundMoney(avgDailySpend * WARNING_DAYS) : 0;
  let running = roundMoney(currentBalance);
  const points: RunwayDatum[] = [];
  for (let day = 0; day <= HORIZON; day += 1) {
    const date = new Date(today);
    date.setDate(date.getDate() + day);
    const payday = incomeByDay.get(isoDate(date)) ?? 0;
    if (day > 0) running = roundMoney(running - avgDailySpend);
    if (payday) running = roundMoney(running + payday);
    points.push({
      day,
      date,
      projectedBalance: running,
      label: day === 0 ? "Today" : date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      when: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      low: running < warningLevel,
      payday: day > 0 && incomeByDay.has(isoDate(date)),
    });
  }
  return points;
}

export function forecastRunway(expenses: Expense[], now = new Date()): RunwayForecast {
  const today = dayStamp(now);
  const spending = expenses.filter((expense) => expense.type === "expense");
  const income = expenses.filter((expense) => expense.type === "income");
  const totalIncome = roundMoney(income.reduce((sum, expense) => sum + expense.amount, 0));
  const totalSpent = roundMoney(spending.reduce((sum, expense) => sum + expense.amount, 0));
  const currentBalance = roundMoney(totalIncome - totalSpent);
  const avgDailySpend = averageDailySpend(expenses, today);

  const incomeByMonth = new Map<string, number>();
  for (const entry of income) {
    const key = entry.date.slice(0, 7);
    incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + entry.amount);
  }
  const latestMonthKey = [...incomeByMonth.keys()].sort().at(-1);
  const latestMonthIncome = latestMonthKey ? roundMoney(incomeByMonth.get(latestMonthKey) ?? 0) : 0;
  const scheduledIncomes = monthEndIncome(today, new Set(incomeByMonth.keys()), latestMonthIncome);
  const points = generateRunwayData(currentBalance, avgDailySpend, scheduledIncomes, today);
  const lowDay = points.find((point) => point.low)?.day ?? null;
  const payLabels = scheduledIncomes.map((pay) => pay.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }));

  return {
    dailyExpense: avgDailySpend,
    totalIncome,
    monthlySalary: latestMonthIncome,
    startingBalance: currentBalance,
    endingBalance: points[HORIZON]?.projectedBalance ?? currentBalance,
    warningLevel: avgDailySpend > 0 ? roundMoney(avgDailySpend * WARNING_DAYS) : 0,
    lowDay,
    payIncluded: scheduledIncomes.length > 0,
    payLabel: payLabels.length > 0 ? payLabels.join(" and ") : null,
    points,
    ready: spending.length > 0 || income.length > 0,
  };
}

function monthEndIncome(today: Date, loggedMonths: Set<string>, amount: number): ScheduledIncome[] {
  if (amount <= 0) return [];
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + HORIZON);
  const pays: ScheduledIncome[] = [];
  let monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  while (monthEnd <= horizon) {
    const monthKey = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}`;
    if (monthEnd >= today && !loggedMonths.has(monthKey)) pays.push({ date: monthEnd, amount });
    monthEnd = new Date(monthEnd.getFullYear(), monthEnd.getMonth() + 2, 0);
  }
  return pays;
}
