import EmptyState from "@/components/EmptyState";
import SortableTable from "@/components/SortableTable";
import { CATEGORY_LABELS, classifyGoogleChannelType } from "@/lib/campaignCategory";
import { getGoogleAccounts } from "@/lib/env";
import { resolveFilters, type SearchParams } from "@/lib/filters";
import { googleAdsConnected } from "@/lib/google/oauth";
import { listGoogleCampaigns } from "@/lib/google/queries";

export const dynamic = "force-dynamic";

export default async function GoogleCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { accountId, dateFrom, dateTo } = resolveFilters(sp, getGoogleAccounts());
  const connected = googleAdsConnected();
  const rows = (connected && accountId ? listGoogleCampaigns(accountId, dateFrom, dateTo) : []).map(
    (row) => ({ ...row, category_label: CATEGORY_LABELS[classifyGoogleChannelType(row.extra)] })
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Campanas Google</h1>
        <p className="text-sm text-muted">
          {accountId || "sin customer id"} - {dateFrom} a {dateTo}
        </p>
      </div>

      {!connected ? (
        <EmptyState
          title="Google Ads no esta conectado"
          hint="Conecta Google Ads y sincroniza el rango para ver campanas reales."
        />
      ) : (
        <SortableTable
          columns={[
            { key: "name", label: "Campana" },
            { key: "status", label: "Estado", format: "status" },
            { key: "extra", label: "Canal" },
            { key: "category_label", label: "Tipo" },
            { key: "cpa", label: "CPL", format: "money" },
            { key: "conversions", label: "Conversiones", format: "decimal" },
            { key: "cost", label: "Gasto", format: "money" },
            { key: "ctr", label: "CTR", format: "percent" },
            { key: "avg_cpc", label: "CPC", format: "money" },
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
