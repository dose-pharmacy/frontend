// ── Finance · Overview comparison bars ───────────────────────────────────────
// Three small, hand-built bars that make a RELATIONSHIP between backend figures
// visible. Recharts is deliberately not used here: these are single stacked
// tracks with no axes, and a charting library would add a dependency-sized way to
// draw a div.
//
// Every number rendered is a backend field passed straight in. Segment widths are
// proportions of the largest supplied figure, which is chart geometry — no
// financial value is derived, substituted or recomputed.

import { EM_DASH, MoneyValue } from "./primitives";
import { SERIES, TONE_TEXT, TEXT } from "./tokens";

function num(v: number | undefined | null): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** One legend row: swatch, name, value, and its share of the track. */
function BarRow({
  color,
  label,
  value,
  pct,
  valueNode,
}: {
  color: string;
  label: string;
  value: number | undefined;
  pct: number;
  valueNode?: React.ReactNode;
}) {
  const missing = typeof value !== "number" || !Number.isFinite(value);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary min-w-0">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} aria-hidden />
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 whitespace-nowrap">
          {valueNode ?? <MoneyValue value={value} size="sm" />}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }}
        />
      </div>
      {missing && <span className={TEXT.meta}>{EM_DASH} — not reported</span>}
    </div>
  );
}

/**
 * Today's sales as a stacked track: discounts + returns + net, over gross.
 *
 * Each segment is a field the dashboard endpoint supplies. The track is scaled by
 * `grossSales` because that is the natural denominator for "share of gross"; the
 * three segments are the backend's own `discounts`, `customerReturns` and
 * `netSalesAfterReturns`, not residuals computed to force the track to close.
 */
export function SalesWaterfallBar({
  grossSales,
  discounts,
  customerReturns,
  netSalesAfterReturns,
}: {
  grossSales?: number;
  discounts?: number;
  customerReturns?: number;
  netSalesAfterReturns?: number;
}) {
  const gross = num(grossSales);
  const scale = gross > 0 ? gross : Math.max(num(discounts), num(customerReturns), num(netSalesAfterReturns), 1);
  const pct = (v: number | undefined) => (scale > 0 ? (num(v) / scale) * 100 : 0);

  return (
    <div className="flex flex-col gap-3.5">
      <div
        className="flex h-10 sm:h-11 w-full overflow-hidden rounded-xl bg-gray-100 shadow-inner"
        role="img"
        aria-label={`Gross sales ${gross.toLocaleString("en-ET")} ETB, made up of ${num(discounts).toLocaleString("en-ET")} ETB discounts, ${num(customerReturns).toLocaleString("en-ET")} ETB customer returns and ${num(netSalesAfterReturns).toLocaleString("en-ET")} ETB net sales after returns`}
      >
        <div className="h-full transition-all" style={{ width: `${pct(discounts)}%`, backgroundColor: SERIES.discounts }} />
        <div
          className="h-full transition-all"
          style={{ width: `${pct(customerReturns)}%`, backgroundColor: SERIES.customerReturns }}
        />
        <div
          className="h-full transition-all"
          style={{ width: `${pct(netSalesAfterReturns)}%`, backgroundColor: SERIES.netSales }}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <LegendStat color={SERIES.discounts} label="Less discounts" value={discounts} />
        <LegendStat color={SERIES.customerReturns} label="Less returns" value={customerReturns} />
        <LegendStat color={SERIES.netSales} label="Net sales" value={netSalesAfterReturns} />
      </div>
    </div>
  );
}

function LegendStat({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200/90 bg-white px-4 py-3 sm:py-3.5 min-h-[58px] sm:min-h-[64px] shadow-xs">
      <span className="inline-flex items-center gap-2 text-xs font-medium text-text-secondary min-w-0">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <MoneyValue value={value} size="sm" />
    </div>
  );
}

/**
 * Cash in versus cash out.
 *
 * "Net cash movement" IS computed here (`collections - payments`) because the
 * dashboard endpoint does not return it. It is labelled as computed in the
 * browser so it is never mistaken for a server-supplied figure. Supplier returns
 * are shown alongside but deliberately NOT subtracted: the endpoint gives no
 * stated relationship between them and payments, so assuming one would invent a
 * number.
 */
export function CashMovementBar({
  collections,
  payments,
  returns,
}: {
  collections?: number;
  payments?: number;
  returns?: number;
}) {
  const net = num(collections) - num(payments);
  const scale = Math.max(num(collections), num(payments), 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
        <div className="flex-1">
          <BarRow
            color={SERIES.collections}
            label="Customer collections (in)"
            value={collections}
            pct={(num(collections) / scale) * 100}
          />
        </div>
        <div className="flex-1">
          <BarRow
            color={SERIES.supplierPayments}
            label="Supplier payments (out)"
            value={payments}
            pct={(num(payments) / scale) * 100}
          />
        </div>
        <div className="flex-1">
          <BarRow
            color={SERIES.supplierReturns}
            label="Supplier returns"
            value={returns}
            pct={(num(returns) / scale) * 100}
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-canvas px-3 py-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-text-secondary">
            Net cash movement (collections − payments)
          </span>
          <MoneyValue value={net} tone={net < 0 ? "negative" : net > 0 ? "positive" : "neutral"} size="sm" />
        </div>
        <p className={`${TEXT.meta} mt-1`}>
          Computed in the browser from the two figures above — the dashboard endpoint does not
          return this value.
        </p>
      </div>
    </div>
  );
}

/**
 * Payables against receivables as one two-segment track.
 *
 * Both segments are backend balances. The scale is the larger of the two, so the
 * comparison is proportional rather than absolute, and the percentages beside the
 * figures are shares of that larger balance — chart geometry, not an accounting
 * result.
 */
export function OutstandingRatioBar({
  payables,
  receivables,
}: {
  payables?: number;
  receivables?: number;
}) {
  const p = num(payables);
  const r = num(receivables);
  const max = Math.max(p, r);
  const pPct = max > 0 ? (p / max) * 100 : 0;
  const rPct = max > 0 ? (r / max) * 100 : 0;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex h-8 w-full overflow-hidden rounded-lg bg-gray-100"
        role="img"
        aria-label={`Supplier payables ${p.toLocaleString("en-ET")} ETB against customer receivables ${r.toLocaleString("en-ET")} ETB`}
      >
        <div className="h-full" style={{ width: `${pPct}%`, backgroundColor: SERIES.supplierPayments }} />
        <div className="h-full" style={{ width: `${rPct}%`, backgroundColor: SERIES.collections }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SERIES.supplierPayments }} aria-hidden />
            Payables
          </span>
          <span className={`text-xs ${TONE_TEXT.warning}`}>
            {max > 0 ? `${pPct.toFixed(0)}%` : "—"} of the larger balance
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SERIES.collections }} aria-hidden />
            Receivables
          </span>
          <span className={`text-xs ${TONE_TEXT.warning}`}>
            {max > 0 ? `${rPct.toFixed(0)}%` : "—"} of the larger balance
          </span>
        </div>
      </div>
    </div>
  );
}