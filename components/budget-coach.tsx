"use client";

import { Sparkles } from "lucide-react";
import { coachInsight, buildCoachSnapshot } from "@/lib/budget-coach";
import type { CategoryLimits } from "@/lib/budget-status";
import { useEffect, useMemo, useState } from "react";
import type { Expense } from "@/types/expense";

export function BudgetCoach({
  expenses,
  budget,
  categoryLimits,
}: {
  expenses: Expense[];
  budget: number;
  categoryLimits: CategoryLimits;
}) {
  const refreshKey = useMemo(
    () => `${budget}:${JSON.stringify(categoryLimits)}:${expenses.map((expense) => `${expense.id}:${expense.amount}:${expense.category}:${expense.date}`).join(",")}`,
    [expenses, budget, categoryLimits],
  );
  const [reply, setReply] = useState<{ key: string; message: string } | null>(null);
  const loading = reply?.key !== refreshKey;
  const message = loading ? "" : (reply?.message ?? "");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      return fetch("/api/coach", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget,
          categoryLimits,
          expenses: expenses.map((expense) => ({
            type: expense.type,
            amount: expense.amount,
            category: expense.category,
            date: expense.date,
          })),
        }),
      });
    })()
      .then((response) => response.json().catch(() => null))
      .then((payload: unknown) => {
        const next =
          typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
            ? payload.message.trim()
            : "";
        setReply({
          key: refreshKey,
          message: next || coachInsight(buildCoachSnapshot(expenses, budget, new Date(), categoryLimits)),
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setReply({
          key: refreshKey,
          message: coachInsight(buildCoachSnapshot(expenses, budget, new Date(), categoryLimits)),
        });
      });
    return () => controller.abort();
  }, [refreshKey, expenses, budget, categoryLimits]);

  return (
    <section
      aria-live="polite"
      aria-busy={loading}
      className="flex items-start gap-3 rounded-3xl bg-primary/10 px-4 py-4 ring-1 ring-primary/20"
    >
      <span className="aura-coach-glow grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Vibe coach</p>
        {loading ? (
          <div className="mt-2 grid gap-2" aria-hidden>
            <span className="h-3 w-11/12 animate-pulse rounded-full bg-primary/15" />
            <span className="h-3 w-2/3 animate-pulse rounded-full bg-primary/10" />
          </div>
        ) : (
          <p className="mt-1 text-sm leading-7">{message}</p>
        )}
      </div>
    </section>
  );
}
