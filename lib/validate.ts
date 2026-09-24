import { moneyInput, parseMoney, roundMoney, todayISO } from "@/lib/format";
import {
  CATEGORIES,
  DEFAULT_CURRENCY,
  type Category,
  type Currency,
  type Expense,
  type ExpenseDraft,
  type LineItem,
  type OCRData,
} from "@/types/expense";

export type FieldErrors = Partial<
  Record<"vendor" | "date" | "amount" | "lineItems" | "notes", string>
>;

const MAX_AMOUNT = 100_000_000;

export interface ValidatedExpense {
  vendor: string;
  amount: number;
  currency: Currency;
  category: Category;
  date: string;
  notes: string;
  lineItems: LineItem[];
}

export function emptyDraft(): ExpenseDraft {
  return {
    vendor: "",
    date: todayISO(),
    amount: "",
    category: "Food & Beverages",
    notes: "",
    lineItems: [],
  };
}

export function draftFromExpense(expense: Expense): ExpenseDraft {
  return {
    vendor: expense.vendor,
    date: expense.date,
    amount: moneyInput(expense.amount),
    category: expense.category,
    notes: expense.notes,
    lineItems: expense.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      amount: moneyInput(item.amount),
    })),
  };
}

export function draftFromOCR(data: OCRData): ExpenseDraft {
  return {
    vendor: data.vendor,
    date: data.date,
    amount: data.totalFound ? moneyInput(data.total) : "",
    category: data.category,
    notes: data.notes,
    lineItems: data.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      amount: moneyInput(item.amount),
    })),
  };
}

function isValidDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function validateDraft(
  draft: ExpenseDraft,
): { ok: true; value: ValidatedExpense } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const vendor = draft.vendor.trim().replace(/\s+/g, " ");

  if (!vendor) errors.vendor = "Add the merchant or payee.";
  else if (vendor.length > 80) errors.vendor = "Keep the name under 80 characters.";

  if (!isValidDate(draft.date)) errors.date = "Choose a real date.";

  const amount = parseMoney(draft.amount);
  if (amount === null) errors.amount = "Enter a total like 1,650 or 1,650 Ks.";
  else if (amount <= 0) errors.amount = "The total needs to be greater than zero.";
  else if (amount > MAX_AMOUNT) errors.amount = "That total is past the ledger limit.";

  const lineItems: LineItem[] = [];
  for (const line of draft.lineItems) {
    const description = line.description.trim().replace(/\s+/g, " ");
    const lineAmountRaw = line.amount.trim();
    if (!description && !lineAmountRaw) continue;
    if (!description || !lineAmountRaw) {
      errors.lineItems = "Each line needs both a description and an amount.";
      break;
    }
    if (description.length > 80) {
      errors.lineItems = "Line descriptions need to stay under 80 characters.";
      break;
    }
    const lineAmount = parseMoney(lineAmountRaw);
    if (lineAmount === null || lineAmount < 0) {
      errors.lineItems = "Line amounts should look like 1,200 or 1,200 Ks.";
      break;
    }
    lineItems.push({ id: line.id, description, amount: lineAmount });
  }

  const notes = draft.notes.trim();
  if (notes.length > 400) errors.notes = "Notes need to stay under 400 characters.";

  if (!CATEGORIES.includes(draft.category)) {
    errors.lineItems = "Choose a category.";
  }

  if (Object.keys(errors).length > 0 || amount === null) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      vendor,
      amount,
      currency: DEFAULT_CURRENCY,
      category: draft.category,
      date: draft.date,
      notes,
      lineItems,
    },
  };
}

export function lineItemsTotal(draft: ExpenseDraft): number | null {
  let sum = 0;
  let counted = 0;
  for (const line of draft.lineItems) {
    if (!line.description.trim() && !line.amount.trim()) continue;
    const amount = parseMoney(line.amount);
    if (amount === null) return null;
    sum += amount;
    counted += 1;
  }
  if (counted === 0) return null;
  return roundMoney(sum);
}
