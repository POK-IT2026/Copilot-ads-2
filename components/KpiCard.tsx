export default function KpiCard({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: {
    value: string;
    tone: "up" | "down" | "flat" | "empty";
  };
}) {
  const deltaClass =
    delta?.tone === "up"
      ? "text-good-ink"
      : delta?.tone === "down"
        ? "text-critical"
        : "text-muted";

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface p-4">
      <p className="truncate text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p className="text-2xl font-semibold text-ink [font-variant-numeric:tabular-nums]">{value}</p>
        {delta && (
          <p className={`whitespace-nowrap text-xs font-semibold ${deltaClass}`}>{delta.value}</p>
        )}
      </div>
      {sub && <p className="mt-1 truncate text-xs text-ink-2" title={sub}>{sub}</p>}
    </div>
  );
}
