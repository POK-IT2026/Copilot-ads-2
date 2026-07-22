import AiAnalysisPanel from "@/components/AiAnalysisPanel";
import RecommendationsBoard from "@/components/RecommendationsBoard";
import { aiAvailable } from "@/lib/ai";
import { getMetaAccounts } from "@/lib/env";
import { resolveFilters, type SearchParams } from "@/lib/filters";
import { getMetaRecommendations } from "@/lib/meta/queries";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { accountId, dateFrom, dateTo } = resolveFilters(sp, getMetaAccounts());
  const recommendations = getMetaRecommendations(accountId);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Recomendaciones</h1>
        <p className="text-sm text-muted">
          Generadas automáticamente al sincronizar. Marcar como hecha requiere una nota.
        </p>
      </div>

      <AiAnalysisPanel
        platform="meta"
        accountId={accountId}
        dateFrom={dateFrom}
        dateTo={dateTo}
        available={aiAvailable()}
      />

      <RecommendationsBoard recommendations={recommendations} platform="meta" />
    </div>
  );
}
