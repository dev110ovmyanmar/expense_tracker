import { fallbackReceipt, extractPdfText, extractSvgText, parseReceiptText } from "@/lib/parse-receipt";
import { DEFAULT_CURRENCY, type LineItem, type OCRData } from "@/types/expense";

export const OCR_STEPS = [
  {
    title: "Uploading image",
    detail: "Reading the file on this device",
  },
  {
    title: "Detecting vendor & totals",
    detail: "Finding the shop, date, and the Total line in kyat",
  },
  {
    title: "Parsing line items & category",
    detail: "Keeping cash tendered and change off the expense total",
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
    tax: parsed.tax,
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

export async function extractReceipt(file: File): Promise<OCRData> {
  try {
    const source = await readReceiptSource(file);
    return toOCRData(file.name, source);
  } catch {
    return toOCRData(file.name, "");
  }
}
