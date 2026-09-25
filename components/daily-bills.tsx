"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useExpenses } from "@/components/expense-provider";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatMoney, parseMoney, todayISO } from "@/lib/format";
import { EXPENSE_CATEGORIES, type Category } from "@/types/expense";
import type { DailyBill } from "@/lib/daily-bills";

export function DailyBillsCard({ bills }: { bills: DailyBill[] }) {
  const [open, setOpen] = useState(false);
  const today = todayISO();
  const weekStart = shiftDate(today, -6);
  const week = bills.filter((bill) => bill.date >= weekStart && bill.date <= today);
  const todayTotal = week.filter((bill) => bill.date === today).reduce((sum, bill) => sum + bill.amount, 0);
  const weekTotal = week.reduce((sum, bill) => sum + bill.amount, 0);

  return (
    <section className="grid gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Daily bills</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatMoney(todayTotal)} today · {formatMoney(weekTotal)} this week
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>Add bill</Button>
      </div>
      {week.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing logged for the last 7 days.</p>
      ) : (
        <ul className="grid gap-2">
          {week.slice(0, 6).map((bill) => (
            <li key={bill.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{bill.title}</span>
                <span className="text-xs text-muted-foreground">{bill.category} · {bill.date === today ? "Today" : formatDate(bill.date)}</span>
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums">{formatMoney(bill.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <AddBillDialog open={open} onOpenChange={setOpen} />
    </section>
  );
}

function AddBillDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { addDailyBill } = useExpenses();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("Food");
  const [date, setDate] = useState(todayISO());
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const name = title.trim();
    const cost = parseMoney(amount);
    if (!name) {
      setNotice("Add a name for the bill.");
      return;
    }
    if (cost === null || cost <= 0) {
      setNotice("Amount has to be a number above zero.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setNotice("Choose a date.");
      return;
    }
    setBusy(true);
    setNotice("");
    void addDailyBill({ title: name, amount: cost, category, date })
      .then(() => {
        setTitle("");
        setAmount("");
        setDate(todayISO());
        onOpenChange(false);
        toast.success("Bill added.");
      })
      .catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "The bill could not be saved.");
      })
      .finally(() => setBusy(false));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a daily bill</DialogTitle>
          <DialogDescription>Name, cost, and the day you paid it.</DialogDescription>
        </DialogHeader>
        <form id="daily-bill-form" className="grid gap-3" onSubmit={submit}>
          <div className="grid gap-1.5">
            <Label htmlFor="bill-title">Name</Label>
            <Input id="bill-title" value={title} onChange={(event) => setTitle(event.target.value)} className="h-11" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bill-amount">Cost</Label>
            <Input id="bill-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-11 font-mono" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bill-category">Category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as Category)}>
              <SelectTrigger id="bill-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((entry) => (
                  <SelectItem key={entry} value={entry}>{entry}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bill-date">Date</Label>
            <Input id="bill-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-11" />
          </div>
          {notice ? <p className="text-sm text-destructive">{notice}</p> : null}
        </form>
        <DialogFooter>
          <Button type="submit" form="daily-bill-form" disabled={busy}>{busy ? "Saving…" : "Add bill"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`;
}
