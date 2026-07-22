import SortableTable from "@/components/SortableTable";
import { getMetaAccounts } from "@/lib/env";
import { resolveFilters, type SearchParams } from "@/lib/filters";
import { getTopPerformers } from "@/lib/meta/queries";

export const dynamic = "force-dynamic";

export default async function TopPerformersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { accountId, dateFrom, dateTo } = resolveFilters(sp, getMetaAccounts());
  const top = getTopPerformers(accountId, dateFrom, dateTo);

  const sections = [
    {
      title: "Mejor CPL",
      hint: "Anuncios con resultados y al menos $20 de gasto",
      rows: top.byCpl,
      sort: "cpl",
      desc: false,
    },
    {
      title: "Mas resultados",
      hint: "Leads + conversaciones iniciadas",
      rows: top.byResults,
      sort: "results",
      desc: true,
    },
    {
      title: "Por CTR",
      hint: "Anuncios con al menos 1,000 impresiones",
      rows: top.byCtr,
      sort: "ctr",
      desc: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Top Performers</h1>
        <p className="text-sm text-muted">
          Ranking de anuncios para leads y mensajes - {dateFrom} a {dateTo}
        </p>
      </div>
      {sections.map((s) => (
        <section key={s.title}>
          <h2 className="text-sm font-semibold text-ink">{s.title}</h2>
          <p className="mb-2 text-xs text-muted">{s.hint}</p>
          <SortableTable
            columns={[
              { key: "name", label: "Anuncio" },
              { key: "campaign_name", label: "Campana" },
              { key: "cpl", label: "CPL", format: "money" },
              { key: "leads", label: "Leads", format: "int" },
              { key: "messages", label: "Mensajes", format: "int" },
              { key: "spend", label: "Gasto", format: "money" },
              { key: "impressions", label: "Impresiones", format: "int" },
              { key: "ctr", label: "CTR", format: "percent" },
            ]}
            rows={s.rows as unknown as Record<string, unknown>[]}
            initialSort={s.sort}
            initialDesc={s.desc}
            adPreviewKey="id"
          />
        </section>
      ))}
    </div>
  );
}
