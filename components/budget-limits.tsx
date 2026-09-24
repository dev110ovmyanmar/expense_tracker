"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { budgetBarClass, budgetBarWidth, budgetLevel, type CategoryLimits } from "@/lib/budget-status";
import { formatMoney, parseMoney } from "@/lib/format";
import { EXPENSE_CATEGORIES, type Category } from "@/types/expense";

export function BudgetLimits({
  budget,
  spent,
  categorySpent,
  categoryLimits,
  onLimit,
}: {
  budget: number;
  spent: number;
  categorySpent: Partial<Record<Category, number>>;
  categoryLimits: CategoryLimits;
  onLimit: (category: Category, amount: number) => Promise<void>;
}) {
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState("");
  const open = EXPENSE_CATEGORIES.filter((entry) => !(categoryLimits[entry] && categoryLimits[entry] > 0));
  const rows = EXPENSE_CATEGORIES.filter((entry) => (categoryLimits[entry] ?? 0) > 0);

  function save(event: FormEvent) {
    event.preventDefault();
    const parsed = parseMoney(amount);
    if (!category || parsed === null || parsed <= 0) {
      toast.error("Choose a category and a limit above zero.");
      return;
    }
    void onLimit(category as Category, parsed)
      .then(() => {
        setAmount("");
        setCategory("");
      })
      .catch((error: unknown) => {
        toast.error("Could not save the limit", {
          description: error instanceof Error ? error.message : "Try again in a moment.",
        });
      });
  }

  return (
    <section className="grid gap-4 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Budget limits</h2>
          <p className="mt-1 text-xs text-muted-foreground">Orange from 80%. Red at 100%.</p>
        </div>
        <div className="flex gap-3 text-[11px] text-muted-foreground">
          <Legend className="bg-primary" label="Under 80%" />
          <Legend className="bg-orange-400" label="80%" />
          <Legend className="bg-destructive" label="100%" />
        </div>
      </div>

      <div className="grid gap-3">
        {budget > 0 ? (
          <LimitRow label="Monthly total" spent={spent} limit={budget} />
        ) : (
          <p className="text-sm text-muted-foreground">Set a monthly budget in the sidebar to watch the total.</p>
        )}
        {rows.map((entry) => (
          <LimitRow
            key={entry}
            label={entry}
            spent={categorySpent[entry] ?? 0}
            limit={categoryLimits[entry] ?? 0}
            onRemove={() => {
              void onLimit(entry, 0).catch((error: unknown) => {
                toast.error("Could not remove the limit", {
                  description: error instanceof Error ? error.message : "Try again in a moment.",
                });
              });
            }}
          />
        ))}
      </div>

      {open.length > 0 ? (
        <form onSubmit={save} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="category-limit">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category-limit" className="w-full">
                <SelectValue placeholder="Food, Transport…" />
              </SelectTrigger>
              <SelectContent>
                {open.map((entry) => (
                  <SelectItem key={entry} value={entry}>{entry}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="category-limit-amount">Limit</Label>
            <Input
              id="category-limit-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-10 font-mono"
              aria-label="Category limit in kyat"
            />
          </div>
          <Button type="submit" className="h-10">Set limit</Button>
        </form>
      ) : null}
    </section>
  );
}

function LimitRow({
  label,
  spent,
  limit,
  onRemove,
}: {
  label: string;
  spent: number;
  limit: number;
  onRemove?: () => void;
}) {
  const level = budgetLevel(spent, limit);
  const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-sm">{label}</p>
        <p className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {formatMoney(spent)} / {formatMoney(limit)} · {percent}%
          {onRemove ? (
            <button type="button" className="ml-2 text-muted-foreground underline-offset-2 hover:underline" onClick={onRemove}>
              Remove
            </button>
          ) : null}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${budgetBarClass(level)}`} style={{ width: `${budgetBarWidth(spent, limit)}%` }} />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}
