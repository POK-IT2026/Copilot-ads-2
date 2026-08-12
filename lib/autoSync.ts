import { getGoogleAccounts, getMetaAccounts } from "./env";
import { googleAdsConnected } from "./google/oauth";
import { syncGoogleAccount } from "./google/sync";
import { syncMetaAccount } from "./meta/sync";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_MINUTES = 60;
const DEFAULT_WINDOW_DAYS = 30;
const KICKOFF_DELAY_MS = 10_000; // deja que el server termine de arrancar antes del primer sync

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Ventana rodante de `days` días terminando hoy (mismo default que usan los dashboards). */
function rollingWindow(days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * DAY_MS);
  return { dateFrom: isoDate(from), dateTo: isoDate(to) };
}

export interface AutoSyncAccountResult {
  accountId: string;
  ok: boolean;
  error?: string;
}

export interface AutoSyncLogEntry {
  at: string;
  dateFrom: string;
  dateTo: string;
  meta: AutoSyncAccountResult[];
  google: AutoSyncAccountResult[];
}

let lastRun: AutoSyncLogEntry | null = null;
let running = false;

export function getLastAutoSync(): AutoSyncLogEntry | null {
  return lastRun;
}

/** Corre un ciclo de sincronización para todas las cuentas configuradas. */
export async function runAutoSyncOnce(): Promise<AutoSyncLogEntry> {
  if (running) return lastRun ?? { at: new Date().toISOString(), dateFrom: "", dateTo: "", meta: [], google: [] };
  running = true;

  const windowDays = Number(process.env.AUTO_SYNC_WINDOW_DAYS) || DEFAULT_WINDOW_DAYS;
  const { dateFrom, dateTo } = rollingWindow(windowDays);
  const entry: AutoSyncLogEntry = { at: new Date().toISOString(), dateFrom, dateTo, meta: [], google: [] };

  try {
    for (const accountId of getMetaAccounts()) {
      try {
        await syncMetaAccount(accountId, dateFrom, dateTo);
        entry.meta.push({ accountId, ok: true });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        entry.meta.push({ accountId, ok: false, error });
        console.error(`[auto-sync] Meta ${accountId} fallo:`, error);
      }
    }

    if (googleAdsConnected()) {
      for (const accountId of getGoogleAccounts()) {
        try {
          await syncGoogleAccount(accountId, dateFrom, dateTo);
          entry.google.push({ accountId, ok: true });
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          entry.google.push({ accountId, ok: false, error });
          console.error(`[auto-sync] Google ${accountId} fallo:`, error);
        }
      }
    }
  } finally {
    running = false;
  }

  lastRun = entry;
  console.log(
    `[auto-sync] ${entry.at} listo (${dateFrom} a ${dateTo}) - Meta: ${entry.meta.filter((r) => r.ok).length}/${entry.meta.length} - Google: ${entry.google.filter((r) => r.ok).length}/${entry.google.length}`
  );
  return entry;
}

declare global {
  // eslint-disable-next-line no-var
  var __autoSyncTimer: ReturnType<typeof setInterval> | undefined;
}

/**
 * Arranca el sync automático en segundo plano (una vez por proceso). Se
 * invoca desde instrumentation.ts al iniciar el server, tanto en `next dev`
 * como en `next start`/producción. Sin esto, los datos solo se refrescan
 * cuando alguien le da click a "Actualizar".
 */
export function startAutoSync() {
  if (globalThis.__autoSyncTimer) return; // ya esta corriendo (evita duplicar en hot-reload)
  if (process.env.AUTO_SYNC_DISABLED === "1") return;
  if (getMetaAccounts().length === 0 && getGoogleAccounts().length === 0) return;

  const minutes = Number(process.env.AUTO_SYNC_INTERVAL_MINUTES) || DEFAULT_INTERVAL_MINUTES;
  const windowDays = Number(process.env.AUTO_SYNC_WINDOW_DAYS) || DEFAULT_WINDOW_DAYS;
  console.log(`[auto-sync] activado - cada ${minutes} min, ventana de ${windowDays} dias`);

  setTimeout(() => {
    runAutoSyncOnce().catch((err) => console.error("[auto-sync] error inicial:", err));
  }, KICKOFF_DELAY_MS);

  globalThis.__autoSyncTimer = setInterval(() => {
    runAutoSyncOnce().catch((err) => console.error("[auto-sync] error:", err));
  }, minutes * 60 * 1000);
}
