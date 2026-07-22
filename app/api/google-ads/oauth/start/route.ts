import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GOOGLE_ADS_SCOPE, googleOAuthReady } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

function randomState() {
  return crypto.randomUUID();
}

export async function GET(request: Request) {
  if (!googleOAuthReady()) {
    return NextResponse.redirect(new URL("/?google_error=missing_config", request.url));
  }

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/google-ads/oauth/callback`;
  const state = randomState();

  const jar = await cookies();
  jar.set("google_ads_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", process.env.GOOGLE_ADS_CLIENT_ID ?? "");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_ADS_SCOPE);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl);
}
