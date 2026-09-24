"use client";

import { useState, type ReactNode } from "react";
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

  return (
    <section id="goals" className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Savings goals</h2>
          <p className="text-sm text-muted-foreground">
            {formatMonth()} · {formatMoney(income)} in · {formatMoney(Math.max(net, 0))} left
            {planned > 0 ? ` · ${formatMoney(planned)} planned` : ""}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={() => { setEditing(null); setOpen(true); }}>
          Add goal
        </Button>
      </div>
      {planned > Math.max(net, 0) && income > 0 ? (
        <p className="text-xs text-muted-foreground">Planned savings are above this month&apos;s net.</p>
      ) : null}
      {goals.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No savings goals yet.
        </p>
      ) : (
        <ul className="grid gap-2">
          {goals.map((goal) => {
            const progress = goalProgress(goal);
            const pace = neededMonthly(goal);
            const setAside = allocatedThisMonth(goal);
            return (
              <li key={goal.id} className="grid gap-2 rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/10">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium">{goal.name}</p>
                  <p className="shrink-0 font-mono text-sm tabular-nums">{progress.percent}%</p>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress.percent}
                  aria-label={`${goal.name} saved`}
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress.percent}%` }} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {formatMoney(goal.savedAmount)} of {formatMoney(goal.targetAmount)}
                  {goal.targetDate ? ` · ${formatDate(goal.targetDate)}` : ""}
                  {pace !== null && !progress.complete ? ` · ${formatMoney(pace)} / month` : ""}
                  {progress.complete ? " · Reached" : ""}
                </p>
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
                      {setAside ? "Set aside" : `Set aside ${formatMoney(goal.monthlyAllocation)}`}
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="outline" onClick={() => setAdding(goal)}>Add</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(goal); setOpen(true); }}>Edit</Button>
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
        saving={saving}
        onOpenChange={setOpen}
        onSave={async (input) => {
          if (editing) await updateGoal(editing.id, input);
          else await addGoal(input);
        }}
        onDelete={editing ? async () => removeGoal(editing.id) : undefined}
      />
      <AddAmountDialog goal={adding} onOpenChange={(next) => !next && setAdding(null)} />
    </section>
  );
}

function GoalDialog({
  open,
  goal,
  saving,
  onOpenChange,
  onSave,
  onDelete,
}: {
  open: boolean;
  goal: SavingsGoal | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: SavingsGoalInput) => Promise<void>;
  onDelete?: () => Promise<void>;
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
          <DialogDescription>A target, a date, and how much of each month&apos;s income to set aside.</DialogDescription>
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
          <Field label="Name" id="goal-name">
            <Input id="goal-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Travel fund" className="h-11" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Target" id="goal-target">
              <Input id="goal-target" inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} className="h-11 font-mono" />
            </Field>
            <Field label="Target date" id="goal-date">
              <Input id="goal-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-11" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Each month" id="goal-monthly">
              <Input id="goal-monthly" inputMode="decimal" value={monthly} onChange={(event) => setMonthly(event.target.value)} className="h-11 font-mono" />
            </Field>
            <Field label="Already saved" id="goal-saved">
              <Input id="goal-saved" inputMode="decimal" value={saved} onChange={(event) => setSaved(event.target.value)} className="h-11 font-mono" />
            </Field>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="sm:justify-between">
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                disabled={saving}
                onClick={() => {
                  void onDelete().then(
                    () => {
                      toast.success("Goal removed", { description: goal?.name });
                      onOpenChange(false);
                    },
                    (deleteError: unknown) => setError(deleteError instanceof Error ? deleteError.message : "Could not remove."),
                  );
                }}
              >
                Delete
              </Button>
            ) : <span />}
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
          <DialogDescription>This stays in the goal and is not recorded as spending.</DialogDescription>
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
                toast.success("Added to the goal", { description: formatMoney(parsed) });
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

function Field({ label, id, children }: { label: string; id?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
