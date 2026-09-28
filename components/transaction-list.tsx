"use client";

import { ChevronRight, Pencil, ScanLine, Trash2 } from "lucide-react";
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
  const { deleteExpense, saving } = useExpenses();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  const [viewing, setViewing] = useState<Expense | null>(null);

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
        {expenses.map((expense) => (
          <li key={expense.id}>
            <button
              type="button"
              onClick={() => setViewing(expense)}
              className="flex min-h-14 w-full items-center gap-3 rounded-lg py-2.5 text-left"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
                <CategoryIcon category={expense.category} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{expense.vendor}</span>
                  <span className={`shrink-0 font-mono text-sm whitespace-nowrap tabular-nums ${amountTone(expense)}`}>
                    {expense.type === "income" ? "+" : "−"}
                    {formatMoney(expense.amount)}
                  </span>
                </span>
                <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                  <span className="shrink-0">{formatDate(expense.date)}</span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <CategoryDot category={expense.category} className="size-1.5 shrink-0 rounded-full" />
                    <span className="truncate">{expense.category}</span>
                  </span>
                  {expense.source === "ocr" ? <ScanLine className="size-3 shrink-0" aria-label="Scanned" /> : null}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <RecordSheet
        expense={viewing}
        onClose={() => setViewing(null)}
        onEdit={() => {
          if (!viewing) return;
          setEditing(viewing);
          setFormSession((current) => current + 1);
          setFormOpen(true);
          setViewing(null);
        }}
        onDelete={() => {
          if (!viewing) return;
          setPendingDelete(viewing);
          setViewing(null);
        }}
      />
      <ExpenseForm
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={editing}
      />
      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this record?</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `${pendingDelete.vendor} · ${formatMoney(pendingDelete.amount)} will leave the ledger.`
                : "This record will leave the ledger."}
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
              {saving ? "Deleting…" : "Delete record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function amountTone(expense: Expense): string {
  return expense.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400";
}

function RecordSheet({
  expense,
  onClose,
  onEdit,
  onDelete,
}: {
  expense: Expense | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Dialog open={Boolean(expense)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 overflow-y-auto p-0 sm:max-w-md max-sm:top-auto max-sm:right-0 max-sm:bottom-0 max-sm:left-0 max-sm:max-h-[88svh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-3xl max-sm:rounded-b-none max-sm:data-open:zoom-in-100 max-sm:data-open:slide-in-from-bottom-4">
        {expense ? (
          <div className="px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:pt-5 sm:pb-5">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted sm:hidden" aria-hidden />
            <DialogHeader className="pr-8">
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                {expense.type === "income" ? "Income" : "Expense"}
              </p>
              <DialogTitle className="font-heading text-xl">{expense.vendor}</DialogTitle>
              <p className={`font-mono text-3xl leading-none tabular-nums ${amountTone(expense)}`}>
                {expense.type === "income" ? "+" : "−"}
                {formatMoney(expense.amount)}
              </p>
              <DialogDescription className="sr-only">
                {expense.type} of {formatMoney(expense.amount)} on {formatDate(expense.date)}, {expense.category}.
              </DialogDescription>
            </DialogHeader>
            <dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 rounded-xl bg-muted/60 px-3 py-3">
              <Fact label="Date" value={formatDate(expense.date)} />
              <Fact label="Category" value={expense.category} />
              <Fact label="Added" value={expense.source === "ocr" ? "Scanned receipt" : "By hand"} />
              <Fact label="Currency" value="Kyat" />
              {expense.receiptName ? <Fact label="File" value={expense.receiptName} /> : null}
            </dl>
            {expense.notes ? (
              <div className="mt-4">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Note</p>
                <p className="mt-1 text-sm leading-5">{expense.notes}</p>
              </div>
            ) : null}
            {expense.lineItems.length > 0 ? (
              <div className="mt-4">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Items</p>
                <ul className="mt-2 divide-y divide-border rounded-xl bg-muted/60">
                  {expense.lineItems.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm">{item.description}</p>
                        {item.quantity && item.unitPrice ? (
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} × {formatMoney(item.unitPrice)}
                          </p>
                        ) : null}
                      </div>
                      <p className="shrink-0 font-mono text-sm tabular-nums">{formatMoney(item.amount)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={onEdit}>
                <Pencil />
                Edit
              </Button>
              <Button type="button" variant="destructive" className="min-h-11" onClick={onDelete}>
                <Trash2 />
                Delete
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm leading-5 font-medium wrap-break-word">{value}</dd>
    </div>
  );
}
