import SortableTable from "@/components/SortableTable";
import { CATEGORY_LABELS } from "@/lib/campaignCategory";
import { getMetaAccounts } from "@/lib/env";
import { resolveFilters, type SearchParams } from "@/lib/filters";
import { listMetaCampaigns } from "@/lib/meta/queries";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { accountId, dateFrom, dateTo } = resolveFilters(sp, getMetaAccounts());
  const rows = listMetaCampaigns(accountId, dateFrom, dateTo).map((row) => ({
    ...row,
    category_label: CATEGORY_LABELS[row.category],
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Campañas</h1>
        <p className="text-sm text-muted">
          {rows.length} campañas · {dateFrom} a {dateTo}
        </p>
      </div>
      <SortableTable
        columns={[
          { key: "name", label: "Campaña" },
          { key: "status", label: "Estado", format: "status" },
          { key: "objective", label: "Objetivo" },
          { key: "category_label", label: "Tipo" },
          { key: "spend", label: "Gasto", format: "money" },
          { key: "impressions", label: "Impresiones", format: "int" },
          { key: "clicks", label: "Clics", format: "int" },
          { key: "ctr", label: "CTR", format: "percent" },
          { key: "cpc", label: "CPC", format: "money" },
          { key: "leads", label: "Leads", format: "int" },
          { key: "messages", label: "Mensajes", format: "int" },
          { key: "cpl", label: "CPL", format: "money" },
        ]}
        rows={rows as unknown as Record<string, unknown>[]}
        initialSort="cpl"
        initialDesc={false}
      />
    </div>
  );
}
