"use client";

import { MoreHorizontal, Pencil, ScanLine, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CategoryDot, CategoryIcon } from "@/components/category-icon";
import { ExpenseForm } from "@/components/ExpenseForm";
import { useExpenses } from "@/components/expense-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const { deleteExpense, saving } = useExpenses();
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
            <li key={expense.id} className="py-1.5 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                  <CategoryIcon category={expense.category} className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium">{expense.vendor}</p>
                    <p
                      className={`shrink-0 font-mono text-sm whitespace-nowrap tabular-nums ${
                        expense.type === "income"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-700 dark:text-rose-400"
                      }`}
                    >
                      {expense.type === "income" ? "+" : "−"}
                      {formatMoney(expense.amount)}
                    </p>
                  </div>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                    <span className="shrink-0">{formatDate(expense.date)}</span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <CategoryDot category={expense.category} className="size-1.5 shrink-0 rounded-full" />
                      <span className="truncate">{expense.category}</span>
                    </span>
                    {expense.source === "ocr" ? (
                      <ScanLine className="size-3 shrink-0" aria-label="Scanned" />
                    ) : null}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-lg"
                      className="shrink-0"
                      aria-label={`Actions for ${expense.vendor}`}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {hasDetails ? (
                      <DropdownMenuItem onSelect={() => toggle(expense.id)}>
                        {open ? "Hide details" : "Details"}
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditing(expense);
                        setFormSession((current) => current + 1);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setPendingDelete(expense)}
                    >
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {open && hasDetails ? (
                <div className="mt-1.5 ml-10 grid gap-1 rounded-lg bg-muted/70 px-3 py-2 text-sm">
                  {expense.notes ? <p>{expense.notes}</p> : null}
                  {expense.lineItems.length > 0 ? (
                    <ul className="grid gap-1">
                      {expense.lineItems.map((item) => (
                        <li key={item.id} className="flex justify-between gap-3 font-mono text-xs">
                          <span className="min-w-0 truncate font-sans">
                            {item.description}
                            {item.quantity && item.unitPrice
                              ? ` · ${item.quantity} × ${formatMoney(item.unitPrice)}`
                              : ""}
                          </span>
                          <span className="shrink-0">{formatMoney(item.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
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
              disabled={saving}
              onClick={() => {
                if (!pendingDelete) return;
                const removing = pendingDelete;
                void deleteExpense(removing.id)
                  .then(() => {
                    toast.success("Expense removed", { description: removing.vendor });
                    setPendingDelete(null);
                  })
                  .catch((error: unknown) => {
                    toast.error("Could not delete this expense", {
                      description: error instanceof Error ? error.message : "Try again in a moment.",
                    });
                  });
              }}
            >
              {saving ? "Deleting…" : "Delete expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
