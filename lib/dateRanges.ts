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
