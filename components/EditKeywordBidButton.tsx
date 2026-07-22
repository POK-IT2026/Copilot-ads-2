"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney } from "@/lib/format";

/**
 * Botón para editar la puja (CPC bid) de una keyword de Google Ads. Al
 * abrir, consulta la puja actual en vivo; al confirmar, aplica el cambio
 * directo sobre la cuenta real.
 */
export default function EditKeywordBidButton({
  accountId,
  adGroupId,
  criterionId,
  keywordText,
}: {
  accountId: string;
  adGroupId: string;
  criterionId: string;
  keywordText: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentBid, setCurrentBid] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function openModal() {
    setOpen(true);
    setDone(false);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/google-ads/actions/keyword-bid?accountId=${encodeURIComponent(accountId)}&adGroupId=${encodeURIComponent(adGroupId)}&criterionId=${encodeURIComponent(criterionId)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setCurrentBid(data.bidPesos ?? 0);
      setInput(String(data.bidPesos ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    const newBidPesos = Number(input);
    if (!Number.isFinite(newBidPesos) || newBidPesos <= 0) {
      setError("Ingresa una puja mayor a 0");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/google-ads/actions/keyword-bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, adGroupId, criterionId, newBidPesos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-2 hover:border-accent hover:text-accent"
      >
        Editar puja
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Editar puja de keyword"
        >
          <div
            className="w-full max-w-sm rounded-lg bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="truncate text-sm font-medium text-ink" title={keywordText}>
              {keywordText}
            </p>
            <p className="mt-0.5 text-xs text-muted">Puja actual (CPC)</p>

            {loading ? (
              <p className="py-6 text-center text-sm text-muted">Cargando puja actual…</p>
            ) : done ? (
              <p className="mt-3 rounded-md bg-good/10 px-3 py-2 text-sm text-good-ink">
                Puja actualizada a {fmtMoney(Number(input))}.
              </p>
            ) : (
              <>
                {currentBid !== null && (
                  <p className="mt-1 text-lg font-semibold text-ink">{fmtMoney(currentBid)}</p>
                )}
                <label className="mt-3 block text-xs font-medium text-ink-2">
                  Nueva puja
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
                  />
                </label>
              </>
            )}

            {error && <p className="mt-2 text-sm text-critical">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-2 hover:bg-page"
              >
                {done ? "Cerrar" : "Cancelar"}
              </button>
              {!done && !loading && (
                <button
                  onClick={confirm}
                  disabled={saving}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Confirmar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
