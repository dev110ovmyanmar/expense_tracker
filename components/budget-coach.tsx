"use client";

import { Sparkles } from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";
import type { Expense } from "@/types/expense";

export function BudgetCoach({ expenses, budget }: { expenses: Expense[]; budget: number }) {
  const refreshKey = useMemo(
    () => `${budget}:${expenses.map((expense) => `${expense.id}:${expense.amount}:${expense.date}`).join(",")}`,
    [expenses, budget],
  );
  const [reply, setReply] = useState<{ key: string; message: string } | null>(null);
  const loading = reply?.key !== refreshKey;
  const message = loading ? "" : (reply?.message ?? "");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const headers: HeadersInit = {};
      if (isSupabaseConfigured()) {
        const token = (await getSupabase().auth.getSession()).data.session?.access_token;
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      return fetch("/api/coach", { signal: controller.signal, headers });
    })()
      .then((response) => response.json().catch(() => null))
      .then((payload: unknown) => {
        const next =
          typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
            ? payload.message.trim()
            : "";
        setReply({
          key: refreshKey,
          message: next || "အခု ခဏအကြံမပေးနိုင်သေးပါ။ ခဏနေပြီး ပြန်ကြည့်ပေးပါ။",
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setReply({ key: refreshKey, message: "အခု ခဏအကြံမပေးနိုင်သေးပါ။ ခဏနေပြီး ပြန်ကြည့်ပေးပါ။" });
      });
    return () => controller.abort();
  }, [refreshKey]);

  return (
    <section
      aria-live="polite"
      aria-busy={loading}
      className="flex items-start gap-3 rounded-3xl bg-[oklch(0.95_0.025_78)] px-4 py-4 ring-1 ring-primary/20 dark:bg-[oklch(0.32_0.03_55)]"
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
