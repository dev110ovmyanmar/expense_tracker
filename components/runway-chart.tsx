"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { forecastRunway } from "@/lib/runway";
import type { Expense } from "@/types/expense";

export function RunwayChart({ expenses }: { expenses: Expense[] }) {
  const forecast = forecastRunway(expenses);
  const low = forecast.lowDay !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial runway</CardTitle>
        <CardDescription>
          Next 30 days from your salary and the recent daily spend.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Figure label="Daily spend" value={formatMoney(forecast.dailyExpense)} />
          <Figure label="Monthly salary" value={formatMoney(forecast.monthlySalary)} />
          <Figure
            label="Balance in 30 days"
            value={`${forecast.endingBalance < 0 ? "−" : ""}${formatMoney(Math.abs(forecast.endingBalance))}`}
            warning={low}
          />
        </div>
        {forecast.ready ? (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecast.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(value: number) =>
                      Math.abs(value) >= 1000 ? `${Math.round(value / 1000)}k` : String(Math.round(value))
                    }
                  />
                  <Tooltip content={<RunwayTooltip />} />
                  {forecast.warningLevel > 0 ? (
                    <ReferenceLine
                      y={forecast.warningLevel}
                      stroke="var(--destructive)"
                      strokeDasharray="4 4"
                      label={{ value: "Low", fill: "var(--destructive)", fontSize: 11, position: "insideTopRight" }}
                    />
                  ) : null}
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke={low ? "var(--destructive)" : "var(--primary)"}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className={`text-sm ${low ? "text-destructive" : "text-muted-foreground"}`}>
              {low && forecast.lowDay !== null
                ? forecast.lowDay === 0
                  ? `Already under ${formatMoney(forecast.warningLevel)}, about a week of spending.`
                  : `Dips under ${formatMoney(forecast.warningLevel)} on ${forecast.points[forecast.lowDay]?.label}, about a week of spending.`
                : "Stays above a week of spending for the next 30 days."}
            </p>
          </>
        ) : (
          <div className="grid min-h-40 place-items-center rounded-xl border border-dashed px-6 text-center">
            <div className="max-w-md space-y-1">
              <p className="font-medium">No runway yet</p>
              <p className="text-sm text-muted-foreground">
                Log a salary and a few expenses. The line uses that pace for the next 30 days.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Figure({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-3">
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <p className={`mt-1 font-mono text-lg tabular-nums ${warning ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

function RunwayTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { label: string; balance: number; low: boolean } }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10">
      <p className="font-medium">{point.label}</p>
      <p className={`font-mono ${point.low ? "text-destructive" : "text-muted-foreground"}`}>
        {formatMoney(point.balance)}
      </p>
    </div>
  );
}
