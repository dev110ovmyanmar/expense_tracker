import { todayISO } from "@/lib/format";
import { DEFAULT_CURRENCY, type Category, type OCRData, type VoucherScan } from "@/types/expense";

export const VISION_SYSTEM_PROMPT =
  "Read this receipt. JSON only: shopName, date as YYYY-MM-DD, invoiceNo, items[{itemName,quantity,unitPrice,totalPrice}], subtotal, tax, serviceCharge, grandTotal, currency. grandTotal is the final amount due, not the subtotal. Leave tax, service charge, and totals out of items. Numbers only.";

const SUMMARY_ITEM =
  /^(grand\s*)?total(?:\s*(amount|amt))?$|^sub[\s-]*total$|^net(?:t)?\s*(?:amount|amt|total)$|^tax$|^vat$|^service\s*charge$|^rounding$|^round\s*off$/i;

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value
    .trim()
    .replace(/kyats?|mmk|ks|usd|\$|€|£/gi, "")
    .replace(/,/g, "")
    .trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
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
  const grandTotal = asNumber(record.grandTotal);
  if (!asText(record.shopName) && grandTotal === null && items.length === 0) return null;
  return {
    shopName: asText(record.shopName),
    date: asDate(record.date),
    invoiceNo: asText(record.invoiceNo),
    items,
    subtotal: asNumber(record.subtotal) ?? 0,
    tax: asNumber(record.tax) ?? 0,
    serviceCharge: asNumber(record.serviceCharge) ?? 0,
    grandTotal: grandTotal ?? 0,
    currency: asText(record.currency) || "MMK",
  };
}

function categoryFor(shopName: string): Category {
  const blob = shopName.toLowerCase();
  if (/city\s*express|city\s*mart|minimart|convenience|grocery|market/.test(blob)) return "Groceries";
  return "Food & Beverages";
}

export function voucherToOCR(voucher: VoucherScan): OCRData {
  const totalFound = voucher.grandTotal > 0;
  const notes = [
    voucher.invoiceNo ? `Invoice ${voucher.invoiceNo}` : "",
    voucher.serviceCharge > 0 ? `Service charge ${voucher.serviceCharge}` : "",
    voucher.tax > 0 ? `Tax ${voucher.tax}` : "",
  ]
    .filter(Boolean)
    .join(". ")
    .slice(0, 400);
  return {
    vendor: voucher.shopName || "Local shop",
    date: voucher.date,
    total: totalFound ? voucher.grandTotal : 0,
    totalFound,
    paid: null,
    change: null,
    currency: DEFAULT_CURRENCY,
    category: categoryFor(voucher.shopName),
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
  };
}
