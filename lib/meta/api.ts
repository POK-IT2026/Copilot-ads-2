/**
 * Cliente mínimo de la Meta Graph API.
 *
 * Rate limiting:
 *  - Lee el header X-Business-Use-Case-Usage y, si algún contador supera el
 *    90%, espera antes de la siguiente llamada.
 *  - Reintenta con backoff exponencial los errores de throttling
 *    (códigos 17, 32 y 80000–80004) y los 5xx.
 */

const RETRYABLE_CODES = new Set([17, 32, 80000, 80001, 80002, 80003, 80004]);
const MAX_RETRIES = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function apiBase(): string {
  const version = process.env.META_API_VERSION?.trim() || "v23.0";
  return `https://graph.facebook.com/${version}`;
}

/** Devuelve el % de uso máximo reportado en X-Business-Use-Case-Usage. */
function readUsageHeader(res: Response): number {
  const raw = res.headers.get("x-business-use-case-usage");
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      Array<Record<string, unknown>>
    >;
    let max = 0;
    for (const entries of Object.values(parsed)) {
      for (const entry of entries) {
        for (const key of ["call_count", "total_cputime", "total_time"]) {
          const v = entry[key];
          if (typeof v === "number") max = Math.max(max, v);
        }
      }
    }
    return max;
  } catch {
    return 0;
  }
}

async function requestWithRetry(url: string, init?: RequestInit): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { cache: "no-store", ...init });
    const usage = readUsageHeader(res);
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: number; message?: string };
    } | null;

    if (res.ok) {
      if (usage >= 90) {
        // Cerca del límite del Business Use Case: enfriar antes de seguir.
        await sleep(30_000);
      }
      return body;
    }

    const code = body?.error?.code;
    const retryable =
      RETRYABLE_CODES.has(code ?? -1) || res.status >= 500 || res.status === 429;
    if (attempt < MAX_RETRIES && retryable) {
      const backoff = Math.min(60_000, 1000 * 2 ** attempt) + Math.random() * 500;
      await sleep(backoff);
      continue;
    }
    throw new Error(
      `Meta API ${res.status}: ${body?.error?.message ?? "error desconocido"} (code ${code ?? "n/a"})`
    );
  }
}

const fetchWithRetry = requestWithRetry;

export async function metaGet(
  pathname: string,
  params: Record<string, string> = {}
): Promise<Record<string, unknown>> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error("META_ACCESS_TOKEN no está configurado en las variables de entorno");
  }
  const url = new URL(`${apiBase()}${pathname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  return (await fetchWithRetry(url.toString())) as Record<string, unknown>;
}

/**
 * POST de escritura sobre un objeto de la Graph API (p. ej. cambiar
 * `status` o `daily_budget` de una campaña/ad set/anuncio). Requiere que
 * el access token tenga el permiso `ads_management`.
 */
export async function metaPost(
  pathname: string,
  body: Record<string, string>
): Promise<Record<string, unknown>> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error("META_ACCESS_TOKEN no está configurado en las variables de entorno");
  }
  const url = `${apiBase()}${pathname}`;
  const form = new URLSearchParams({ ...body, access_token: token });
  return (await requestWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  })) as Record<string, unknown>;
}

/** GET paginado: sigue paging.next hasta agotar los resultados. */
export async function metaGetAll(
  pathname: string,
  params: Record<string, string> = {}
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let page = (await metaGet(pathname, { limit: "500", ...params })) as {
    data?: Record<string, unknown>[];
    paging?: { next?: string };
  };
  for (;;) {
    rows.push(...(page.data ?? []));
    const next = page.paging?.next;
    if (!next) break;
    page = (await fetchWithRetry(next)) as typeof page;
  }
  return rows;
}
