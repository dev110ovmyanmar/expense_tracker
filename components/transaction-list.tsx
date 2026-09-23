"use client";

import { ChevronDown, Pencil, ScanLine, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CategoryDot, CategoryIcon } from "@/components/category-icon";
import { ExpenseForm } from "@/components/ExpenseForm";
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
import { formatDate, formatMoney } from "@/lib/format";
import type { Expense } from "@/types/expense";

export function TransactionList({
  expenses,
  emptyTitle,
  emptyBody,
}: {
  expenses: Expense[];
  emptyTitle: string;
  emptyBody: string;
}) {
  const { deleteExpense } = useExpenses();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (expenses.length === 0) {
    return (
      <div className="grid min-h-40 place-items-center rounded-xl border border-dashed px-6 py-10 text-center">
        <div className="max-w-sm space-y-1">
          <p className="font-medium">{emptyTitle}</p>
          <p className="text-sm text-muted-foreground">{emptyBody}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {expenses.map((expense) => {
          const open = expanded.has(expense.id);
          const hasDetails = Boolean(expense.notes) || expense.lineItems.length > 0;
          return (
            <li key={expense.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                  <CategoryIcon category={expense.category} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{expense.vendor}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{formatDate(expense.date)}</span>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-1.5">
                          <CategoryDot category={expense.category} className="size-1.5 rounded-full" />
                          {expense.category}
                        </span>
                        {expense.source === "ocr" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                            <ScanLine className="size-3" />
                            Scanned
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <p className="font-mono text-sm tabular-nums">{formatMoney(expense.amount)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {hasDetails ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-expanded={open}
                        onClick={() => toggle(expense.id)}
                      >
                        <ChevronDown className={open ? "rotate-180" : undefined} />
                        {open ? "Hide details" : "Details"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(expense);
                        setFormSession((current) => current + 1);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setPendingDelete(expense)}
                    >
                      <Trash2 />
                      Delete
                    </Button>
                  </div>
                  {open && hasDetails ? (
                    <div className="mt-2 grid gap-2 rounded-lg bg-muted/70 px-3 py-3 text-sm">
                      {expense.notes ? <p>{expense.notes}</p> : null}
                      {expense.lineItems.length > 0 ? (
                        <ul className="grid gap-1">
                          {expense.lineItems.map((item) => (
                            <li key={item.id} className="flex justify-between gap-3 font-mono text-xs">
                              <span className="font-sans">{item.description}</span>
                              <span>{formatMoney(item.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {expense.tax > 0 ? (
                        <p className="text-xs text-muted-foreground">Tax {formatMoney(expense.tax)}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <ExpenseForm
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={editing}
      />
      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this expense?</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `${pendingDelete.vendor} · ${formatMoney(pendingDelete.amount)} will leave the ledger.`
                : "This charge will leave the ledger."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!pendingDelete) return;
                deleteExpense(pendingDelete.id);
                toast.success("Expense removed", { description: pendingDelete.vendor });
                setPendingDelete(null);
              }}
            >
              Delete expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
