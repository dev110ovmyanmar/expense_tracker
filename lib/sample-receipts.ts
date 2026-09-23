import { formatDate, moneyInput, recentDate, todayISO } from "@/lib/format";
import { getTemplate, templateToOCR } from "@/lib/ocr";
import type { OCRData } from "@/types/expense";

export interface SampleReceipt {
  id: string;
  label: string;
  description: string;
  file: File;
  data: OCRData;
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderThermalReceipt(input: {
  merchant: string;
  address: string;
  dateLabel: string;
  lines: { description: string; amount: string }[];
  subtotal: string;
  tax: string;
  total: string;
  footer: string;
}): string {
  const width = 360;
  const lineHeight = 28;
  const top = 168;
  const height = top + input.lines.length * lineHeight + 230;
  const rows = input.lines
    .map((line, index) => {
      const y = top + index * lineHeight;
      return `<text x="32" y="${y}" font-size="15" fill="#2c261f">${esc(line.description)}</text>
        <text x="328" y="${y}" font-size="15" fill="#2c261f" text-anchor="end">${esc(line.amount)}</text>`;
    })
    .join("");
  const subY = top + input.lines.length * lineHeight + 16;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#f6f0e4"/>
  <path d="M0 12 L12 0 L24 12 L36 0 L48 12 L60 0 L72 12 L84 0 L96 12 L108 0 L120 12 L132 0 L144 12 L156 0 L168 12 L180 0 L192 12 L204 0 L216 12 L228 0 L240 12 L252 0 L264 12 L276 0 L288 12 L300 0 L312 12 L324 0 L336 12 L348 0 L360 12 V ${height} H0 Z" fill="#fbf7ef"/>
  <text x="180" y="58" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#2c261f">${esc(input.merchant)}</text>
  <text x="180" y="82" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="12" fill="#6d6458">${esc(input.address)}</text>
  <text x="180" y="104" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="12" fill="#6d6458">${esc(input.dateLabel)}</text>
  <line x1="32" y1="124" x2="328" y2="124" stroke="#c9bfb0" stroke-dasharray="3 4"/>
  <g font-family="ui-monospace, Menlo, Consolas, monospace">${rows}</g>
  <line x1="32" y1="${subY - 8}" x2="328" y2="${subY - 8}" stroke="#c9bfb0" stroke-dasharray="3 4"/>
  <g font-family="ui-monospace, Menlo, Consolas, monospace" font-size="14" fill="#2c261f">
    <text x="32" y="${subY + 16}">Subtotal</text>
    <text x="328" y="${subY + 16}" text-anchor="end">${esc(input.subtotal)}</text>
    <text x="32" y="${subY + 42}">Tax</text>
    <text x="328" y="${subY + 42}" text-anchor="end">${esc(input.tax)}</text>
  </g>
  <text x="32" y="${subY + 78}" font-family="Georgia, serif" font-size="18" fill="#2c261f">Total</text>
  <text x="328" y="${subY + 78}" text-anchor="end" font-family="Georgia, serif" font-size="18" fill="#2c261f">${esc(input.total)}</text>
  <text x="180" y="${height - 36}" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" fill="#6d6458">${esc(input.footer)}</text>
</svg>`;
}

function renderStatement(input: {
  merchant: string;
  account: string;
  dateLabel: string;
  lines: { description: string; amount: string }[];
  tax: string;
  total: string;
  footer: string;
}): string {
  const width = 420;
  const height = 520;
  const rows = input.lines
    .map((line, index) => {
      const y = 230 + index * 36;
      return `<text x="36" y="${y}" font-size="15" fill="#243044">${esc(line.description)}</text>
        <text x="384" y="${y}" font-size="15" fill="#243044" text-anchor="end">${esc(line.amount)}</text>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="18" fill="#f4f7fb"/>
  <rect width="${width}" height="92" rx="18" fill="#1f3b5b"/>
  <rect y="74" width="${width}" height="18" fill="#1f3b5b"/>
  <text x="36" y="48" font-family="Georgia, serif" font-size="26" fill="#f7f4ee">${esc(input.merchant)}</text>
  <text x="36" y="72" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="12" fill="#d5e2f2">Residential statement</text>
  <text x="36" y="140" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="13" fill="#5c6b80">${esc(input.account)}</text>
  <text x="36" y="164" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="13" fill="#5c6b80">Statement date ${esc(input.dateLabel)}</text>
  <line x1="36" y1="190" x2="384" y2="190" stroke="#d5deea"/>
  <g font-family="ui-monospace, Menlo, Consolas, monospace">${rows}</g>
  <text x="36" y="330" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="15" fill="#243044">Tax</text>
  <text x="384" y="330" text-anchor="end" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="15" fill="#243044">${esc(input.tax)}</text>
  <rect x="24" y="360" width="372" height="78" rx="12" fill="#1f3b5b"/>
  <text x="44" y="392" font-family="Georgia, serif" font-size="16" fill="#d5e2f2">Amount due</text>
  <text x="376" y="408" text-anchor="end" font-family="Georgia, serif" font-size="28" fill="#f7f4ee">${esc(input.total)}</text>
  <text x="36" y="478" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="12" fill="#5c6b80">${esc(input.footer)}</text>
</svg>`;
}

function svgFile(name: string, svg: string): File {
  return new File([svg], name, { type: "image/svg+xml" });
}

export function getSampleReceipts(): SampleReceipt[] {
  const coffee = getTemplate("blue-bottle");
  const utility = getTemplate("coned");
  if (!coffee || !utility) return [];

  const coffeeDate = todayISO();
  const utilityDate = recentDate(5);
  const coffeeData = templateToOCR(coffee, {
    date: coffeeDate,
    confidence: 0.98,
    matchedSample: true,
    id: "sample-coffee",
  });
  const utilityData = templateToOCR(utility, {
    date: utilityDate,
    confidence: 0.96,
    matchedSample: true,
    id: "sample-coned",
  });

  const coffeeSubtotal = (coffeeData.total - coffeeData.tax).toFixed(2);
  const coffeeSvg = renderThermalReceipt({
    merchant: coffeeData.vendor,
    address: "10 Prince St, New York",
    dateLabel: formatDate(coffeeDate),
    lines: coffeeData.lineItems.map((item) => ({
      description: item.description,
      amount: moneyInput(item.amount),
    })),
    subtotal: coffeeSubtotal,
    tax: moneyInput(coffeeData.tax),
    total: moneyInput(coffeeData.total),
    footer: "Card ending 4412  ·  Thank you",
  });

  const utilitySvg = renderStatement({
    merchant: utilityData.vendor,
    account: "Account 8821-440",
    dateLabel: formatDate(utilityDate),
    lines: utilityData.lineItems.map((item) => ({
      description: item.description,
      amount: moneyInput(item.amount),
    })),
    tax: moneyInput(utilityData.tax),
    total: moneyInput(utilityData.total),
    footer: "Amount due matches the charges above. Pay by the 28th.",
  });

  return [
    {
      id: "coffee",
      label: "Coffee receipt",
      description: "Blue Bottle, SoHo",
      file: svgFile("blue-bottle-receipt.svg", coffeeSvg),
      data: coffeeData,
    },
    {
      id: "utility",
      label: "Utility bill",
      description: "Con Edison statement",
      file: svgFile("coned-bill.svg", utilitySvg),
      data: utilityData,
    },
  ];
}
