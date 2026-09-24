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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useExpenses } from "@/components/expense-provider";
import { formatDate, formatMoney, parseMoney, todayISO } from "@/lib/format";
import { scheduleCatchUp } from "@/lib/recurring";
import { categoriesFor, type Category, type EntryType } from "@/types/expense";
import type { Frequency, RecurringInput, RecurringItem } from "@/types/planning";

export function FixedBills() {
  const { recurring, saving, addRecurring, updateRecurring, removeRecurring, logRecurring } = useExpenses();
  const [editing, setEditing] = useState<RecurringItem | null>(null);
  const [open, setOpen] = useState(false);
  const today = todayISO();
  const due = recurring.filter((item) => item.active && scheduleCatchUp(item.nextDue, item.frequency, today).dates.length > 0);

  async function log(id: string, name: string) {
    try {
      await logRecurring(id);
      toast.success("Bill logged", { description: name });
    } catch (error) {
      toast.error("Could not log this bill", { description: error instanceof Error ? error.message : "Try again." });
    }
  }

  return (
    <section id="bills" className="grid gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl">Fixed bills</h2>
          <p className="text-sm text-muted-foreground">Rent, internet, and other charges on a weekly or monthly cycle.</p>
        </div>
        <Button type="button" className="min-h-11 shrink-0" onClick={() => { setEditing(null); setOpen(true); }}>
          Add bill
        </Button>
      </div>
      {due.length > 0 ? (
        <div className="grid gap-2 rounded-xl bg-primary/10 px-3 py-3">
          <p className="text-sm font-medium">{due.length === 1 ? "1 bill is due" : `${due.length} bills are due`}</p>
          {due.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{item.name} · {formatMoney(item.amount)}</span>
              <Button type="button" size="sm" className="min-h-9 shrink-0" disabled={saving} onClick={() => void log(item.id, item.name)}>
                Log
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {recurring.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No fixed bills yet. Add rent or a subscription and Aura can log it each cycle.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl bg-card px-3 ring-1 ring-foreground/10">
          {recurring.map((item) => {
            const waiting = scheduleCatchUp(item.nextDue, item.frequency, today).dates.length;
            return (
              <li key={item.id} className="grid gap-1 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="shrink-0 font-mono text-sm tabular-nums">{formatMoney(item.amount)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.frequency === "weekly" ? "Weekly" : "Monthly"} · {item.category} · {waiting > 0 ? "Due" : `Next ${formatDate(item.nextDue)}`}
                  {item.autoLog ? " · Logs itself" : " · Asks first"}
                  {item.active ? "" : " · Paused"}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {waiting > 0 && item.active ? (
                    <Button type="button" size="sm" disabled={saving} onClick={() => void log(item.id, item.name)}>Log due</Button>
                  ) : null}
                  <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(item); setOpen(true); }}>Edit</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => {
                      void removeRecurring(item.id).then(
                        () => toast.success("Bill removed", { description: item.name }),
                        (error: unknown) => toast.error("Could not remove this bill", { description: error instanceof Error ? error.message : "Try again." }),
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
      <BillDialog
        key={editing?.id ?? "new"}
        open={open}
        item={editing}
        onOpenChange={setOpen}
        onSave={async (input) => {
          if (editing) await updateRecurring(editing.id, input);
          else await addRecurring(input);
        }}
      />
    </section>
  );
}

function BillDialog({
  open,
  item,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  item: RecurringItem | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: RecurringInput) => Promise<void>;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [amount, setAmount] = useState(item ? String(item.amount) : "");
  const [type, setType] = useState<EntryType>(item?.type ?? "expense");
  const [category, setCategory] = useState<Category>(item?.category ?? "Housing");
  const [frequency, setFrequency] = useState<Frequency>(item?.frequency ?? "monthly");
  const [nextDue, setNextDue] = useState(item?.nextDue ?? todayISO());
  const [autoLog, setAutoLog] = useState(item?.autoLog ?? false);
  const [active, setActive] = useState(item?.active ?? true);
  const [error, setError] = useState("");
  const categories = categoriesFor(type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Edit bill" : "Add a fixed bill"}</DialogTitle>
          <DialogDescription>Choose monthly or weekly. Aura logs it when the date arrives, or asks you first.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseMoney(amount);
            if (!name.trim() || parsed === null || parsed <= 0) {
              setError("Add a name and an amount.");
              return;
            }
            void onSave({
              name: name.trim(),
              amount: parsed,
              type,
              category: categories.includes(category) ? category : categories[0],
              frequency,
              nextDue,
              autoLog,
              active,
            }).then(
              () => {
                toast.success(item ? "Bill updated" : "Bill added");
                onOpenChange(false);
              },
              (saveError: unknown) => setError(saveError instanceof Error ? saveError.message : "Could not save."),
            );
          }}
        >
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            {(["expense", "income"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`h-9 rounded-md text-sm ${type === value ? "bg-background font-medium" : "text-muted-foreground"}`}
                onClick={() => {
                  const next = categoriesFor(value);
                  setType(value);
                  setCategory(next.includes(category) ? category : next[0]);
                }}
              >
                {value === "expense" ? "Expense" : "Income"}
              </button>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bill-name">Name</Label>
            <Input id="bill-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Rent" className="h-11" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="bill-amount">Amount</Label>
              <Input id="bill-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-11 font-mono" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bill-due">Next due</Label>
              <Input id="bill-due" type="date" value={nextDue} onChange={(event) => setNextDue(event.target.value)} className="h-11" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as Category)}>
              <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((entry) => <SelectItem key={entry} value={entry}>{entry}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Choice label="Frequency" value={frequency} options={[["monthly", "Monthly"], ["weekly", "Weekly"]]} onChange={(value) => setFrequency(value as Frequency)} />
            <Choice label="When due" value={autoLog ? "auto" : "ask"} options={[["ask", "Ask me"], ["auto", "Log it"]]} onChange={(value) => setAutoLog(value === "auto")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            Active
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" className="min-h-11">{item ? "Save bill" : "Add bill"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {options.map(([id, text]) => (
          <button key={id} type="button" className={`h-9 rounded-md text-xs ${value === id ? "bg-background font-medium" : "text-muted-foreground"}`} onClick={() => onChange(id)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
