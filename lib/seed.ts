import { recentDate } from "@/lib/format";
import { DEFAULT_CURRENCY, type Category, type Expense, type ExpenseSource, type LineItem } from "@/types/expense";

export const DEFAULT_BUDGET = 500_000;

interface SeedInput {
  vendor: string;
  amount: number;
  category: Category;
  notes: string;
  source: ExpenseSource;
  daysAgo: number;
  lines?: [string, number][];
}

const SEED: SeedInput[] = [
  {
    vendor: "City Express",
    amount: 8500,
    category: "Groceries",
    notes: "Drinks and snacks from the Kabar Aye branch",
    source: "ocr",
    daysAgo: 0,
    lines: [
      ["Coca Cola 330ml", 2200],
      ["Lays Classic", 3000],
      ["Tissue and water", 3300],
    ],
  },
  {
    vendor: "Shwe Oh Tea Shop",
    amount: 1500,
    category: "Food & Beverages",
    notes: "Milk tea and paratha in Sanchaung",
    source: "manual",
    daysAgo: 1,
    lines: [
      ["Milk tea", 800],
      ["Paratha", 700],
    ],
  },
  {
    vendor: "YBS Bus",
    amount: 600,
    category: "Transport",
    notes: "Two rides downtown",
    source: "manual",
    daysAgo: 1,
    lines: [["Bus fare", 600]],
  },
  {
    vendor: "Grab",
    amount: 6500,
    category: "Transport",
    notes: "Evening ride home from Junction City",
    source: "ocr",
    daysAgo: 2,
    lines: [["Trip fare", 6500]],
  },
  {
    vendor: "YESC",
    amount: 45000,
    category: "Utilities",
    notes: "Residential electricity bill",
    source: "ocr",
    daysAgo: 3,
    lines: [["Electricity", 45000]],
  },
  {
    vendor: "Junction Cinema",
    amount: 12000,
    category: "Entertainment",
    notes: "Two evening tickets",
    source: "manual",
    daysAgo: 4,
    lines: [["Tickets", 12000]],
  },
  {
    vendor: "Atom",
    amount: 35000,
    category: "Utilities",
    notes: "Monthly fiber",
    source: "manual",
    daysAgo: 5,
    lines: [["Internet", 35000]],
  },
  {
    vendor: "City Mart",
    amount: 42000,
    category: "Groceries",
    notes: "Weekly groceries",
    source: "ocr",
    daysAgo: 6,
    lines: [
      ["Rice and oil", 22000],
      ["Vegetables", 8000],
      ["Household", 12000],
    ],
  },
  {
    vendor: "City Pharmacy",
    amount: 7800,
    category: "Health",
    notes: "Cold medicine",
    source: "ocr",
    daysAgo: 8,
    lines: [["Medicine", 7800]],
  },
  {
    vendor: "Sein Daw Market",
    amount: 18500,
    category: "Groceries",
    notes: "Morning market run",
    source: "manual",
    daysAgo: 9,
    lines: [
      ["Fish", 10000],
      ["Fruit", 8500],
    ],
  },
  {
    vendor: "Rangoon Tea House",
    amount: 2200,
    category: "Food & Beverages",
    notes: "Evening tea",
    source: "manual",
    daysAgo: 10,
    lines: [["Tea and snack", 2200]],
  },
  {
    vendor: "Denko",
    amount: 25000,
    category: "Transport",
    notes: "Fuel on the way to Thanlyin",
    source: "ocr",
    daysAgo: 12,
    lines: [["Fuel", 25000]],
  },
  {
    vendor: "People's Park Show",
    amount: 20000,
    category: "Entertainment",
    notes: "Saturday tickets",
    source: "manual",
    daysAgo: 13,
    lines: [["Tickets", 20000]],
  },
  {
    vendor: "City Home",
    amount: 15000,
    category: "Housing",
    notes: "Bulbs and a broom",
    source: "manual",
    daysAgo: 14,
    lines: [["Household supplies", 15000]],
  },
];

function timestamp(iso: string, hour: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, hour, 15, 0, 0).toISOString();
}

export function createSeedExpenses(): Expense[] {
  return SEED.map((entry, index) => {
    const id = `seed-${String(index + 1).padStart(2, "0")}`;
    const date = recentDate(entry.daysAgo);
    const createdAt = timestamp(date, 8 + (index % 9));
    const lineItems: LineItem[] = (entry.lines ?? []).map(([description, amount], lineIndex) => ({
      id: `${id}-line-${lineIndex + 1}`,
      description,
      amount,
    }));
    return {
      id,
      vendor: entry.vendor,
      amount: entry.amount,
      currency: DEFAULT_CURRENCY,
      category: entry.category,
      date,
      notes: entry.notes,
      source: entry.source,
      receiptName:
        entry.source === "ocr"
          ? `${entry.vendor.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.jpg`
          : undefined,
      lineItems,
      createdAt,
      updatedAt: createdAt,
    };
  });
}
