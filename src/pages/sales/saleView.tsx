// ── Shared sale/credit presentation helpers ───────────────────────────────────
// Formatting and small building blocks shared by the Sales and Credit pages, so
// a balance, a payment method or an error message is rendered identically
// wherever it appears. Everything here is pure presentation over values the
// backend returned — no figures are derived that the API did not supply.

import type { ReactNode } from "react";
import Button from "../../components/ui/Button";
import { fmtMoney, fmtNumber } from "../../utils/format";
import type { SaleDto, SaleItemDto } from "../../features/sales/salesApi";

// ── Payment methods ──────────────────────────────────────────────────────────

/**
 * Display labels for the payment records the backend returns.
 * There is intentionally NO "Credit" entry — an unpaid balance is not a payment
 * method. Unknown values fall back to the raw backend string rather than being
 * dropped or renamed.
 */
const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  MOBILE_TRANSFER: "Mobile Transfer",
  DIGITAL_TRANSFER: "Digital Transfer",
  CHECK: "Cheque",
};

export function paymentMethodLabel(method: string): string {
  return PAYMENT_LABELS[method] ?? method;
}

/**
 * POST /pos/sales/{id}/payments accepts exactly these three methods. CARD is
 * valid on a sale's payments (taken at checkout) but is NOT accepted when
 * collecting a balance, so it is deliberately absent from this list.
 */
export const RECORD_METHODS: { value: string; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "MOBILE_TRANSFER", label: "Mobile Transfer" },
  { value: "CHECK", label: "Cheque" },
];

// ── Date bounds ──────────────────────────────────────────────────────────────
// The API declares dateFrom / dateTo as `date-time`, so a bare YYYY-MM-DD upper
// bound would truncate the final day. Each bound expands to the full local day.

export function dayStartIso(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

export function dayEndIso(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

// ── Domain helpers ───────────────────────────────────────────────────────────

/**
 * Outstanding balance of a sale. Only a COMPLETED sale can carry one: a DRAFT
 * sale was never settled and a CANCELLED sale is void, so neither has money owed.
 * Clamped at zero so an overpayment (which the backend records as
 * `changeAmount`) never renders as a negative balance.
 */
export function outstandingFor(sale: Pick<SaleDto, "status" | "totalAmount" | "paidAmount">): number {
  if (sale.status !== "COMPLETED") return 0;
  return Math.max(0, (sale.totalAmount ?? 0) - (sale.paidAmount ?? 0));
}

/** Compact method summary for a table cell, e.g. "Cash", "Cash + Mobile Transfer". */
export function paymentSummary(
  payments: readonly { method: string }[] | null | undefined,
): string {
  const methods = Array.from(
    new Set((payments ?? []).map((p) => paymentMethodLabel(p.method)).filter(Boolean)),
  );
  if (methods.length === 0) return "—";
  if (methods.length <= 2) return methods.join(" + ");
  return `${methods.slice(0, 2).join(" + ")} +${methods.length - 2}`;
}

/**
 * The moment a sale took effect. Completed and cancelled sales carry their own
 * timestamps; a DRAFT sale falls back to when it was created. Nothing is invented.
 */
export function saleMoment(sale: SaleDto): { value: string | null; label: string } {
  if (sale.status === "COMPLETED" && sale.completedAt) {
    return { value: sale.completedAt, label: "Completed" };
  }
  if (sale.status === "CANCELLED" && sale.cancelledAt) {
    return { value: sale.cancelledAt, label: "Cancelled" };
  }
  return { value: sale.createdAt, label: "Created" };
}

export function discountLabel(item: SaleItemDto): string {
  if (!item.discountType || item.discountValue == null) return "—";
  const value =
    item.discountType === "PERCENTAGE"
      ? `${item.discountValue}%`
      : fmtMoney(item.discountValue);
  return `${value} (${fmtMoney(item.discountAmount)})`;
}

/**
 * Surfaces the backend's own message. `SalesApiError` / `CreditApiError` both
 * extend Error and populate `message` from `error.message`, so a 409 or 422 is
 * shown as the backend worded it instead of being replaced by generic text.
 */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

// ── Small shared pieces ──────────────────────────────────────────────────────

const STATUS_TONE: Record<string, string> = {
  COMPLETED: "bg-green-50 text-green-700",
  DRAFT: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-50 text-red-700",
};

/** Sale status badge. Shows the raw backend value — no invented states. */
export function SaleStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_TONE[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}

/** "Settled" vs "Outstanding" — a business state derived from total vs paid. */
export function BalancePill({ sale }: { sale: SaleDto }) {
  if (sale.status !== "COMPLETED") {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
        Not settled
      </span>
    );
  }
  const outstanding = outstandingFor(sale);
  if (outstanding <= 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
        Fully paid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      Outstanding {fmtMoney(outstanding)}
    </span>
  );
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
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4F6B4A]">
          {title}
        </h3>
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

export function SummaryRow({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
  tone?: "outstanding" | "muted" | "success";
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-2.5">
      <span className={`text-sm ${emphasis ? "font-bold text-[#333333]" : "text-[#666666]"}`}>
        {label}
      </span>
      <span
        className={`tabular-nums ${
          emphasis ? "text-base font-bold" : "text-sm font-semibold"
        } ${
          tone === "outstanding"
            ? "text-amber-700"
            : tone === "muted"
              ? "text-[#999999]"
              : tone === "success"
                ? "text-green-700"
                : "text-[#333333]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * A recoverable failure. Rendered inside its own card/panel so one failed
 * request never blanks the page around it.
 */
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-6 text-center">
      <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md">
        {message}
      </p>
      {onRetry && <Button onClick={onRetry}>Retry</Button>}
    </div>
  );
}

/** Table-shaped loading placeholder, used instead of a spinner. */
export function SkeletonRows({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="divide-y divide-[#E6ECE2]" aria-hidden>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-4">
          {Array.from({ length: cols }, (_, c) => (
            <div
              key={c}
              className={`h-3 rounded bg-[#E6ECE2]/${c === 0 ? "80" : "50"} animate-pulse ${
                c === 0 ? "w-32" : "w-20"
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A run of `count` followed by a noun — "3 items", "1 payment". */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${fmtNumber(count)} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}