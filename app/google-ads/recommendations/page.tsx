import AiAnalysisPanel from "@/components/AiAnalysisPanel";
import EmptyState from "@/components/EmptyState";
import RecommendationsBoard from "@/components/RecommendationsBoard";
import { aiAvailable } from "@/lib/ai";
import { getGoogleAccounts } from "@/lib/env";
import { resolveFilters, type SearchParams } from "@/lib/filters";
import { googleAdsConnected } from "@/lib/google/oauth";
import { getGoogleRecommendations } from "@/lib/google/queries";

export const dynamic = "force-dynamic";

export default async function GoogleRecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { accountId, dateFrom, dateTo } = resolveFilters(sp, getGoogleAccounts());
  const connected = googleAdsConnected();
  const recommendations = connected && accountId ? getGoogleRecommendations(accountId) : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Recomendaciones Google</h1>
        <p className="text-sm text-muted">
          Acciones generadas al sincronizar Google Ads - {dateFrom} a {dateTo}
        </p>
      </div>

      {!connected ? (
        <EmptyState
          title="Google Ads no esta conectado"
          hint="Conecta y sincroniza Google Ads para generar recomendaciones."
        />
      ) : (
        <>
          <AiAnalysisPanel
            platform="google"
            accountId={accountId}
            dateFrom={dateFrom}
            dateTo={dateTo}
            available={aiAvailable()}
          />
          <RecommendationsBoard recommendations={recommendations} platform="google" />
        </>
      )}
    </div>
  );
}
