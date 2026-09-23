import { recentDate } from "@/lib/format";
import type { Category, Expense, ExpenseSource, LineItem } from "@/types/expense";

export const DEFAULT_BUDGET = 1200;

interface SeedInput {
  vendor: string;
  amount: number;
  tax: number;
  category: Category;
  notes: string;
  source: ExpenseSource;
  daysAgo: number;
  lines?: [string, number][];
}

const SEED: SeedInput[] = [
  {
    vendor: "Blue Bottle Coffee",
    amount: 11.98,
    tax: 0.98,
    category: "Food",
    notes: "Cortado and a cardamom bun at the SoHo counter",
    source: "ocr",
    daysAgo: 0,
    lines: [
      ["Cortado", 5.5],
      ["Cardamom bun", 4.75],
      ["Oat milk", 0.75],
    ],
  },
  {
    vendor: "Sweetgreen",
    amount: 19.32,
    tax: 1.57,
    category: "Food",
    notes: "Harvest bowl after a meeting in Flatiron",
    source: "manual",
    daysAgo: 1,
    lines: [
      ["Harvest bowl", 14.25],
      ["Limeade", 3.5],
    ],
  },
  {
    vendor: "MTA MetroCard",
    amount: 34,
    tax: 0,
    category: "Transport",
    notes: "7-day unlimited for the week downtown",
    source: "manual",
    daysAgo: 2,
    lines: [["7-day unlimited", 34]],
  },
  {
    vendor: "Uber",
    amount: 22.97,
    tax: 1.87,
    category: "Transport",
    notes: "Late ride home from Canal Street",
    source: "ocr",
    daysAgo: 3,
    lines: [
      ["Trip fare", 18.6],
      ["Booking fee", 2.5],
    ],
  },
  {
    vendor: "Con Edison",
    amount: 97.62,
    tax: 7.12,
    category: "Utilities",
    notes: "August residential service, account ending 440",
    source: "ocr",
    daysAgo: 4,
    lines: [
      ["Delivery charges", 72.4],
      ["Supply charges", 18.1],
    ],
  },
  {
    vendor: "Alamo Drafthouse",
    amount: 49.54,
    tax: 4.04,
    category: "Entertainment",
    notes: "Two tickets and a popcorn to split",
    source: "ocr",
    daysAgo: 5,
    lines: [
      ["Tickets", 32],
      ["Popcorn", 8.5],
      ["Soda", 5],
    ],
  },
  {
    vendor: "Spectrum",
    amount: 79.99,
    tax: 0,
    category: "Utilities",
    notes: "Monthly fiber bill, autopay",
    source: "manual",
    daysAgo: 6,
    lines: [["Internet service", 79.99]],
  },
  {
    vendor: "Uniqlo SoHo",
    amount: 50.95,
    tax: 4.15,
    category: "Shopping",
    notes: "Linen shirt and a pair of socks",
    source: "ocr",
    daysAgo: 7,
    lines: [
      ["Linen shirt", 39.9],
      ["Socks", 6.9],
    ],
  },
  {
    vendor: "Bowery Ballroom",
    amount: 86,
    tax: 0,
    category: "Entertainment",
    notes: "Saturday show, general admission",
    source: "manual",
    daysAgo: 8,
    lines: [["General admission", 86]],
  },
  {
    vendor: "City Pharmacy",
    amount: 16.09,
    tax: 1.31,
    category: "Health",
    notes: "Ibuprofen and bandages",
    source: "ocr",
    daysAgo: 9,
    lines: [
      ["Ibuprofen", 8.49],
      ["Bandages", 6.29],
    ],
  },
  {
    vendor: "Center Hardware",
    amount: 28.58,
    tax: 2.33,
    category: "Housing",
    notes: "Bulbs and tape for the hallway",
    source: "manual",
    daysAgo: 10,
    lines: [
      ["LED bulbs", 18.4],
      ["Painter's tape", 7.85],
    ],
  },
  {
    vendor: "Book Culture",
    amount: 28.4,
    tax: 2.52,
    category: "Shopping",
    notes: "Paperback and a bookmark",
    source: "manual",
    daysAgo: 11,
    lines: [["Paperback", 25.88]],
  },
  {
    vendor: "H Mart",
    amount: 64.2,
    tax: 0,
    category: "Food",
    notes: "Weekly groceries, mostly untaxed",
    source: "ocr",
    daysAgo: 12,
    lines: [["Groceries", 64.2]],
  },
  {
    vendor: "Union Square Greenmarket",
    amount: 26.5,
    tax: 0,
    category: "Food",
    notes: "Peaches, eggs, and a loaf",
    source: "manual",
    daysAgo: 13,
    lines: [
      ["Peaches", 8],
      ["Eggs", 7.5],
      ["Sourdough", 11],
    ],
  },
  {
    vendor: "Equinox",
    amount: 45,
    tax: 0,
    category: "Health",
    notes: "Day pass while traveling",
    source: "manual",
    daysAgo: 14,
    lines: [["Day pass", 45]],
  },
  {
    vendor: "Shell",
    amount: 48.1,
    tax: 3.92,
    category: "Transport",
    notes: "Regular unleaded on the way upstate",
    source: "ocr",
    daysAgo: 15,
    lines: [["Regular unleaded", 44.18]],
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
      tax: entry.tax,
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
