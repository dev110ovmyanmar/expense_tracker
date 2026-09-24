"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useExpenses } from "@/components/expense-provider";
import { formatDate, formatMoney, formatMonth, parseMoney } from "@/lib/format";
import { allocatedThisMonth, goalProgress, neededMonthly } from "@/lib/goals";
import type { SavingsGoal, SavingsGoalInput } from "@/types/planning";

export function SavingsGoals({ income, net }: { income: number; net: number }) {
  const { goals, saving, addGoal, updateGoal, removeGoal, addToGoal } = useExpenses();
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<SavingsGoal | null>(null);
  const planned = goals.reduce((sum, goal) => sum + goal.monthlyAllocation, 0);
  const month = formatMonth();

  return (
    <section id="goals" className="grid gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl">Savings goals</h2>
          <p className="text-sm text-muted-foreground">
            Envelopes for a target amount. Setting money aside does not create a spending line.
          </p>
        </div>
        <Button type="button" className="min-h-11 shrink-0" onClick={() => { setEditing(null); setOpen(true); }}>
          Add goal
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {month}: {formatMoney(income)} income, {formatMoney(Math.max(net, 0))} left after spending.
        {planned > 0 ? ` Envelopes ask for ${formatMoney(planned)} a month.` : ""}
        {planned > Math.max(net, 0) && income > 0 ? " That is more than this month's net." : ""}
      </p>
      {goals.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No envelopes yet. Try a travel fund or emergency savings.
        </p>
      ) : (
        <ul className="grid gap-3">
          {goals.map((goal) => {
            const progress = goalProgress(goal);
            const pace = neededMonthly(goal);
            const setAside = allocatedThisMonth(goal);
            return (
              <li key={goal.id} className="grid gap-2 rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/10">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium">{goal.name}</p>
                  <p className="shrink-0 font-mono text-sm tabular-nums">{progress.percent}%</p>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress.percent}
                  aria-label={`${goal.name} saved`}
                  className="h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress.percent}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(goal.savedAmount)} of {formatMoney(goal.targetAmount)}
                  {goal.targetDate ? ` · by ${formatDate(goal.targetDate)}` : ""}
                  {goal.monthlyAllocation > 0 ? ` · ${formatMoney(goal.monthlyAllocation)} from monthly income` : ""}
                </p>
                {pace !== null && !progress.complete ? (
                  <p className="text-xs text-muted-foreground">
                    About {formatMoney(pace)} a month reaches the date.
                    {goal.monthlyAllocation > 0 && goal.monthlyAllocation + 1 < pace
                      ? ` The envelope is ${formatMoney(pace - goal.monthlyAllocation)} short of that pace.`
                      : ""}
                  </p>
                ) : null}
                {progress.complete ? <p className="text-xs text-emerald-700 dark:text-emerald-400">Target reached.</p> : null}
                <div className="flex flex-wrap gap-2">
                  {goal.monthlyAllocation > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={saving || setAside}
                      onClick={() => {
                        void addToGoal(goal.id, goal.monthlyAllocation, true).then(
                          () => toast.success("Set aside", { description: `${formatMoney(goal.monthlyAllocation)} for ${goal.name}` }),
                          (error: unknown) => toast.error("Could not set this aside", { description: error instanceof Error ? error.message : "Try again." }),
                        );
                      }}
                    >
                      {setAside ? "Set aside this month" : `Set aside ${formatMoney(goal.monthlyAllocation)}`}
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="outline" onClick={() => setAdding(goal)}>Add amount</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(goal); setOpen(true); }}>Edit</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => {
                      void removeGoal(goal.id).then(
                        () => toast.success("Goal removed", { description: goal.name }),
                        (error: unknown) => toast.error("Could not remove this goal", { description: error instanceof Error ? error.message : "Try again." }),
                      );
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <GoalDialog
        key={editing?.id ?? "new-goal"}
        open={open}
        goal={editing}
        onOpenChange={setOpen}
        onSave={async (input) => {
          if (editing) await updateGoal(editing.id, input);
          else await addGoal(input);
        }}
      />
      <AddAmountDialog goal={adding} onOpenChange={(next) => !next && setAdding(null)} />
    </section>
  );
}

function GoalDialog({
  open,
  goal,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  goal: SavingsGoal | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: SavingsGoalInput) => Promise<void>;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? String(goal.targetAmount) : "");
  const [date, setDate] = useState(goal?.targetDate ?? "");
  const [monthly, setMonthly] = useState(goal ? String(goal.monthlyAllocation) : "");
  const [saved, setSaved] = useState(goal ? String(goal.savedAmount) : "0");
  const [error, setError] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit goal" : "Add a savings goal"}</DialogTitle>
          <DialogDescription>Set the target and how much of each month of income goes into this envelope.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const targetAmount = parseMoney(target);
            const monthlyAllocation = parseMoney(monthly || "0");
            const savedAmount = parseMoney(saved || "0");
            if (!name.trim() || targetAmount === null || targetAmount <= 0 || monthlyAllocation === null || savedAmount === null) {
              setError("Add a name and a target amount.");
              return;
            }
            void onSave({
              name: name.trim(),
              targetAmount,
              targetDate: date || null,
              monthlyAllocation,
              savedAmount,
            }).then(
              () => {
                toast.success(goal ? "Goal updated" : "Goal added");
                onOpenChange(false);
              },
              (saveError: unknown) => setError(saveError instanceof Error ? saveError.message : "Could not save."),
            );
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="goal-name">Name</Label>
            <Input id="goal-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Travel fund" className="h-11" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="goal-target">Target</Label>
              <Input id="goal-target" inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} className="h-11 font-mono" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="goal-date">Target date</Label>
              <Input id="goal-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-11" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="goal-monthly">Each month</Label>
              <Input id="goal-monthly" inputMode="decimal" value={monthly} onChange={(event) => setMonthly(event.target.value)} placeholder="From income" className="h-11 font-mono" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="goal-saved">Already saved</Label>
              <Input id="goal-saved" inputMode="decimal" value={saved} onChange={(event) => setSaved(event.target.value)} className="h-11 font-mono" />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" className="min-h-11">{goal ? "Save goal" : "Add goal"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddAmountDialog({ goal, onOpenChange }: { goal: SavingsGoal | null; onOpenChange: (open: boolean) => void }) {
  const { addToGoal } = useExpenses();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  return (
    <Dialog open={Boolean(goal)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to {goal?.name}</DialogTitle>
          <DialogDescription>This stays in the envelope and does not add an expense.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseMoney(amount);
            if (!goal || parsed === null || parsed <= 0) {
              setError("Enter an amount.");
              return;
            }
            void addToGoal(goal.id, parsed).then(
              () => {
                toast.success("Added to the envelope", { description: formatMoney(parsed) });
                setAmount("");
                onOpenChange(false);
              },
              (saveError: unknown) => setError(saveError instanceof Error ? saveError.message : "Could not add."),
            );
          }}
        >
          <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-11 font-mono" aria-label="Amount to add" />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" className="min-h-11">Add to goal</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
