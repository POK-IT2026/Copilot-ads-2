export function fmtInt(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

export function fmtMoney(n: number | null | undefined): string {
  return (
    "$" +
    (n ?? 0).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function fmtMoneyCompact(n: number | null | undefined): string {
  return (
    "$" +
    new Intl.NumberFormat("es-MX", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n ?? 0)
  );
}

export function fmtPercent(n: number | null | undefined): string {
  return (
    (n ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 2 }) + "%"
  );
}

export function fmtDecimal(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtCompact(n: number | null | undefined): string {
  return new Intl.NumberFormat("es-MX", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n ?? 0);
}
