export interface Filters {
  accountId: string;
  dateFrom: string;
  dateTo: string;
}

export type SearchParams = Record<string, string | string[] | undefined>;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Resuelve los filtros globales desde los URL params (?accountId=&dateFrom=&dateTo=).
 * Por defecto: primera cuenta configurada y últimos 30 días.
 */
export function resolveFilters(sp: SearchParams, accounts: string[]): Filters {
  const get = (k: string): string | undefined => {
    const v = sp[k];
    return typeof v === "string" && v.trim() !== "" ? v : undefined;
  };
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  const dateFrom = get("dateFrom") ?? iso(from);
  const dateTo = get("dateTo") ?? iso(today);
  const ordered =
    dateFrom <= dateTo
      ? { dateFrom, dateTo }
      : { dateFrom: dateTo, dateTo: dateFrom };

  return {
    accountId: get("accountId") ?? accounts[0] ?? "",
    ...ordered,
  };
}
