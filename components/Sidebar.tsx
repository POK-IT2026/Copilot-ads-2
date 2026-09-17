"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useMobileNav } from "./MobileNav";

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

const META_ITEMS: NavItem[] = [
  { href: "/meta-ads", label: "Dashboard", exact: true },
  { href: "/meta-ads/campaigns", label: "Campañas" },
  { href: "/meta-ads/adsets", label: "Ad Sets" },
  { href: "/meta-ads/ads", label: "Anuncios" },
  { href: "/meta-ads/creatives", label: "Creativos" },
  { href: "/meta-ads/top-performers", label: "Top Performers" },
  { href: "/meta-ads/alerts", label: "Alertas" },
  { href: "/meta-ads/recommendations", label: "Recomendaciones" },
];

const OVERVIEW_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard central", exact: true },
  { href: "/budget-navigator", label: "Budget Navigator", exact: true },
  { href: "/budget-navigator/portfolios", label: "Portfolios" },
];
const GOOGLE_ITEMS: NavItem[] = [
  { href: "/google-ads", label: "Dashboard", exact: true },
  { href: "/google-ads/campaigns", label: "Campanas" },
  { href: "/google-ads/ad-groups", label: "Grupos de anuncios" },
  { href: "/google-ads/keywords", label: "Palabras clave" },
  { href: "/google-ads/top-performers", label: "Top performance" },
  { href: "/google-ads/recommendations", label: "Recomendaciones" },
];

function isActive(item: NavItem, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

/**
 * Desplegable: por defecto abierta solo la sección que contiene la página
 * activa (para no amontonar los ~17 links de las 3 secciones a la vez).
 * `manualOpen` es null mientras el usuario no la toque -- ahí sigue el
 * criterio automático; en cuanto hace click, queda fija en ese estado.
 */
function NavSection({
  title,
  items,
  pathname,
  qs,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  qs: string;
}) {
  const containsActive = items.some((item) => isActive(item, pathname));
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? containsActive;

  return (
    <div>
      <button
        type="button"
        onClick={() => setManualOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md px-3 pt-6 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-ink/50 transition-colors hover:text-sidebar-ink/80"
      >
        <span>{title}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active = isActive(item, pathname);
            return (
              <li key={item.href}>
                <Link
                  href={qs ? `${item.href}?${qs}` : item.href}
                  className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-white/10 font-medium text-white"
                      : "text-sidebar-ink hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  // Conservar los filtros globales al navegar entre páginas
  const qs = useSearchParams().toString();
  const { open, close } = useMobileNav();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={close}
          aria-hidden
        />
      )}
      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 -translate-x-full flex-col bg-sidebar px-3 py-5 transition-transform duration-200 ease-out motion-reduce:transition-none lg:sticky lg:top-0 lg:z-auto lg:w-60 lg:translate-x-0 ${
          open ? "translate-x-0" : ""
        }`}
      >
        <Link href={qs ? `/?${qs}` : "/"} className="px-3">
          <span className="[font-family:var(--font-display)] text-base font-semibold tracking-tight text-white">
            Campaign Copilot
          </span>
          <span className="ml-1.5 rounded bg-accent/25 px-1.5 py-0.5 text-[11px] font-semibold text-[#e8a878]">
            v2
          </span>
        </Link>
        <nav className="mt-2 flex-1 overflow-y-auto">
          <NavSection title="Central" items={OVERVIEW_ITEMS} pathname={pathname} qs={qs} />
          <NavSection title="Meta Ads" items={META_ITEMS} pathname={pathname} qs={qs} />
          <NavSection title="Google" items={GOOGLE_ITEMS} pathname={pathname} qs={qs} />
        </nav>
        <p className="px-3 text-[11px] text-sidebar-ink/40">SQLite local · sin marcas</p>
      </aside>
    </>
  );
}
