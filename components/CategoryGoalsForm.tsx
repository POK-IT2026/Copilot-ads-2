"use client";

import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CampaignCategory } from "@/lib/campaignCategory";

interface GoalValue {
  roasTarget: number | null;
  cpaTarget: number | null;
  kpiCountTarget: number | null;
}

type GoalsByCategory = Partial<Record<CampaignCategory, GoalValue>>;

const ROWS: Array<{
  category: CampaignCategory;
  label: string;
  fields: Array<{ key: keyof GoalValue; label: string }>;
}> = [
  { category: "sales", label: "Ventas", fields: [{ key: "roasTarget", label: "ROAS objetivo" }] },
  {
    category: "leads",
    label: "Leads",
    fields: [
      { key: "cpaTarget", label: "CPL objetivo" },
      { key: "kpiCountTarget", label: "# leads objetivo" },
    ],
  },
  { category: "traffic", label: "Tráfico", fields: [{ key: "cpaTarget", label: "CPC objetivo" }] },
];

export default function CategoryGoalsForm({ goals }: { goals: GoalsByCategory }) {
  return (
    <div className="space-y-3">
      {ROWS.map((row) => (
        <GoalRow
          key={row.category}
          category={row.category}
          label={row.label}
          fields={row.fields}
          current={goals[row.category]}
        />
      ))}
    </div>
  );
}

function GoalRow({
  category,
  label,
  fields,
  current,
}: {
  category: CampaignCategory;
  label: string;
  fields: Array<{ key: keyof GoalValue; label: string }>;
  current?: GoalValue;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((f) => [f.key, current?.[f.key] != null ? String(current[f.key]) : ""])
    )
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed: Record<string, number | null> = {};
    for (const f of fields) {
      const raw = values[f.key];
      if (raw === "" || raw === undefined) {
        parsed[f.key] = null;
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        setError(`${f.label}: ingresa un número válido`);
        return;
      }
      parsed[f.key] = n;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/budget-navigator/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, ...parsed }),
      });
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
    <form onSubmit={save} className="flex flex-wrap items-end gap-2">
      <span className="w-16 shrink-0 text-sm font-medium text-ink">{label}</span>
      {fields.map((f) => (
        <label key={f.key} className="text-xs font-medium text-ink-2">
          {f.label}
          <input
            type="number"
            min="0"
            step="0.1"
            value={values[f.key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            className="mt-1 block h-9 w-32 rounded-md border border-line bg-surface px-2.5 text-sm text-ink"
          />
        </label>
      ))}
      <button
        type="submit"
        disabled={busy}
        className="h-9 rounded-md border border-line bg-page px-3 text-sm font-medium text-ink-2 hover:bg-surface hover:text-ink disabled:opacity-50"
      >
        {busy ? "Guardando..." : "Guardar"}
      </button>
      {error && <p className="text-xs text-critical">{error}</p>}
    </form>
  );
}
