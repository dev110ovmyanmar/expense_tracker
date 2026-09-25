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
}

export interface RunwayForecast {
  dailyExpense: number;
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

  const salaryByMonth = new Map<string, number>();
  for (const expense of expenses) {
    if (expense.type !== "income" || expense.category !== "Salary") continue;
    const key = expense.date.slice(0, 7);
    salaryByMonth.set(key, (salaryByMonth.get(key) ?? 0) + expense.amount);
  }
  const monthlySalary =
    salaryByMonth.size > 0
      ? roundMoney([...salaryByMonth.values()].reduce((sum, amount) => sum + amount, 0) / salaryByMonth.size)
      : 0;

  const net = expenses.reduce(
    (sum, expense) => sum + (expense.type === "income" ? expense.amount : -expense.amount),
    0,
  );
  const startingBalance = roundMoney(net);
  const warningLevel = dailyExpense > 0 ? roundMoney(dailyExpense * WARNING_DAYS) : 0;
  const salaryDates = new Set(
    expenses.filter((expense) => expense.type === "income" && expense.category === "Salary").map((expense) => expense.date),
  );
  const pay = upcomingSalary(today, salaryDates, monthlySalary);

  let lowDay: number | null = null;
  const points: RunwayPoint[] = [];
  for (let day = 0; day <= HORIZON; day += 1) {
    const salary = pay && day >= pay.offset ? monthlySalary : 0;
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
    });
  }

  return {
    dailyExpense,
    monthlySalary,
    startingBalance,
    endingBalance: points[HORIZON]?.balance ?? startingBalance,
    warningLevel,
    lowDay,
    payIncluded: Boolean(pay),
    payLabel: pay?.label ?? null,
    points,
    ready: spending.length > 0 || salaryByMonth.size > 0,
  };
}

function upcomingSalary(today: Date, salaryDates: Set<string>, monthlySalary: number): { offset: number; label: string } | null {
  if (monthlySalary <= 0 || salaryDates.size === 0) return null;
  const latest = [...salaryDates].sort().at(-1);
  if (!latest) return null;
  const payDay = Number(latest.slice(8, 10));
  let cursor = payOnOrAfter(today, payDay);
  if (salaryDates.has(isoDate(cursor))) cursor = payOnOrAfter(addMonths(cursor, 1), payDay);
  const offset = Math.round((dayStamp(cursor).getTime() - today.getTime()) / 86_400_000);
  if (offset < 0 || offset > HORIZON || salaryDates.has(isoDate(cursor))) return null;
  return {
    offset,
    label: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function payOnOrAfter(today: Date, payDay: number): Date {
  const thisMonth = clampPayDay(today.getFullYear(), today.getMonth(), payDay);
  if (thisMonth >= today) return thisMonth;
  return clampPayDay(today.getFullYear(), today.getMonth() + 1, payDay);
}

function clampPayDay(year: number, month: number, payDay: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(payDay, last));
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
