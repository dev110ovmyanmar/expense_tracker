"use client";

import { BookOpen, LayoutDashboard, ScanLine, UserRound, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { DailyReminderBanner, ReminderToggle } from "@/components/daily-reminder";
import { useExpenses } from "@/components/expense-provider";
import { ThemePicker } from "@/components/theme-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { budgetBarClass, budgetLevel } from "@/lib/budget-status";
import { expensesInMonth, ofType, sumAmounts } from "@/lib/expenses";
import { useAuth } from "@/context/AuthContext";
import { formatMoney, formatMonth, moneyInput, parseMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/expenses", label: "Ledger", icon: BookOpen },
  { href: "/plan", label: "Plan", icon: Wallet },
  { href: "/scanner", label: "Scanner", icon: ScanLine },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { storageWarning, storageMessage, hydrated, userName } = useExpenses();
  const { configured, signOut } = useAuth();

  if (!hydrated) {
    return <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-svh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="px-5 pt-6">
          <Brand />
        </div>
        <nav className="mt-8 grid gap-1 px-3">
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} active={pathname === item.href} />
          ))}
          <NavLink href="/profile" label="Profile" icon={UserRound} active={pathname === "/profile"} />
        </nav>
        <div className="mt-auto grid gap-3 px-4 pt-2 pb-4">
          <BudgetControls />
          <ReminderToggle />
          <div className="grid gap-3 border-t border-sidebar-border pt-3">
            <div className="flex items-center gap-2.5">
              <Link href="/profile" className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                {(userName ?? "A").slice(0, 1).toUpperCase()}
              </Link>
              <Link href="/profile" className="min-w-0 flex-1 truncate text-sm font-medium">
                {userName ?? "Profile"}
              </Link>
              {configured ? (
                <button type="button" className="shrink-0 text-xs text-muted-foreground" onClick={() => void signOut()}>
                  Log out
                </button>
              ) : null}
            </div>
            <ThemePicker />
          </div>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/85 px-4 py-3 backdrop-blur md:hidden">
          <Brand />
          <div className="flex items-center gap-3">
            <Link href="/profile" className="max-w-28 truncate text-sm font-medium">
              {userName ?? "Profile"}
            </Link>
            <ThemePicker compact />
          </div>
        </header>
        <main className="overflow-x-hidden px-4 pt-3 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pt-8 md:pb-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 md:gap-5">
            {storageWarning ? (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {storageMessage ?? "The ledger could not be saved. Try again in a moment."}
              </p>
            ) : null}
            <DailyReminderBanner />
            <div className="grid gap-3 md:hidden">
              <ReminderToggle />
              <BudgetControls compact />
            </div>
            {children}
          </div>
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <ul className="grid grid-cols-4 px-1">
            {NAV.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-8 place-items-center rounded-full",
                        active ? "bg-primary/10 text-primary" : "",
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-primary font-heading text-lg text-primary-foreground">
        A
      </span>
      <span>
        <span className="block font-heading text-lg leading-none">Aura</span>
        <span className="text-[11px] text-muted-foreground">Personal ledger</span>
      </span>
    </Link>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

function BudgetControls({ compact = false }: { compact?: boolean }) {
  const { budget, expenses, hydrated, setBudget } = useExpenses();
  const [draft, setDraft] = useState<string | null>(null);
  const spent = sumAmounts(ofType(expensesInMonth(expenses), "expense"));
  const ratio = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const remaining = budget - spent;

  function commit() {
    const parsed = parseMoney(draft ?? "");
    setDraft(null);
    if (parsed === null) return;
    void setBudget(parsed).catch((error: unknown) => {
      toast.error("Could not save the budget", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    });
  }

  if (!hydrated) {
    return <div className="h-24 animate-pulse rounded-xl bg-muted" />;
  }

  const body = (
    <div className="grid gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {formatMonth()}
          </p>
          <p className="mt-1 font-mono text-sm tabular-nums">
            {formatMoney(spent)}
            <span className="text-muted-foreground"> of {formatMoney(budget)}</span>
          </p>
        </div>
        {budget > 0 ? (
          <p className={`text-xs ${remaining < 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {remaining < 0 ? `${formatMoney(Math.abs(remaining))} over` : `${formatMoney(remaining)} left`}
          </p>
        ) : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${budgetBarClass(budgetLevel(spent, budget))}`}
          style={{ width: `${ratio}%` }}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={compact ? "budget-mobile" : "budget-desktop"}>Monthly budget</Label>
        <Input
          id={compact ? "budget-mobile" : "budget-desktop"}
          inputMode="decimal"
          value={draft ?? moneyInput(budget)}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setDraft(moneyInput(budget))}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="h-10 font-mono"
          aria-label="Monthly budget in kyat"
        />
      </div>
    </div>
  );

  if (!compact) return body;

  return (
    <details className="rounded-xl bg-card px-3 py-2 ring-1 ring-foreground/10">
      <summary className="cursor-pointer list-none text-sm font-medium">
        Budget · {budget > 0 && remaining < 0 ? `${formatMoney(Math.abs(remaining))} over` : `${formatMoney(Math.max(remaining, 0))} left`}
      </summary>
      <div className="pt-3">{body}</div>
    </details>
  );
}
