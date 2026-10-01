export const DEFAULT_CURRENCY = "MMK" as const;

export type Currency = typeof DEFAULT_CURRENCY;

export const EXPENSE_CATEGORIES = [
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

export const INCOME_CATEGORIES = ["Salary", "Freelance", "Investments", "Other"] as const;

export const CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  "Salary",
  "Freelance",
  "Investments",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type EntryType = "income" | "expense";

export function categoriesFor(type: EntryType): readonly Category[] {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export type ExpenseSource = "manual" | "ocr";

export interface LineItem {
  id: string;
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
}

export interface VoucherItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface VoucherScan {
  shopName: string;
  date: string;
  invoiceNo: string;
  items: VoucherItem[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  grandTotal: number;
  currency: string;
  direction: "in" | "out" | null;
  note: string;
}

export interface Expense {
  id: string;
  type: EntryType;
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
  invoiceNo?: string;
  warning?: string;
  direction?: "in" | "out";
}

export interface DraftLineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
}

export interface ExpenseDraft {
  type: EntryType;
  vendor: string;
  date: string;
  amount: string;
  category: Category;
  notes: string;
  lineItems: DraftLineItem[];
}

export interface ExpenseInput {
  type: EntryType;
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
