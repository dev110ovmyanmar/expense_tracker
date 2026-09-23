import { recentDate, roundMoney } from "@/lib/format";
import type { Category, LineItem, OCRData } from "@/types/expense";

interface ReceiptTemplate {
  id: string;
  keywords: string[];
  vendor: string;
  category: Category;
  tax: number;
  notes: string;
  lines: [string, number][];
}

const TEMPLATES: ReceiptTemplate[] = [
  {
    id: "blue-bottle",
    keywords: ["coffee", "cafe", "starbucks", "blue-bottle", "bluebottle"],
    vendor: "Blue Bottle Coffee",
    category: "Food",
    tax: 0.98,
    notes: "SoHo counter order",
    lines: [
      ["Cortado", 5.5],
      ["Cardamom bun", 4.75],
      ["Oat milk", 0.75],
    ],
  },
  {
    id: "sweetgreen",
    keywords: ["sweetgreen", "salad", "lunch", "dinner", "restaurant"],
    vendor: "Sweetgreen",
    category: "Food",
    tax: 1.57,
    notes: "Harvest bowl and a limeade",
    lines: [
      ["Harvest bowl", 14.25],
      ["Limeade", 3.5],
    ],
  },
  {
    id: "hmart",
    keywords: ["grocery", "market", "hmart", "trader", "wholefoods"],
    vendor: "H Mart",
    category: "Food",
    tax: 0,
    notes: "Weekly groceries, mostly untaxed",
    lines: [["Groceries", 64.2]],
  },
  {
    id: "metro",
    keywords: ["metro", "mta", "transit", "subway"],
    vendor: "MTA MetroCard",
    category: "Transport",
    tax: 0,
    notes: "7-day unlimited",
    lines: [["7-day unlimited", 34]],
  },
  {
    id: "uber",
    keywords: ["uber", "lyft", "taxi", "ride"],
    vendor: "Uber",
    category: "Transport",
    tax: 1.87,
    notes: "Trip toward Canal Street",
    lines: [
      ["Trip fare", 18.6],
      ["Booking fee", 2.5],
    ],
  },
  {
    id: "shell",
    keywords: ["shell", "gas", "fuel", "exxon", "chevron"],
    vendor: "Shell",
    category: "Transport",
    tax: 3.92,
    notes: "Regular unleaded",
    lines: [["Regular unleaded", 44.18]],
  },
  {
    id: "coned",
    keywords: ["coned", "edison", "electric", "utility", "power", "water"],
    vendor: "Con Edison",
    category: "Utilities",
    tax: 7.12,
    notes: "Residential service, account ending 440",
    lines: [
      ["Delivery charges", 72.4],
      ["Supply charges", 18.1],
    ],
  },
  {
    id: "internet",
    keywords: ["internet", "verizon", "spectrum", "wifi", "phone"],
    vendor: "Spectrum",
    category: "Utilities",
    tax: 0,
    notes: "Monthly fiber bill",
    lines: [["Internet service", 79.99]],
  },
  {
    id: "alamo",
    keywords: ["movie", "cinema", "alamo", "ticket", "concert", "netflix"],
    vendor: "Alamo Drafthouse",
    category: "Entertainment",
    tax: 4.04,
    notes: "Two tickets with popcorn",
    lines: [
      ["Tickets", 32],
      ["Popcorn", 8.5],
      ["Soda", 5],
    ],
  },
  {
    id: "uniqlo",
    keywords: ["uniqlo", "shop", "amazon", "store", "mall", "clothing"],
    vendor: "Uniqlo SoHo",
    category: "Shopping",
    tax: 4.15,
    notes: "Linen shirt and socks",
    lines: [
      ["Linen shirt", 39.9],
      ["Socks", 6.9],
    ],
  },
  {
    id: "pharmacy",
    keywords: ["pharmacy", "cvs", "clinic", "health", "gym"],
    vendor: "City Pharmacy",
    category: "Health",
    tax: 1.31,
    notes: "Ibuprofen and bandages",
    lines: [
      ["Ibuprofen", 8.49],
      ["Bandages", 6.29],
    ],
  },
  {
    id: "hardware",
    keywords: ["hardware", "ikea", "rent", "apartment", "home"],
    vendor: "Center Hardware",
    category: "Housing",
    tax: 2.33,
    notes: "Bulbs and tape for the hallway",
    lines: [
      ["LED bulbs", 18.4],
      ["Painter's tape", 7.85],
    ],
  },
];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function toLineItems(lines: [string, number][], seed: string): LineItem[] {
  return lines.map(([description, amount], index) => ({
    id: `${seed}-line-${index + 1}`,
    description,
    amount: roundMoney(amount),
  }));
}

export function templateToOCR(
  template: ReceiptTemplate,
  options?: { date?: string; confidence?: number; matchedSample?: boolean; id?: string },
): OCRData {
  const lineItems = toLineItems(template.lines, options?.id ?? template.id);
  const subtotal = roundMoney(lineItems.reduce((sum, item) => sum + item.amount, 0));
  return {
    vendor: template.vendor,
    date: options?.date ?? recentDate(hashString(template.id) % 6),
    total: roundMoney(subtotal + template.tax),
    tax: roundMoney(template.tax),
    category: template.category,
    notes: template.notes,
    lineItems,
    confidence: options?.confidence ?? 0.91,
    matchedSample: options?.matchedSample ?? false,
  };
}

export function getTemplate(id: string): ReceiptTemplate | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

export const OCR_STEPS = [
  {
    title: "Uploading image",
    detail: "Reading the file on this device",
  },
  {
    title: "Detecting vendor & totals",
    detail: "Finding the merchant, date, and amount due",
  },
  {
    title: "Parsing line items & category",
    detail: "Sorting charges and choosing a category",
  },
] as const;

export function fileKind(file: File): "image" | "pdf" | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    file.type.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "svg"].some((ext) => name.endsWith(`.${ext}`))
  ) {
    return "image";
  }
  return null;
}

export function suggestReceipt(file: File): OCRData {
  const haystack = `${file.name} ${file.type}`.toLowerCase();
  const matched = TEMPLATES.find((template) =>
    template.keywords.some((keyword) => haystack.includes(keyword)),
  );
  const hash = hashString(`${file.name}:${file.size}`);
  const template = matched ?? TEMPLATES[hash % TEMPLATES.length];
  const confidence = matched ? 0.93 : roundMoney(0.86 + (hash % 10) / 100);
  return templateToOCR(template, {
    date: recentDate(hash % 6),
    confidence,
    matchedSample: false,
    id: `scan-${hash.toString(16)}`,
  });
}
