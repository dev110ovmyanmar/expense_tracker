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
      className="relative grid rounded-xl bg-muted p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-lg bg-primary shadow-sm transition-transform duration-200 ease-out"
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
            data-press="flat"
            onClick={() => onChange(option.id)}
            className={`relative z-10 h-10 rounded-lg text-sm font-medium transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
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
