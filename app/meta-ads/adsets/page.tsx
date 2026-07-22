import SortableTable from "@/components/SortableTable";
import { getMetaAccounts } from "@/lib/env";
import { resolveFilters, type SearchParams } from "@/lib/filters";
import { listMetaAdsets } from "@/lib/meta/queries";

export const dynamic = "force-dynamic";

export default async function AdsetsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { accountId, dateFrom, dateTo } = resolveFilters(sp, getMetaAccounts());
  const rows = listMetaAdsets(accountId, dateFrom, dateTo);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Ad Sets</h1>
        <p className="text-sm text-muted">
          {rows.length} ad sets · {dateFrom} a {dateTo}
        </p>
      </div>
      <SortableTable
        columns={[
          { key: "name", label: "Ad set" },
          { key: "campaign_name", label: "Campaña" },
          { key: "status", label: "Estado", format: "status" },
          { key: "spend", label: "Gasto", format: "money" },
          { key: "impressions", label: "Impresiones", format: "int" },
          { key: "clicks", label: "Clics", format: "int" },
          { key: "ctr", label: "CTR", format: "percent" },
          { key: "frequency", label: "Frecuencia", format: "decimal" },
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
