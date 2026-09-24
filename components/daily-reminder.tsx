"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useExpenses } from "@/components/expense-provider";
import { todayISO } from "@/lib/format";

export function ReminderToggle() {
  const { dailyReminder, saving, setDailyReminder } = useExpenses();

  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>
        <span className="block">Daily reminder</span>
        <span className="text-xs text-muted-foreground">Prompt to log expenses and receipts.</span>
      </span>
      <input
        type="checkbox"
        className="size-4"
        checked={dailyReminder}
        disabled={saving}
        onChange={(event) => {
          const enabled = event.target.checked;
          void (async () => {
            if (enabled && typeof Notification !== "undefined" && Notification.permission === "default") {
              const permission = await Notification.requestPermission();
              if (permission !== "granted") toast.message("Aura will remind you in the app. Allow notifications for a browser prompt.");
            }
            await setDailyReminder(enabled);
          })().catch((error: unknown) => {
            toast.error("Could not save the reminder", { description: error instanceof Error ? error.message : "Try again." });
          });
        }}
      />
    </label>
  );
}

export function DailyReminderBanner() {
  const { dailyReminder, lastReminded, expenses, markReminded } = useExpenses();
  const today = todayISO();
  const loggedToday = expenses.some((expense) => expense.date === today);
  const show = dailyReminder && lastReminded !== today && !loggedToday;

  useEffect(() => {
    if (!show || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    new Notification("Aura", { body: "Log today's expenses and receipts." });
  }, [show]);

  if (!show) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2.5 text-sm ring-1 ring-foreground/10">
      <p>Log today&apos;s expenses and receipts.</p>
      <button type="button" className="shrink-0 text-xs text-muted-foreground" onClick={() => void markReminded(today)}>
        Dismiss
      </button>
    </div>
  );
}
