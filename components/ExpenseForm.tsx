"use client";

import { Banknote, Plus } from "lucide-react";
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
import { draftFromExpense, emptyDraft, salaryDraft, validateDraft, type FieldErrors } from "@/lib/validate";
import type { EntryType, Expense, ExpenseDraft } from "@/types/expense";

const FIELD_ORDER = ["vendor", "date", "amount", "lineItems", "notes"] as const;

export function ExpenseForm({
  open,
  onOpenChange,
  expense,
  initialDraft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
  initialDraft?: ExpenseDraft;
}) {
  const { addExpense, updateExpense, saving } = useExpenses();
  const [draft, setDraft] = useState<ExpenseDraft>(() =>
    expense ? draftFromExpense(expense) : (initialDraft ?? emptyDraft()),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const editing = Boolean(expense);
  const income = draft.type === "income";
  const kind = income ? "income" : "expense";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      const first = FIELD_ORDER.find((key) => result.errors[key]);
      if (first) document.getElementById(`manual-${first}`)?.focus();
      return;
    }

    try {
      if (expense) {
        await updateExpense(expense.id, {
          ...result.value,
          source: expense.source,
          receiptName: expense.receiptName,
        });
        toast.success(income ? "Income updated" : "Expense updated", { description: result.value.vendor });
      } else {
        await addExpense({ ...result.value, source: "manual" });
        toast.success(income ? "Income added" : "Expense added", { description: result.value.vendor });
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(income ? "Could not save this income" : "Could not save this expense", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,760px)] overflow-y-auto sm:max-w-xl">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {editing ? `Edit ${kind}` : income ? "Add income" : "Add expense"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the entry. Scanned receipts keep their scan history."
                : income
                  ? "Log pay or other income in kyat. It raises this month's balance."
                  : "Log a charge in kyat. It shows up on the overview immediately."}
            </DialogDescription>
          </DialogHeader>
          {editing ? null : (
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() => {
                setDraft(salaryDraft());
                setErrors({});
                document.getElementById("manual-amount")?.focus();
              }}
            >
              <Banknote />
              Monthly Salary
            </Button>
          )}
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
            <Button type="submit" className="h-10 px-4" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : income ? "Add income" : "Add expense"}
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
  initialType = "expense",
  salary = false,
}: {
  label?: string;
  variant?: "default" | "outline" | "secondary";
  className?: string;
  initialType?: EntryType;
  salary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const initialDraft = salary ? salaryDraft() : initialType === "income" ? { ...emptyDraft(), type: "income" as const, category: "Salary" as const, vendor: "" } : undefined;
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
        {salary ? <Banknote /> : <Plus />}
        {label}
      </Button>
      <ExpenseForm key={session} open={open} onOpenChange={setOpen} initialDraft={initialDraft} />
    </>
  );
}
