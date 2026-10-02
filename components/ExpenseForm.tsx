"use client";

import { Banknote, Plus, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { ExpenseFields } from "@/components/expense-fields";
import { useExpenses } from "@/components/expense-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
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
      <DialogContent
        showCloseButton={false}
        overlayClassName="max-sm:hidden"
        className="inset-0 flex h-dvh max-h-none w-full max-w-none translate-none flex-col gap-0 overflow-hidden overscroll-none rounded-none bg-background p-0 shadow-none ring-0 data-open:zoom-in-100 data-open:slide-in-from-bottom data-closed:zoom-out-100 data-closed:slide-out-to-bottom sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[min(90svh,760px)] sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:bg-popover sm:shadow-[0_24px_60px_-24px_oklch(0_0_0/0.65)] sm:ring-1 sm:data-open:zoom-in-95 sm:data-closed:zoom-out-95"
      >
        <form onSubmit={onSubmit} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DialogHeader className="shrink-0 border-b px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:border-0 sm:px-5 sm:pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="font-heading text-2xl sm:text-xl">
                  {editing ? `Edit ${kind}` : income ? "Add income" : "Add expense"}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {editing
                    ? "Update the entry. Scanned receipts keep their scan history."
                    : income
                      ? "Log pay or other income in kyat. It raises this month's balance."
                      : "Log a charge in kyat. It shows up on the overview immediately."}
                </DialogDescription>
              </div>
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Close">
                  <X />
                </Button>
              </DialogClose>
            </div>
          </DialogHeader>
          <div data-aura-scroll className="min-h-0 min-w-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-none px-4 py-5 sm:px-5">
            <ExpenseFields
              draft={draft}
              onChange={setDraft}
              errors={errors}
              idPrefix="manual"
            />
          </div>
          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-b-xl sm:bg-muted/50 sm:pb-4">
            <Button type="button" variant="ghost" className="hidden h-11 text-muted-foreground sm:inline-flex" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="h-12 w-full rounded-xl px-4 text-base sm:h-11 sm:w-auto" disabled={saving}>
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
