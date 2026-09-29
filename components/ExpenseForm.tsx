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
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(90svh,760px)] sm:max-w-xl max-sm:top-3 max-sm:bottom-[calc(5.25rem+env(safe-area-inset-bottom))] max-sm:max-h-none max-sm:translate-y-0">
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="shrink-0 px-4 pt-4 pr-12">
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
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <ExpenseFields
              draft={draft}
              onChange={setDraft}
              errors={errors}
              idPrefix="manual"
            />
          </div>
          <DialogFooter className="mx-0 mb-0 shrink-0">
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
