import EmptyState from "@/components/EmptyState";
import SortableTable from "@/components/SortableTable";
import { getGoogleAccounts } from "@/lib/env";
import { resolveFilters, type SearchParams } from "@/lib/filters";
import { googleAdsConnected } from "@/lib/google/oauth";
import { listGoogleAdGroups } from "@/lib/google/queries";

export const dynamic = "force-dynamic";

export default async function GoogleAdGroupsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { accountId, dateFrom, dateTo } = resolveFilters(sp, getGoogleAccounts());
  const connected = googleAdsConnected();
  const rows = connected && accountId ? listGoogleAdGroups(accountId, dateFrom, dateTo) : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Grupos de anuncios Google</h1>
        <p className="text-sm text-muted">
          {accountId || "sin customer id"} - {rows.length} grupos - {dateFrom} a {dateTo}
        </p>
      </div>

      {!connected ? (
        <EmptyState
          title="Google Ads no esta conectado"
          hint="Conecta Google Ads y sincroniza el rango para ver grupos de anuncios reales."
        />
      ) : (
        <SortableTable
          columns={[
            { key: "name", label: "Grupo de anuncios" },
            { key: "campaign_name", label: "Campana" },
            { key: "status", label: "Estado", format: "status" },
            { key: "cpa", label: "CPL", format: "money" },
            { key: "conversions", label: "Conversiones", format: "decimal" },
            { key: "cost", label: "Gasto", format: "money" },
            { key: "ctr", label: "CTR", format: "percent" },
            { key: "avg_cpc", label: "CPC", format: "money" },
            { key: "impressions", label: "Impresiones", format: "int" },
            { key: "clicks", label: "Clics", format: "int" },
          ]}
          rows={rows as unknown as Record<string, unknown>[]}
          initialSort="cost"
          initialDesc
        />
      )}
    </div>
  );
}
