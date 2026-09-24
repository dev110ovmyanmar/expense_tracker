import { fallbackReceipt, extractPdfText, extractSvgText, parseReceiptText } from "@/lib/parse-receipt";
import { parseVoucher, voucherToOCR } from "@/lib/vision-receipt";
import { DEFAULT_CURRENCY, type LineItem, type OCRData } from "@/types/expense";

export const OCR_STEPS = [
  {
    title: "Uploading image",
    detail: "Sending the voucher image to the vision model",
  },
  {
    title: "Detecting vendor & totals",
    detail: "Reading the shop name and the grand total",
  },
  {
    title: "Parsing line items & category",
    detail: "Checking item names, quantities, and unit prices",
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

async function readVision(file: File): Promise<OCRData> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/ocr", { method: "POST", body });
  const payload: unknown = await response.json().catch(() => null);
  const record = typeof payload === "object" && payload !== null ? payload : {};
  const error = "error" in record && typeof record.error === "string" ? record.error : "";
  const voucher = "voucher" in record ? parseVoucher(record.voucher) : null;
  if (voucher) return voucherToOCR(voucher);
  const fallback = fallbackReceipt(file.name);
  return {
    vendor: fallback.vendor,
    date: fallback.date,
    total: 0,
    totalFound: false,
    paid: null,
    change: null,
    currency: DEFAULT_CURRENCY,
    category: fallback.category,
    notes: error || fallback.notes,
    lineItems: [],
    confidence: 0.3,
    matchedSample: false,
    warning: error || "The vision model could not read this voucher.",
  };
}

async function readReceiptSource(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const isSvg = file.type.includes("svg") || name.endsWith(".svg");
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  const isText = file.type.startsWith("text/") || name.endsWith(".txt");
  if (!isSvg && !isPdf && !isText) return "";

  if (isPdf) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
    }
    return extractPdfText(binary);
  }

  const raw = await file.text();
  return isSvg ? extractSvgText(raw) : raw;
}

function toOCRData(fileName: string, source: string): OCRData {
  const parsed = source.trim() ? parseReceiptText(source, fileName) : fallbackReceipt(fileName);
  const lineItems: LineItem[] = parsed.lineItems.map((item, index) => ({
    id: `scan-line-${index + 1}`,
    description: item.description,
    amount: item.amount,
  }));
  return {
    vendor: parsed.vendor,
    date: parsed.date,
    total: parsed.total ?? 0,
    totalFound: parsed.totalFound,
    paid: parsed.paid,
    change: parsed.change,
    currency: parsed.currency || DEFAULT_CURRENCY,
    category: parsed.category,
    notes: parsed.notes,
    lineItems,
    confidence: parsed.confidence,
    matchedSample: parsed.totalFound,
  };
}

function isRaster(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) ||
    ["png", "jpg", "jpeg", "webp", "gif"].some((ext) => name.endsWith(`.${ext}`))
  );
}

export async function extractReceipt(file: File): Promise<OCRData> {
  try {
    if (isRaster(file)) return await readVision(file);
    const source = await readReceiptSource(file);
    return toOCRData(file.name, source);
  } catch {
    return toOCRData(file.name, "");
  }
}
