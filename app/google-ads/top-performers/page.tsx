import EmptyState from "@/components/EmptyState";
import SortableTable from "@/components/SortableTable";
import { getGoogleAccounts } from "@/lib/env";
import { resolveFilters, type SearchParams } from "@/lib/filters";
import { googleAdsConnected } from "@/lib/google/oauth";
import { getGoogleTopPerformers } from "@/lib/google/queries";

export const dynamic = "force-dynamic";

export default async function GoogleTopPerformersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { accountId, dateFrom, dateTo } = resolveFilters(sp, getGoogleAccounts());
  const connected = googleAdsConnected();
  const top = connected && accountId ? getGoogleTopPerformers(accountId, dateFrom, dateTo) : null;

  const sections = top
    ? [
        {
          title: "Mejor CPL por campana",
          hint: "Campanas con conversiones y al menos $20 de gasto",
          rows: top.byCpl,
          sort: "cpa",
          desc: false,
        },
        {
          title: "Mas conversiones",
          hint: "Campanas ordenadas por volumen de conversiones",
          rows: top.byConversions,
          sort: "conversions",
          desc: true,
        },
        {
          title: "Mejor CTR",
          hint: "Campanas con al menos 100 impresiones",
          rows: top.byCtr,
          sort: "ctr",
          desc: true,
        },
        {
          title: "Keywords con mejor CPL",
          hint: "Palabras clave con conversiones y gasto suficiente",
          rows: top.keywordsByCpl,
          sort: "cpa",
          desc: false,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Top performance Google</h1>
        <p className="text-sm text-muted">
          Rankings por CPL, conversiones y CTR - {dateFrom} a {dateTo}
        </p>
      </div>

      {!connected ? (
        <EmptyState
          title="Google Ads no esta conectado"
          hint="Conecta Google Ads y sincroniza el rango para calcular top performers."
        />
      ) : (
        sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-sm font-semibold text-ink">{section.title}</h2>
            <p className="mb-2 text-xs text-muted">{section.hint}</p>
            <SortableTable
              columns={[
                { key: "name", label: "Nombre" },
                { key: "campaign_name", label: "Campana" },
                { key: "cpa", label: "CPL", format: "money" },
                { key: "conversions", label: "Conversiones", format: "decimal" },
                { key: "cost", label: "Gasto", format: "money" },
                { key: "ctr", label: "CTR", format: "percent" },
                { key: "avg_cpc", label: "CPC", format: "money" },
              ]}
              rows={section.rows as unknown as Record<string, unknown>[]}
              initialSort={section.sort}
              initialDesc={section.desc}
            />
          </section>
        ))
      )}
    </div>
  );
}
