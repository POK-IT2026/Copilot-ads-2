import Link from "next/link";
import KpiCard from "@/components/KpiCard";
import SpendChart from "@/components/SpendChart";
import EmptyState from "@/components/EmptyState";
import { PriorityBadge, LEVEL_LABELS } from "@/components/Badges";
import SortableTable from "@/components/SortableTable";
import { addDays, getPeriodLengthDays, getPreviousPeriod } from "@/lib/dateRanges";
import { getMetaAccounts } from "@/lib/env";
import { resolveFilters, type SearchParams } from "@/lib/filters";
import { fmtDecimal, fmtInt, fmtMoney, fmtPercent } from "@/lib/format";
import {
  type DailyPoint,
  type MetaEntityRow,
  getLastMetaSync,
  getMetaDailySeries,
  getMetaKpis,
  listMetaCampaigns,
} from "@/lib/meta/queries";
import { computeMetaAlerts } from "@/lib/meta/recommendations";

export const dynamic = "force-dynamic";

type FormatKind = "money" | "int" | "decimal" | "percent";
type DeltaTone = "up" | "down" | "flat" | "empty";

function formatValue(value: number, kind: FormatKind): string {
  switch (kind) {
    case "money":
      return fmtMoney(value);
    case "int":
      return fmtInt(value);
    case "percent":
      return fmtPercent(value);
    default:
      return fmtDecimal(value);
  }
}

function delta(current: number, previous: number, positiveIsGood = true) {
  if (previous === 0) {
    if (current === 0) return { value: "0%", tone: "flat" as const };
    return { value: "nuevo", tone: positiveIsGood ? ("up" as const) : ("down" as const) };
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  const abs = Math.abs(change);
  const tone: DeltaTone =
    abs < 0.1 ? "flat" : (change > 0) === positiveIsGood ? "up" : "down";
  const sign = change > 0 ? "+" : "";
  return { value: `${sign}${fmtPercent(change)}`, tone };
}

function kpiSub(previous: number, kind: FormatKind): string {
  return `Ant. ${formatValue(previous, kind)}`;
}

function cplSub(previousCpl: number, previousResults: number): string {
  return `Ant. ${previousResults > 0 ? fmtMoney(previousCpl) : "—"}`;
}

function alignSeries(
  current: DailyPoint[],
  previous: DailyPoint[],
  dateFrom: string,
  dateTo: string,
  previousFrom: string
) {
  const days = getPeriodLengthDays(dateFrom, dateTo);
  const currentByDate = new Map(current.map((d) => [d.date, d.spend]));
  const previousByDate = new Map(previous.map((d) => [d.date, d.spend]));

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(dateFrom, index);
    const previousDate = addDays(previousFrom, index);
    return {
      date,
      spend: currentByDate.get(date) ?? 0,
      previousDate,
      previousSpend: previousByDate.get(previousDate) ?? 0,
    };
  });
}

function withPreviousCampaigns(current: MetaEntityRow[], previous: MetaEntityRow[]) {
  const previousById = new Map(previous.map((row) => [row.id, row]));
  return current.map((row) => {
    const prev = previousById.get(row.id);
    return {
      ...row,
      previous_spend: prev?.spend ?? 0,
      previous_cpl: prev?.cpl ?? null,
      cpl_delta:
        prev && prev.cpl !== null && prev.cpl > 0 && row.cpl !== null
          ? ((row.cpl - prev.cpl) / prev.cpl) * 100
          : null,
    };
  });
}

