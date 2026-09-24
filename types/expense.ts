export const DEFAULT_CURRENCY = "MMK" as const;

export type Currency = typeof DEFAULT_CURRENCY;

export const CATEGORIES = [
  "Food & Beverages",
  "Groceries",
  "Food",
  "Transport",
  "Utilities",
  "Entertainment",
  "Shopping",
  "Health",
  "Housing",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type ExpenseSource = "manual" | "ocr";

export interface LineItem {
  id: string;
  description: string;
  amount: number;
}

export interface Expense {
  id: string;
  vendor: string;
  amount: number;
  currency: Currency;
  category: Category;
  date: string;
  notes: string;
  source: ExpenseSource;
  receiptName?: string;
  lineItems: LineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OCRData {
  vendor: string;
  date: string;
  total: number;
  totalFound: boolean;
  paid: number | null;
  change: number | null;
  currency: Currency;
  category: Category;
  notes: string;
  lineItems: LineItem[];
  confidence: number;
  matchedSample: boolean;
}

export interface DraftLineItem {
  id: string;
  description: string;
  amount: string;
}

export interface ExpenseDraft {
  vendor: string;
  date: string;
  amount: string;
  category: Category;
  notes: string;
  lineItems: DraftLineItem[];
}

export interface ExpenseInput {
  vendor: string;
  amount: number;
  currency: Currency;
  category: Category;
  date: string;
  notes: string;
  source: ExpenseSource;
  receiptName?: string;
  lineItems: LineItem[];
}
