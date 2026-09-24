import { EXPENSE_CATEGORIES, type Category } from "@/types/expense";

export type CategoryLimits = Partial<Record<Category, number>>;
export type BudgetLevel = "ok" | "near" | "over";

export const CATEGORY_BURMESE: Record<(typeof EXPENSE_CATEGORIES)[number], string> = {
  "Food & Beverages": "အစားအသောက်",
  Groceries: "ကုန်စုံ",
  Food: "ထမင်း",
  Transport: "သွားလာရေး",
  Utilities: "အိမ်သုံးဝန်ဆောင်မှု",
  Entertainment: "ဖျော်ဖြေရေး",
  Shopping: "ဈေးဝယ်",
  Health: "ကျန်းမာရေး",
  Housing: "အိမ်",
  Other: "အခြား",
};

export function budgetLevel(spent: number, limit: number): BudgetLevel | null {
  if (!(limit > 0)) return null;
  const ratio = spent / limit;
  if (ratio >= 1) return "over";
  if (ratio >= 0.8) return "near";
  return "ok";
}

export function budgetBarClass(level: BudgetLevel | null): string {
  if (level === "over") return "bg-destructive";
  if (level === "near") return "bg-orange-400";
  return "bg-primary";
}

export function budgetPercent(spent: number, limit: number): number {
  if (!(limit > 0)) return 0;
  return Math.round((spent / limit) * 100);
}

export function budgetBarWidth(spent: number, limit: number): number {
  return Math.min(100, budgetPercent(spent, limit));
}

export function parseCategoryLimits(value: unknown): CategoryLimits {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  const limits: CategoryLimits = {};
  for (const category of EXPENSE_CATEGORIES) {
    const entry = raw[category];
    const amount = typeof entry === "number" ? entry : typeof entry === "string" ? Number(entry) : NaN;
    if (Number.isFinite(amount) && amount > 0) limits[category] = Math.round(amount * 100) / 100;
  }
  return limits;
}

export function isExpenseCategory(value: string): value is (typeof EXPENSE_CATEGORIES)[number] {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}
