"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildCoachSnapshot, localCoachMessage } from "@/lib/budget-coach";
import type { Expense } from "@/types/expense";

export function BudgetCoach({ expenses, budget }: { expenses: Expense[]; budget: number }) {
  const snapshot = useMemo(() => buildCoachSnapshot(expenses, budget), [expenses, budget]);
  const fallback = useMemo(() => localCoachMessage(snapshot), [snapshot]);
  const requestKey = useMemo(() => JSON.stringify(snapshot), [snapshot]);
  const [reply, setReply] = useState<{ key: string; message: string } | null>(null);
  const live = reply?.key === requestKey;
  const message = live && reply ? reply.message : fallback;

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        const next =
          typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
            ? payload.message.trim()
            : "";
        if (next) setReply({ key: requestKey, message: next });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [requestKey, snapshot]);

  return (
    <section
      aria-live="polite"
      className="flex items-start gap-3 rounded-3xl bg-[oklch(0.95_0.025_78)] px-4 py-4 ring-1 ring-primary/20 dark:bg-[oklch(0.32_0.03_55)]"
    >
      <span className="aura-coach-glow grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Vibe coach</p>
        <p className="mt-1 text-sm leading-7">{message}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{live ? "ဒီလအတိုင်း ပြောထားတယ်" : "ဒီလကို ကြည့်နေတယ်"}</p>
      </div>
    </section>
  );
}
