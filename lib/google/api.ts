/**
 * Cliente minimo de Google Ads API (REST). Usa OAuth2 con refresh token;
 * todas las credenciales viven en variables de entorno.
 */

let cachedToken: { token: string; expiresAt: number } | null = null;

export function googleAdsApiVersion(): string {
  return process.env.GOOGLE_ADS_API_VERSION?.trim() || "v24";
}

function cleanCustomerId(customerId: string): string {
  return customerId.replace(/-/g, "").trim();
}

export async function getGoogleAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Faltan GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET / GOOGLE_ADS_REFRESH_TOKEN en las variables de entorno"
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !body.access_token) {
    throw new Error(
      `OAuth de Google fallo: ${body.error_description ?? body.error ?? res.status}`
    );
  }

  cachedToken = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

async function googleAdsHeaders(includeLoginCustomer: boolean) {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN no esta configurado en las variables de entorno");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${await getGoogleAccessToken()}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  const loginCustomer = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, "").trim();
  if (includeLoginCustomer && loginCustomer) {
    headers["login-customer-id"] = loginCustomer;
  }
  return headers;
}

function googleAdsError(status: number, body: unknown) {
  const data = body as { error?: { message?: string; details?: unknown[] } } | null;
  const message = data?.error?.message ?? JSON.stringify(body ?? {}).slice(0, 300);
  return new Error(`Google Ads API ${status}: ${message}`);
}

export async function listAccessibleGoogleCustomers(): Promise<string[]> {
  const res = await fetch(
    `https://googleads.googleapis.com/${googleAdsApiVersion()}/customers:listAccessibleCustomers`,
    {
      method: "GET",
      headers: await googleAdsHeaders(false),
      cache: "no-store",
    }
  );
  const body = (await res.json().catch(() => null)) as {
    resourceNames?: string[];
  } | null;

  if (!res.ok) {
    throw googleAdsError(res.status, body);
  }

  return body?.resourceNames ?? [];
}

/**
 * Ejecuta una mutación sobre un recurso de Google Ads (p. ej. pausar una
 * campaña o cambiar la puja de una keyword). `resourcePlural` es el
 * segmento REST (`campaigns`, `adGroups`, `campaignBudgets`,
 * `adGroupCriteria`). Requiere que el refresh token tenga el scope
 * completo de adwords (ya es el caso: ver GOOGLE_ADS_SCOPE en oauth.ts).
 */
export async function googleAdsMutate(
  customerId: string,
  resourcePlural: string,
  operations: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `https://googleads.googleapis.com/${googleAdsApiVersion()}/customers/${cleanCustomerId(customerId)}/${resourcePlural}:mutate`,
    {
      method: "POST",
      headers: await googleAdsHeaders(true),
      body: JSON.stringify({ operations }),
      cache: "no-store",
    }
  );
  const body = (await res.json().catch(() => null)) as {
    results?: Record<string, unknown>[];
  } | null;

  if (!res.ok) {
    throw googleAdsError(res.status, body);
  }

  return body?.results ?? [];
}

/** Ejecuta una consulta GAQL con paginacion (googleAds:search). */
export async function gaqlSearch(
  customerId: string,
  query: string
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  let pageToken: string | undefined;

  do {
    const res = await fetch(
      `https://googleads.googleapis.com/${googleAdsApiVersion()}/customers/${cleanCustomerId(customerId)}/googleAds:search`,
      {
        method: "POST",
        headers: await googleAdsHeaders(true),
        body: JSON.stringify(pageToken ? { query, pageToken } : { query }),
        cache: "no-store",
      }
    );
    const body = (await res.json().catch(() => null)) as {
      results?: Record<string, unknown>[];
      nextPageToken?: string;
    } | null;

    if (!res.ok) {
      throw googleAdsError(res.status, body);
    }

    results.push(...(body?.results ?? []));
    pageToken = body?.nextPageToken;
  } while (pageToken);

  return results;
}
