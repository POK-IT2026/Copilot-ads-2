"use client";

import { apiFetch } from "@/lib/api-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CampaignRow {
  platform: "meta" | "google";
  campaignId: string;
  name: string;
  portfolioId: number | null;
}

export default function PortfolioAssignmentPanel({
  campaigns,
  portfolios,
}: {
  campaigns: CampaignRow[];
  portfolios: Array<{ id: number; name: string }>;
}) {
  if (campaigns.length === 0) {
    return <p className="text-sm text-muted">No hay campañas activas para asignar.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="px-3 py-2.5 font-medium text-muted">Campaña</th>
            <th className="px-3 py-2.5 font-medium text-muted">Plataforma</th>
            <th className="px-3 py-2.5 font-medium text-muted">Portfolio</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <AssignmentRow key={`${c.platform}-${c.campaignId}`} campaign={c} portfolios={portfolios} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssignmentRow({
  campaign,
  portfolios,
}: {
  campaign: CampaignRow;
  portfolios: Array<{ id: number; name: string }>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(campaign.portfolioId != null ? String(campaign.portfolioId) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(next: string) {
    setValue(next);
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/budget-navigator/portfolios/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: campaign.platform,
          campaignId: campaign.campaignId,
          portfolioId: next === "" ? null : Number(next),
        }),
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
    <tr className="border-b border-line/60">
      <td className="px-3 py-2 font-medium text-ink">{campaign.name}</td>
      <td className="px-3 py-2 text-ink-2">{campaign.platform === "meta" ? "Meta" : "Google"}</td>
      <td className="px-3 py-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={busy}
          className="h-9 rounded-md border border-line bg-surface px-2.5 text-sm text-ink disabled:opacity-50"
        >
          <option value="">Sin portfolio</option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-critical">{error}</p>}
      </td>
    </tr>
  );
}
