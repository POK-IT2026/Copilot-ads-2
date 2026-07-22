import EmptyState from "@/components/EmptyState";
import { LEVEL_LABELS, PriorityBadge } from "@/components/Badges";
import { getMetaAccounts } from "@/lib/env";
import { resolveFilters, type SearchParams } from "@/lib/filters";
import { computeMetaAlerts } from "@/lib/meta/recommendations";

export const dynamic = "force-dynamic";

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { accountId, dateFrom, dateTo } = resolveFilters(sp, getMetaAccounts());
  const alerts = computeMetaAlerts(accountId, dateFrom, dateTo);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Alertas</h1>
        <p className="text-sm text-muted">
          Evaluación en vivo de las reglas automáticas sobre los datos sincronizados ·{" "}
          {dateFrom} a {dateTo}
        </p>
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          title="Sin alertas en el periodo"
          hint="Las alertas se calculan con reglas de leads y mensajes: gasto sin resultados, CPL alto, CTR bajo, frecuencia alta y CPL competitivo."
        />
      ) : (
        <ul className="space-y-2.5">
          {alerts.map((a, i) => (
            <li key={i} className="rounded-lg border border-line bg-surface px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={a.priority} />
                <span className="text-sm font-medium text-ink">{a.title}</span>
                <span className="rounded bg-page px-1.5 py-0.5 text-[11px] text-muted">
                  {LEVEL_LABELS[a.level] ?? a.level}
                </span>
                <code className="text-[11px] text-muted">{a.rule}</code>
              </div>
              <p className="mt-1 text-sm text-ink-2">{a.detail}</p>
              <p className="mt-1 text-xs text-muted">
                {a.entityName} · id {a.entityId}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
