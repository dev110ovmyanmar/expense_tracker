"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { forecastRunway, type RunwayPoint } from "@/lib/runway";
import type { Expense } from "@/types/expense";

export function RunwayChart({ expenses }: { expenses: Expense[] }) {
  const forecast = forecastRunway(expenses);
  const low = forecast.lowDay !== null;
  const rising = forecast.endingBalance >= forecast.startingBalance && !low;
  const stroke = low ? "var(--destructive)" : rising ? "#1f8a5b" : "var(--primary)";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial runway</CardTitle>
        <CardDescription>
          Next 30 days from your salary and the recent daily spend.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
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
            <div className="h-64 min-w-0 overflow-hidden sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast.points} margin={{ top: 28, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="runway-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={stroke} stopOpacity={0.32} />
                      <stop offset="78%" stopColor={stroke} stopOpacity={0.06} />
                      <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                    </linearGradient>
                    <filter id="runway-glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="2.4" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
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
                    width={44}
                    tickFormatter={(value: number) =>
                      Math.abs(value) >= 1000 ? `${Math.round(value / 1000)}k` : String(Math.round(value))
                    }
                  />
                  <Tooltip content={<RunwayTooltip />} cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }} />
                  {forecast.warningLevel > 0 ? (
                    <ReferenceLine
                      y={forecast.warningLevel}
                      stroke="var(--destructive)"
                      strokeDasharray="4 4"
                      label={{ value: "Low", fill: "var(--destructive)", fontSize: 11, position: "insideTopRight" }}
                    />
                  ) : null}
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke={stroke}
                    strokeWidth={2.5}
                    fill="url(#runway-fill)"
                    dot={(props) => <RunwayDot {...props} stroke={stroke} />}
                    activeDot={{ r: 5, fill: stroke, stroke: "var(--card)", strokeWidth: 2 }}
                  />
                </AreaChart>
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

function RunwayDot({
  cx,
  cy,
  payload,
  stroke,
}: {
  cx?: number;
  cy?: number;
  payload?: RunwayPoint;
  stroke: string;
}) {
  if (cx == null || cy == null || !payload) return null;
  const marked = payload.day === 0 || payload.day === 30;
  if (!marked) return <circle cx={cx} cy={cy} r={2.4} fill={stroke} />;
  const title = payload.day === 0 ? "Today" : "Day 30";
  return (
    <g filter="url(#runway-glow)">
      <circle cx={cx} cy={cy} r={10} fill={stroke} opacity={0.18} />
      <circle cx={cx} cy={cy} r={4.5} fill={stroke} stroke="var(--card)" strokeWidth={2} />
      <text x={cx} y={cy - 14} textAnchor="middle" fill={stroke} fontSize={11} fontWeight={600}>
        {title}
      </text>
    </g>
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
  payload?: Array<{ payload?: RunwayPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const mark = point.day === 0 ? "Today" : point.day === 30 ? "Day 30" : `Day ${point.day}`;
  return (
    <div className="rounded-xl bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{mark}</p>
      <p className="font-medium">{point.when}</p>
      <p className="mt-1 text-xs text-muted-foreground">Projected balance</p>
      <p className={`font-mono text-base ${point.low ? "text-destructive" : ""}`}>{formatMoney(point.balance)}</p>
    </div>
  );
}
