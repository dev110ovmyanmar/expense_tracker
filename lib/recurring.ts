import { toISODate } from "@/lib/format";
import type { Frequency } from "@/types/planning";

export function advanceDate(iso: string, frequency: Frequency, steps = 1): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  if (frequency === "daily") {
    return toISODate(new Date(year, month - 1, day + steps));
  }
  if (frequency === "weekly") {
    return toISODate(new Date(year, month - 1, day + 7 * steps));
  }
  const target = new Date(year, month - 1 + steps, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  return toISODate(target);
}

export function scheduleCatchUp(nextDue: string, frequency: Frequency, today: string, limit = frequency === "daily" ? 31 : 6) {
  const dates: string[] = [];
  let cursor = nextDue;
  while (cursor <= today && dates.length < limit) {
    dates.push(cursor);
    cursor = advanceDate(cursor, frequency);
  }
  return { dates, nextDue: dates.length > 0 ? cursor : nextDue };
}
