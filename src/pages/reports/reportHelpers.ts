export function fmtMoney(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? Number(n) : n;
  if (num == null || isNaN(num)) return "—";
  return `${num.toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

export function fmtPercent(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? Number(n) : n;
  if (num == null || isNaN(num)) return "—";
  return `${num.toFixed(1)}%`;
}

export function fmtNumber(n: number | string | null | undefined): string {
  const num = typeof n === "string" ? Number(n) : n;
  if (num == null || isNaN(num)) return "—";
  return num.toLocaleString("en-ET");
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Default report window: first day of the current month through today. */
export function defaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
    to: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  };
}