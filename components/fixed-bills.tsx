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
    <section id="bills" className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Fixed bills</h2>
          <p className="text-sm text-muted-foreground">Rent, internet, and subscriptions.</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={() => { setEditing(null); setOpen(true); }}>
          Add bill
        </Button>
      </div>
      {due.length > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2.5 ring-1 ring-foreground/10">
          <p className="text-sm">{due.length === 1 ? "1 bill is due" : `${due.length} bills are due`}</p>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => {
              for (const item of due) void log(item.id, item.name);
            }}
          >
            Log due
          </Button>
        </div>
      ) : null}
      {recurring.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No fixed bills yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl bg-card px-3 ring-1 ring-foreground/10">
          {recurring.map((item) => {
            const waiting = item.active ? scheduleCatchUp(item.nextDue, item.frequency, today).dates.length : 0;
            return (
              <li key={item.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="shrink-0 font-mono text-sm tabular-nums">{formatMoney(item.amount)}</p>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.frequency === "daily" ? "Daily" : item.frequency === "weekly" ? "Weekly" : "Monthly"}
                    {" · "}
                    {item.category}
                    {" · "}
                    {waiting > 0 ? "Due" : formatDate(item.nextDue)}
                    {item.autoLog ? " · Auto" : ""}
                    {item.active ? "" : " · Paused"}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => { setEditing(item); setOpen(true); }}>
                  Edit
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <BillDialog
        key={editing?.id ?? "new"}
        open={open}
        item={editing}
        saving={saving}
        onOpenChange={setOpen}
        onSave={async (input) => {
          if (editing) await updateRecurring(editing.id, input);
          else await addRecurring(input);
        }}
        onDelete={editing ? async () => removeRecurring(editing.id) : undefined}
      />
    </section>
  );
}

function BillDialog({
  open,
  item,
  saving,
  onOpenChange,
  onSave,
  onDelete,
}: {
  open: boolean;
  item: RecurringItem | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: RecurringInput) => Promise<void>;
  onDelete?: () => Promise<void>;
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
          <DialogDescription>Log it when the date arrives, or let Aura add it for you.</DialogDescription>
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
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
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
          <Field label="Name" id="bill-name">
            <Input id="bill-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Rent" className="h-11" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amount" id="bill-amount">
              <Input id="bill-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-11 font-mono" />
            </Field>
            <Field label="Next due" id="bill-due">
              <Input id="bill-due" type="date" value={nextDue} onChange={(event) => setNextDue(event.target.value)} className="h-11" />
            </Field>
          </div>
          <Field label="Category">
            <Select value={category} onValueChange={(value) => setCategory(value as Category)}>
              <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((entry) => <SelectItem key={entry} value={entry}>{entry}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Choice label="Frequency" value={frequency} options={[["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]]} onChange={(value) => setFrequency(value as Frequency)} />
            {frequency === "daily" ? (
              <div className="grid gap-1.5">
                <span className="text-xs text-muted-foreground">Each day</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoLog}
                  onClick={() => setAutoLog((value) => !value)}
                  className="flex h-11 items-center justify-between rounded-md bg-muted px-3 text-sm"
                >
                  Auto-add daily
                  <span className={`relative h-5 w-9 rounded-full ${autoLog ? "bg-primary" : "bg-foreground/20"}`}>
                    <span className={`absolute top-0.5 size-4 rounded-full bg-background ${autoLog ? "left-4" : "left-0.5"}`} />
                  </span>
                </button>
              </div>
            ) : (
              <Choice label="When due" value={autoLog ? "auto" : "ask"} options={[["ask", "Ask me"], ["auto", "Log it"]]} onChange={(value) => setAutoLog(value === "auto")} />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            Active
          </label>
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
                      toast.success("Bill removed", { description: item?.name });
                      onOpenChange(false);
                    },
                    (deleteError: unknown) => setError(deleteError instanceof Error ? deleteError.message : "Could not remove."),
                  );
                }}
              >
                Delete
              </Button>
            ) : <span />}
            <Button type="submit" className="min-h-11">{item ? "Save bill" : "Add bill"}</Button>
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
