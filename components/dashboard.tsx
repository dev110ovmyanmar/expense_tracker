"use client";

import { ArrowDownLeft, ArrowUpRight, PiggyBank, Scale, ScanLine } from "lucide-react";
import Link from "next/link";
import { BudgetCoach } from "@/components/budget-coach";
import { AddExpenseButton } from "@/components/ExpenseForm";
import { PageHeader } from "@/components/page-header";
import { useExpenses } from "@/components/expense-provider";
import { RunwayChart } from "@/components/runway-chart";
import { SpendingChart } from "@/components/SpendingChart";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { expensesInMonth, ofType, sortExpenses, sumAmounts } from "@/lib/expenses";
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

  const monthRows = sortExpenses(expensesInMonth(expenses));
  const monthExpenses = ofType(monthRows, "expense");
  const monthIncome = ofType(monthRows, "income");
  const spent = sumAmounts(monthExpenses);
  const earned = sumAmounts(monthIncome);
  const net = roundMoney(earned - spent);
  const remaining = roundMoney(budget - spent);
  const over = budget > 0 && remaining < 0;
  const month = formatMonth();

  const description =
    monthRows.length === 0
      ? `Nothing logged for ${month} yet. Add income, a cost, or a scanned receipt.`
      : net >= 0
        ? `${formatMoney(earned)} in and ${formatMoney(spent)} out. ${formatMoney(net)} is left this month.`
        : `${formatMoney(spent)} went out against ${formatMoney(earned)} in. The month is ${formatMoney(Math.abs(net))} short.`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={formatLongDate()}
        title={greeting()}
        description={description}
        actions={
          <>
            <AddExpenseButton className="h-10" />
            <AddExpenseButton label="Add income" variant="outline" className="h-10" initialType="income" />
            <Button asChild variant="outline" className="h-10">
              <Link href="/scanner">
                <ScanLine />
                Scan receipt
              </Link>
            </Button>
          </>
        }
      />

      <BudgetCoach expenses={monthRows} budget={budget} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total income"
          value={`+${formatMoney(earned)}`}
          hint={`${monthIncome.length} ${monthIncome.length === 1 ? "payment" : "payments"} this month`}
          icon={ArrowDownLeft}
          tone="positive"
        />
        <StatCard
          label="Total expenses"
          value={`−${formatMoney(spent)}`}
          hint={`${monthExpenses.length} ${monthExpenses.length === 1 ? "expense" : "expenses"} this month`}
          icon={ArrowUpRight}
          tone="warning"
        />
        <StatCard
          label="Net balance"
          value={`${net >= 0 ? "+" : "−"}${formatMoney(Math.abs(net))}`}
          hint={net >= 0 ? "Income covers this month's spending" : "Spending is ahead of income"}
          icon={Scale}
          tone={net >= 0 ? "positive" : "warning"}
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
      </section>

      <RunwayChart expenses={expenses} />

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
            <CardDescription>The newest income and expenses this month</CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionList
              expenses={monthRows.slice(0, 5)}
              emptyTitle="Nothing yet"
              emptyBody="Add income, log a cost, or confirm a scanned receipt."
            />
          </CardContent>
          {monthRows.length > 0 ? (
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
  tone?: "default" | "warning" | "positive";
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
              tone === "warning"
                ? "bg-destructive/10 text-destructive"
                : tone === "positive"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-primary/10 text-primary"
            }`}
          >
            <Icon className="size-4" />
          </span>
        </div>
        <p
          className={`font-mono text-2xl tracking-tight tabular-nums ${
            tone === "warning" ? "text-destructive" : tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : ""
          }`}
        >
          {value}
        </p>
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
