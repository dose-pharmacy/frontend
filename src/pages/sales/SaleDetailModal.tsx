// ── Sale detail modal (shared by Sales and Credit) ───────────────────────────
// The full receipt view for one sale: sale information, line items, FEFO batch
// allocations, payment history and the money summary.
//
//   GET  /pos/sales/{id}           → the receipt
//   POST /pos/sales/{id}/payments  → collect an outstanding balance
//   POST /pos/sales/{id}/cancel    → DRAFT sales only
//
// The Credit page reuses this component for its "View Sale" action so there is
// exactly one sale-detail implementation in the app.
//
// A customer return is the one action gated on sale status, and it is offered
// only when the host passes `onReturnSale` (the Sales Transactions tab). The
// button lives here rather than in the host because this component holds the
// loaded sale and is therefore the single place that knows whether the sale is
// COMPLETED — the only status POST /pos/sales/{id}/returns accepts.
//
// Deliberately read-only with respect to stock: FEFO allocation, pricing,
// discounts and stock movement are the backend's job and are never recomputed
// here. A return likewise restores nothing in the browser — the create endpoint
// does it in one transaction.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import Select from "../../components/ui/Select";
import {
  getSale,
  cancelSale,
  recordSalePayment,
  SalesApiError,
  type SaleDto,
  type RecordSalePaymentMethod,
} from "../../features/sales/salesApi";
import { fmtMoney, fmtDate, fmtDateTime } from "../../utils/format";
import {
  BalancePill,
  InlineError,
  InfoRow,
  Panel,
  RECORD_METHODS,
  SaleStatusBadge,
  SummaryRow,
  discountLabel,
  errorMessage,
  paymentMethodLabel,
  saleMoment,
} from "./saleView";

interface Props {
  saleId: string;
  onClose: () => void;
  /** Called after a cancel or a payment so the host page can refetch its list. */
  onChanged: () => void;
  /** Optional extra footer controls supplied by the host page. */
  extraFooterActions?: ReactNode;
  /**
   * When supplied, a "Return Sale" action appears for a COMPLETED sale. The
   * loaded sale is handed back so the host can carry the cashier's name across —
   * the return screen's own endpoint publishes no cashier field.
   */
  onReturnSale?: (sale: SaleDto) => void;
}

