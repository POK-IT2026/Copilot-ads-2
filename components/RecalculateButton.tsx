"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RecalculateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/budget-navigator/recalculate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Recalculando..." : "Recalcular ahora"}
      </button>
      {error && <p className="max-w-xl truncate text-xs text-critical">{error}</p>}
    </div>
  );
}
