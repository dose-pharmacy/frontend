// ── Narcotics presentation helpers ────────────────────────────────────────────
// Pure presentation over the values GET /financials/reports/narcotics and
// /financials/reports/narcotics/activity returned. Nothing here invents a
// figure: expiry status is derived from a real `expiryDate` using the
// application's existing inventory windows (see `expiryRules.ts`), and every
// enum keeps the raw backend value available so nothing is hidden behind prose.

import type { ReactNode } from "react";
import { fmtDate, fmtNumber } from "../../utils/format";
import { daysUntilExpiry, EXPIRY_WINDOWS } from "./expiryRules";

// ── Expiry status ────────────────────────────────────────────────────────────

/**
 * The backend's own expiry vocabulary, reused verbatim so no state is invented.
 * `/financials/reports/narcotics` batch objects carry only `expiryDate` (no
 * `status`), so the label is derived from that date using the app's existing
 * windows: <0 expired, <=30 critical, <=90 expiring soon, <=365 warning, else
 * normal. The same boundaries Inventory already applies — see `expiryRules.ts`.
 */
export type ExpiryStatus = "EXPIRED" | "CRITICAL" | "EXPIRING_SOON" | "WARNING" | "NORMAL";

export interface ExpiryVerdict {
  status: ExpiryStatus | null;
  days: number | null;
}

/** `null` when the backend sent no expiry date, or one we could not read. */
export function expiryVerdict(expiryDate: string | null | undefined): ExpiryVerdict {
  if (!expiryDate) return { status: null, days: null };
  const days = daysUntilExpiry(expiryDate);
  if (Number.isNaN(days)) return { status: null, days: null };

  let status: ExpiryStatus;
  if (days < 0) status = "EXPIRED";
  else if (days <= EXPIRY_WINDOWS.CRITICAL) status = "CRITICAL";
  else if (days <= EXPIRY_WINDOWS.EXPIRING_SOON) status = "EXPIRING_SOON";
  else if (days <= EXPIRY_WINDOWS.WARNING) status = "WARNING";
  else status = "NORMAL";

  return { status, days };
}

const EXPIRY_TONE: Record<ExpiryStatus, string> = {
  EXPIRED: "bg-red-100 text-red-700",
  CRITICAL: "bg-orange-100 text-orange-700",
  EXPIRING_SOON: "bg-amber-100 text-amber-800",
  WARNING: "bg-yellow-50 text-yellow-800",
  NORMAL: "bg-green-50 text-green-700",
};

const EXPIRY_LABEL: Record<ExpiryStatus, string> = {
  EXPIRED: "Expired",
  CRITICAL: "Expiring soon",
  EXPIRING_SOON: "Expiring",
  WARNING: "Watch",
  NORMAL: "Normal",
};

/**
 * Expiry badge. `title` carries the raw derived status and the day count so the
 * number is never buried in a tooltip-free label.
 */
export function ExpiryBadge({ expiryDate }: { expiryDate: string | null | undefined }) {
  const { status, days } = expiryVerdict(expiryDate);
  if (!status || days === null) {
    return <span className="text-xs text-[#999999]">—</span>;
  }
  return (
    <span
      title={`${status} · ${days} day${days === 1 ? "" : "s"} remaining`}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
        EXPIRY_TONE[status]
      }`}
    >
      {EXPIRY_LABEL[status]}
    </span>
  );
}

/** "12 Jan 2027" plus a relative day count, matching the Inventory batch pages. */
export function ExpiryCell({ expiryDate }: { expiryDate: string | null | undefined }) {
  const { days } = expiryVerdict(expiryDate);
  if (!expiryDate) return <span className="text-xs text-[#999999]">—</span>;
  return (
    <div className="whitespace-nowrap">
      <div className={days !== null && days < 30 ? "font-semibold text-red-600" : "text-[#333333]"}>
        {fmtDate(expiryDate)}
      </div>
      {days !== null && (
        <div className="text-xs text-[#666666]">
          {days < 0 ? `${Math.abs(days)} days overdue` : `${days} days`}
        </div>
      )}
    </div>
  );
}

// ── Movements ────────────────────────────────────────────────────────────────

/**
 * Readable labels for movement types. This is NOT a whitelist — it only
 * prettifies values already known to the app. `movementLabel` falls back to the
 * raw backend string, so a type the backend adds still renders correctly and is
 * still selectable in the filter (whose options are collected from real
 * responses rather than hardcoded from this map).
 */
const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE: "Purchase",
  OPENING: "Opening stock",
  SALE: "Sale",
  RETURN_IN: "Customer return",
  RETURN_OUT: "Supplier return",
  ADJUSTMENT_IN: "Adjustment in",
  ADJUSTMENT_OUT: "Adjustment out",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
  EXPIRY_DISPOSE: "Expiry dispose",
};

export function movementLabel(movementType: string | null | undefined): string {
  if (!movementType) return "—";
  return MOVEMENT_LABELS[movementType] ?? movementType;
}

/** "IN" adds stock, anything else removes it. The raw value is kept as `title`. */
function isInbound(direction: string | null | undefined): boolean {
  return direction === "IN";
}

export function MovementBadge({
  movementType,
  direction,
}: {
  movementType: string | null | undefined;
  direction: string | null | undefined;
}) {
  const inbound = isInbound(direction);
  return (
    <span
      title={direction ? `${direction} · ${movementType ?? "—"}` : (movementType ?? undefined)}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
        inbound ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
      }`}
    >
      <span aria-hidden>{inbound ? "▲" : "▼"}</span>
      {movementLabel(movementType)}
    </span>
  );
}

// ── Small shared pieces ──────────────────────────────────────────────────────

/** A quantity, or an em dash when the backend omitted it. Never defaulted to 0. */
export function qty(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return fmtNumber(n);
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E6ECE2] bg-white overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-[#E6ECE2] px-5 py-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4F6B4A]">{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#999999]">{label}</p>
      <p className="text-sm text-[#333333] break-words">{value}</p>
    </div>
  );
}

/**
 * Surfaces the backend's own message. `ReportsApiError` extends Error and
 * populates `message` from `error.message`, so a 401/403/404/409/422 is shown as
 * the backend worded it rather than replaced by generic text.
 */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}