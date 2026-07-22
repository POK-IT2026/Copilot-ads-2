import { NextResponse, type NextRequest } from "next/server";
import { metaGet } from "@/lib/meta/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/ad-preview?adId={id}
 * Llama a /{adId}/previews?ad_format=DESKTOP_FEED_STANDARD en la Graph API
 * y devuelve el HTML del iframe de vista previa.
 */
export async function GET(request: NextRequest) {
  const adId = request.nextUrl.searchParams.get("adId");
  if (!adId) {
    return NextResponse.json({ error: "adId es requerido" }, { status: 400 });
  }
  try {
    const res = (await metaGet(`/${encodeURIComponent(adId)}/previews`, {
      ad_format: "DESKTOP_FEED_STANDARD",
    })) as { data?: Array<{ body?: string }> };
    const html = res.data?.[0]?.body;
    if (!html) {
      return NextResponse.json(
        { error: "Meta no devolvió vista previa para este anuncio" },
        { status: 404 }
      );
    }
    return NextResponse.json({ html });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
