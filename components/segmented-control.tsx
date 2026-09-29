export function SegmentedControl({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
  label: string;
}) {
  const index = Math.max(0, options.findIndex((option) => option.id === value));
  return (
    <div
      role="tablist"
      aria-label={label}
      className="aura-segment relative grid h-12 rounded-full bg-muted p-1 shadow-[inset_0_1px_1px_oklch(0_0_0/0.22)]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="aura-segment-pill pointer-events-none absolute top-1 bottom-1 left-1 rounded-full bg-primary shadow-[0_1px_2px_oklch(0_0_0/0.18),0_8px_16px_-10px_oklch(0_0_0/0.55)]"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.id)}
            className={`relative z-10 h-full rounded-full text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
              selected ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
