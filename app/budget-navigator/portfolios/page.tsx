import PortfolioAssignmentPanel from "@/components/PortfolioAssignmentPanel";
import PortfolioForm from "@/components/PortfolioForm";
import { CATEGORY_LABELS } from "@/lib/campaignCategory";
import { getBudgetNavigatorState, recalculateBudgetNavigator } from "@/lib/budgetNavigator/engine";
import { listPortfolios } from "@/lib/budgetNavigator/portfolios";

export const dynamic = "force-dynamic";

export default async function PortfoliosPage() {
  let state = getBudgetNavigatorState();
  if (!state || state.isStale) {
    const fresh = await recalculateBudgetNavigator();
    state = { ...fresh, isStale: false };
  }
  const portfolios = listPortfolios();

  const campaigns = state.campaignSnapshots.map((c) => ({
    platform: c.platform,
    campaignId: c.campaignId,
    name: `${c.name} (${CATEGORY_LABELS[c.category]})`,
    portfolioId: c.portfolioId,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Portfolios</h1>
        <p className="text-sm text-muted">
          Agrupa campañas de Meta y Google para verlas juntas. No cambia el reparto de
          presupuesto -- es solo organización.
        </p>
      </div>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Tus portfolios</h2>
        <PortfolioForm portfolios={portfolios} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink">Asignar campañas</h2>
        <PortfolioAssignmentPanel
          campaigns={campaigns}
          portfolios={portfolios.map((p) => ({ id: p.id, name: p.name }))}
        />
      </section>
    </div>
  );
}
