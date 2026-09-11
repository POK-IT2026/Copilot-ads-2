"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LEVEL_LABELS, PriorityBadge } from "./Badges";
import ApplyActionButton from "./ApplyActionButton";
import { availableActionsFor } from "@/lib/recommendationActionRules";

export interface RecItem {
  id: number;
  level: string;
  entity_id: string;
  entity_name: string;
  rule: string;
  priority: string;
  title: string;
  detail: string;
  kpi_snapshot: string;
  status: string;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
}

const TABS = [
  { key: "pending", label: "Pendientes" },
  { key: "done", label: "Hechas" },
  { key: "discarded", label: "Descartadas" },
] as const;

function Snapshot({ raw }: { raw: string }) {
  let pretty = raw;
  try {
    pretty = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    /* mostrar tal cual */
  }
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-muted hover:text-ink-2">
        Ver snapshot de KPIs
      </summary>
      <pre className="mt-1.5 overflow-x-auto rounded-md bg-page p-3 text-[11px] leading-relaxed text-ink-2">
        {pretty}
      </pre>
    </details>
  );
}

export default function RecommendationsBoard({
  recommendations,
  platform,
}: {
  recommendations: RecItem[];
  platform: "meta" | "google";
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("pending");
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byStatus = (s: string) => recommendations.filter((r) => r.status === s);
  const visible = byStatus(tab);

  async function patch(id: number, status: "done" | "discarded" | "pending", noteText?: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await apiFetch(`/api/recommendations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, status, note: noteText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setNoteFor(null);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-sm transition-colors ${
              tab === t.key
                ? "border-accent font-medium text-ink"
                : "border-transparent text-muted hover:text-ink-2"
            }`}
          >
            {t.label}
            <span className="ml-1.5 rounded-full bg-line/70 px-1.5 text-xs text-ink-2">
              {byStatus(t.key).length}
            </span>
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-critical">{error}</p>}

      {visible.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">
          No hay recomendaciones en esta pestaña. Sincroniza datos para generarlas.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((rec) => (
            <li key={rec.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={rec.priority} />
                <span className="text-sm font-medium text-ink">{rec.title}</span>
                <span className="rounded bg-page px-1.5 py-0.5 text-[11px] text-muted">
                  {LEVEL_LABELS[rec.level] ?? rec.level}
                </span>
                <code className="text-[11px] text-muted">{rec.rule}</code>
              </div>
              <p className="mt-1.5 text-sm text-ink-2">{rec.detail}</p>
              <p className="mt-1 text-xs text-muted">
                {rec.entity_name} · id {rec.entity_id} · generada {rec.created_at}
              </p>
              {rec.note && (
                <p className="mt-2 rounded-md bg-page px-3 py-2 text-xs text-ink-2">
                  <span className="font-medium">Nota:</span> {rec.note}
                </p>
              )}
              <Snapshot raw={rec.kpi_snapshot} />

              {rec.status === "pending" && (
                <div className="mt-3">
                  {(() => {
                    const actions = availableActionsFor(platform, rec.level, rec.rule);
                    return actions.length > 0 ? (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {actions.map((action) => (
                          <ApplyActionButton
                            key={action}
                            recId={rec.id}
                            platform={platform}
                            action={action}
                          />
                        ))}
                      </div>
                    ) : null;
                  })()}
                  {noteFor === rec.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Nota obligatoria: ¿qué acción tomaste?"
                        rows={2}
                        className="w-full rounded-md border border-line bg-surface p-2 text-sm text-ink"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => patch(rec.id, "done", note)}
                          disabled={busy === rec.id || note.trim() === ""}
                          className="rounded-md bg-good px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Confirmar hecha
                        </button>
                        <button
                          onClick={() => {
                            setNoteFor(null);
                            setNote("");
                          }}
                          className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-2"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setNoteFor(rec.id)}
                        disabled={busy === rec.id}
                        className="rounded-md border border-good/40 px-3 py-1.5 text-xs font-medium text-good-ink hover:bg-good/10 disabled:opacity-50"
                      >
                        Marcar como hecha
                      </button>
                      <button
                        onClick={() => patch(rec.id, "discarded")}
                        disabled={busy === rec.id}
                        className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-2 hover:bg-page disabled:opacity-50"
                      >
                        Descartar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
