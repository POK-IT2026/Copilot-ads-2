"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useState } from "react";

export default function GoogleSyncButton({
  accountId,
  dateFrom,
  dateTo,
}: {
  accountId: string;
  dateFrom: string;
  dateTo: string;
}) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function sync() {
    if (syncing) return;
    setSyncing(true);
    setMessage(null);
    setError(false);
    try {
      const res = await apiFetch("/api/google-ads/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, dateFrom, dateTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setMessage(`Google sincronizado: ${data.campaigns} campanas, ${data.keywords} keywords`);
      window.location.reload();
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={sync}
        disabled={syncing || !accountId}
        className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {syncing ? "Sincronizando..." : "Sincronizar Google"}
      </button>
      {message && (
        <p className={`max-w-xl truncate text-xs ${error ? "text-critical" : "text-good-ink"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
