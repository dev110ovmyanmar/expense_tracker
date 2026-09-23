"use client";

import { CalendarDays, PiggyBank, ScanLine, Wallet } from "lucide-react";
import Link from "next/link";
import { AddExpenseButton } from "@/components/ExpenseForm";
import { PageHeader } from "@/components/page-header";
import { useExpenses } from "@/components/expense-provider";
import { SpendingChart } from "@/components/SpendingChart";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { expensesInMonth, sortExpenses, sumAmounts } from "@/lib/expenses";
import { formatLongDate, formatMoney, formatMonth, greeting, roundMoney } from "@/lib/format";
import type { LucideIcon } from "lucide-react";

export function Dashboard() {
  const { expenses, budget, hydrated } = useExpenses();

  if (!hydrated) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  const monthExpenses = sortExpenses(expensesInMonth(expenses));
  const spent = sumAmounts(monthExpenses);
  const scanned = monthExpenses.filter((expense) => expense.source === "ocr").length;
  const day = new Date().getDate();
  const daily = roundMoney(spent / day);
  const remaining = roundMoney(budget - spent);
  const over = budget > 0 && remaining < 0;
  const month = formatMonth();

  const description =
    monthExpenses.length === 0
      ? `Nothing logged for ${month} yet. Add a cost or scan a receipt to fill the month in.`
      : over
        ? `${formatMoney(spent)} is logged for ${month}, ${formatMoney(Math.abs(remaining))} past the ${formatMoney(budget)} budget.`
        : budget > 0
          ? `${formatMoney(spent)} across ${monthExpenses.length} expenses. ${formatMoney(remaining)} is still inside the ${formatMoney(budget)} budget.`
          : `${formatMoney(spent)} across ${monthExpenses.length} expenses. Set a monthly budget in the sidebar when you want a ceiling.`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={formatLongDate()}
        title={greeting()}
        description={description}
        actions={
          <>
            <AddExpenseButton className="h-10" />
            <Button asChild variant="outline" className="h-10">
              <Link href="/scanner">
                <ScanLine />
                Scan receipt
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Spent this month"
          value={formatMoney(spent)}
          hint={`${monthExpenses.length} ${monthExpenses.length === 1 ? "expense" : "expenses"}`}
          icon={Wallet}
        />
        <StatCard
          label={budget <= 0 ? "No budget set" : over ? "Over budget" : "Budget remaining"}
          value={budget <= 0 ? "—" : formatMoney(Math.abs(remaining))}
          hint={
            budget <= 0
              ? "Add a monthly limit in the sidebar"
              : `${formatMoney(spent)} of ${formatMoney(budget)}`
          }
          icon={PiggyBank}
          tone={over ? "warning" : "default"}
          progress={budget > 0 ? Math.min(100, (spent / budget) * 100) : undefined}
        />
        <StatCard
          label="Daily average"
          value={formatMoney(daily)}
          hint={`Across ${day} ${day === 1 ? "day" : "days"} this month`}
          icon={CalendarDays}
        />
        <StatCard
          label="Receipts scanned"
          value={String(scanned)}
          hint={scanned === 0 ? "None yet — open the scanner" : "Captured with the scanner"}
          icon={ScanLine}
          href="/scanner"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Where it went</CardTitle>
            <CardDescription>{month} by category</CardDescription>
          </CardHeader>
          <CardContent>
            <SpendingChart expenses={monthExpenses} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Latest</CardTitle>
            <CardDescription>The newest charges this month</CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionList
              expenses={monthExpenses.slice(0, 5)}
              emptyTitle="No expenses yet"
              emptyBody="Add one by hand or confirm a scanned receipt."
            />
          </CardContent>
          {monthExpenses.length > 0 ? (
            <div className="px-4 pb-4">
              <Button asChild variant="outline" className="w-full">
                <Link href="/expenses">Open the full ledger</Link>
              </Button>
            </div>
          ) : null}
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  progress,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: "default" | "warning";
  progress?: number;
  href?: string;
}) {
  const body = (
    <Card className={href ? "h-full transition-colors hover:bg-muted/50" : "h-full"}>
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {label}
          </p>
          <span
            className={`grid size-8 place-items-center rounded-lg ${
              tone === "warning" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
            }`}
          >
            <Icon className="size-4" />
          </span>
        </div>
        <p className="font-mono text-2xl tracking-tight tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
        {typeof progress === "number" ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${tone === "warning" ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  if (!href) return body;
  return (
    <Link href={href} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {body}
    </Link>
  );
}
