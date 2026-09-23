export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function startOfMonthISO(date = new Date()): string {
  return toISODate(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function monthKey(date = new Date()): string {
  return toISODate(date).slice(0, 7);
}

export function recentDate(daysAgo: number): string {
  const today = new Date();
  const shift = Math.min(Math.max(0, daysAgo), Math.max(0, today.getDate() - 1));
  return toISODate(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - shift),
  );
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatLongDate(date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatMonth(date = new Date()): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseMoney(input: string): number | null {
  const cleaned = input.trim().replace(/[$,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return roundMoney(value);
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function moneyInput(value: number): string {
  return value.toFixed(2);
}
