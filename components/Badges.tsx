const PRIORITY_STYLES: Record<string, { label: string; className: string; dot: string }> = {
  high: { label: "Alta", className: "bg-critical/10 text-critical", dot: "●" },
  medium: { label: "Media", className: "bg-warning/15 text-[#8a6100]", dot: "●" },
  low: { label: "Baja", className: "bg-good/10 text-good-ink", dot: "●" },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const s = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.low;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}
    >
      <span aria-hidden>{s.dot}</span> {s.label}
    </span>
  );
}

const ACTIVE_STATUSES = new Set(["ACTIVE", "ENABLED"]);

export function StatusBadge({ status }: { status: string }) {
  if (!status) return <span className="text-muted">—</span>;
  const active = ACTIVE_STATUSES.has(status.toUpperCase());
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-good/10 text-good-ink" : "bg-line/60 text-ink-2"
      }`}
    >
      <span aria-hidden>{active ? "●" : "○"}</span>
      {status}
    </span>
  );
}

export const LEVEL_LABELS: Record<string, string> = {
  campaign: "Campaña",
  adset: "Ad set",
  ad_group: "Grupo de anuncios",
  ad: "Anuncio",
  keyword: "Keyword",
};
