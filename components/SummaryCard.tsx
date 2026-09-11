import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Summary Card · Fibrand brandbook.
 * Variante A del mockup v3 (conteo prominente + link + hover royal).
 * Reemplaza los <Link> ad-hoc en meta-ads/page.tsx y google-ads/page.tsx.
 */
export default function SummaryCard({
  label,
  href,
  count,
  hint,
  icon,
}: {
  label: string;
  href: string;
  count: number | string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-lg border border-line bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-md hover:shadow-accent/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-ink transition-colors group-hover:text-accent-deep">
            {label}
          </p>
          <p className="mt-1 text-2xl font-black leading-none tracking-tight text-accent-deep [font-variant-numeric:tabular-nums]">
            {count}
          </p>
          <p className="mt-1.5 text-[10.5px] font-semibold text-muted transition-colors group-hover:text-accent">
            {hint ?? "Ver detalle →"}
          </p>
        </div>
        {icon && (
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent/[0.08] text-accent-deep transition-all group-hover:bg-accent group-hover:text-white">
            {icon}
          </div>
        )}
      </div>
      {/* Barra decorativa royal · slide desde la izquierda al hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-accent via-accent-deep to-accent transition-transform duration-500 ease-out group-hover:scale-x-100"
      />
    </Link>
  );
}
