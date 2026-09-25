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
        <p className="text-[11px] font-medium tracking-[0.14em] text-white/60 uppercase sm:text-xs">
          {eyebrow}
        </p>
        <h1 className="font-sans text-2xl leading-tight font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
        {description ? (
          <p className="text-sm leading-5 text-white/60 sm:text-base sm:leading-6">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap [&>*:last-child:nth-child(odd)]:col-span-2 [&_a]:min-h-11 [&_a]:w-full sm:[&_a]:w-auto [&_button]:min-h-11 [&_button]:w-full sm:[&_button]:w-auto">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
