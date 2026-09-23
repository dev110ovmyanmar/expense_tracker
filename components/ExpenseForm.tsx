"use client";

import { Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { ExpenseFields } from "@/components/expense-fields";
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
import { draftFromExpense, emptyDraft, validateDraft, type FieldErrors } from "@/lib/validate";
import type { Expense, ExpenseDraft } from "@/types/expense";

const FIELD_ORDER = ["vendor", "date", "amount", "tax", "lineItems", "notes"] as const;

export function ExpenseForm({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
}) {
  const { addExpense, updateExpense } = useExpenses();
  const [draft, setDraft] = useState<ExpenseDraft>(() =>
    expense ? draftFromExpense(expense) : emptyDraft(),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const editing = Boolean(expense);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      const first = FIELD_ORDER.find((key) => result.errors[key]);
      if (first) document.getElementById(`manual-${first}`)?.focus();
      return;
    }

    if (expense) {
      updateExpense(expense.id, {
        ...result.value,
        source: expense.source,
        receiptName: expense.receiptName,
      });
      toast.success("Expense updated", { description: result.value.vendor });
    } else {
      addExpense({ ...result.value, source: "manual" });
      toast.success("Expense added", { description: result.value.vendor });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,760px)] overflow-y-auto sm:max-w-xl">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {editing ? "Edit expense" : "Add expense"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the charge. Scanned receipts keep their scan history."
                : "Log a charge by hand. It shows up on the overview immediately."}
            </DialogDescription>
          </DialogHeader>
          <ExpenseFields
            draft={draft}
            onChange={setDraft}
            errors={errors}
            idPrefix="manual"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="h-10 px-4">
              {editing ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddExpenseButton({
  label = "Add expense",
  variant = "default",
  className,
}: {
  label?: string;
  variant?: "default" | "outline" | "secondary";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={() => {
          setSession((current) => current + 1);
          setOpen(true);
        }}
      >
        <Plus />
        {label}
      </Button>
      <ExpenseForm key={session} open={open} onOpenChange={setOpen} />
    </>
  );
}
