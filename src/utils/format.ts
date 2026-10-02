export function fmtMoney(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return `${n.toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

export function fmtNumber(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-ET");
}

/**
 * A percentage the backend already supplied. No rounding is applied to the
 * source value beyond display formatting, and a non-finite value (the backend
 * documents it guards against NaN/Infinity) renders as "—" rather than as 0.
 */
export function fmtPercent(n: number | null | undefined): string {
  if (n == null || isNaN(n) || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

/**
 * "Showing 21-40 of 147 products" for a server-paginated list.
 *
 * Deliberately built from `page` / `limit` / `total` — never from the length of
 * the rows currently on screen, which only describes one page. `to` is capped at
 * `total` so a short final page reads "141-147", not "141-160".
 */
export function rangeLabel(
  page: number,
  limit: number,
  total: number,
  noun: string,
): string {
  if (total === 0 || limit === 0) return "No records";
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return `Showing ${from.toLocaleString("en-ET")}–${to.toLocaleString(
    "en-ET",
  )} of ${total.toLocaleString("en-ET")} ${noun}`;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "Date not set";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "Date not set";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Compact human-readable relative time, e.g. "5 minutes ago", "Yesterday". */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.round(hr / 24);
  if (days < 2) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}