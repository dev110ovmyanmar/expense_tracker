import { formatReceiptDate, recentDate, todayISO } from "@/lib/format";

export interface SampleReceipt {
  id: string;
  label: string;
  description: string;
  file: File;
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderThermal(lines: string[]): string {
  const width = 360;
  const lineHeight = 22;
  const height = 36 + lines.length * lineHeight + 28;
  const rows = lines
    .map((line, index) => {
      const y = 36 + index * lineHeight;
      const header = index === 0;
      return `<text x="180" y="${y}" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="${header ? 18 : 13}" font-weight="${header ? 700 : 400}" fill="#241c14">${esc(line)}</text>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#f4efe4"/>
  <rect x="12" y="12" width="${width - 24}" height="${height - 24}" fill="#fbf7ef" stroke="#d9d0c2"/>
  ${rows}
</svg>`;
}

function svgFile(name: string, svg: string): File {
  return new File([svg], name, { type: "image/svg+xml" });
}

export function getSampleReceipts(): SampleReceipt[] {
  const today = formatReceiptDate(todayISO());
  const earlier = formatReceiptDate(recentDate(4));

  const cityExpress = [
    "CITY EXPRESS",
    "Convenience Store",
    "No.45 Kabar Aye Pagoda Rd",
    "Yangon",
    `${today} 12:05 PM`,
    "INV CE-10482",
    "Coca Cola 330ml 1,200",
    "Lays Classic 1,500",
    "Tissue 800",
    "Subtotal 3,500",
    "Tax 0",
    "Total: 3,500",
    "Cash 5,000",
    "Change 1,500",
    "Paid By: Cash",
  ];

  const teaShop = [
    "SHWE OH TEA SHOP",
    "Sanchaung, Yangon",
    `${earlier} 7:40 AM`,
    "Milk tea 800",
    "Paratha 700",
    "Total Ks 1,500",
    "Paid Ks 2,000",
    "Changed Ks 500",
  ];

  return [
    {
      id: "city-express",
      label: "City Express",
      description: "Convenience store, total 3,500 Ks",
      file: svgFile("city-express-receipt.svg", renderThermal(cityExpress)),
    },
    {
      id: "tea-shop",
      label: "Tea shop",
      description: "Shwe Oh, total 1,500 Ks",
      file: svgFile("shwe-oh-tea.svg", renderThermal(teaShop)),
    },
  ];
}
