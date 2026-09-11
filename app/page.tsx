import ComparePeriodPicker from "@/components/ComparePeriodPicker";
import GoogleSyncButton from "@/components/GoogleSyncButton";
import KpiCard from "@/components/KpiCard";
import SpendChart from "@/components/SpendChart";
import { addDays, getComparisonPeriod, getPeriodLengthDays, type ComparePreset } from "@/lib/dateRanges";
import { getGoogleAccounts, getMetaAccounts } from "@/lib/env";
import { type SearchParams } from "@/lib/filters";
import { fmtDecimal, fmtInt, fmtMoney, fmtPercent } from "@/lib/format";
import { getGoogleDailySeries, getGoogleKpis } from "@/lib/google/queries";
import { googleAdsConnected, googleOAuthReady } from "@/lib/google/oauth";
import { getMetaDailySeries, getMetaKpis } from "@/lib/meta/queries";

export const dynamic = "force-dynamic";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getParam(sp: SearchParams, key: string): string | undefined {
  const value = sp[key];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function resolveDates(sp: SearchParams) {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  const rawFrom = getParam(sp, "dateFrom") ?? iso(from);
  const rawTo = getParam(sp, "dateTo") ?? iso(today);
  return rawFrom <= rawTo
    ? { dateFrom: rawFrom, dateTo: rawTo }
    : { dateFrom: rawTo, dateTo: rawFrom };
}

type FormatKind = "money" | "int" | "decimal" | "percent";

function formatMetric(value: number, kind: FormatKind) {
  switch (kind) {
    case "money":
      return fmtMoney(value);
    case "percent":
      return fmtPercent(value);
    case "decimal":
      return fmtDecimal(value);
    default:
      return fmtInt(value);
  }
}

function metricDelta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "0%" : "nuevo";
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const sign = change > 0 ? "+" : "";
  return `${sign}${fmtPercent(change)}`;
}

function deltaTone(current: number, previous: number, lowerIsBetter = false) {
  if (previous === 0 || Math.abs(current - previous) < 0.0001) return "text-muted";
  const improved = lowerIsBetter ? current < previous : current > previous;
  return improved ? "text-good-ink" : "text-critical";
}

