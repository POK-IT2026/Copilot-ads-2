"use client";

import Link from "next/link";
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
  { href: "/budget-navigator", label: "Budget Navigator" },
];
const GOOGLE_ITEMS: NavItem[] = [
  { href: "/google-ads", label: "Dashboard", exact: true },
  { href: "/google-ads/campaigns", label: "Campanas" },
  { href: "/google-ads/ad-groups", label: "Grupos de anuncios" },
  { href: "/google-ads/keywords", label: "Palabras clave" },
  { href: "/google-ads/top-performers", label: "Top performance" },
  { href: "/google-ads/recommendations", label: "Recomendaciones" },
];

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
  return (
    <div>
      <p className="px-3 pt-5 pb-2 text-[10px] font-bold uppercase tracking-[1.5px] text-white/45">
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={qs ? `${item.href}?${qs}` : item.href}
                className={`block rounded-md border-l-[3px] px-3 py-2 text-sm transition-all ${
                  active
                    ? "border-brand bg-white/10 font-bold text-white"
                    : "border-transparent text-white/75 hover:border-white/20 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
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
        {/* Brand header · logo brand yellow + nombre PlayOut Kids */}
        <Link href={qs ? `/?${qs}` : "/"} className="flex items-center gap-3 px-3 pb-4 border-b border-white/10">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-brand font-black text-brand-ink text-base shadow-lg shadow-brand/30 tracking-tight">
            P
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-extrabold text-white tracking-tight leading-tight">
              PlayOut Kids
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-white/60 mt-0.5">
              Media Suite
            </div>
          </div>
        </Link>

        {/* Link volver al Suite Selector · consistente con ERP/CRM */}
        <a
          href="/main-menu"
          className="mx-3 mt-3 flex items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Volver a Suite
        </a>

        <nav className="mt-2 flex-1 overflow-y-auto">
          <NavSection title="Central" items={OVERVIEW_ITEMS} pathname={pathname} qs={qs} />
          <NavSection title="Meta Ads" items={META_ITEMS} pathname={pathname} qs={qs} />
          <NavSection title="Google Ads" items={GOOGLE_ITEMS} pathname={pathname} qs={qs} />
        </nav>

        {/* Footer branded */}
        <div className="border-t border-white/10 px-3 pt-4 pb-1">
          <p className="text-[11px] font-bold text-white/80">media.playoutkids.com</p>
          <p className="text-[10px] text-white/50 mt-0.5">v2.0 · PlayOut Kids ERP</p>
        </div>
      </aside>
    </>
  );
}