export default function SaleDetailModal({
  saleId,
  onClose,
  onChanged,
  extraFooterActions,
  onReturnSale,
}: Props) {
  const [sale, setSale] = useState<SaleDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "payment" | "cancel">("none");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      setSale(await getSale(saleId));
    } catch (e) {
      setError(errorMessage(e, "Unable to load this sale."));
      // A missing sale is a distinct state from a failed request — retrying
      // will not conjure it.
      setNotFound(e instanceof SalesApiError && e.status === 404);
    } finally {
      setLoading(false);
    }
  }, [saleId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Cancel (DRAFT only) ───────────────────────────────────────────────────
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function handleCancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelSale(saleId, reason.trim());
      setPanel("none");
      setReason("");
      setNotice("Sale cancelled.");
      await load();
      onChanged();
    } catch (e) {
      // 409 surfaces as "Sale is not cancellable" — shown verbatim.
      setCancelError(errorMessage(e, "The sale could not be cancelled."));
    } finally {
      setCancelling(false);
    }
  }

  // ── Record payment (COMPLETED with a balance only) ────────────────────────
  const [method, setMethod] = useState<RecordSalePaymentMethod>("CASH");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Prefer the server's authoritative `creditAmount` as soon as the backend
  // publishes it, and only fall back to deriving it from the published
  // total/paid pair (the only option today — `Sale` exposes no credit field
  // yet). Never negative. This is display-only; settling a balance is a
  // separate concern handled by recordSalePayment below.
  const outstanding = sale
    ? Math.max(
        0,
        typeof sale.creditAmount === "number"
          ? sale.creditAmount
          : (sale.totalAmount ?? 0) - (sale.paidAmount ?? 0),
      )
    : 0;
  // Printed on the receipt only when actually recorded — never a placeholder.
  const receiptCustomerName = sale?.customerName?.trim() ?? "";
  const receiptCustomerPhone = sale?.customerPhone?.trim() ?? "";
  const parsedAmount = Number(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const amountWithinBalance = amountValid && parsedAmount <= outstanding + 1e-9;
  const canSubmitPayment = amountValid && amountWithinBalance && !paying;

  async function handlePayment() {
    if (!sale || !canSubmitPayment) return;
    setPaying(true);
    setPaymentError(null);
    try {
      await recordSalePayment(saleId, {
        method,
        amount: parsedAmount,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      });
      setPanel("none");
      setAmount("");
      setReference("");
      setNotice("Payment recorded.");
      // The backend is the source of truth: refetch rather than trusting local maths.
      await load();
      onChanged();
    } catch (e) {
      // 422 "amount exceeds outstanding balance" is shown as sent by the backend.
      setPaymentError(errorMessage(e, "The payment could not be recorded."));
    } finally {
      setPaying(false);
    }
  }

  const canCancel = sale?.status === "DRAFT";
  const canPay = sale?.status === "COMPLETED" && outstanding > 0;
  // A customer return needs a COMPLETED sale — the one status the create
  // endpoint accepts — and is only surfaced when the host wires the action up.
  const canReturn = Boolean(onReturnSale) && sale?.status === "COMPLETED";

  return (
    <Modal
      open
      size="2xl"
      onClose={onClose}
      title={sale ? `Sale Details · ${sale.saleNumber}` : "Sale Details"}
    >
      {loading && !sale ? (
        <div className="flex flex-col gap-4" aria-hidden>
          <div className="h-8 w-48 rounded bg-[#E6ECE2]/70 animate-pulse" />
          <div className="h-24 rounded-xl bg-[#E6ECE2]/50 animate-pulse" />
          <div className="h-40 rounded-xl bg-[#E6ECE2]/50 animate-pulse" />
        </div>
      ) : notFound ? (
        <EmptyState
          title="Sale not found"
          description={error ?? "This sale does not exist or was never created."}
        />
      ) : error && !sale ? (
        <InlineError message={error} onRetry={load} />
      ) : !sale ? (
        <EmptyState title="Sale not found" description={error ?? undefined} />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Header strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6ECE2] bg-[#E6ECE2]/30 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-lg font-bold text-[#333333]">{sale.saleNumber}</span>
              <SaleStatusBadge status={sale.status} />
              <BalancePill sale={sale} />
            </div>
            {sale.cashier && (
              <p className="text-xs text-[#666666]">
                Cashier:{" "}
                <span className="font-semibold text-[#333333]">{sale.cashier.name}</span>
              </p>
            )}
          </div>

          {notice && (
            <p className="text-xs text-green-800 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              {notice}
            </p>
          )}
          {error && sale && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Could not refresh this sale — showing the last loaded data.{" "}
              <button onClick={load} className="font-semibold underline">
                Retry
              </button>
            </p>
          )}

          {/* Sale information */}
          <Panel title="Sale Information">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 px-5 py-4">
              <InfoRow label={saleMoment(sale).label} value={fmtDateTime(saleMoment(sale).value)} />
              <InfoRow label="Created" value={fmtDateTime(sale.createdAt)} />
              <InfoRow label="Cashier" value={sale.cashier?.name ?? "—"} />
              <InfoRow label="Location" value={sale.location?.name ?? "—"} />
              {/* Customer details print only when they were actually
                  recorded — an anonymous credit sale shows neither line. */}
              {receiptCustomerName && (
                <InfoRow label="Customer" value={receiptCustomerName} />
              )}
              {receiptCustomerPhone && (
                <InfoRow label="Phone" value={receiptCustomerPhone} />
              )}
              {sale.billDiscountValue != null && sale.billDiscountValue !== 0 && (
                <InfoRow
                  label="Bill Discount"
                  value={
                    sale.billDiscountType === "PERCENTAGE"
                      ? `${sale.billDiscountValue}%`
                      : fmtMoney(sale.billDiscountValue)
                  }
                />
              )}
              {sale.cancelReason && <InfoRow label="Cancel Reason" value={sale.cancelReason} />}
              {sale.notes && <InfoRow label="Notes" value={sale.notes} />}
            </div>
          </Panel>

          {/* Items */}
          <Panel title={`Items (${sale.items?.length ?? 0})`}>
            {(sale.items?.length ?? 0) === 0 ? (
              <EmptyState
                title="No items on this sale"
                description="The backend returned no line items for this sale."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b border-[#E6ECE2] text-left">
                      {["Product", "SKU", "Unit", "Qty", "Unit Price", "Discount", "Line Total"].map(
                        (h) => (
                          <th
                            key={h}
                            className={`px-4 py-2.5 font-semibold text-[#666666] ${
                              ["Qty", "Unit Price", "Discount", "Line Total"].includes(h)
                                ? "text-right"
                                : ""
                            }`}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6ECE2]">
                    {sale.items.map((item) => (
                      <tr key={item.id} className="align-top">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#333333]">{item.product?.name ?? "—"}</p>
                          {item.product?.brand && (
                            <p className="text-xs text-[#999999]">{item.product.brand}</p>
                          )}
                          {/* FEFO allocations the backend chose. Read-only. */}
                          {(item.batchAllocations?.length ?? 0) > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {item.batchAllocations.map((alloc) => (
                                <li
                                  key={alloc.id}
                                  className="text-[11px] text-[#666666] bg-[#F5F8F2] rounded px-1.5 py-0.5 inline-block mr-1"
                                >
                                  Batch {alloc.batch?.batchNumber ?? "—"} ·{" "}
                                  {alloc.batch?.expiryDate
                                    ? fmtDate(alloc.batch.expiryDate)
                                    : "no expiry"}{" "}
                                  · {alloc.baseQuantity} base
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#666666]">{item.product?.sku ?? "—"}</td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                          {item.unit?.name ?? "—"}
                          {item.unit?.symbol ? ` (${item.unit.symbol})` : ""}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#333333]">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#666666]">
                          {fmtMoney(item.actualUnitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#666666]">
                          {discountLabel(item)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#333333]">
                          {fmtMoney(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* Payments */}
          <Panel
            title={`Payments (${sale.payments?.length ?? 0})`}
            action={
              <span className="text-xs text-[#666666]">
                Paid <span className="font-bold text-[#333333]">{fmtMoney(sale.paidAmount)}</span>
              </span>
            }
          >
            {(sale.payments?.length ?? 0) === 0 ? (
              <p className="px-5 py-4 text-sm text-[#666666]">
                No payments recorded against this sale.
              </p>
            ) : (
              <ul className="divide-y divide-[#E6ECE2]">
                {sale.payments.map((p) => (
                  <li
                    key={p.id}
                    className="px-5 py-3 flex items-center justify-between gap-4 flex-wrap"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#333333]">
                        {paymentMethodLabel(p.method)}
                      </p>
                      {p.reference && (
                        <p className="text-[11px] text-[#666666]">Reference: {p.reference}</p>
                      )}
                      <p className="text-[11px] text-[#999999]">{fmtDateTime(p.createdAt)}</p>
                    </div>
                    <p className="text-sm font-bold text-[#333333] tabular-nums">
                      {fmtMoney(p.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Summary */}
          <Panel title="Summary">
            <div className="divide-y divide-[#E6ECE2] py-1">
              <SummaryRow label="Subtotal" value={fmtMoney(sale.subtotal)} />
              <SummaryRow label="Discount" value={fmtMoney(sale.totalDiscount)} />
              <SummaryRow label="Total" value={fmtMoney(sale.totalAmount)} emphasis />
              <SummaryRow label="Paid" value={fmtMoney(sale.paidAmount)} />
              {/* Balance Due prints only when the sale actually left credit —
                  a fully-paid or cancelled sale shows no such line. */}
              {sale.status === "COMPLETED" && outstanding > 0 && (
                <SummaryRow
                  label="Balance Due"
                  value={fmtMoney(outstanding)}
                  emphasis
                  tone="outstanding"
                />
              )}
              {sale.changeAmount > 0 && (
                <SummaryRow label="Change" value={fmtMoney(sale.changeAmount)} tone="muted" />
              )}
            </div>
          </Panel>

          {/* ── Inline panels (kept inside the modal: no stacked overlays) ── */}
          {panel === "payment" && (
            <div className="rounded-xl border border-[#B6C8AF] bg-[#F5F8F2] p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-bold text-[#333333]">Add Payment</h4>
                <button
                  onClick={() => setPanel("none")}
                  disabled={paying}
                  className="text-xs font-semibold text-[#666666] hover:underline disabled:opacity-50"
                >
                  Close
                </button>
              </div>

              <p className="text-sm text-[#666666]">
                Outstanding balance{" "}
                <span className="font-bold text-amber-700">{fmtMoney(outstanding)}</span>
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Select
                  label="Payment Method"
                  value={method}
                  disabled={paying}
                  onChange={(e) => setMethod(e.target.value as RecordSalePaymentMethod)}
                >
                  {RECORD_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="payment-amount" className="text-sm font-medium text-[#333333]">
                    Amount
                  </label>
                  <input
                    id="payment-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={amount}
                    disabled={paying}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={`rounded-lg border bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20 ${
                      amount && !amountWithinBalance
                        ? "border-red-400"
                        : "border-[#C6D4BF] focus:border-[#B6C8AF]"
                    }`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="payment-reference"
                    className="text-sm font-medium text-[#333333]"
                  >
                    Reference <span className="text-[#999999] font-normal">(optional)</span>
                  </label>
                  <input
                    id="payment-reference"
                    type="text"
                    value={reference}
                    disabled={paying}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Cheque or transfer ref"
                    className="rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
                  />
                </div>
              </div>

              {/* Client-side guard only. The backend remains the authority and
                  its 422 message is surfaced verbatim below. */}
              {amount && !amountValid && (
                <p className="text-xs text-red-600">Enter an amount greater than zero.</p>
              )}
              {amount && amountValid && !amountWithinBalance && (
                <p className="text-xs text-red-600">
                  Amount exceeds the outstanding balance of {fmtMoney(outstanding)}.
                </p>
              )}
              {paymentError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {paymentError}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setPanel("none")} disabled={paying}>
                  Cancel
                </Button>
                <Button onClick={handlePayment} disabled={!canSubmitPayment} loading={paying}>
                  {paying ? "Recording payment…" : "Record Payment"}
                </Button>
              </div>
            </div>
          )}

          {panel === "cancel" && (
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-bold text-[#333333]">Cancel Sale</h4>
                <button
                  onClick={() => setPanel("none")}
                  disabled={cancelling}
                  className="text-xs font-semibold text-[#666666] hover:underline disabled:opacity-50"
                >
                  Close
                </button>
              </div>

              <p className="text-xs text-[#666666]">
                Only draft sales can be cancelled. This cannot be undone.
              </p>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="cancel-reason" className="text-sm font-medium text-[#333333]">
                  Reason
                </label>
                <textarea
                  id="cancel-reason"
                  rows={2}
                  value={reason}
                  disabled={cancelling}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Wrong items scanned"
                  className="rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
                />
              </div>

              {cancelError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {cancelError}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setPanel("none")} disabled={cancelling}>
                  Keep Sale
                </Button>
                <Button
                  onClick={handleCancel}
                  disabled={cancelling || !reason.trim()}
                  loading={cancelling}
                  className="!bg-red-500 !text-white hover:!bg-red-600"
                >
                  {cancelling ? "Cancelling sale…" : "Cancel Sale"}
                </Button>
              </div>
            </div>
          )}

          {/* Footer actions — availability is decided by the backend's rules. */}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#E6ECE2] pt-4">
            {sale.status === "COMPLETED" && !canPay && !canReturn && (
              <p className="text-xs text-[#999999] mr-auto">
                This sale is settled — there is nothing further to collect.
              </p>
            )}
            {canCancel && (
              <Button
                variant="secondary"
                onClick={() => setPanel("cancel")}
                className="mr-auto !border-red-300 !text-red-700 hover:!bg-red-50"
              >
                Cancel Sale
              </Button>
            )}
            {canPay && (
              <Button onClick={() => setPanel("payment")} className="mr-auto">
                Add Payment
              </Button>
            )}
            {canReturn && (
              <Button
                onClick={() => sale && onReturnSale?.(sale)}
                className="mr-auto"
                title="Refund part of this sale from its original prices"
              >
                Return Sale
              </Button>
            )}
            {extraFooterActions}
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}