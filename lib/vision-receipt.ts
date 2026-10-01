import { todayISO } from "@/lib/format";
import { DEFAULT_CURRENCY, type Category, type OCRData, type VoucherScan } from "@/types/expense";

export const VISION_SYSTEM_PROMPT =
  "Read this receipt. JSON only: shopName, date as YYYY-MM-DD, invoiceNo, items[{itemName,quantity,unitPrice,totalPrice}], subtotal, tax, serviceCharge, grandTotal, currency, direction, counterparty, note. grandTotal is the final amount as a positive number. direction is \"in\" only when that amount is printed with a leading plus, and \"out\" when it is printed with a leading minus. For KBZPay, KPay, Wave, or bank e-receipts, counterparty is Transfer From when direction is in and Transfer To or the merchant when direction is out, invoiceNo is the transaction number, note is the Notes line, and items is empty. Leave tax, service charge, and totals out of items.";

const SUMMARY_ITEM =
  /^(grand\s*)?total(?:\s*(amount|amt))?$|^sub[\s-]*total$|^net(?:t)?\s*(?:amount|amt|total)$|^tax$|^vat$|^service\s*charge$|^rounding$|^round\s*off$/i;

export function asNumber(value: unknown): number | null {
  const signed = readSigned(value);
  if (signed.amount === null) return null;
  return signed.direction === "out" ? -signed.amount : signed.amount;
}

export function readSigned(value: unknown): { amount: number | null; direction: "in" | "out" | null } {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 0) return { amount: Math.abs(value), direction: "out" };
    return { amount: value, direction: null };
  }
  if (typeof value !== "string") return { amount: null, direction: null };
  const cleaned = value
    .trim()
    .replace(/kyats?|mmk|ks|usd|\$|€|£|ကျပ်/gi, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "");
  if (!cleaned) return { amount: null, direction: null };
  const direction = cleaned.startsWith("+") ? "in" : cleaned.startsWith("-") ? "out" : null;
  const numeric = cleaned.replace(/^[+-]/, "");
  if (!/^\d+(\.\d+)?$/.test(numeric)) return { amount: null, direction };
  const amount = Number(numeric);
  return Number.isFinite(amount) ? { amount, direction } : { amount: null, direction };
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function asDirection(value: unknown): "in" | "out" | null {
  const text = asText(value).toLowerCase();
  if (text === "in" || text === "income" || text === "credit" || text === "+" || text === "plus") return "in";
  if (text === "out" || text === "expense" || text === "debit" || text === "-" || text === "minus") return "out";
  return null;
}

function partyName(value: string): string {
  return value
    .replace(/\([^)]*\*+[^)]*\)/g, "")
    .replace(/\*+\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isWallet(value: string): boolean {
  return /kbz\s*pay|kbzpay|kpay|kbz\s*bank|wave\s*money|wavepay|cb\s*pay|aya\s*pay|uab\s*pay/i.test(value);
}

function asDate(value: unknown): string {
  const text = asText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (!match) return todayISO();
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  if (day < 1 || day > 31 || month < 1 || month > 12) return todayISO();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseVoucher(value: unknown): VoucherScan | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items = rawItems.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const row = item as Record<string, unknown>;
    const itemName = asText(row.itemName);
    if (!itemName || SUMMARY_ITEM.test(itemName)) return [];
    const quantity = asNumber(row.quantity);
    const unitPrice = asNumber(row.unitPrice);
    let totalPrice = asNumber(row.totalPrice);
    if (totalPrice === null && quantity !== null && unitPrice !== null) {
      totalPrice = Math.round(quantity * unitPrice * 100) / 100;
    }
    if (totalPrice === null || totalPrice < 0) return [];
    return [
      {
        itemName,
        quantity: quantity ?? 1,
        unitPrice: unitPrice ?? totalPrice,
        totalPrice,
      },
    ];
  });
  const signed = readSigned(record.grandTotal);
  const labeled = asDirection(record.direction);
  const brand = asText(record.shopName);
  const counterparty = partyName(
    asText(record.counterparty) || asText(record.transferFrom) || asText(record.transferTo),
  );
  const wallet = isWallet(`${brand} ${asText(record.channel)} ${counterparty}`);
  const direction =
    signed.direction === "in"
      ? "in"
      : signed.direction === "out"
        ? "out"
        : labeled === "in"
          ? "in"
          : labeled === "out" && wallet
            ? "out"
            : null;
  const shopName = counterparty && (wallet || direction === "in") ? counterparty : brand;
  const grandTotal = signed.amount;
  const keptItems = wallet || direction === "in" ? [] : items;
  if (!shopName && grandTotal === null && keptItems.length === 0) return null;
  return {
    shopName,
    date: asDate(record.date),
    invoiceNo: asText(record.invoiceNo),
    items: keptItems,
    subtotal: Math.abs(asNumber(record.subtotal) ?? 0),
    tax: Math.abs(asNumber(record.tax) ?? 0),
    serviceCharge: Math.abs(asNumber(record.serviceCharge) ?? 0),
    grandTotal: grandTotal ?? 0,
    currency: asText(record.currency) || "MMK",
    direction,
    note: asText(record.note).slice(0, 160),
  };
}

function categoryFor(shopName: string): Category {
  const blob = shopName.toLowerCase();
  if (/city\s*express|city\s*mart|minimart|convenience|grocery|market/.test(blob)) return "Groceries";
  return "Food & Beverages";
}

export function voucherToOCR(voucher: VoucherScan): OCRData {
  const totalFound = voucher.grandTotal > 0;
  const income = voucher.direction === "in";
  const notes = [
    voucher.invoiceNo ? `Txn ${voucher.invoiceNo}` : "",
    voucher.note,
    voucher.serviceCharge > 0 ? `Service charge ${voucher.serviceCharge}` : "",
    voucher.tax > 0 ? `Tax ${voucher.tax}` : "",
  ]
    .filter(Boolean)
    .join(". ")
    .slice(0, 400);
  return {
    vendor: voucher.shopName || (income ? "Transfer" : "Local shop"),
    date: voucher.date,
    total: totalFound ? voucher.grandTotal : 0,
    totalFound,
    paid: null,
    change: null,
    currency: DEFAULT_CURRENCY,
    category: income || voucher.direction === "out" ? "Other" : categoryFor(voucher.shopName),
    notes,
    lineItems: voucher.items.map((item, index) => ({
      id: `scan-line-${index + 1}`,
      description: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.totalPrice,
    })),
    confidence: totalFound && voucher.shopName ? 0.9 : 0.45,
    matchedSample: false,
    invoiceNo: voucher.invoiceNo || undefined,
    ...(voucher.direction ? { direction: voucher.direction } : {}),
  };
}