export default async function MetaDashboard({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { accountId, dateFrom, dateTo } = resolveFilters(sp, getMetaAccounts());

  if (!accountId) {
    return (
      <EmptyState
        title="No hay cuentas de Meta Ads configuradas"
        hint="Define META_AD_ACCOUNT_IDS y META_ACCESS_TOKEN en .env.local y luego usa Actualizar datos para traer insights reales."
      />
    );
  }

  const previousPeriod = getPreviousPeriod(dateFrom, dateTo);
  const kpis = getMetaKpis(accountId, dateFrom, dateTo);
  const previousKpis = getMetaKpis(
    accountId,
    previousPeriod.dateFrom,
    previousPeriod.dateTo
  );
  const series = getMetaDailySeries(accountId, dateFrom, dateTo);
  const previousSeries = getMetaDailySeries(
    accountId,
    previousPeriod.dateFrom,
    previousPeriod.dateTo
  );
  const alerts = computeMetaAlerts(accountId, dateFrom, dateTo).filter(
    (a) => a.rule !== "top_cpl"
  );
  const campaigns = listMetaCampaigns(accountId, dateFrom, dateTo).slice(0, 5);
  const previousCampaigns = listMetaCampaigns(
    accountId,
    previousPeriod.dateFrom,
    previousPeriod.dateTo
  );
  const lastSync = getLastMetaSync(accountId);
  const qs = new URLSearchParams({ accountId, dateFrom, dateTo }).toString();
  const comparisonSeries = alignSeries(
    series,
    previousSeries,
    dateFrom,
    dateTo,
    previousPeriod.dateFrom
  );
  const campaignRows = withPreviousCampaigns(campaigns, previousCampaigns);
  const hasCurrentData = series.length > 0 || campaigns.length > 0;
  // Contactos totales = leads + mensajes de campañas iniciados (leads y mensajes se
  // mantienen también como tarjetas separadas).
  const totalContacts = kpis.leads + kpis.messages;
  const previousTotalContacts = previousKpis.leads + previousKpis.messages;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-ink">Meta Ads - Leads y mensajes</h1>
          <p className="text-sm text-muted">
            {accountId} - {dateFrom} a {dateTo}
          </p>
          <p className="text-xs text-muted">
            CPL calculado sobre leads + conversaciones. Comparado con{" "}
            {previousPeriod.dateFrom} a {previousPeriod.dateTo}
          </p>
        </div>
        {lastSync && (
          <p className="text-xs text-muted">
            Ultimo sync: {lastSync.started_at} ({lastSync.status})
          </p>
        )}
      </div>

      {!hasCurrentData && (
        <EmptyState
          title="Sin datos reales para este periodo"
          hint="Usa Actualizar datos para sincronizar Meta Ads con el token configurado. El dashboard quedara vacio hasta recibir datos de la API."
        />
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-9">
        <KpiCard
          label="Contactos totales"
          value={fmtInt(totalContacts)}
          sub={`${kpiSub(previousTotalContacts, "int")} · ${fmtInt(kpis.leads)} leads + ${fmtInt(kpis.messages)} mensajes`}
          delta={delta(totalContacts, previousTotalContacts)}
        />
        <KpiCard
          label="CPL"
          value={kpis.results > 0 ? fmtMoney(kpis.cpl) : "—"}
          sub={`${cplSub(previousKpis.cpl, previousKpis.results)} · ${fmtInt(kpis.results)} resultados`}
          delta={
            kpis.results > 0 && previousKpis.results > 0
              ? delta(kpis.cpl, previousKpis.cpl, false)
              : undefined
          }
        />
        <KpiCard
          label="Gasto"
          value={fmtMoney(kpis.spend)}
          sub={kpiSub(previousKpis.spend, "money")}
          delta={delta(kpis.spend, previousKpis.spend, false)}
        />
        <KpiCard
          label="Leads"
          value={fmtInt(kpis.leads)}
          sub={kpiSub(previousKpis.leads, "int")}
          delta={delta(kpis.leads, previousKpis.leads)}
        />
        <KpiCard
          label="Mensajes"
          value={fmtInt(kpis.messages)}
          sub={kpiSub(previousKpis.messages, "int")}
          delta={delta(kpis.messages, previousKpis.messages)}
        />
        <KpiCard
          label="CTR"
          value={fmtPercent(kpis.ctr)}
          sub={kpiSub(previousKpis.ctr, "percent")}
          delta={delta(kpis.ctr, previousKpis.ctr)}
        />
        <KpiCard
          label="CPC"
          value={fmtMoney(kpis.cpc)}
          sub={kpiSub(previousKpis.cpc, "money")}
          delta={delta(kpis.cpc, previousKpis.cpc, false)}
        />
        <KpiCard
          label="Impresiones"
          value={fmtInt(kpis.impressions)}
          sub={kpiSub(previousKpis.impressions, "int")}
          delta={delta(kpis.impressions, previousKpis.impressions)}
        />
        <KpiCard
          label="Clics"
          value={fmtInt(kpis.clicks)}
          sub={kpiSub(previousKpis.clicks, "int")}
          delta={delta(kpis.clicks, previousKpis.clicks)}
        />
      </div>

      <SpendChart
        data={comparisonSeries}
        title="Gasto diario vs periodo anterior"
        previousLabel="Anterior"
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Alertas activas</h2>
            <Link href={`/meta-ads/alerts?${qs}`} className="text-xs text-accent hover:underline">
              Ver todas ({alerts.length})
            </Link>
          </div>
          {alerts.length === 0 ? (
            <EmptyState title="Sin alertas en el periodo" />
          ) : (
            <ul className="space-y-2">
              {alerts.slice(0, 5).map((a, i) => (
                <li key={i} className="rounded-lg border border-line bg-surface px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={a.priority} />
                    <span className="text-sm font-medium text-ink">{a.title}</span>
                    <span className="rounded bg-page px-1.5 py-0.5 text-[11px] text-muted">
                      {LEVEL_LABELS[a.level] ?? a.level}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-2">{a.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Top campanas por CPL</h2>
            <Link href={`/meta-ads/campaigns?${qs}`} className="text-xs text-accent hover:underline">
              Ver todas
            </Link>
          </div>
          <SortableTable
            columns={[
              { key: "name", label: "Campana" },
              { key: "cpl", label: "CPL", format: "money" },
              { key: "previous_cpl", label: "CPL ant.", format: "money" },
              { key: "cpl_delta", label: "Var. CPL", format: "percent" },
              { key: "leads", label: "Leads", format: "int" },
              { key: "messages", label: "Mensajes", format: "int" },
              { key: "spend", label: "Gasto", format: "money" },
            ]}
            rows={campaignRows as unknown as Record<string, unknown>[]}
            initialSort="cpl"
            initialDesc={false}
          />
        </section>
      </div>
    </div>
  );
}
