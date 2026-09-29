import ApplyActionButton from "@/components/ApplyActionButton";
import BudgetCurve from "@/components/BudgetCurve";
import BudgetSimulator from "@/components/BudgetSimulator";
import CategoryGoalsForm from "@/components/CategoryGoalsForm";
import EmptyState from "@/components/EmptyState";
import KpiCard from "@/components/KpiCard";
import MasterBudgetForm from "@/components/MasterBudgetForm";
import RecalculateButton from "@/components/RecalculateButton";
import { PriorityBadge } from "@/components/Badges";
import { CATEGORY_LABELS } from "@/lib/campaignCategory";
import { getBudgetNavigatorState, recalculateBudgetNavigator } from "@/lib/budgetNavigator/engine";
import { FORECAST_DEVIATION_PCT } from "@/lib/budgetNavigator/forecast";
import { getGoals } from "@/lib/budgetNavigator/goals";
import { getGoogleAccounts, getMetaAccounts } from "@/lib/env";
import { fmtMoney } from "@/lib/format";
import { googleAdsConnected } from "@/lib/google/oauth";
import { getGoogleRecommendations } from "@/lib/google/queries";
import { getMetaRecommendations } from "@/lib/meta/queries";
import { availableActionsFor, type ActionKey, type Platform } from "@/lib/recommendationActionRules";

export const dynamic = "force-dynamic";

const GROWTH_RULES = new Set([
  "bn_below_target",
  "bn_sustained_roas",
  "bn_pace_ahead",
  "bn_forecast_underspend",
]);
const REDUCE_RULES = new Set([
  "bn_above_target",
  "bn_sustained_cpa",
  "bn_no_conversions",
  "bn_forecast_overspend",
]);

interface BnRow {
  id: number;
  level: string;
  rule: string;
  priority: string;
  title: string;
  detail: string;
  entity_name: string;
  platform: Platform;
}

