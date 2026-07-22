import { NextResponse } from "next/server";
import { getGoogleKeywordBidLive, setGoogleKeywordBid } from "@/lib/google/actions";

export const dynamic = "force-dynamic";

/** GET /api/google-ads/actions/keyword-bid?accountId=&adGroupId=&criterionId= */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  const adGroupId = searchParams.get("adGroupId");
  const criterionId = searchParams.get("criterionId");
  if (!accountId || !adGroupId || !criterionId) {
    return NextResponse.json(
      { error: "accountId, adGroupId y criterionId son requeridos" },
      { status: 400 }
    );
  }
  try {
    const cpcBidMicros = await getGoogleKeywordBidLive(accountId, adGroupId, criterionId);
    return NextResponse.json({ cpcBidMicros, bidPesos: cpcBidMicros / 1_000_000 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}

/**
 * POST /api/google-ads/actions/keyword-bid
 * Body: { accountId, adGroupId, criterionId, newBidPesos }
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    accountId?: string;
    adGroupId?: string;
    criterionId?: string;
    newBidPesos?: number;
  };
  const { accountId, adGroupId, criterionId, newBidPesos } = body;
  if (!accountId || !adGroupId || !criterionId) {
    return NextResponse.json(
      { error: "accountId, adGroupId y criterionId son requeridos" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(newBidPesos) || (newBidPesos as number) <= 0) {
    return NextResponse.json({ error: "newBidPesos debe ser un número mayor a 0" }, { status: 400 });
  }

  try {
    const cpcBidMicros = Math.round((newBidPesos as number) * 1_000_000);
    await setGoogleKeywordBid(accountId, adGroupId, criterionId, cpcBidMicros);
    return NextResponse.json({ ok: true, cpcBidMicros });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
