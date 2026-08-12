export interface DateRange {
  dateFrom: string;
  dateTo: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getPeriodLengthDays(dateFrom: string, dateTo: string): number {
  const from = parseIsoDate(dateFrom).getTime();
  const to = parseIsoDate(dateTo).getTime();
  return Math.max(1, Math.floor((to - from) / DAY_MS) + 1);
}

export function getPreviousPeriod(dateFrom: string, dateTo: string): DateRange {
  const days = getPeriodLengthDays(dateFrom, dateTo);
  const previousTo = parseIsoDate(dateFrom);
  previousTo.setUTCDate(previousTo.getUTCDate() - 1);

  const previousFrom = new Date(previousTo);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - days + 1);

  return {
    dateFrom: formatIsoDate(previousFrom),
    dateTo: formatIsoDate(previousTo),
  };
}

export function addDays(date: string, days: number): string {
  const next = parseIsoDate(date);
  next.setUTCDate(next.getUTCDate() + days);
  return formatIsoDate(next);
}

export type ComparePreset = "previous" | "7d" | "30d" | "custom";

/** Ventana de `days` días que termina justo un día antes de `beforeDate`. */
function trailingWindow(beforeDate: string, days: number): DateRange {
  const to = parseIsoDate(beforeDate);
  to.setUTCDate(to.getUTCDate() - 1);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days + 1);
  return { dateFrom: formatIsoDate(from), dateTo: formatIsoDate(to) };
}

/**
 * Resuelve el periodo de comparación según el preset elegido:
 * - "previous": mismo número de días, inmediatamente anterior (default histórico).
 * - "7d" / "30d": ventana fija de 7 o 30 días justo antes de `dateFrom`.
 * - "custom": rango explícito (`custom.dateFrom`/`custom.dateTo`); si falta alguno, cae a "previous".
 */
export function getComparisonPeriod(
  preset: ComparePreset,
  dateFrom: string,
  dateTo: string,
  custom?: { dateFrom?: string; dateTo?: string }
): DateRange {
  if (preset === "custom" && custom?.dateFrom && custom?.dateTo) {
    return custom.dateFrom <= custom.dateTo
      ? { dateFrom: custom.dateFrom, dateTo: custom.dateTo }
      : { dateFrom: custom.dateTo, dateTo: custom.dateFrom };
  }
  if (preset === "7d") return trailingWindow(dateFrom, 7);
  if (preset === "30d") return trailingWindow(dateFrom, 30);
  return getPreviousPeriod(dateFrom, dateTo);
}
