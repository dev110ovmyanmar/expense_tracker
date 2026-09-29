export function SwitchRow({
  checked,
  onCheckedChange,
  label,
  description,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-press="flat"
      onClick={() => onCheckedChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl bg-muted/70 px-3.5 py-2.5 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{description}</span> : null}
      </span>
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${checked ? "bg-primary" : "bg-foreground/25"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-background shadow-sm transition-transform duration-200 ease-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
