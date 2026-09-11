"use client";

import { type FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MobileNavToggle } from "./MobileNav";
import { apiFetch } from "@/lib/api-fetch";

function iso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
}

const PRESETS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

/**
 * Mapa de pathname → título + breadcrumb para el header.
 * Consistente con el patrón de las Suites del ERP (Suite / Media / Sección).
 */
const PAGE_META: Record<string, { title: string; section: string }> = {
  "/": { title: "Dashboard central", section: "Central" },
  "/budget-navigator": { title: "Budget Navigator", section: "Central" },
  "/meta-ads": { title: "Dashboard", section: "Meta Ads" },
  "/meta-ads/campaigns": { title: "Campañas", section: "Meta Ads" },
  "/meta-ads/adsets": { title: "Ad Sets", section: "Meta Ads" },
  "/meta-ads/ads": { title: "Anuncios", section: "Meta Ads" },
  "/meta-ads/creatives": { title: "Creativos", section: "Meta Ads" },
  "/meta-ads/top-performers": { title: "Top Performers", section: "Meta Ads" },
  "/meta-ads/alerts": { title: "Alertas", section: "Meta Ads" },
  "/meta-ads/recommendations": { title: "Recomendaciones", section: "Meta Ads" },
  "/google-ads": { title: "Dashboard", section: "Google Ads" },
  "/google-ads/campaigns": { title: "Campañas", section: "Google Ads" },
  "/google-ads/keywords": { title: "Palabras clave", section: "Google Ads" },
  "/google-ads/top-performers": { title: "Top performance", section: "Google Ads" },
  "/google-ads/recommendations": { title: "Recomendaciones", section: "Google Ads" },
};

function getPageMeta(pathname: string): { title: string; section: string } {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  // Fallback · buscar prefix match
  const match = Object.keys(PAGE_META)
    .filter((k) => k !== "/" && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_META[match] : { title: "Media Suite", section: "Media" };
}

function withParams(
  pathname: string,
  current: URLSearchParams,
  patch: Record<string, string | undefined>
) {
  const params = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export default function Header({ metaAccounts }: { metaAccounts: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const isMeta = pathname.startsWith("/meta-ads");
  const accountId = searchParams.get("accountId") ?? metaAccounts[0] ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? daysAgo(29);
  const dateTo = searchParams.get("dateTo") ?? iso(new Date());
  const [draftFrom, setDraftFrom] = useState(dateFrom);
  const [draftTo, setDraftTo] = useState(dateTo);

  useEffect(() => {
    setDraftFrom(dateFrom);
    setDraftTo(dateTo);
  }, [dateFrom, dateTo]);

  function go(patch: Record<string, string | undefined>) {
    // router.push respeta basePath /media automáticamente · a diferencia de
    // window.location.assign que hace navegación raw sin prefijo · si usáramos
    // window.location, nginx no matchea /media/ y el ERP redirige al Suite Selector.
    router.push(withParams(pathname, searchParams, patch));
  }

  function normalizedRange(from = draftFrom, to = draftTo) {
    const fallbackFrom = dateFrom;
    const fallbackTo = dateTo;
    const cleanFrom = from || fallbackFrom;
    const cleanTo = to || fallbackTo;
    return cleanFrom <= cleanTo
      ? { dateFrom: cleanFrom, dateTo: cleanTo }
      : { dateFrom: cleanTo, dateTo: cleanFrom };
  }

  function applyRange(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const range = normalizedRange();
    go(range);
  }

  function applyPreset(days: number) {
    const range = { dateFrom: daysAgo(days - 1), dateTo: iso(new Date()) };
    setDraftFrom(range.dateFrom);
    setDraftTo(range.dateTo);
    go(range);
  }

  async function handleSync() {
    const id = isMeta ? accountId : metaAccounts[0];
    if (!id || syncing) return;
    const range = normalizedRange();
    setSyncing(true);
    setMessage(null);
    try {
      // apiFetch prepende basePath /media automáticamente · sin él el request
      // va a erp.playoutkids.com/api/... que responde HTML del ERP → JSON.parse falla.
      const res = await apiFetch("/api/meta-ads/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: id, ...range, includePrevious: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setMessage({
        text: `Sincronizado ${range.dateFrom} a ${range.dateTo}: ${data.campaigns} campanas, ${data.ads} anuncios + periodo anterior`,
        error: false,
      });
      go(isMeta ? { accountId: id, ...range } : range);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      setSyncing(false);
    }
  }

  const pageMeta = getPageMeta(pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      {/* Breadcrumbs + título dinámico · patrón Suite ERP/CRM */}
      <div className="border-b border-line/60 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted mb-1">
          <a href="/main-menu" className="hover:text-accent transition-colors">Suite</a>
          <span className="text-muted/50">/</span>
          <span className="text-muted">Media</span>
          <span className="text-muted/50">/</span>
          <span className="text-muted">{pageMeta.section}</span>
          <span className="text-muted/50">/</span>
          <span className="text-ink font-bold">{pageMeta.title}</span>
        </div>
        <h1 className="text-xl font-extrabold text-ink leading-tight tracking-tight">
          {pageMeta.section} · <span className="relative inline-block">
            <span className="relative z-10">{pageMeta.title}</span>
            <span className="absolute inset-x-0 bottom-0 h-[8px] bg-brand/40 -z-0" />
          </span>
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <MobileNavToggle />
        <form onSubmit={applyRange} className="flex flex-wrap items-center gap-3">
          {isMeta && (
            <select
              name="accountId"
              value={accountId}
              onChange={(e) => go({ accountId: e.target.value })}
              disabled={metaAccounts.length === 0}
              className="h-9 rounded-md border border-line bg-surface px-2.5 text-sm text-ink disabled:opacity-50"
              aria-label="Cuenta publicitaria"
            >
              {metaAccounts.length === 0 ? (
                <option>Sin cuentas configuradas</option>
              ) : (
                metaAccounts.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))
              )}
            </select>
          )}

          <div className="flex items-center gap-1.5 text-sm text-ink-2">
            <input
              type="date"
              name="dateFrom"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
              aria-label="Fecha desde"
            />
            <span className="text-muted">-</span>
            <input
              type="date"
              name="dateTo"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
              className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
              aria-label="Fecha hasta"
            />
            <button
              type="submit"
              className="h-9 rounded-md border border-line bg-page px-3 text-sm font-medium text-ink-2 hover:bg-surface hover:text-ink"
            >
              Aplicar
            </button>
          </div>
        </form>

        <div className="flex overflow-hidden rounded-md border border-line">
          {PRESETS.map((p) => {
            const from = daysAgo(p.days - 1);
            const to = iso(new Date());
            const active = dateFrom === from && dateTo === to;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.days)}
                className={`flex h-9 items-center px-3 text-sm transition-colors ${
                  active
                    ? "bg-accent font-medium text-white"
                    : "bg-surface text-ink-2 hover:bg-page"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {message && (
          <p
            className={`max-w-md truncate text-xs ${message.error ? "text-critical" : "text-good-ink"}`}
            title={message.text}
          >
            {message.text}
          </p>
        )}

        <button
          onClick={handleSync}
          disabled={syncing || !(isMeta ? accountId : metaAccounts[0])}
          className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {syncing ? "Sincronizando..." : "Actualizar Meta"}
        </button>
      </div>
    </header>
  );
}
