"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Portfolio {
  id: number;
  name: string;
  createdAt: string;
  campaigns: Array<{ platform: "meta" | "google"; campaignId: string }>;
}

export default function PortfolioForm({ portfolios }: { portfolios: Portfolio[] }) {
  return (
    <div className="space-y-3">
      {portfolios.map((p) => (
        <PortfolioRow key={p.id} portfolio={p} />
      ))}
      <NewPortfolioRow />
    </div>
  );
}

function PortfolioRow({ portfolio }: { portfolio: Portfolio }) {
  const router = useRouter();
  const [name, setName] = useState(portfolio.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rename() {
    if (!name.trim()) {
      setError("El nombre no puede estar vacío");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/budget-navigator/portfolios/${portfolio.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
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

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/budget-navigator/portfolios/${portfolio.id}`, { method: "DELETE" });
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
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-ink-2">
          Nombre
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block h-9 w-56 rounded-md border border-line bg-surface px-2.5 text-sm text-ink"
          />
        </label>
        <button
          type="button"
          onClick={rename}
          disabled={busy}
          className="h-9 rounded-md border border-line bg-page px-3 text-sm font-medium text-ink-2 hover:bg-surface hover:text-ink disabled:opacity-50"
        >
          {busy ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="h-9 rounded-md border border-critical/40 px-3 text-sm font-medium text-critical hover:bg-critical/10 disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        {portfolio.campaigns.length === 0
          ? "Sin campañas asignadas"
          : `${portfolio.campaigns.length} campaña${portfolio.campaigns.length === 1 ? "" : "s"} asignada${portfolio.campaigns.length === 1 ? "" : "s"}`}
      </p>
      {error && <p className="mt-1 text-xs text-critical">{error}</p>}
    </div>
  );
}

function NewPortfolioRow() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Ingresa un nombre");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/budget-navigator/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={create} className="flex flex-wrap items-end gap-2">
      <label className="text-xs font-medium text-ink-2">
        Nuevo portfolio
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ej. Marca A"
          className="mt-1 block h-9 w-56 rounded-md border border-line bg-surface px-2.5 text-sm text-ink"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Creando..." : "Crear"}
      </button>
      {error && <p className="text-xs text-critical">{error}</p>}
    </form>
  );
}
