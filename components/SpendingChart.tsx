"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CategoryDot } from "@/components/category-icon";
import { CATEGORY_META } from "@/lib/categories";
import { totalsByCategory } from "@/lib/expenses";
import { formatMoney } from "@/lib/format";
import type { Expense } from "@/types/expense";

export function SpendingChart({ expenses }: { expenses: Expense[] }) {
  const slices = totalsByCategory(expenses);
  const total = slices.reduce((sum, slice) => sum + slice.total, 0);

  if (slices.length === 0) {
    return (
      <div className="grid min-h-52 place-items-center rounded-xl border border-dashed px-6 text-center">
        <div className="max-w-xs space-y-1">
          <p className="font-medium">No spending in this month yet</p>
          <p className="text-sm text-muted-foreground">
            Add an expense or scan a receipt and the breakdown will land here.
          </p>
        </div>
      </div>
    );
  }

  const data = slices.map((slice) => ({
    name: slice.category,
    value: slice.total,
    color: CATEGORY_META[slice.category].color,
  }));

  return (
    <div className="grid items-center gap-4 md:grid-cols-[220px_1fr]">
      <div className="relative h-52">
        <div aria-hidden className="h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="88%"
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Spent</p>
            <p className="font-mono text-lg tracking-tight">{formatMoney(total)}</p>
          </div>
        </div>
      </div>
      <ul className="grid gap-2">
        {slices.map((slice) => {
          const percent = total > 0 ? (slice.total / total) * 100 : 0;
          const label = percent >= 10 ? `${percent.toFixed(0)}%` : `${percent.toFixed(1)}%`;
          return (
            <li key={slice.category} className="flex items-center gap-3 text-sm">
              <CategoryDot category={slice.category} className="size-2.5 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1 truncate">{slice.category}</span>
              <span className="text-muted-foreground">{label}</span>
              <span className="w-24 text-right font-mono tabular-nums">
                {formatMoney(slice.total)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10">
      <p className="font-medium">{item.name}</p>
      <p className="font-mono text-muted-foreground">{formatMoney(Number(item.value ?? 0))}</p>
    </div>
  );
}
