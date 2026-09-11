/**
 * KPI Card · Fibrand brandbook
 * Variante A del mockup v3 · borde acento royal + hover lift + fade-in animación.
 * 2026-07-30 · rediseño Fibrand aplicado a Media Suite.
 * 2026-07-30-b · valor con auto-scale por longitud + delta separado en línea propia
 * para evitar rotura visual en cifras largas ($172,274.24 · 5,406,142).
 */
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
      ? "bg-good-ink/10 text-good-ink"
      : delta?.tone === "down"
        ? "bg-critical/10 text-critical"
        : "bg-muted/10 text-muted";

  // Auto-scale del valor según longitud · evita truncate en cifras largas
  const valueLen = value?.length ?? 0;
  const valueSize =
    valueLen <= 8 ? "text-[24px]"
    : valueLen <= 11 ? "text-[20px]"
    : valueLen <= 14 ? "text-[17px]"
    : "text-[15px]";

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-lg border border-line bg-surface p-4",
        "border-l-[3px] border-l-accent",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-l-accent-deep hover:shadow-lg hover:shadow-accent/10",
      ].join(" ")}
    >
      <p className="truncate text-[10px] font-extrabold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p
        className={`mt-1.5 ${valueSize} font-black leading-tight tracking-tight text-ink [font-variant-numeric:tabular-nums]`}
        title={value}
      >
        {value}
      </p>
      {delta && (
        <span
          className={`mt-1.5 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${deltaClass}`}
        >
          {delta.tone === "up" && "↑ "}
          {delta.tone === "down" && "↓ "}
          {delta.value}
        </span>
      )}
      {sub && (
        <p className="mt-1 truncate text-[10.5px] font-medium text-muted" title={sub}>
          {sub}
        </p>
      )}
      {/* Barra royal decorativa al hover · slide desde la izquierda */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-accent via-accent-deep to-accent transition-transform duration-500 ease-out group-hover:scale-x-100"
      />
    </div>
  );
}
