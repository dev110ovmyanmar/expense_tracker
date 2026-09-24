"use client";

import { Plus, Trash2 } from "lucide-react";
import { CategoryDot } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_META } from "@/lib/categories";
import { formatMoney, moneyInput, parseMoney } from "@/lib/format";
import { lineItemsTotal, type FieldErrors } from "@/lib/validate";
import { CATEGORIES, type ExpenseDraft } from "@/types/expense";

export function ExpenseFields({
  draft,
  onChange,
  errors,
  idPrefix,
}: {
  draft: ExpenseDraft;
  onChange: (draft: ExpenseDraft) => void;
  errors: FieldErrors;
  idPrefix: string;
}) {
  const itemsSum = lineItemsTotal(draft);
  const total = parseMoney(draft.amount);
  const reconciles =
    itemsSum !== null && total !== null && Math.abs(itemsSum - total) <= 0.009;
  const linesShort =
    itemsSum !== null && total !== null && itemsSum + 0.009 < total;
  const linesOver =
    itemsSum !== null && total !== null && itemsSum > total + 0.009;

  function update(partial: Partial<ExpenseDraft>) {
    onChange({ ...draft, ...partial });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-vendor`}>Vendor name</Label>
          <Input
            id={`${idPrefix}-vendor`}
            value={draft.vendor}
            onChange={(event) => update({ vendor: event.target.value })}
            placeholder="Merchant or payee"
            aria-invalid={Boolean(errors.vendor)}
            autoComplete="off"
            className="h-10"
          />
          {errors.vendor ? <FieldError>{errors.vendor}</FieldError> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-date`}>Date</Label>
          <Input
            id={`${idPrefix}-date`}
            type="date"
            value={draft.date}
            onChange={(event) => update({ date: event.target.value })}
            aria-invalid={Boolean(errors.date)}
            className="h-10"
          />
          {errors.date ? <FieldError>{errors.date}</FieldError> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-category`}>Category</Label>
          <Select
            value={draft.category}
            onValueChange={(category) => {
              if ((CATEGORIES as readonly string[]).includes(category)) {
                update({ category: category as ExpenseDraft["category"] });
              }
            }}
          >
            <SelectTrigger id={`${idPrefix}-category`} className="h-10 w-full">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  <span className="flex items-center gap-2">
                    <CategoryDot category={category} className="size-2 rounded-full" />
                    {category}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-amount`}>Amount</Label>
          <div className="relative">
            <Input
              id={`${idPrefix}-amount`}
              inputMode="decimal"
              value={draft.amount}
              onChange={(event) => update({ amount: event.target.value })}
              placeholder="1,650"
              aria-invalid={Boolean(errors.amount)}
              className="h-12 pr-14 font-mono text-lg"
            />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-muted-foreground">
              Ks
            </span>
          </div>
          {errors.amount ? (
            <FieldError>{errors.amount}</FieldError>
          ) : total !== null ? (
            <p className="text-xs text-muted-foreground">
              Saves as {formatMoney(total)}. Use the grand total, not cash, change, or tax.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Myanmar kyat. Commas are optional, for example 1,650 or 86,400 Ks.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-2" id={`${idPrefix}-lineItems`}>
        <div className="flex items-center justify-between gap-3">
          <Label>Line items</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              update({
                lineItems: [
                  ...draft.lineItems,
                  { id: crypto.randomUUID(), description: "", amount: "" },
                ],
              })
            }
          >
            <Plus />
            Add line
          </Button>
        </div>
        {draft.lineItems.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
            No line items yet. Add them if the receipt lists individual charges.
          </p>
        ) : (
          <ul className="grid gap-2">
            {draft.lineItems.map((line, index) => (
              <li key={line.id} className="flex items-center gap-2">
                <Input
                  aria-label={`Line ${index + 1} description`}
                  value={line.description}
                  onChange={(event) =>
                    update({
                      lineItems: draft.lineItems.map((item) =>
                        item.id === line.id ? { ...item, description: event.target.value } : item,
                      ),
                    })
                  }
                  placeholder="Description"
                  className="h-10"
                />
                <Input
                  aria-label={`Line ${index + 1} amount`}
                  inputMode="decimal"
                  value={line.amount}
                  onChange={(event) =>
                    update({
                      lineItems: draft.lineItems.map((item) =>
                        item.id === line.id ? { ...item, amount: event.target.value } : item,
                      ),
                    })
                  }
                  placeholder="1,650"
                  className="h-10 w-36 shrink-0 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${line.description || `line ${index + 1}`}`}
                  onClick={() =>
                    update({ lineItems: draft.lineItems.filter((item) => item.id !== line.id) })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {errors.lineItems ? <FieldError>{errors.lineItems}</FieldError> : null}
        {reconciles ? (
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-foreground">
            Line items match {formatMoney(total ?? 0)}.
          </p>
        ) : null}
        {linesShort && itemsSum !== null ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Dishes add up to {formatMoney(itemsSum)}. Service charge and tax stay inside the amount.
          </p>
        ) : null}
        {linesOver && itemsSum !== null ? (
          <div className="flex flex-col gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p>Line items come to {formatMoney(itemsSum)}, which is above the amount.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => update({ amount: moneyInput(itemsSum) })}
            >
              Use {formatMoney(itemsSum)}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={draft.notes}
          onChange={(event) => update({ notes: event.target.value })}
          placeholder="Optional context — lunch with Sam, shared cab, August bill"
          aria-invalid={Boolean(errors.notes)}
          className="min-h-20"
        />
        {errors.notes ? <FieldError>{errors.notes}</FieldError> : null}
        <p className="text-xs text-muted-foreground">
          {CATEGORY_META[draft.category].description}
        </p>
      </div>
    </div>
  );
}

function FieldError({ children }: { children: string }) {
  return <p className="text-xs text-destructive">{children}</p>;
}
