import EmptyState from "@/components/EmptyState";
import GoogleDiagnosticsPanel from "@/components/GoogleDiagnosticsPanel";
import GoogleSyncButton from "@/components/GoogleSyncButton";
import KpiCard from "@/components/KpiCard";
import SortableTable from "@/components/SortableTable";
import SpendChart from "@/components/SpendChart";
import Link from "next/link";
import { getGoogleAccounts } from "@/lib/env";
import { resolveFilters, type SearchParams } from "@/lib/filters";
import { fmtInt, fmtMoney, fmtPercent } from "@/lib/format";
import { googleAdsConnected, googleOAuthReady } from "@/lib/google/oauth";
import {
  getGoogleDailySeries,
  getGoogleKpis,
  getGoogleRecommendations,
  listGoogleCampaigns,
  listGoogleKeywords,
} from "@/lib/google/queries";

export const dynamic = "force-dynamic";

export default async function GoogleAdsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { accountId, dateFrom, dateTo } = resolveFilters(sp, getGoogleAccounts());
  const ready = googleOAuthReady();
  const connected = googleAdsConnected();
  const googleError = typeof sp.google_error === "string" ? sp.google_error : undefined;
  const googleJustConnected = sp.google_connected === "1";

  const kpis =
    connected && accountId
      ? getGoogleKpis(accountId, dateFrom, dateTo)
      : {
          cost: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          conversions_value: 0,
          ctr: 0,
          avg_cpc: 0,
          roas: 0,
          cpa: 0,
        };
  const series = connected && accountId ? getGoogleDailySeries(accountId, dateFrom, dateTo) : [];
  const campaigns = connected && accountId ? listGoogleCampaigns(accountId, dateFrom, dateTo) : [];
  const keywords = connected && accountId ? listGoogleKeywords(accountId, dateFrom, dateTo) : [];
  const recommendations = connected && accountId ? getGoogleRecommendations(accountId) : [];
  const qs = new URLSearchParams({ dateFrom, dateTo }).toString();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Google Ads</h1>
          <p className="text-sm text-muted">
            {accountId || "sin customer id"} - {dateFrom} a {dateTo}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!connected && ready && (
            <a
              href="/api/google-ads/oauth/start"
              className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:opacity-90"
            >
              Conectar Google Ads
            </a>
          )}
          {connected && accountId && (
            <GoogleSyncButton accountId={accountId} dateFrom={dateFrom} dateTo={dateTo} />
          )}
        </div>
      </div>

      {googleError && (
        <p className="rounded-md border border-critical/30 bg-surface px-3 py-2 text-sm text-critical">
          Google OAuth no se completo: {googleError}
        </p>
      )}
      {googleJustConnected && (
        <p className="rounded-md border border-good/30 bg-surface px-3 py-2 text-sm text-good-ink">
          Google Ads conectado. Corre el diagnostico y luego sincroniza el rango.
        </p>
      )}

      {!ready && (
        <EmptyState
          title="Faltan credenciales de Google Ads"
          hint="Configura developer token, OAuth client id, OAuth client secret, MCC y customer id en .env.local."
        />
      )}

      {ready && <GoogleDiagnosticsPanel accountId={accountId} />}

      {connected && (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Campanas", `/google-ads/campaigns?${qs}`, campaigns.length],
              ["Palabras clave", `/google-ads/keywords?${qs}`, keywords.length],
              ["Top performance", `/google-ads/top-performers?${qs}`, campaigns.length],
              [
                "Recomendaciones",
                `/google-ads/recommendations?${qs}`,
                recommendations.filter((rec) => rec.status === "pending").length,
              ],
            ].map(([label, href, count]) => (
              <Link
                key={String(label)}
                href={String(href)}
                className="rounded-lg border border-line bg-surface px-4 py-3 transition-colors hover:bg-page"
              >
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="mt-1 text-xs text-muted">{count} registros</p>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <KpiCard
              label="CPL Google"
              value={kpis.conversions > 0 ? fmtMoney(kpis.cpa) : "-"}
              sub={`${fmtInt(kpis.conversions)} conversiones`}
            />
            <KpiCard label="Gasto Google" value={fmtMoney(kpis.cost)} />
            <KpiCard label="CTR Google" value={fmtPercent(kpis.ctr)} />
            <KpiCard label="CPC Google" value={fmtMoney(kpis.avg_cpc)} />
            <KpiCard label="Impresiones" value={fmtInt(kpis.impressions)} />
            <KpiCard label="Clics" value={fmtInt(kpis.clicks)} />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <SpendChart
              title="CPL diario Google"
              data={series.map((point) => ({
                date: point.date,
                spend: point.conversions > 0 ? point.spend / point.conversions : 0,
              }))}
            />
            <SpendChart
              title="Gasto diario Google"
              data={series.map((point) => ({
                date: point.date,
                spend: point.spend,
              }))}
            />
          </div>

          {campaigns.length === 0 ? (
            <EmptyState
              title="Sin datos sincronizados de Google Ads"
              hint="Usa Sincronizar Google para traer campanas del rango seleccionado."
            />
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-ink">Campanas por gasto</h2>
                  <Link href={`/google-ads/campaigns?${qs}`} className="text-xs text-accent hover:underline">
                    Ver todas
                  </Link>
                </div>
                <SortableTable
                  columns={[
                    { key: "name", label: "Campana" },
                    { key: "cpa", label: "CPL", format: "money" },
                    { key: "conversions", label: "Conv.", format: "decimal" },
                    { key: "cost", label: "Gasto", format: "money" },
                    { key: "ctr", label: "CTR", format: "percent" },
                  ]}
                  rows={campaigns.slice(0, 8) as unknown as Record<string, unknown>[]}
                  initialSort="cost"
                  initialDesc
                />
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-ink">Keywords por gasto</h2>
                  <Link href={`/google-ads/keywords?${qs}`} className="text-xs text-accent hover:underline">
                    Ver todas
                  </Link>
                </div>
                <SortableTable
                  columns={[
                    { key: "name", label: "Keyword" },
                    { key: "cpa", label: "CPL", format: "money" },
                    { key: "conversions", label: "Conv.", format: "decimal" },
                    { key: "cost", label: "Gasto", format: "money" },
                    { key: "ctr", label: "CTR", format: "percent" },
                  ]}
                  rows={keywords.slice(0, 8) as unknown as Record<string, unknown>[]}
                  initialSort="cost"
                  initialDesc
                />
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
