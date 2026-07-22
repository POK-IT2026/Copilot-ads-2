import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { upsertLocalEnv } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const origin = url.origin;

  if (error) {
    return NextResponse.redirect(new URL(`/?google_error=${encodeURIComponent(error)}`, origin));
  }

  const jar = await cookies();
  const expectedState = jar.get("google_ads_oauth_state")?.value;
  jar.delete("google_ads_oauth_state");

  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL("/?google_error=invalid_oauth_state", origin));
  }

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/?google_error=missing_oauth_client", origin));
  }

  const redirectUri = `${origin}/api/google-ads/oauth/callback`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const body = (await res.json().catch(() => null)) as {
    refresh_token?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!res.ok || !body?.refresh_token) {
    const reason = body?.error_description ?? body?.error ?? "missing_refresh_token";
    return NextResponse.redirect(
      new URL(`/?google_error=${encodeURIComponent(reason)}`, origin)
    );
  }

  upsertLocalEnv("GOOGLE_ADS_REFRESH_TOKEN", body.refresh_token);
  return NextResponse.redirect(new URL("/?google_connected=1", origin));
}
