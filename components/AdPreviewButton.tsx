"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useState } from "react";

/**
 * Botón de vista previa de un anuncio de Meta. Abre un modal y carga el
 * iframe devuelto por GET /api/ad-preview?adId={id}.
 */
export default function AdPreviewButton({
  adId,
  adName,
}: {
  adId: string;
  adName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function openPreview() {
    setOpen(true);
    if (html || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/ad-preview?adId=${encodeURIComponent(adId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setHtml(data.html ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={openPreview}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-2 transition-colors hover:border-accent hover:text-accent"
        title="Ver vista previa del anuncio"
        aria-label={`Vista previa de ${adName ?? adId}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa del anuncio"
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-lg bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="truncate text-sm font-medium text-ink">
                {adName || `Anuncio ${adId}`}
              </p>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-2 hover:bg-page"
              >
                Cerrar
              </button>
            </div>
            {loading && <p className="py-10 text-center text-sm text-muted">Cargando vista previa…</p>}
            {error && <p className="py-10 text-center text-sm text-critical">{error}</p>}
            {html && (
              // Meta devuelve el HTML de un <iframe> firmado por su API
              <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: html }} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
