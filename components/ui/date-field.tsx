"use client";

import { Calendar } from "lucide-react";
import { cn } from "cn";
import { formatDate } from "@/lib/format";

export function DateField({
  id,
  value,
  onChange,
  className,
  "aria-invalid": ariaInvalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "aria-invalid"?: boolean;
}) {
  return (
    <div className={cn("relative w-full min-w-0 max-w-full overflow-hidden", className)}>
      <input
        id={id}
        type="date"
        value={value}
        aria-invalid={ariaInvalid || undefined}
        onChange={(event) => onChange(event.target.value)}
        className="peer absolute inset-0 z-10 h-full w-full min-w-0 max-w-full cursor-pointer opacity-0"
      />
      <div
        aria-hidden
        className="pointer-events-none flex h-11 w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-input bg-transparent px-2.5 text-base peer-focus:border-ring peer-focus:ring-3 peer-focus:ring-ring/50 peer-focus:ring-inset peer-aria-invalid:border-destructive dark:bg-input/30"
      >
        <span className="min-w-0 flex-1 truncate">{value ? formatDate(value) : "Choose a date"}</span>
        <Calendar className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
    </div>
  );
}
