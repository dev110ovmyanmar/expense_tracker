import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-muted/80", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <span className="sr-only">Loading your ledger</span>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-48 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-full sm:w-36" />
      </div>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-44" />
      <Skeleton className="h-64" />
    </div>
  );
}
