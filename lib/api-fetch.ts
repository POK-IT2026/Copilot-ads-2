/**
 * Wrapper de fetch que prepende automáticamente el basePath `/media` en
 * llamadas client-side.
 *
 * ¿Por qué? Con basePath configurado en next.config.ts, Next.js reescribe
 * rutas de páginas y assets automáticamente, PERO `fetch()` es una llamada
 * HTTP directa del navegador · el basePath NO se aplica.
 *
 * Sin este helper: `fetch("/api/meta-ads/sync")` desde /media/meta-ads envía
 * el request a `erp.playoutkids.com/api/meta-ads/sync`, nginx no matchea
 * `/media/*`, cae al ERP Laravel que responde HTML de login → JSON.parse falla.
 *
 * Con este helper: `apiFetch("/api/meta-ads/sync")` envía a
 * `erp.playoutkids.com/media/api/meta-ads/sync`, nginx proxya al Docker
 * de Media Suite, Next.js sirve la ruta API correctamente.
 *
 * Debe coincidir con basePath en next.config.ts.
 */
export const BASE_PATH = "/media";

/**
 * Prepende BASE_PATH al path si empieza con "/api/", "/media/" ya presente
 * o URL absoluta se dejan intactos.
 */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = normalizeApiPath(input);
  return fetch(url, init);
}

function normalizeApiPath(input: string): string {
  // URL absoluta: no tocar
  if (/^https?:\/\//i.test(input)) return input;
  // Ya tiene basePath: no duplicar
  if (input.startsWith(`${BASE_PATH}/`)) return input;
  // Path relativo /api/... o /some-endpoint : prepend basePath
  if (input.startsWith("/")) return `${BASE_PATH}${input}`;
  // Path sin leading slash: asumir relativo, no tocar (Next resuelve)
  return input;
}
