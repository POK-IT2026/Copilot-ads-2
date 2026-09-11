import { NextResponse } from "next/server";
import { addDays, getPeriodLengthDays } from "@/lib/dateRanges";
import { getGoogleAccounts, getMetaAccounts } from "@/lib/env";
import { getGoogleDailySeries } from "@/lib/google/queries";
import { googleAdsConnected } from "@/lib/google/oauth";
import { getMetaDailySeries } from "@/lib/meta/queries";

export const dynamic = "force-dynamic";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  return { dateFrom: iso(from), dateTo: iso(today) };
}

function cleanDate(value: string | null): string | undefined {
  if (!value) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function resolveDateRange(searchParams: URLSearchParams) {
  const fallback = defaultRange();
  const rawFrom = cleanDate(searchParams.get("dateFrom")) ?? fallback.dateFrom;
  const rawTo = cleanDate(searchParams.get("dateTo")) ?? fallback.dateTo;
  return rawFrom <= rawTo
    ? { dateFrom: rawFrom, dateTo: rawTo }
    : { dateFrom: rawTo, dateTo: rawFrom };
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function money(value: number) {
  return value.toFixed(2);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { dateFrom, dateTo } = resolveDateRange(url.searchParams);
  const metaAccount = url.searchParams.get("metaAccount") ?? getMetaAccounts()[0] ?? "";
  const googleAccount = url.searchParams.get("googleAccount") ?? getGoogleAccounts()[0] ?? "";

  const metaSeries = metaAccount ? getMetaDailySeries(metaAccount, dateFrom, dateTo) : [];
  const googleSeries =
    googleAdsConnected() && googleAccount
      ? getGoogleDailySeries(googleAccount, dateFrom, dateTo)
      : [];

  const metaByDate = new Map(metaSeries.map((point) => [point.date, point]));
  const googleByDate = new Map(googleSeries.map((point) => [point.date, point]));
  const days = getPeriodLengthDays(dateFrom, dateTo);

  const rows = Array.from({ length: days }, (_, index) => {
    const date = addDays(dateFrom, index);
    const metaSpend = metaByDate.get(date)?.spend ?? 0;
    const googleSpend = googleByDate.get(date)?.spend ?? 0;
    return [
      date,
      metaAccount,
      money(metaSpend),
      googleAccount,
      money(googleSpend),
      money(metaSpend + googleSpend),
    ];
  });

  const header = [
    "fecha",
    "cuenta_meta",
    "gasto_meta",
    "cuenta_google",
    "gasto_google",
    "gasto_total",
  ];
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => csvCell(cell)).join(","))
    .join("\r\n");
  const filename = `gasto-publicitario-${dateFrom}-a-${dateTo}.csv`;

  return new NextResponse(`\uFEFF${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
