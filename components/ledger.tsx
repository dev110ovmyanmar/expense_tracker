"use client";

import { Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { CategoryDot } from "@/components/category-icon";
import { AddExpenseButton } from "@/components/ExpenseForm";
import { useExpenses } from "@/components/expense-provider";
import { PageHeader } from "@/components/page-header";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filterExpenses, ofType, sumAmounts } from "@/lib/expenses";
import { formatMoney, formatMonth, startOfMonthISO, todayISO } from "@/lib/format";
import { CATEGORIES, type Category } from "@/types/expense";

export function Ledger() {
  const { expenses, hydrated } = useExpenses();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [from, setFrom] = useState(startOfMonthISO);
  const [to, setTo] = useState(todayISO);

  const deferredQuery = useDeferredValue(query);
  const searching = deferredQuery !== query;
  const rangeInvalid = Boolean(from && to && from > to);
  const filtered = useMemo(
    () =>
      rangeInvalid
        ? []
        : filterExpenses(expenses, { query: deferredQuery, category, from, to }),
    [expenses, deferredQuery, category, from, to, rangeInvalid],
  );
  const incomeTotal = sumAmounts(ofType(filtered, "income"));
  const expenseTotal = sumAmounts(ofType(filtered, "expense"));
  const monthDefault = from === startOfMonthISO() && to === todayISO() && !query && category === "all";

  if (!hydrated) return <PageSkeleton />;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        eyebrow={formatMonth()}
        title="Ledger"
        description="Search, narrow by category or date, then edit or remove a charge. Scanned receipts stay marked."
        actions={<AddExpenseButton className="h-10" />}
      />

      <div className="grid min-w-0 gap-3 rounded-xl bg-card p-3 shadow-[0_10px_30px_-18px_oklch(0_0_0/0.55)] ring-1 ring-foreground/10 sm:p-4 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,160px)_minmax(0,160px)]">
        <div className="grid gap-2">
          <Label htmlFor="ledger-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="ledger-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Vendor, note, or item"
              className="h-11 pl-8"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ledger-category">Category</Label>
          <Select
            value={category}
            onValueChange={(value) => setCategory(value === "all" ? "all" : (value as Category))}
          >
            <SelectTrigger id="ledger-category" className="h-11 w-full">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((item) => (
                <SelectItem key={item} value={item}>
                  <span className="flex items-center gap-2">
                    <CategoryDot category={item} className="size-2 rounded-full" />
                    {item}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:contents">
          <div className="grid min-w-0 flex-1 gap-2">
            <Label htmlFor="ledger-from">From</Label>
            <Input
              id="ledger-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="h-11 w-full min-w-0"
            />
          </div>
          <div className="grid min-w-0 flex-1 gap-2">
            <Label htmlFor="ledger-to">To</Label>
            <Input
              id="ledger-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="h-11 w-full min-w-0"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-5 text-muted-foreground sm:text-sm">
          {rangeInvalid
            ? "The start date is after the end date."
            : `Showing ${filtered.length} of ${expenses.length} · +${formatMoney(incomeTotal)} in · −${formatMoney(expenseTotal)} out`}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery("");
            setCategory("all");
            setFrom(startOfMonthISO());
            setTo(todayISO());
          }}
          disabled={monthDefault}
        >
          Reset to this month
        </Button>
      </div>

      <div className={`rounded-xl bg-card px-3 py-2 shadow-[0_10px_30px_-18px_oklch(0_0_0/0.55)] ring-1 ring-foreground/10 transition-opacity duration-200 sm:px-5 sm:py-4 ${searching ? "opacity-60" : ""}`}>
        <TransactionList
          expenses={filtered}
          emptyTitle={expenses.length === 0 ? "The ledger is empty" : "Nothing matches"}
          emptyBody={
            expenses.length === 0
              ? "Add an expense or confirm a scanned receipt and it will show up here."
              : rangeInvalid
                ? "Swap the dates, or reset the range to this month."
                : "Try another vendor, category, or a wider date range."
          }
        />
      </div>
    </div>
  );
}
