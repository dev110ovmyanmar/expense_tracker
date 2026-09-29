"use client";

import { BookOpen, LayoutDashboard, LogOut, ScanLine, UserRound, Wallet } from "lucide-react";
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
  const { storageWarning, storageMessage, saving, userName } = useExpenses();
  const { configured, signOut } = useAuth();

  return (
    <div className="min-h-svh">
      {saving ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary/20 md:left-64" role="status" aria-label="Saving">
          <div className="aura-savebar h-full w-1/3 bg-primary" />
        </div>
      ) : null}
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
              {configured ? <LogOutButton onClick={() => void signOut()} /> : null}
            </div>
            <ThemePicker />
          </div>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 border-b bg-background px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 md:hidden">
          <div className="flex h-12 items-center justify-between gap-3">
            <Brand compact />
            <div className="flex shrink-0 items-center gap-1">
              {configured ? <LogOutButton compact onClick={() => void signOut()} /> : null}
              <ThemePicker compact />
              <Link
                href="/profile"
                aria-label={userName ? `Profile, ${userName}` : "Profile"}
                className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-medium text-primary"
              >
                {(userName ?? "A").slice(0, 1).toUpperCase()}
              </Link>
            </div>
          </div>
        </header>
        <main className="overflow-x-hidden px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-8 md:pt-8 md:pb-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 md:gap-5">
            {storageWarning ? (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {storageMessage ?? "The ledger could not be saved. Try again in a moment."}
              </p>
            ) : null}
            <DailyReminderBanner />
            {pathname === "/" ? (
              <div className="md:hidden">
                <BudgetControls compact />
              </div>
            ) : null}
            <div key={pathname} className="animate-in fade-in slide-in-from-bottom-1 duration-300 ease-out">
              {children}
            </div>
          </div>
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
          <ul className="grid grid-cols-4">
            {NAV.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors duration-200 active:opacity-70",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
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

function LogOutButton({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  if (compact) {
    return (
      <button
        type="button"
        aria-label="Log out"
        onClick={onClick}
        className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <LogOut className="size-4" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 shrink-0 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      Log out
    </button>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary font-heading text-lg text-primary-foreground">
        A
      </span>
      <span className="min-w-0">
        <span className="block truncate font-heading text-lg leading-none">Aura</span>
        {compact ? null : <span className="text-[11px] text-muted-foreground">Personal ledger</span>}
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
        "flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-200",
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
          className={`aura-bar h-full rounded-full ${budgetBarClass(budgetLevel(spent, budget))}`}
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
    <section className="rounded-xl bg-card px-3.5 py-3 ring-1 ring-foreground/10">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">{formatMonth()}</p>
          <p className="mt-0.5 truncate font-mono text-sm tabular-nums">
            {formatMoney(spent)}
            <span className="text-muted-foreground"> of {formatMoney(budget)}</span>
          </p>
        </div>
        {budget > 0 ? (
          <p className={`shrink-0 text-xs ${remaining < 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {remaining < 0 ? `${formatMoney(Math.abs(remaining))} over` : `${formatMoney(remaining)} left`}
          </p>
        ) : null}
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`aura-bar h-full rounded-full ${budgetBarClass(budgetLevel(spent, budget))}`}
          style={{ width: `${ratio}%` }}
        />
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer list-none text-xs font-medium text-primary">Edit budget</summary>
        <div className="grid gap-3 pt-3">
          <div className="grid gap-2">
            <Label htmlFor="budget-mobile">Monthly budget</Label>
            <Input
              id="budget-mobile"
              inputMode="decimal"
              value={draft ?? moneyInput(budget)}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={() => setDraft(moneyInput(budget))}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="h-11 font-mono"
              aria-label="Monthly budget in kyat"
            />
          </div>
          <ReminderToggle />
        </div>
      </details>
    </section>
  );
}
