// ── Return sale screen ───────────────────────────────────────────────────────
// The cashier-facing flow for turning part (or all) of a completed sale back:
//
//   GET  /pos/sales/{id}/returns  → what is still returnable, at the ORIGINAL
//                                   sale's prices, per batch
//   POST /pos/sales/{id}/returns  → actually process it
//
// Three rules from the backend shape this screen:
//
//  • The refund is NEVER computed here. The API publishes `netUnitPrice`,
//    `billDiscountShare`, `amountRefunded` and `amountReturnable`, and the create
//    body has no money field at all — the backend derives every refund from the
//    original sale inside its own transaction. This screen shows the backend's
//    figures and states plainly that the total is issued on completion, rather
//    than inventing a "refundable total" by multiplying a current product price.
//  • There is NO location picker. Stock is always restored to the ORIGINAL sale
//    location, so that location is shown read-only.
//  • A sale item can only be returned up to `quantityReturnable`. The stepper is
//    hard-clamped to it, and the backend re-validates every quantity anyway.
//
// The whole return happens in ONE backend transaction — return, items, refund and
// inventory movement commit together or not at all. Nothing is applied to stock
// or money in the browser.

import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import Select from "../../components/ui/Select";
import NarcoticBadge from "../../components/ui/NarcoticBadge";
import { fmtDate, fmtMoney, fmtNumber } from "../../utils/format";
import {
  REFUND_METHOD_OPTIONS,
  ReturnsApiError,
  createSaleReturn,
  getSaleReturnInfo,
  newReturnIdempotencyKey,
  type RefundMethod,
  type SaleReturn,
  type SaleReturnInfo,
} from "../../features/sales/returnsApi";
import {
  InlineError,
  InfoRow,
  Panel,
  SaleStatusBadge,
  SummaryRow,
  errorMessage,
  paymentMethodLabel,
  plural,
} from "./saleView";
import { BatchTable, RestockBadge, unitLabel } from "./returnsView";

interface Props {
  saleId: string;
  /**
   * The sale already loaded by GET /pos/sales/{id}, when the screen is opened
   * from the sale detail. `SaleReturnInfo.sale` publishes no cashier, so the
   * name is passed in from a real backend response rather than invented here.
   */
  cashierName?: string | null;
  onClose: () => void;
  /** "← Back to Sale" — reopen the originating sale detail. */
  onBackToSale: () => void;
  /** "View Return" — open the created return's detail view. */
  onViewReturn: (returnId: string) => void;
  /** Called after a return is created so the host can refetch its data. */
  onChanged: () => void;
}

/** One line's cashier selection. */
interface LineSelection {
  quantity: number;
  restock: boolean;
  reason: string;
}

/**
 * Restock pre-selection.
 *
 * The task's guidance is "Yes" and that is what a new line starts on, but note
 * honestly: this repository contains no pre-existing restock convention (there
 * was no restock code anywhere before this feature), so this is a UI
 * pre-selection and not a business rule. Nothing is committed until the backend
 * receives the flag, and the backend recomputes the inventory movement itself.
 */
const DEFAULT_RESTOCK = true;

/** Stable no-op so the modal can refuse to close without re-creating a handler. */
function noop() {}

