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
import { formatMoney, parseMoney } from "@/lib/format";
import { allocatedThisMonth, goalProgress, neededMonthly } from "@/lib/goals";
import type { SavingsGoal, SavingsGoalInput } from "@/types/planning";

function burmeseDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("my-MM", { day: "numeric", month: "short", year: "numeric" });
}

export function SavingsGoals({ income, net }: { income: number; net: number }) {
  const { goals, saving, addGoal, updateGoal, removeGoal, addToGoal } = useExpenses();
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<SavingsGoal | null>(null);
  const planned = goals.reduce((sum, goal) => sum + goal.monthlyAllocation, 0);
  const month = new Date().toLocaleDateString("my-MM", { month: "long", year: "numeric" });

  return (
    <section id="goals" className="grid gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl">စုငွေပန်းတိုင်</h2>
          <p className="text-sm text-muted-foreground">
            ပန်းတိုင်ပမာဏအတွက် အိတ်များ။ ဘေးဖယ်ထားခြင်းက အသုံးစရိတ်စာရင်း မဖြစ်ပါ။
          </p>
        </div>
        <Button type="button" className="min-h-11 shrink-0" onClick={() => { setEditing(null); setOpen(true); }}>
          ပန်းတိုင်ထည့်
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {month}။ ဝင်ငွေ {formatMoney(income)}၊ သုံးပြီး ကျန် {formatMoney(Math.max(net, 0))}။
        {planned > 0 ? ` အိတ်များက တစ်လ ${formatMoney(planned)} တောင်းထားသည်။` : ""}
        {planned > Math.max(net, 0) && income > 0 ? " ဒီလ အသားတင်ထက် ပိုများနေသည်။" : ""}
      </p>
      {goals.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          အိတ် မရှိသေးပါ။ ခရီးစရိတ် သို့မဟုတ် အရေးပေါ်စုငွေ စမ်းကြည့်ပါ။
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
                  aria-label={`${goal.name} စုပြီး`}
                  className="h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress.percent}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(goal.savedAmount)} / {formatMoney(goal.targetAmount)}
                  {goal.targetDate ? ` · ${burmeseDate(goal.targetDate)} မတိုင်မီ` : ""}
                  {goal.monthlyAllocation > 0 ? ` · လစဉ်ဝင်ငွေမှ ${formatMoney(goal.monthlyAllocation)}` : ""}
                </p>
                {pace !== null && !progress.complete ? (
                  <p className="text-xs text-muted-foreground">
                    ရက်ရောက်ဖို့ တစ်လလျှင် {formatMoney(pace)} ခန့် လိုသည်။
                    {goal.monthlyAllocation > 0 && goal.monthlyAllocation + 1 < pace
                      ? ` အိတ်က ဒီနှုန်းထက် ${formatMoney(pace - goal.monthlyAllocation)} နည်းနေသည်။`
                      : ""}
                  </p>
                ) : null}
                {progress.complete ? <p className="text-xs text-emerald-700 dark:text-emerald-400">ပန်းတိုင် ရောက်ပါပြီ။</p> : null}
                <div className="flex flex-wrap gap-2">
                  {goal.monthlyAllocation > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={saving || setAside}
                      onClick={() => {
                        void addToGoal(goal.id, goal.monthlyAllocation, true).then(
                          () => toast.success("ဘေးဖယ်ပြီးပါပြီ", { description: `${goal.name} အတွက် ${formatMoney(goal.monthlyAllocation)}` }),
                          (error: unknown) => toast.error("ဘေးမဖယ်နိုင်သေးပါ", { description: error instanceof Error ? error.message : "ခဏနေပြီး ပြန်ကြိုးစားပါ။" }),
                        );
                      }}
                    >
                      {setAside ? "ဒီလ ဖယ်ပြီးပါပြီ" : `${formatMoney(goal.monthlyAllocation)} ဖယ်မည်`}
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="outline" onClick={() => setAdding(goal)}>ပမာဏထည့်</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(goal); setOpen(true); }}>ပြင်မည်</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => {
                      void removeGoal(goal.id).then(
                        () => toast.success("ပန်းတိုင် ဖယ်ပြီးပါပြီ", { description: goal.name }),
                        (error: unknown) => toast.error("ပန်းတိုင် မဖယ်နိုင်သေးပါ", { description: error instanceof Error ? error.message : "ခဏနေပြီး ပြန်ကြိုးစားပါ။" }),
                      );
                    }}
                  >
                    ဖျက်မည်
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
          <DialogTitle>{goal ? "ပန်းတိုင် ပြင်မည်" : "စုငွေပန်းတိုင် ထည့်မည်"}</DialogTitle>
          <DialogDescription>ပန်းတိုင်ပမာဏနဲ့ လစဉ်ဝင်ငွေထဲက ဘယ်လောက်ထည့်မလဲ သတ်မှတ်ပါ။</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const targetAmount = parseMoney(target);
            const monthlyAllocation = parseMoney(monthly || "0");
            const savedAmount = parseMoney(saved || "0");
            if (!name.trim() || targetAmount === null || targetAmount <= 0 || monthlyAllocation === null || savedAmount === null) {
              setError("နာမည်နဲ့ ပန်းတိုင်ပမာဏ ထည့်ပါ။");
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
                toast.success(goal ? "ပန်းတိုင် ပြင်ပြီးပါပြီ" : "ပန်းတိုင် ထည့်ပြီးပါပြီ");
                onOpenChange(false);
              },
              (saveError: unknown) => setError(saveError instanceof Error ? saveError.message : "မသိမ်းနိုင်သေးပါ။"),
            );
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="goal-name">နာမည်</Label>
            <Input id="goal-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="ခရီးစရိတ်" className="h-11" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="goal-target">ပန်းတိုင်</Label>
              <Input id="goal-target" inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} className="h-11 font-mono" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="goal-date">ရက်စွဲ</Label>
              <Input id="goal-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-11" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="goal-monthly">လစဉ်</Label>
              <Input id="goal-monthly" inputMode="decimal" value={monthly} onChange={(event) => setMonthly(event.target.value)} placeholder="ဝင်ငွေမှ" className="h-11 font-mono" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="goal-saved">စုပြီးသား</Label>
              <Input id="goal-saved" inputMode="decimal" value={saved} onChange={(event) => setSaved(event.target.value)} className="h-11 font-mono" />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" className="min-h-11">{goal ? "ပန်းတိုင် သိမ်းမည်" : "ပန်းတိုင်ထည့်"}</Button>
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
          <DialogTitle>{goal?.name} ထဲ ထည့်မည်</DialogTitle>
          <DialogDescription>ဒီပမာဏက အိတ်ထဲမှာပဲ နေပြီး အသုံးစရိတ် မဖြစ်ပါ။</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseMoney(amount);
            if (!goal || parsed === null || parsed <= 0) {
              setError("ပမာဏ ထည့်ပါ။");
              return;
            }
            void addToGoal(goal.id, parsed).then(
              () => {
                toast.success("အိတ်ထဲ ထည့်ပြီးပါပြီ", { description: formatMoney(parsed) });
                setAmount("");
                onOpenChange(false);
              },
              (saveError: unknown) => setError(saveError instanceof Error ? saveError.message : "မထည့်နိုင်သေးပါ။"),
            );
          }}
        >
          <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-11 font-mono" aria-label="ထည့်မည့်ပမာဏ" />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" className="min-h-11">ပန်းတိုင်ထဲ ထည့်မည်</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
