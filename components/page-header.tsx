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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl space-y-2">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <h1 className="font-heading text-3xl tracking-tight sm:text-4xl">{title}</h1>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
