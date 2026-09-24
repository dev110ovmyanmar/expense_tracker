"use client";

import { FixedBills } from "@/components/fixed-bills";
import { PageHeader } from "@/components/page-header";
import { SavingsGoals } from "@/components/savings-goals";
import { useExpenses } from "@/components/expense-provider";
import { ofType, sumAmounts, expensesInMonth } from "@/lib/expenses";
import { roundMoney } from "@/lib/format";

export function PlanBoard() {
  const { expenses, hydrated, planningMessage } = useExpenses();
  if (!hydrated) return <div className="h-80 animate-pulse rounded-xl bg-muted" />;
  const month = expensesInMonth(expenses);
  const income = sumAmounts(ofType(month, "income"));
  const spent = sumAmounts(ofType(month, "expense"));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="အစီအစဉ်"
        title="ဘေလ်နဲ့ စုငွေ"
        description="ပုံသေဘေလ်ကို ရက်ရောက်ရင် ကိုယ်တိုင် မှတ်နိုင်ပါတယ်။ စုငွေအိတ်က ပန်းတိုင်ကို သုံးစွဲမှုအဖြစ် မရေတွက်ပါ။"
      />
      {planningMessage ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {planningMessage}
        </p>
      ) : null}
      <FixedBills />
      <SavingsGoals income={income} net={roundMoney(income - spent)} />
    </div>
  );
}
