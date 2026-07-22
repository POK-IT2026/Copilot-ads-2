import EmptyState from "@/components/EmptyState";
import { getMetaAccounts } from "@/lib/env";
import { resolveFilters, type SearchParams } from "@/lib/filters";
import { fmtInt, fmtMoney, fmtPercent } from "@/lib/format";
import {
  classifyCreatives,
  type ClassifiedCreative,
  type CreativeBucket,
} from "@/lib/meta/queries";

export const dynamic = "force-dynamic";

const BUCKETS: Array<{
  key: CreativeBucket;
  label: string;
  dot: string;
  color: string;
}> = [
  { key: "winner", label: "Ganadores", dot: "UP", color: "text-good-ink" },
  { key: "neutral", label: "Neutrales", dot: "MID", color: "text-ink-2" },
  { key: "loser", label: "Perdedores", dot: "DOWN", color: "text-critical" },
  { key: "no_data", label: "Sin datos", dot: "NA", color: "text-muted" },
];

function CreativeCard({ item }: { item: ClassifiedCreative }) {
  const { ad } = item;
  const cpl = ad.cpl === null ? "—" : fmtMoney(ad.cpl);
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-start gap-3">
        {ad.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ad.thumbnail_url}
            alt=""
            className="h-14 w-14 shrink-0 rounded-md border border-line object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-line bg-page text-xs font-semibold text-muted">
            AD
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink" title={ad.name}>
            {ad.name}
          </p>
          <p className="truncate text-xs text-muted">{ad.campaign_name}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
        {[
          ["CPL", cpl],
          ["CTR", fmtPercent(ad.ctr)],
          ["Leads", fmtInt(ad.leads)],
          ["Mensajes", fmtInt(ad.messages)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-page px-1 py-1.5">
            <dt className="text-[10px] uppercase tracking-wide text-muted">{label}</dt>
            <dd className="text-xs font-semibold text-ink [font-variant-numeric:tabular-nums]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function CreativesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { accountId, dateFrom, dateTo } = resolveFilters(sp, getMetaAccounts());
  const classified = classifyCreatives(accountId, dateFrom, dateTo);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Creativos</h1>
        <p className="text-sm text-muted">
          Clasificacion por CPL vs. el promedio de la cuenta - {dateFrom} a {dateTo}
        </p>
      </div>

      {classified.length === 0 ? (
        <EmptyState
          title="Sin creativos en el periodo"
          hint="Sincroniza datos con el boton Actualizar datos."
        />
      ) : (
        BUCKETS.map((bucket) => {
          const items = classified.filter((c) => c.bucket === bucket.key);
          return (
            <section key={bucket.key}>
              <h2 className={`mb-2 flex items-center gap-1.5 text-sm font-semibold ${bucket.color}`}>
                <span aria-hidden className="text-[10px]">
                  {bucket.dot}
                </span>
                {bucket.label}
                <span className="font-normal text-muted">({items.length})</span>
              </h2>
              {items.length === 0 ? (
                <p className="text-sm text-muted">Ningun creativo en esta categoria.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {items.map((item) => (
                    <CreativeCard key={item.ad.id} item={item} />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
