import { formatMoney, roundMoney, todayISO } from "@/lib/format";
import { DEFAULT_CURRENCY, type Category, type Currency, type LineItem } from "@/types/expense";

export interface ParsedReceipt {
  vendor: string;
  date: string;
  total: number | null;
  paid: number | null;
  change: number | null;
  currency: Currency;
  category: Category;
  notes: string;
  lineItems: Array<Pick<LineItem, "description" | "amount">>;
  confidence: number;
  totalFound: boolean;
}

const AMOUNT_RE =
  /(?<![\d:/.-])(?:(?:ks|mmk|kyats?|ကျပ်)\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?:\s*(?:ks|mmk|kyats?|ကျပ်))?(?![\d:/.-])/gi;

const DATE_RE = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;

type LineKind =
  | "grand"
  | "total"
  | "subtotal"
  | "paid"
  | "change"
  | "paidBy"
  | "skip"
  | "item";

function parseAmountToken(whole: string, fraction?: string): number | null {
  const digits = whole.replace(/,/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const value = Number(fraction ? `${digits}.${fraction}` : digits);
  if (!Number.isFinite(value)) return null;
  return roundMoney(value);
}

function amountPattern(): RegExp {
  return new RegExp(AMOUNT_RE.source, "gi");
}

function amountsIn(line: string): number[] {
  const found: number[] = [];
  for (const match of line.matchAll(amountPattern())) {
    const value = parseAmountToken(match[1] ?? "", match[2]);
    if (value !== null) found.push(value);
  }
  return found;
}

function lastAmount(line: string): number | null {
  const found = amountsIn(line);
  return found.length ? found[found.length - 1] : null;
}

function titleCase(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function classify(line: string): LineKind {
  const normalized = line.replace(/\s+/g, " ").trim();
  if (!normalized) return "skip";
  if (/^(thank you|thanks|welcome|have a nice day|check|receipt|invoice|bill)\b/i.test(normalized)) return "skip";
  if (
    /^(tel|phone|ph|mobile|hotline|cashier|served by|waitstaff|waiter|server|table|guest|terminal|date|time|inv|invoice no|receipt no|bill no|no\.?)\b/i.test(
      normalized,
    )
  ) {
    return "skip";
  }
  if (/^paid\s*by\b/i.test(normalized)) return "paidBy";
  if (/^(change|changed|change\s*due)\b/i.test(normalized)) return "change";
  if (/^sub[\s-]*total\b/i.test(normalized)) return "subtotal";
  if (/^(service\s*charge|svc\.?\s*ch|rounding|round\s*off|tax|vat|commercial\s*tax|gst)\b/i.test(normalized)) {
    return "skip";
  }
  if (/^total\s+before\b/i.test(normalized)) return "skip";
  if (/^(cash\s*tendered|cash\s*received|amount\s*paid|amount\s*tendered|tendered|tender|paid|cash(?!ier))\b/i.test(normalized)) {
    return "paid";
  }
  if (/^grand\s*total\b/i.test(normalized)) return "grand";
  if (/^(net\s*total|amount\s*due|balance\s*due|total\s*amount|total\s*due|total)\b/i.test(normalized)) {
    return "total";
  }
  return "item";
}

function parseDate(line: string): string | null {
  const match = line.match(DATE_RE);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  const monthText = String(month).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");
  return `${year}-${monthText}-${dayText}`;
}

function inferCategory(vendor: string, text: string): Category {
  const blob = `${vendor}\n${text}`.toLowerCase();
  if (/city\s*express|city\s*mart|mini\s*mart|minimart|convenience|grocery|grocer|supermarket|market/.test(blob)) {
    return "Groceries";
  }
  if (/tea|cafe|coffee|restaurant|food|beverage|bakery|noodle|mohinga|beer|bar\b|pub\b/.test(blob)) {
    return "Food & Beverages";
  }
  return "Food & Beverages";
}

function pickVendor(lines: string[]): string {
  const candidates = lines.filter((line) => {
    if (classify(line) !== "item") return false;
    if (isHeaderNoise(line) || amountsIn(line).length > 0) return false;
    const letters = line.match(/[A-Za-z\u1000-\u109F]/g)?.length ?? 0;
    return letters >= 3 && letters / line.length > 0.6;
  });
  const named = candidates.find((line) =>
    /beer factory|city express|city mart|tea shop|tea house/i.test(line),
  );
  const chosen = named ?? candidates.sort((a, b) => b.length - a.length)[0] ?? "";
  return titleCase(
    chosen
      .replace(/[^A-Za-z\u1000-\u109F &.'-]+$/g, "")
      .replace(/\s+[A-Za-z]$/g, "")
      .trim(),
  );
}

function vendorFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ");
  const cleaned = base
    .replace(/\b(receipt|voucher|bill|scan|img|image|photo|jpg|jpeg|png|pdf|svg)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 3) return "";
  return titleCase(cleaned);
}

function isHeaderNoise(line: string): boolean {
  return /^(no\.?\s*\d|yangon|mandalay|sanchaung|bahan|kamayut|tel\b|phone\b|address\b|unit\b|terminal\b|fb\.?\s*com)/i.test(
    line,
  );
}

function itemFromLine(line: string): { description: string; amount: number } | null {
  const withoutAsides = line.replace(/\([^)]*\)/g, " ");
  const matches = [...withoutAsides.matchAll(amountPattern())];
  if (!matches.length) return null;
  const last = matches[matches.length - 1];
  const amount = parseAmountToken(last[1] ?? "", last[2]);
  if (amount === null || amount < 50) return null;
  let description = withoutAsides.slice(0, last.index ?? 0).replace(/[\s:.\-|]+$/g, "").trim();
  description = description.replace(/(?:\s+\d{1,3}(?:,\d{3})*)+\s*$/g, "").trim();
  const letters = description.match(/[A-Za-z\u1000-\u109F]/g)?.length ?? 0;
  if (letters < 3 || letters / Math.max(description.length, 1) < 0.45) return null;
  if (description.length > 80) description = description.slice(0, 80);
  return { description: description.replace(/\s+/g, " "), amount };
}

function paidByLabel(line: string): string {
  return line.replace(/^paid\s*by\s*:?\s*/i, "").trim();
}

export function parseReceiptText(source: string, fileName = ""): ParsedReceipt {
  const text = source.replace(/\r/g, "").trim();
  if (!text) return fallbackReceipt(fileName);

  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let vendor = "";
  let date = "";
  let total: number | null = null;
  let grand: number | null = null;
  let subtotal: number | null = null;
  let paid: number | null = null;
  let change: number | null = null;
  let paidBy = "";
  let itemsStarted = false;
  const lineItems: Array<{ description: string; amount: number }> = [];

  for (const line of lines) {
    const foundDate = parseDate(line);
    if (foundDate && !date) date = foundDate;

    const kind = classify(line);
    if (kind === "paidBy") {
      paidBy = paidByLabel(line);
      itemsStarted = true;
      continue;
    }
    if (kind === "change") {
      const amount = lastAmount(line);
      if (amount !== null) change = amount;
      itemsStarted = true;
      continue;
    }
    if (kind === "paid") {
      const amount = lastAmount(line);
      if (amount !== null) paid = amount;
      itemsStarted = true;
      continue;
    }
    if (kind === "subtotal") {
      const amount = lastAmount(line);
      if (amount !== null) subtotal = amount;
      itemsStarted = true;
      continue;
    }
    if (kind === "grand") {
      const amount = lastAmount(line);
      if (amount !== null) grand = amount;
      itemsStarted = true;
      continue;
    }
    if (kind === "total") {
      const amount = lastAmount(line);
      if (amount !== null && grand === null) total = amount;
      itemsStarted = true;
      continue;
    }
    if (kind === "skip") {
      if (foundDate) itemsStarted = true;
      continue;
    }

    if (!itemsStarted) {
      if (foundDate) {
        itemsStarted = true;
        continue;
      }
      continue;
    }

    if (foundDate && amountsIn(line).length === 0) continue;
    if (/no\.?\s*\d|road|street|pagoda|tower|yangon|phone|fb\.?\s*com/i.test(line)) continue;
    const item = itemFromLine(line);
    if (item) lineItems.push(item);
  }

  if (!vendor) vendor = pickVendor(lines) || vendorFromFileName(fileName);

  if (grand !== null) total = grand;
  let totalFound = total !== null;
  if (!totalFound && subtotal !== null) {
    total = subtotal;
    totalFound = true;
  }

  if (total !== null && change !== null && total === change && paid !== null && paid !== total) {
    total = paid > change ? roundMoney(paid - change) : total;
  }

  const category = inferCategory(vendor, text);
  const notes = buildNotes({ paid, change, paidBy, totalFound });
  const confidence = scoreConfidence({
    vendor,
    date,
    totalFound,
    lineItems: lineItems.length,
    paid,
    change,
    text,
  });

  return {
    vendor: vendor || "Local shop",
    date: date || todayISO(),
    total: totalFound ? total : null,
    paid,
    change,
    currency: DEFAULT_CURRENCY,
    category,
    notes,
    lineItems,
    confidence,
    totalFound,
  };
}

function buildNotes(input: {
  paid: number | null;
  change: number | null;
  paidBy: string;
  totalFound: boolean;
}): string {
  const parts: string[] = [];
  if (input.paid !== null) parts.push(`Cash tendered ${formatMoney(input.paid)}`);
  if (input.change !== null) parts.push(`change ${formatMoney(input.change)}`);
  if (input.paidBy) parts.push(`Paid by ${input.paidBy}`);
  if (!input.totalFound) {
    parts.push("Total was not read. Enter the Total line, not the cash or change.");
  }
  return parts.join(". ").slice(0, 400);
}

function scoreConfidence(input: {
  vendor: string;
  date: string;
  totalFound: boolean;
  lineItems: number;
  paid: number | null;
  change: number | null;
  text: string;
}): number {
  let score = 0.22;
  if (input.vendor && input.vendor !== "Local shop") score += 0.22;
  if (input.date) score += 0.14;
  if (input.totalFound) score += 0.3;
  if (input.lineItems > 0) score += 0.08;
  if (input.paid !== null || input.change !== null) score += 0.08;
  if (/ks|mmk|kyat|ကျပ်/i.test(input.text)) score += 0.06;
  if (!input.totalFound) score = Math.min(score, 0.45);
  return roundMoney(Math.min(0.98, score));
}

export function fallbackReceipt(fileName = ""): ParsedReceipt {
  const vendor = vendorFromFileName(fileName);
  const category = inferCategory(vendor, fileName);
  return {
    vendor: vendor || "Local shop",
    date: todayISO(),
    total: null,
    paid: null,
    change: null,
    currency: DEFAULT_CURRENCY,
    category,
    notes: "Could not read the print. Enter the Total in kyat, and leave out cash tendered or change.",
    lineItems: [],
    confidence: vendor ? 0.4 : 0.28,
    totalFound: false,
  };
}

export function extractSvgText(svg: string): string {
  return [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)]
    .map((match) =>
      decodeXml(match[1].replace(/<[^>]+>/g, ""))
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

export function extractPdfText(binary: string): string {
  const parts: string[] = [];
  for (const match of binary.matchAll(/\((?:\\.|[^\\)]){2,}\)/g)) {
    const inner = match[0]
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");
    if (/[A-Za-z\u1000-\u109F]/.test(inner)) parts.push(inner);
  }
  return parts.join("\n").trim();
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
