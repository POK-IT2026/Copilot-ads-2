import EmptyState from "@/components/EmptyState";
import EditKeywordBidButton from "@/components/EditKeywordBidButton";
import SortableTable from "@/components/SortableTable";
import { getGoogleAccounts } from "@/lib/env";
import { resolveFilters, type SearchParams } from "@/lib/filters";
import { googleAdsConnected } from "@/lib/google/oauth";
import { listGoogleKeywords } from "@/lib/google/queries";

export const dynamic = "force-dynamic";

export default async function GoogleKeywordsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { accountId, dateFrom, dateTo } = resolveFilters(sp, getGoogleAccounts());
  const connected = googleAdsConnected();
  const rows = connected && accountId ? listGoogleKeywords(accountId, dateFrom, dateTo) : [];
  const bidButtons = Object.fromEntries(
    rows.map((row) => [
      row.id,
      <EditKeywordBidButton
        key={row.id}
        accountId={accountId}
        adGroupId={row.ad_group_id ?? ""}
        criterionId={row.id}
        keywordText={row.name}
      />,
    ])
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Palabras clave</h1>
        <p className="text-sm text-muted">
          Keywords de Google Ads - {dateFrom} a {dateTo}
        </p>
      </div>

      {!connected ? (
        <EmptyState
          title="Google Ads no esta conectado"
          hint="Conecta Google Ads y sincroniza para consultar palabras clave."
        />
      ) : (
        <SortableTable
          columns={[
            { key: "name", label: "Keyword" },
            { key: "status", label: "Match" },
            { key: "extra", label: "Ad group" },
            { key: "campaign_name", label: "Campana" },
            { key: "cpa", label: "CPL", format: "money" },
            { key: "conversions", label: "Conversiones", format: "decimal" },
            { key: "cost", label: "Gasto", format: "money" },
            { key: "ctr", label: "CTR", format: "percent" },
            { key: "avg_cpc", label: "CPC promedio", format: "money" },
            { key: "clicks", label: "Clics", format: "int" },
          ]}
          rows={rows as unknown as Record<string, unknown>[]}
          initialSort="cost"
          initialDesc
          actionColumn={{ label: "Puja", cells: bidButtons }}
        />
      )}
    </div>
  );
}