function FindingList({ rows, emptyText }: { rows: BnRow[]; emptyText: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">{emptyText}</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const actions: ActionKey[] = availableActionsFor(r.platform, r.level, r.rule);
        return (
          <li key={`${r.platform}-${r.id}`} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge priority={r.priority} />
              <span className="text-sm font-medium text-ink">{r.title}</span>
              <span className="rounded bg-page px-1.5 py-0.5 text-[11px] text-muted">
                {r.platform === "meta" ? "Meta" : "Google"}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-ink-2">{r.detail}</p>
            <p className="mt-1 text-xs text-muted">{r.entity_name}</p>
            {actions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {actions.map((a) => (
                  <ApplyActionButton key={a} recId={r.id} platform={r.platform} action={a} />
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default async function BudgetNavigatorPage() {
  let state = getBudgetNavigatorState();
  if (!state || state.isStale) {
    const fresh = await recalculateBudgetNavigator();
    state = { ...fresh, isStale: false };
  }

  const metaAccountId = getMetaAccounts()[0];
  const googleConnected = googleAdsConnected();
  const googleAccountId = googleConnected ? getGoogleAccounts()[0] : undefined;

  const metaRecs = metaAccountId ? getMetaRecommendations(metaAccountId) : [];
  const googleRecs = googleAccountId ? getGoogleRecommendations(googleAccountId) : [];

  const bnRows: BnRow[] = [
    ...metaRecs
      .filter((r) => r.status === "pending" && r.rule.startsWith("bn_"))
      .map((r) => ({ ...r, platform: "meta" as const })),
    ...googleRecs
      .filter((r) => r.status === "pending" && r.rule.startsWith("bn_"))
      .map((r) => ({ ...r, platform: "google" as const })),
  ];

  const growth = bnRows.filter((r) => GROWTH_RULES.has(r.rule));
  const reduce = bnRows.filter((r) => REDUCE_RULES.has(r.rule));
  const remaining = state.monthlyBudget - state.totalSpendMtd;

  const accountDeviationPct =
    state.monthlyBudget > 0 ? (state.projectedSpendEom - state.monthlyBudget) / state.monthlyBudget : null;
  const accountDeviationTone: "up" | "down" | "flat" =
    accountDeviationPct === null
      ? "flat"
      : accountDeviationPct > FORECAST_DEVIATION_PCT
        ? "down"
        : accountDeviationPct < -FORECAST_DEVIATION_PCT
          ? "flat"
          : "up";

  const goals = getGoals();

  const simCampaigns = state.campaignSnapshots.map((c) => ({
    platform: c.platform,
    campaignId: c.campaignId,
    name: `${c.name} (${CATEGORY_LABELS[c.category]})`,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Budget Navigator</h1>
          <p className="text-sm text-muted">
            Recomendaciones de redistribución de presupuesto entre Meta y Google Ads.
          </p>
          <p className="text-xs text-muted">
            {state.computedAt
              ? `Último cálculo: ${new Date(state.computedAt).toLocaleString("es-MX")}`
              : "Sin cálculos previos"}
          </p>
        </div>
        <RecalculateButton />
      </div>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold text-ink">Presupuesto maestro</h2>
        <MasterBudgetForm currentMonthlyBudget={state.monthlyBudget} />
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-ink">Metas de KPI por categoría</h2>
        <p className="mb-3 text-xs text-muted">
          Opcional: si defines una meta, el reparto y las alertas de racha se evalúan contra ella
          en vez del promedio histórico de la cuenta.
        </p>
        <CategoryGoalsForm goals={goals} />
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Presupuesto mensual" value={fmtMoney(state.monthlyBudget)} />
        <KpiCard label="Presupuesto diario (asignado)" value={fmtMoney(state.totalDailyBudget)} />
        <KpiCard label="Consumido este mes" value={fmtMoney(state.totalSpendMtd)} />
        <KpiCard
          label="Restante este mes"
          value={fmtMoney(remaining)}
          delta={
            state.monthlyBudget > 0
              ? { value: `${remaining < 0 ? "" : ""}${fmtMoney(remaining)}`, tone: remaining < 0 ? "down" : "flat" }
              : undefined
          }
        />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink">Proyección de cierre de mes</h2>
        {state.monthlyBudget > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Ritmo diario (últimos 7 días)" value={fmtMoney(state.totalDailyRunRate)} />
            <KpiCard
              label="Proyección de gasto a fin de mes"
              value={fmtMoney(state.projectedSpendEom)}
              sub={`${state.projectedDaysRemaining} días restantes`}
              delta={
                accountDeviationPct !== null
                  ? {
                      value: `${accountDeviationPct >= 0 ? "+" : ""}${(accountDeviationPct * 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })}% vs. presupuesto`,
                      tone: accountDeviationTone,
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <EmptyState
            title="Configura un presupuesto mensual para ver la proyección de cierre de mes"
            hint="La proyección extrapola el ritmo de gasto de los últimos 7 días a lo que resta del mes y lo compara contra tu presupuesto mensual."
          />
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-good-ink">
            Campañas con oportunidad de crecimiento
          </h2>
          <FindingList rows={growth} emptyText="Sin oportunidades de crecimiento detectadas." />
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold text-critical">
            Campañas que deberían reducir inversión
          </h2>
          <FindingList rows={reduce} emptyText="Sin campañas candidatas a reducir detectadas." />
        </section>
      </div>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-ink">Simulador</h2>
        <p className="mb-3 text-xs text-muted">
          Prueba escenarios de cambio de presupuesto antes de aplicarlos.
        </p>
        <BudgetSimulator campaigns={simCampaigns} />
      </section>

      {state.totalDailyBudget > 0 && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="mb-1 text-sm font-semibold text-ink">Curva &quot;qué pasaría si&quot;</h2>
          <p className="mb-3 text-xs text-muted">
            Retorno esperado del reparto real (mismo motor que las oportunidades de arriba) contra
            distintos niveles de presupuesto diario total. Asume eficiencia constante por campaña,
            igual que el Simulador.
          </p>
          <BudgetCurve />
        </section>
      )}
    </div>
  );
}
