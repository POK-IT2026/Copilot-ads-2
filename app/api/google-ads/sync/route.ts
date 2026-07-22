import { NextResponse } from "next/server";
import { syncGoogleAccount } from "@/lib/google/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      accountId?: string;
      dateFrom?: string;
      dateTo?: string;
    };
    const { accountId, dateFrom, dateTo } = body;
    if (!accountId || !dateFrom || !dateTo) {
      return NextResponse.json(
        { error: "accountId, dateFrom y dateTo son requeridos" },
        { status: 400 }
      );
    }
    if (!DATE_RE.test(dateFrom) || !DATE_RE.test(dateTo)) {
      return NextResponse.json(
        { error: "Las fechas deben tener formato YYYY-MM-DD" },
        { status: 400 }
      );
    }
    const result = await syncGoogleAccount(accountId.replace(/-/g, ""), dateFrom, dateTo);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
