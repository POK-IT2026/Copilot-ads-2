import SortableTable from "@/components/SortableTable";
import { getMetaAccounts } from "@/lib/env";
import { resolveFilters, type SearchParams } from "@/lib/filters";
import { listMetaAds } from "@/lib/meta/queries";

export const dynamic = "force-dynamic";

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { accountId, dateFrom, dateTo } = resolveFilters(sp, getMetaAccounts());
  const rows = listMetaAds(accountId, dateFrom, dateTo);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Anuncios</h1>
        <p className="text-sm text-muted">
          {rows.length} anuncios · {dateFrom} a {dateTo} · haz clic en el ojo para ver la
          vista previa de Meta
        </p>
      </div>
      <SortableTable
        columns={[
          { key: "name", label: "Anuncio" },
          { key: "adset_name", label: "Ad set" },
          { key: "campaign_name", label: "Campaña" },
          { key: "status", label: "Estado", format: "status" },
          { key: "spend", label: "Gasto", format: "money" },
          { key: "impressions", label: "Impresiones", format: "int" },
          { key: "ctr", label: "CTR", format: "percent" },
          { key: "leads", label: "Leads", format: "int" },
          { key: "messages", label: "Mensajes", format: "int" },
          { key: "cpl", label: "CPL", format: "money" },
        ]}
        rows={rows as unknown as Record<string, unknown>[]}
        initialSort="cpl"
        initialDesc={false}
        adPreviewKey="id"
      />
    </div>
  );
}
