"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useState } from "react";

type StepStatus = "ok" | "error" | "pending";

interface DiagnosticStep {
  key: string;
  label: string;
  status: StepStatus;
  detail: string;
}

interface DiagnosticResponse {
  ok: boolean;
  accountId: string;
  accessibleCustomers: string[];
  steps: DiagnosticStep[];
}

function statusClass(status: StepStatus) {
  switch (status) {
    case "ok":
      return "border-good/40 bg-good/10 text-good-ink";
    case "error":
      return "border-critical/40 bg-critical/10 text-critical";
    default:
      return "border-warning/40 bg-warning/10 text-ink-2";
  }
}

function statusLabel(status: StepStatus) {
  switch (status) {
    case "ok":
      return "OK";
    case "error":
      return "Error";
    default:
      return "Pendiente";
  }
}

export default function GoogleDiagnosticsPanel({ accountId }: { accountId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runDiagnostics() {
    if (loading) return;
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (accountId) params.set("accountId", accountId);
      const res = await apiFetch(`/api/google-ads/diagnostics?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as DiagnosticResponse;
      setResult(data);
      setMessage(data.ok ? "Conexion lista para sincronizar." : "Hay un paso que revisar.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Diagnostico de conexion</h2>
          <p className="mt-1 text-sm text-muted">
            Valida OAuth, token de desarrollador, MCC y customer id antes de sincronizar.
          </p>
        </div>
        <button
          type="button"
          onClick={runDiagnostics}
          disabled={loading || !accountId}
          className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Probando..." : "Probar conexion"}
        </button>
      </div>

      {message && <p className="mt-3 text-sm text-ink-2">{message}</p>}

      {result && (
        <div className="mt-4 space-y-2">
          {result.steps.map((item) => (
            <div key={item.key} className="rounded-md border border-line bg-page px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded border px-2 py-0.5 text-[11px] font-semibold uppercase ${statusClass(
                    item.status
                  )}`}
                >
                  {statusLabel(item.status)}
                </span>
                <span className="text-sm font-medium text-ink">{item.label}</span>
              </div>
              <p className="mt-1 break-words text-xs text-muted">{item.detail}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
