import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="max-w-2xl space-y-1 sm:space-y-2">
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase sm:text-xs">
          {eyebrow}
        </p>
        <h1 className="font-heading text-xl leading-tight tracking-tight sm:text-4xl">{title}</h1>
        {description ? (
          <p className="line-clamp-3 text-[13px] leading-5 text-muted-foreground sm:line-clamp-none sm:text-base sm:leading-6">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap has-[>:nth-child(3)]:grid has-[>:nth-child(3)]:grid-cols-3 [&_a]:min-h-11 [&_a]:w-full sm:[&_a]:w-auto [&_button]:min-h-11 [&_button]:w-full sm:[&_button]:w-auto has-[>:nth-child(3)]:[&_a]:h-auto has-[>:nth-child(3)]:[&_a]:min-h-14 has-[>:nth-child(3)]:[&_a]:flex-col has-[>:nth-child(3)]:[&_a]:gap-1 has-[>:nth-child(3)]:[&_a]:px-1.5 has-[>:nth-child(3)]:[&_a]:text-xs has-[>:nth-child(3)]:[&_button]:h-auto has-[>:nth-child(3)]:[&_button]:min-h-14 has-[>:nth-child(3)]:[&_button]:flex-col has-[>:nth-child(3)]:[&_button]:gap-1 has-[>:nth-child(3)]:[&_button]:px-1.5 has-[>:nth-child(3)]:[&_button]:text-xs sm:has-[>:nth-child(3)]:[&_a]:h-10 sm:has-[>:nth-child(3)]:[&_a]:min-h-11 sm:has-[>:nth-child(3)]:[&_a]:flex-row sm:has-[>:nth-child(3)]:[&_a]:px-2.5 sm:has-[>:nth-child(3)]:[&_a]:text-sm sm:has-[>:nth-child(3)]:[&_button]:h-10 sm:has-[>:nth-child(3)]:[&_button]:min-h-11 sm:has-[>:nth-child(3)]:[&_button]:flex-row sm:has-[>:nth-child(3)]:[&_button]:px-2.5 sm:has-[>:nth-child(3)]:[&_button]:text-sm">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