function kpiDelta(current: number, previous: number, lowerIsBetter = false) {
  if (previous === 0) {
    return { value: current === 0 ? "0%" : "nuevo", tone: "flat" as const };
  }
  if (Math.abs(current - previous) < 0.0001) {
    return { value: "0%", tone: "flat" as const };
  }
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const improved = lowerIsBetter ? change < 0 : change > 0;
  return {
    value: `${change > 0 ? "+" : ""}${fmtPercent(change)}`,
    tone: improved ? ("up" as const) : ("down" as const),
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { dateFrom, dateTo } = resolveDates(sp);
  const metaAccount = getMetaAccounts()[0] ?? "";
  const googleAccount = getGoogleAccounts()[0] ?? "";
  const googleReady = googleOAuthReady();
  const googleConnected = googleAdsConnected();
  const googleError = getParam(sp, "google_error");
  const googleJustConnected = getParam(sp, "google_connected") === "1";
  const comparePreset = (getParam(sp, "comparePreset") as ComparePreset | undefined) ?? "previous";
  const compareFrom = getParam(sp, "compareFrom");
  const compareTo = getParam(sp, "compareTo");
  const exportHref = `/api/export/ad-spend?dateFrom=${encodeURIComponent(
    dateFrom
  )}&dateTo=${encodeURIComponent(dateTo)}`;
  const previousPeriod = getComparisonPeriod(comparePreset, dateFrom, dateTo, {
    dateFrom: compareFrom,
    dateTo: compareTo,
  });

  const meta = metaAccount
    ? getMetaKpis(metaAccount, dateFrom, dateTo)
    : {
        spend: 0,
        results: 0,
        leads: 0,
        messages: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cpc: 0,
        cpl: 0,
      };
  const google =
    googleConnected && googleAccount
      ? getGoogleKpis(googleAccount, dateFrom, dateTo)
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
  const previousMeta = metaAccount
    ? getMetaKpis(metaAccount, previousPeriod.dateFrom, previousPeriod.dateTo)
    : {
        spend: 0,
        results: 0,
        leads: 0,
        messages: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cpc: 0,
        cpl: 0,
      };
  const previousGoogle =
    googleConnected && googleAccount
      ? getGoogleKpis(googleAccount, previousPeriod.dateFrom, previousPeriod.dateTo)
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

  const metaSeries = metaAccount ? getMetaDailySeries(metaAccount, dateFrom, dateTo) : [];
  const googleSeries =
    googleConnected && googleAccount ? getGoogleDailySeries(googleAccount, dateFrom, dateTo) : [];
  const previousMetaSeries = metaAccount
    ? getMetaDailySeries(metaAccount, previousPeriod.dateFrom, previousPeriod.dateTo)
    : [];
  const previousGoogleSeries =
    googleConnected && googleAccount
      ? getGoogleDailySeries(googleAccount, previousPeriod.dateFrom, previousPeriod.dateTo)
      : [];

  const totalSpend = meta.spend + google.cost;
  // Contactos totales = leads de Meta + mensajes de Meta iniciados + conversiones de Google.
  // meta.results ya es leads + messages (ver lib/meta/sync.ts), así que sumarlo con
  // google.conversions da el total de contactos generados por ambas plataformas.
  const totalContacts = meta.results + google.conversions;
  const totalClicks = meta.clicks + google.clicks;
  const globalCpl = totalContacts > 0 ? totalSpend / totalContacts : 0;
  const globalCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const previousSpend = previousMeta.spend + previousGoogle.cost;
  const previousContacts = previousMeta.results + previousGoogle.conversions;
  const previousClicks = previousMeta.clicks + previousGoogle.clicks;
  const previousGlobalCpl = previousContacts > 0 ? previousSpend / previousContacts : 0;
  const previousGlobalCpc = previousClicks > 0 ? previousSpend / previousClicks : 0;

  const metaByDate = new Map(metaSeries.map((point) => [point.date, point]));
  const googleByDate = new Map(googleSeries.map((point) => [point.date, point]));
  const previousMetaByDate = new Map(previousMetaSeries.map((point) => [point.date, point]));
  const previousGoogleByDate = new Map(
    previousGoogleSeries.map((point) => [point.date, point])
  );
  const days = getPeriodLengthDays(dateFrom, dateTo);
  const currentDates = Array.from({ length: days }, (_, index) => addDays(dateFrom, index));

  const cplSeries = currentDates.map((date, index) => {
    const previousDate = addDays(previousPeriod.dateFrom, index);
    const metaPoint = metaByDate.get(date);
    const googlePoint = googleByDate.get(date);
    const previousMetaPoint = previousMetaByDate.get(previousDate);
    const previousGooglePoint = previousGoogleByDate.get(previousDate);
    const spend = (metaPoint?.spend ?? 0) + (googlePoint?.spend ?? 0);
    const conversions = (metaPoint?.results ?? 0) + (googlePoint?.conversions ?? 0);
    const previousDailySpend =
      (previousMetaPoint?.spend ?? 0) + (previousGooglePoint?.spend ?? 0);
    const previousDailyConversions =
      (previousMetaPoint?.results ?? 0) + (previousGooglePoint?.conversions ?? 0);
    return {
      date,
      spend: conversions > 0 ? spend / conversions : 0,
      previousDate,
      previousSpend:
        previousDailyConversions > 0 ? previousDailySpend / previousDailyConversions : 0,
    };
  });
  const spendSeries = currentDates.map((date, index) => {
    const previousDate = addDays(previousPeriod.dateFrom, index);
    return {
      date,
      spend: (metaByDate.get(date)?.spend ?? 0) + (googleByDate.get(date)?.spend ?? 0),
      previousDate,
      previousSpend:
        (previousMetaByDate.get(previousDate)?.spend ?? 0) +
        (previousGoogleByDate.get(previousDate)?.spend ?? 0),
    };
  });
  // Contactos totales diarios = resultados de Meta (leads + mensajes) + conversiones de Google.
  const contactsSeries = currentDates.map((date, index) => {
    const previousDate = addDays(previousPeriod.dateFrom, index);
    return {
      date,
      spend: (metaByDate.get(date)?.results ?? 0) + (googleByDate.get(date)?.conversions ?? 0),
      previousDate,
      previousSpend:
        (previousMetaByDate.get(previousDate)?.results ?? 0) +
        (previousGoogleByDate.get(previousDate)?.conversions ?? 0),
    };
  });
  const comparisonRows: Array<{
    label: string;
    current: number;
    previous: number;
    kind: FormatKind;
    lowerIsBetter?: boolean;
  }> = [
    {
      label: "CPL global",
      current: globalCpl,
      previous: previousGlobalCpl,
      kind: "money",
      lowerIsBetter: true,
    },
    { label: "Gasto total", current: totalSpend, previous: previousSpend, kind: "money" },
    {
      label: "Contactos totales",
      current: totalContacts,
      previous: previousContacts,
      kind: "decimal",
    },
    {
      label: "Conversiones Meta",
      current: meta.results,
      previous: previousMeta.results,
      kind: "int",
    },
    {
      label: "Conversiones Google",
      current: google.conversions,
      previous: previousGoogle.conversions,
      kind: "decimal",
    },
    {
      label: "CPC global",
      current: globalCpc,
      previous: previousGlobalCpc,
      kind: "money",
      lowerIsBetter: true,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Dashboard central</h1>
          <p className="text-sm text-muted">
            Meta + Google Ads - {dateFrom} a {dateTo}
          </p>
          <p className="text-xs text-muted">
            Comparado contra {previousPeriod.dateFrom} a {previousPeriod.dateTo}
          </p>
        </div>
        <div className="text-xs text-muted">
          Meta: {metaAccount || "sin cuenta"} | Google: {googleAccount || "sin cuenta"}
        </div>
        <a
          href={exportHref}
          className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink-2 hover:bg-page hover:text-ink"
        >
          Descargar gasto CSV
        </a>
      </div>

      <ComparePeriodPicker />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <KpiCard
          label="Contactos totales"
          value={fmtDecimal(totalContacts)}
          sub={`Ant. ${fmtDecimal(previousContacts)} | Meta: ${fmtInt(meta.leads)} leads + ${fmtInt(meta.messages)} msjs | Google: ${fmtDecimal(google.conversions)}`}
          delta={kpiDelta(totalContacts, previousContacts)}
        />
        <KpiCard
          label="CPL global"
          value={totalContacts > 0 ? fmtMoney(globalCpl) : "-"}
          sub={`Ant. ${fmtMoney(previousGlobalCpl)} | ${fmtDecimal(totalContacts)} contactos`}
          delta={kpiDelta(globalCpl, previousGlobalCpl, true)}
        />
        <KpiCard
          label="Gasto total"
          value={fmtMoney(totalSpend)}
          sub={`Ant. ${fmtMoney(previousSpend)}`}
          delta={kpiDelta(totalSpend, previousSpend, true)}
        />
        <KpiCard
          label="Conv. Meta"
          value={fmtInt(meta.results)}
          sub={`Ant. ${fmtInt(previousMeta.results)} | ${fmtInt(meta.leads)} leads | ${fmtInt(meta.messages)} mensajes`}
          delta={kpiDelta(meta.results, previousMeta.results)}
        />
        <KpiCard
          label="Conv. Google"
          value={fmtDecimal(google.conversions)}
          sub={`Ant. ${fmtDecimal(previousGoogle.conversions)}`}
          delta={kpiDelta(google.conversions, previousGoogle.conversions)}
        />
        <KpiCard
          label="Gasto Meta"
          value={fmtMoney(meta.spend)}
          sub={`Ant. ${fmtMoney(previousMeta.spend)}`}
          delta={kpiDelta(meta.spend, previousMeta.spend, true)}
        />
        <KpiCard
          label="Gasto Google"
          value={fmtMoney(google.cost)}
          sub={`Ant. ${fmtMoney(previousGoogle.cost)}`}
          delta={kpiDelta(google.cost, previousGoogle.cost, true)}
        />
        <KpiCard
          label="CPC global"
          value={fmtMoney(globalCpc)}
          sub={`Ant. ${fmtMoney(previousGlobalCpc)}`}
          delta={kpiDelta(globalCpc, previousGlobalCpc, true)}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="xl:col-span-2">
          <SpendChart
            data={contactsSeries}
            title="Contactos totales (Meta + Google, incluye mensajes)"
            previousLabel="Periodo anterior"
            valueFormat="count"
          />
        </div>
        <SpendChart
          data={cplSeries}
          title="CPL diario global"
          previousLabel="Periodo anterior"
        />
        <SpendChart
          data={spendSeries}
          title="Gasto diario total"
          previousLabel="Periodo anterior"
        />
      </div>

      <section>
        <div className="mb-2">
          <h2 className="text-sm font-semibold text-ink">Comparativo central</h2>
          <p className="text-xs text-muted">
            Misma cantidad de dias: {dateFrom} a {dateTo} vs {previousPeriod.dateFrom} a{" "}
            {previousPeriod.dateTo}
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-3 py-2.5 font-medium text-muted">Metrica</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted">Actual</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted">Anterior</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted">Variacion</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.label} className="border-b border-line/60 last:border-0">
                  <td className="px-3 py-2 font-medium text-ink">{row.label}</td>
                  <td className="px-3 py-2 text-right text-ink [font-variant-numeric:tabular-nums]">
                    {formatMetric(row.current, row.kind)}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-2 [font-variant-numeric:tabular-nums]">
                    {formatMetric(row.previous, row.kind)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-medium [font-variant-numeric:tabular-nums] ${deltaTone(
                      row.current,
                      row.previous,
                      row.lowerIsBetter
                    )}`}
                  >
                    {metricDelta(row.current, row.previous)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-accent/30 bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-accent">
              Google Ads
            </p>
            <h2 className="mt-1 text-base font-semibold text-ink">Conexion y sync</h2>
            <p className="mt-1 text-sm text-muted">
              {googleConnected
                ? `Conectado a la cuenta ${googleAccount || "sin customer id"}`
                : "Conecta Google Ads para completar el CPL global y las secciones de keywords."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!googleConnected && googleReady && (
              <a
                href="/api/google-ads/oauth/start"
                className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:opacity-90"
              >
                Conectar Google Ads
              </a>
            )}
            {googleConnected && googleAccount && (
              <GoogleSyncButton accountId={googleAccount} dateFrom={dateFrom} dateTo={dateTo} />
            )}
            {googleConnected && (
              <a
                href={`/google-ads?dateFrom=${dateFrom}&dateTo=${dateTo}`}
                className="inline-flex h-9 items-center rounded-md border border-line bg-page px-4 text-sm font-medium text-ink-2 hover:bg-surface hover:text-ink"
              >
                Ver Google Ads
              </a>
            )}
          </div>
        </div>

        {googleError && (
          <p className="mt-3 rounded-md border border-critical/30 bg-page px-3 py-2 text-sm text-critical">
            Google OAuth no se completo: {googleError}
          </p>
        )}
        {googleJustConnected && (
          <p className="mt-3 rounded-md border border-good/30 bg-page px-3 py-2 text-sm text-good-ink">
            Google Ads conectado. Ahora sincroniza el rango seleccionado.
          </p>
        )}
        {!googleReady && (
          <p className="mt-3 rounded-md border border-warning/40 bg-page px-3 py-2 text-sm text-ink-2">
            Faltan credenciales base de Google Ads en .env.local.
          </p>
        )}

        {googleConnected && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <KpiCard
              label="CPL Google"
              value={google.conversions > 0 ? fmtMoney(google.cpa) : "-"}
              sub={`${fmtDecimal(google.conversions)} conversiones`}
            />
            <KpiCard label="Gasto Google" value={fmtMoney(google.cost)} />
            <KpiCard label="CTR Google" value={fmtPercent(google.ctr)} />
            <KpiCard label="CPC Google" value={fmtMoney(google.avg_cpc)} />
            <KpiCard label="Impresiones Google" value={fmtInt(google.impressions)} />
            <KpiCard label="Clics Google" value={fmtInt(google.clicks)} />
          </div>
        )}
      </section>
    </div>
  );
}