export default function ReturnSaleModal({
  saleId,
  cashierName,
  onClose,
  onBackToSale,
  onViewReturn,
  onChanged,
}: Props) {
  const [info, setInfo] = useState<SaleReturnInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [selections, setSelections] = useState<Record<string, LineSelection>>({});
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("CASH");
  const [refundReference, setRefundReference] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<SaleReturn | null>(null);

  /**
   * The backend-supported idempotency key, minted ONCE for this mount and then
   * reused for every retry of this submission. A double click or a network retry
   * therefore replays the same key and the backend returns the original return
   * instead of issuing a second refund. It is deliberately NOT regenerated after
   * a failure — a retry is the same logical action. A genuinely new return gets
   * a new screen (and so a new key).
   */
  const [idempotencyKey] = useState(newReturnIdempotencyKey);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const loaded = await getSaleReturnInfo(saleId);
      setInfo(loaded);
      // Re-clamp every selection against the ceiling the server just reported.
      // A concurrent return may have consumed some of this sale's returnable
      // quantity, and a stale selection must never be resubmitted as-is — the
      // stepper clamps on change, but only this can catch a changed ceiling.
      setSelections((prev) => {
        const next: Record<string, LineSelection> = {};
        for (const item of loaded.items ?? []) {
          const max = item.quantityReturnable ?? 0;
          const current = prev[item.saleItemId];
          if (!current || max <= 0) continue; // fully returned since — drop the line
          const quantity = Math.min(current.quantity, max);
          if (quantity <= 0) continue; // nothing selected — keep the sheet tidy
          next[item.saleItemId] = { ...current, quantity };
        }
        return next;
      });
    } catch (e) {
      setError(errorMessage(e, "Unable to load return information for this sale."));
      setNotFound(e instanceof ReturnsApiError && e.status === 404);
    } finally {
      setLoading(false);
    }
  }, [saleId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The backend's own answer is the only authority on returnability, and it is
  // `true` only for a COMPLETED sale. Status is checked too so a sale whose
  // status changed since the last load cannot be presented as returnable.
  const sale = info?.sale ?? null;
  const returnable = Boolean(sale && sale.returnable && sale.status === "COMPLETED");

  const items = useMemo(() => info?.items ?? [], [info]);
  const openItems = useMemo(
    () => items.filter((i) => (i.quantityReturnable ?? 0) > 0),
    [items],
  );
  const closedItems = useMemo(
    () => items.filter((i) => (i.quantityReturnable ?? 0) <= 0),
    [items],
  );

  // `quantityReturnable` is the ceiling for every line, so a stale selection can
  // never exceed it after a reload either.
  const ceiling = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of openItems) map.set(item.saleItemId, item.quantityReturnable ?? 0);
    return map;
  }, [openItems]);

  function select(saleItemId: string, patch: Partial<LineSelection>) {
    setSelections((prev) => {
      const current = prev[saleItemId] ?? {
        quantity: 0,
        restock: DEFAULT_RESTOCK,
        reason: "",
      };
      return { ...prev, [saleItemId]: { ...current, ...patch } };
    });
  }

  function step(saleItemId: string, delta: number) {
    const max = ceiling.get(saleItemId) ?? 0;
    const current = selections[saleItemId]?.quantity ?? 0;
    select(saleItemId, { quantity: Math.min(max, Math.max(0, current + delta)) });
  }

  /** The lines that will actually be sent — quantity > 0 only. */
  const chosen = useMemo(
    () =>
      openItems
        .map((item) => ({ item, selection: selections[item.saleItemId] }))
        .filter(
          (row): row is { item: (typeof openItems)[number]; selection: LineSelection } =>
            (row.selection?.quantity ?? 0) > 0,
        ),
    [openItems, selections],
  );

  const chosenUnits = chosen.reduce((sum, row) => sum + row.selection.quantity, 0);
  /** Lines refunded without going back to the shelf and with no reason given. */
  const unReasonedDiscards = chosen.filter(
    (row) => !row.selection.restock && !row.selection.reason.trim(),
  );

  const canSubmit = chosen.length > 0 && !submitting && returnable;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const createdReturn = await createSaleReturn(saleId, {
        items: chosen.map(({ item, selection }) => ({
          saleItemId: item.saleItemId,
          quantity: selection.quantity,
          restock: selection.restock,
          ...(selection.reason.trim() ? { reason: selection.reason.trim() } : {}),
        })),
        refundMethod,
        ...(refundReference.trim() ? { refundReference: refundReference.trim() } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        idempotencyKey,
      });
      // The backend response is the only record of what happened: no local
      // return row is inserted and no stock figure is touched here.
      setCreated(createdReturn);
      onChanged();
    } catch (e) {
      // 409 (sale no longer returnable / concurrent conflict) — show the
      // backend's message and refetch eligibility so the numbers on screen are
      // current before another attempt is allowed.
      if (e instanceof ReturnsApiError && e.status === 409) await load();
      setSubmitError(errorMessage(e, "The return could not be processed."));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Completion state ───────────────────────────────────────────────────────
  if (created) {
    return (
      <Modal
        open
        size="xl"
        onClose={onClose}
        title={`Return Completed · ${created.returnNumber}`}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50 px-4 py-3">
            <span
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-white"
              aria-hidden
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.704 5.29a.75.75 0 01.006 1.06l-7.5 7.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.97 2.97 6.97-6.97a.75.75 0 011.06-.006z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <p className="text-sm font-semibold text-green-800">
              Return successfully processed
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <InfoRow label="Return Number" value={created.returnNumber} />
            <InfoRow label="Original Sale" value={created.sale?.saleNumber ?? "—"} />
            <InfoRow label="Refund Method" value={paymentMethodLabel(created.refundMethod)} />
            <InfoRow label="Inventory" value={<RestockBadge items={created.items} />} />
          </div>

          <Panel
            title={`Returned Items (${created.items?.length ?? 0})`}
            action={
              <span className="text-xs text-[#666666]">
                Refund{" "}
                <span className="font-bold text-[#333333]">{fmtMoney(created.refundAmount)}</span>
              </span>
            }
          >
            {(created.items?.length ?? 0) === 0 ? (
              <p className="px-5 py-4 text-sm text-[#666666]">
                The response contained no item lines for this return.
              </p>
            ) : (
              <ul className="divide-y divide-[#E6ECE2]">
                {created.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#333333]">
                        {item.product?.name ?? "—"}
                      </p>
                      <p className="text-[11px] text-[#999999]">
                        {unitLabel(item.unit)} × {fmtNumber(item.quantity)}
                        {item.reason ? ` · ${item.reason}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <RestockBadge items={[item]} />
                      <span className="text-sm font-bold tabular-nums text-[#333333]">
                        {fmtMoney(item.refundAmount)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="rounded-xl border border-[#E6ECE2] bg-[#F5F8F2] p-4">
            <div className="divide-y divide-[#E6ECE2]">
              <SummaryRow label="Refund Amount" value={fmtMoney(created.refundAmount)} emphasis />
              <SummaryRow
                label="Refund Reference"
                value={created.refundReference || "—"}
                tone="muted"
              />
              <SummaryRow label="Reason" value={created.reason || "—"} tone="muted" />
              <SummaryRow label="Processed By" value={created.createdBy?.name ?? "—"} />
              <SummaryRow
                label="Processed At"
                value={created.createdAt ? fmtDate(created.createdAt) : "—"}
                tone="muted"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button onClick={() => onViewReturn(created.id)}>View Return</Button>
            <Button variant="secondary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // ── Loading / failure / not-returnable ────────────────────────────────────
  return (
    <Modal
      open
      size="2xl"
      /* Dismissing mid-submission would unmount the component holding the
         idempotency key, so a re-opened screen would mint a fresh key for what is
         still the same user action. The overlay therefore stays put until the
         backend answers — the button already reads "Processing return…". */
      onClose={submitting ? noop : onClose}
      title={sale ? `Return Sale · ${sale.saleNumber}` : "Return Sale"}
    >
      {loading && !info ? (
        <div className="flex flex-col gap-4" aria-hidden>
          <div className="h-8 w-56 rounded bg-[#E6ECE2]/70 animate-pulse" />
          <div className="h-24 rounded-xl bg-[#E6ECE2]/50 animate-pulse" />
          <div className="h-40 rounded-xl bg-[#E6ECE2]/50 animate-pulse" />
          <div className="h-32 rounded-xl bg-[#E6ECE2]/50 animate-pulse" />
        </div>
      ) : notFound ? (
        <EmptyState
          title="Sale not found"
          description={error ?? "This sale does not exist or was never created."}
        />
      ) : error && !info ? (
        <InlineError message={error} onRetry={load} />
      ) : !info || !sale ? (
        <EmptyState title="Return information unavailable" description={error ?? undefined} />
      ) : (
        <div className="flex flex-col gap-4">
          {/* ── Header ── */}
          <div className="rounded-xl border border-[#E6ECE2] bg-[#E6ECE2]/30 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-lg font-bold text-[#333333]">{sale.saleNumber}</span>
              <SaleStatusBadge status={sale.status} />
              {sale.completedAt && (
                <span className="text-xs text-[#666666]">{fmtDate(sale.completedAt)}</span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {/* Read-only: the backend always restores stock here. */}
              <InfoRow
                label="Original Sale Location"
                value={sale.location?.name ?? "—"}
              />
              {cashierName && <InfoRow label="Cashier" value={cashierName} />}
              <InfoRow label="Original Total" value={fmtMoney(sale.totalAmount)} />
              <InfoRow label="Already Refunded" value={fmtMoney(info.totalRefunded)} />
            </div>
          </div>

          {/* Previous returns against this sale, exactly as the API listed them.
              Shown regardless of returnability — it is the history that explains
              why a line may have nothing left to return. */}
          {(info.returns?.length ?? 0) > 0 && (
            <Panel title={`Previous Returns (${info.returns.length})`}>
              <ul className="divide-y divide-[#E6ECE2]">
                {info.returns.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#333333]">{r.returnNumber}</p>
                      <p className="text-[11px] text-[#999999]">
                        {fmtDate(r.createdAt)} · {paymentMethodLabel(r.refundMethod)}
                        {r.createdBy?.name ? ` · ${r.createdBy.name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <RestockBadge items={r.items} />
                      <span className="text-sm font-bold tabular-nums text-[#333333]">
                        {fmtMoney(r.refundAmount)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {!returnable ? (
            <EmptyState
              title="This sale cannot be returned"
              description={`Customer returns require a COMPLETED sale. This sale is ${sale.status}.`}
              action={
                <Button variant="secondary" onClick={onBackToSale}>
                  Back to Sale
                </Button>
              }
            />
          ) : openItems.length === 0 ? (
            <>
              <EmptyState
                title="No items are currently returnable from this sale"
                description="All sold quantities may already have been returned."
                action={
                  <Button variant="secondary" onClick={onBackToSale}>
                    Back to Sale
                  </Button>
                }
              />
              {closedItems.length > 0 && (
                <p className="text-xs text-[#999999] text-center">
                  {plural(closedItems.length, "line")} on this sale{" "}
                  {closedItems.length === 1 ? "has" : "have"} nothing left to return.
                </p>
              )}
            </>
          ) : (
            <>
              {/* ── Returnable lines ── */}
              <div className="flex flex-col gap-3">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4F6B4A]">
                  Items eligible for return
                </h3>
                {openItems.map((item) => (
                  <ReturnItemCard
                    key={item.saleItemId}
                    item={item}
                    selection={selections[item.saleItemId]}
                    locationName={sale.location?.name ?? null}
                    onStep={(delta) => step(item.saleItemId, delta)}
                    onRestock={(value) => select(item.saleItemId, { restock: value })}
                    onReason={(value) => select(item.saleItemId, { reason: value })}
                    disabled={submitting}
                  />
                ))}
                {closedItems.length > 0 && (
                  <p className="text-xs text-[#999999]">
                    {plural(closedItems.length, "further line")} fully returned and hidden.
                  </p>
                )}
              </div>

              {/* ── Summary + actions ── */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3 flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-[#333333]">
                      Reason <span className="text-[#999999] font-normal">(optional)</span>
                    </span>
                    <input
                      type="text"
                      value={reason}
                      disabled={submitting}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Customer return"
                      className="rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-[#333333]">
                      Notes <span className="text-[#999999] font-normal">(optional)</span>
                    </span>
                    <textarea
                      rows={2}
                      value={notes}
                      disabled={submitting}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Anything worth recording about this return"
                      className="rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
                    />
                  </label>
                </div>

                <div className="lg:col-span-2">
                  <div className="rounded-xl border border-[#B6C8AF] bg-[#F5F8F2] p-4 flex flex-col gap-3 lg:sticky lg:top-0">
                    <h4 className="text-sm font-bold text-[#333333]">Return Summary</h4>
                    <div className="divide-y divide-[#E6ECE2]">
                      <SummaryRow
                        label="Items to return"
                        value={
                          <span title={`${fmtNumber(chosenUnits)} units`}>
                            {plural(chosen.length, "line")} · {fmtNumber(chosenUnits)} units
                          </span>
                        }
                      />
                      <SummaryRow
                        label="Refund Method"
                        value={
                          <Select
                            aria-label="Refund Method"
                            value={refundMethod}
                            disabled={submitting}
                            onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
                            className="!py-1.5 !text-xs"
                          >
                            {REFUND_METHOD_OPTIONS.map((m) => (
                              <option key={m} value={m}>
                                {paymentMethodLabel(m)}
                              </option>
                            ))}
                          </Select>
                        }
                      />
                      <SummaryRow
                        label="Refund Reference"
                        value={
                          <input
                            type="text"
                            value={refundReference}
                            disabled={submitting}
                            onChange={(e) => setRefundReference(e.target.value)}
                            placeholder="Cheque or transfer ref"
                            className="w-40 rounded-lg border border-[#C6D4BF] bg-white px-2.5 py-1.5 text-xs text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
                          />
                        }
                        tone="muted"
                      />
                    </div>

                    {/* The refund total is deliberately absent. It is derived by
                        the backend from the original sale; multiplying anything
                        here would produce a figure the API never issued. */}
                    <p className="text-[11px] leading-relaxed text-[#666666]">
                      The refund amount is calculated by the server from each line&apos;s
                      original price and its share of the bill discount, then recorded
                      when the return is processed.
                    </p>

                    {unReasonedDiscards.length > 0 && (
                      <p className="text-[11px] text-amber-700">
                        {plural(unReasonedDiscards.length, "line")} will not be restocked and
                        {unReasonedDiscards.length === 1 ? " has" : " have"} no reason yet. The
                        reason is recorded with the line.
                      </p>
                    )}

                    {submitError && (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        {submitError}
                      </p>
                    )}

                    <div className="flex justify-end gap-3">
                      <Button
                        variant="secondary"
                        onClick={onBackToSale}
                        disabled={submitting}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleSubmit} disabled={!canSubmit} loading={submitting}>
                        {submitting ? "Processing return…" : "Process Return"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── One returnable line ──────────────────────────────────────────────────────

function ReturnItemCard({
  item,
  selection,
  locationName,
  onStep,
  onRestock,
  onReason,
  disabled,
}: {
  item: SaleReturnInfo["items"][number];
  selection: LineSelection | undefined;
  /** The ORIGINAL sale location — the only place stock can go back to. */
  locationName: string | null;
  onStep: (delta: number) => void;
  onRestock: (value: boolean) => void;
  onReason: (value: string) => void;
  disabled: boolean;
}) {
  const quantity = selection?.quantity ?? 0;
  const restock = selection?.restock ?? DEFAULT_RESTOCK;
  const reason = selection?.reason ?? "";
  const max = item.quantityReturnable ?? 0;
  const maxBase = item.baseQuantityReturnable ?? 0;

  return (
    <div
      className={`rounded-xl border bg-white overflow-hidden ${
        quantity > 0 ? "border-[#B6C8AF]" : "border-[#E6ECE2]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-[#E6ECE2]">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#333333]">
            {item.product?.name ?? "—"}
            {item.product?.isNarcotic && <NarcoticBadge />}
          </p>
          <p className="text-[11px] text-[#999999]">
            SKU: {item.product?.sku || "—"} · {unitLabel(item.unit)}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-[#666666]">
            Sold{" "}
            <span className="font-semibold text-[#333333] tabular-nums">
              {fmtNumber(item.quantitySold)}
            </span>
          </span>
          <span className="text-[#666666]">
            Already returned{" "}
            <span className="font-semibold text-[#333333] tabular-nums">
              {fmtNumber(item.quantityReturned)}
            </span>
          </span>
          <span className="text-[#666666]">
            Returnable{" "}
            <span className="font-bold text-[#4F6B4A] tabular-nums">{fmtNumber(max)}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 py-3 sm:grid-cols-2">
        {/* Every money figure below comes from the original sale. The current
            ProductUnit price is never consulted. */}
        <div className="divide-y divide-[#E6ECE2]">
          <div className="flex justify-between gap-3 py-1.5">
            <span className="text-xs text-[#666666]">Original price</span>
            <span className="text-xs font-semibold tabular-nums text-[#333333]">
              {fmtMoney(item.originalUnitPrice)}
            </span>
          </div>
          <div className="flex justify-between gap-3 py-1.5">
            <span className="text-xs text-[#666666]">Actual sale price</span>
            <span className="text-xs font-semibold tabular-nums text-[#333333]">
              {fmtMoney(item.actualUnitPrice)}
            </span>
          </div>
          <div className="flex justify-between gap-3 py-1.5">
            <span className="text-xs text-[#666666]">Bill discount share</span>
            <span className="text-xs font-semibold tabular-nums text-[#333333]">
              {fmtMoney(item.billDiscountShare)}
            </span>
          </div>
          <div className="flex justify-between gap-3 py-1.5">
            <span className="text-xs text-[#666666]">Net unit price</span>
            <span className="text-xs font-semibold tabular-nums text-[#333333]">
              {fmtMoney(item.netUnitPrice)}
            </span>
          </div>
          <div className="flex justify-between gap-3 py-1.5">
            <span className="text-xs text-[#666666]">Already refunded</span>
            <span className="text-xs font-semibold tabular-nums text-[#333333]">
              {fmtMoney(item.amountRefunded)}
            </span>
          </div>
          <div className="flex justify-between gap-3 py-1.5">
            <span className="text-xs text-[#666666]">
              Refundable
              <span className="block text-[10px] text-[#999999]">
                For all {fmtNumber(max)} remaining {max === 1 ? "unit" : "units"}
              </span>
            </span>
            <span className="text-xs font-bold tabular-nums text-[#4F6B4A]">
              {fmtMoney(item.amountReturnable)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-[#333333]">Return quantity</span>
            <div className="flex items-center gap-1.5">
              <StepButton
                onClick={() => onStep(-1)}
                disabled={disabled || quantity <= 0}
                label={`Return one fewer ${item.product?.name ?? "unit"}`}
              >
                −
              </StepButton>
              <span
                className="w-12 text-center text-sm font-bold tabular-nums text-[#333333]"
                title={`Maximum ${fmtNumber(max)}`}
              >
                {fmtNumber(quantity)}
              </span>
              <StepButton
                onClick={() => onStep(1)}
                disabled={disabled || quantity >= max}
                label={`Return one more ${item.product?.name ?? "unit"}`}
              >
                +
              </StepButton>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#333333]">Restock inventory</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm text-[#333333]">
                <input
                  type="radio"
                  name={`restock-${item.saleItemId}`}
                  checked={restock}
                  disabled={disabled}
                  onChange={() => onRestock(true)}
                  className="accent-[#4F6B4A]"
                />
                Yes
              </label>
              <label className="flex items-center gap-1.5 text-sm text-[#333333]">
                <input
                  type="radio"
                  name={`restock-${item.saleItemId}`}
                  checked={!restock}
                  disabled={disabled}
                  onChange={() => onRestock(false)}
                  className="accent-[#4F6B4A]"
                />
                No
              </label>
            </div>
            <p className="text-[11px] text-[#999999]">
              {restock
                ? locationName
                  ? `Returned stock goes back to ${locationName}.`
                  : "Returned stock goes back to the original sale location."
                : "Refunded without going back to stock."}
            </p>
          </div>

          {!restock && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#333333]">
                Reason{" "}
                <span className="text-[#999999] font-normal">
                  (recorded with this line)
                </span>
              </span>
              <input
                type="text"
                value={reason}
                disabled={disabled}
                onChange={(e) => onReason(e.target.value)}
                placeholder="e.g. Opened package"
                className="rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
              />
            </label>
          )}

          {maxBase > 0 && max !== maxBase && (
            <p className="text-[11px] text-[#999999]">
              Equivalent to {fmtNumber(maxBase)} base {maxBase === 1 ? "unit" : "units"}.
            </p>
          )}
        </div>
      </div>

      {(item.batchAllocations?.length ?? 0) > 0 && (
        <div className="border-t border-[#E6ECE2]">
          <BatchTable allocations={item.batchAllocations} />
        </div>
      )}
    </div>
  );
}

function StepButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C6D4BF] bg-white text-base font-bold text-[#333333] hover:bg-[#E6ECE2] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
