// ── Dashboard → Credit ────────────────────────────────────────────────────────
// Who owes the pharmacy money, and how much — a receivables collection page.
//
// Endpoints used (via the existing API clients; there is no second client):
//
//   GET  /financials/credit-sales       → the credit sale list, server-paginated
//   GET  /financials/credit-sales/{id}  → balance, items, payment history
//   POST /pos/sales/{id}/payments       → collect part or all of a balance
//   GET  /inventory/locations           → the location filter's options
//
// What this page is NOT (§4, §5, §26):
//   • Not Finance — no trends, revenue charts, margins, supplier spend or
//     profitability. Those live on the Finance tab.
//   • Not Sales — it does not reproduce the POS transaction table. It answers
//     "what money is still owed", not "what sales happened".
//   • It performs no stock, batch, purchase-order or product operations, and no
//     sale cancellation (the backend only cancels DRAFT sales; collection is
//     done by recording a payment).
//
// Real backend limits, deliberately not worked around:
//   • The backend returns one row per credit SALE. There is no customer-level
//     grouping endpoint, so balances are NOT rolled up per customer — doing so
//     in the browser would silently cover only the current page.
//   • There is no portfolio totals endpoint, so no "total outstanding" or
//     "customers with debt" figure is shown. Only `meta.total` (the backend's
//     own count for the active filters) and a clearly page-scoped sum.
//   • There is no due date or payment term, so nothing is labelled Overdue.
//     Outstanding simply means a non-zero remaining balance.
//   • There is no CUSTOMER entity endpoint and no customer search: the customer
//     fields are free text recorded on the sale, filterable by `customerName`
//     and `customerPhone`.
//   • "CREDIT" is not a payment method. A balance is settled with CASH,
//     MOBILE_TRANSFER or CHECK, exactly as POST /pos/sales/{id}/payments allows.

import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardSubNav from "../dashboard/DashboardSubNav";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import MetricCard from "../../components/ui/MetricCard";
import Pagination from "../../components/ui/Pagination";
import EmptyState from "../../components/ui/EmptyState";
import Modal from "../../components/ui/Modal";
import SearchInput from "../../components/ui/SearchInput";
import Select from "../../components/ui/Select";
import DatePicker from "../../components/ui/DatePicker";
import { IconBanknotes, IconReceipt, IconUser } from "../../components/ui/icons";
import { listLocations, type LocationDto } from "../../features/inventory/locationsApi";
import {
  listCreditSales,
  getCreditSale,
  CreditApiError,
  type CreditPaymentStatus,
  type CreditSaleDetail,
  type CreditSaleListItem,
  type CreditStatusFilter,
  type RecordCreditPaymentMethod,
} from "../../features/credit/creditApi";
// Only the single existing implementation of the payment call is imported here —
// the credit module does not re-implement it.
import { recordSalePayment } from "../../features/sales/salesApi";
import { fmtMoney, fmtDate, fmtDateTime, fmtNumber } from "../../utils/format";
import SaleDetailModal from "../sales/SaleDetailModal";
import {
  InlineError,
  InfoRow,
  Panel,
  RECORD_METHODS,
  SkeletonRows,
  SummaryRow,
  dayEndIso,
  dayStartIso,
  errorMessage,
  paymentMethodLabel,
  plural,
} from "../sales/saleView";

const PAGE_SIZE = 20;

/**
 * Mirrors the backend's `status` query enum exactly:
 * OUTSTANDING | PARTIALLY_PAID | PAID | ALL.
 */
const STATUS_CHIPS: { value: CreditStatusFilter; label: string; hint: string }[] = [
  { value: "ALL", label: "All", hint: "Every credit sale regardless of balance" },
  {
    value: "OUTSTANDING",
    label: "Nothing paid",
    hint: "No payment has been recorded against the sale",
  },
  {
    value: "PARTIALLY_PAID",
    label: "Part paid",
    hint: "Some payment recorded, a balance still remains",
  },
  { value: "PAID", label: "Paid", hint: "The balance has been settled in full" },
];

const STATUS_TONE: Record<CreditPaymentStatus, string> = {
  OUTSTANDING: "bg-red-50 text-red-700",
  PARTIALLY_PAID: "bg-amber-50 text-amber-800",
  PAID: "bg-green-50 text-green-700",
};

const STATUS_LABEL: Record<CreditPaymentStatus, string> = {
  OUTSTANDING: "Outstanding",
  PARTIALLY_PAID: "Part paid",
  PAID: "Paid",
};

/** The real backend value, surfaced as a title so nothing is hidden behind prose. */
function CreditStatusBadge({ status }: { status: CreditPaymentStatus }) {
  return (
    <span
      title={status}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_TONE[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ── Credit sale detail ───────────────────────────────────────────────────────

function CreditSaleModal({
  creditId,
  onClose,
  onChanged,
}: {
  creditId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [credit, setCredit] = useState<CreditSaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [viewSaleId, setViewSaleId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      setCredit(await getCreditSale(creditId));
    } catch (e) {
      setError(errorMessage(e, "Unable to load this credit balance."));
      setNotFound(e instanceof CreditApiError && e.status === 404);
    } finally {
      setLoading(false);
    }
  }, [creditId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Record payment ────────────────────────────────────────────────────────
  const [method, setMethod] = useState<RecordCreditPaymentMethod>("CASH");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // The backend reports the balance itself; prefer it over recomputing.
  const outstanding = Math.max(0, credit?.outstandingAmount ?? 0);
  const parsedAmount = Number(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const amountWithinBalance = amountValid && parsedAmount <= outstanding + 1e-9;
  const canSubmitPayment = amountValid && amountWithinBalance && !paying;

  async function handlePayment() {
    if (!credit || !canSubmitPayment) return;
    setPaying(true);
    setPaymentError(null);
    try {
      // Recorded against the underlying sale. This call updates the balance;
      // the credit record is then re-read so nothing is trusted from local maths.
      await recordSalePayment(creditId, {
        method,
        amount: parsedAmount,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      });
      setShowPayment(false);
      setAmount("");
      setReference("");
      setNotice("Payment recorded.");
      await load();
      onChanged();
    } catch (e) {
      // 409 "not completed or has no outstanding balance" and 422 "amount
      // exceeds outstanding balance" are shown exactly as the backend worded them.
      setPaymentError(errorMessage(e, "The payment could not be recorded."));
    } finally {
      setPaying(false);
    }
  }

  const settled = outstanding <= 0;

  /**
   * A payment can also be recorded from the nested sale modal. That must refresh
   * this balance too, not just the list behind it, otherwise the panel keeps
   * showing a stale amount until it is reopened.
   */
  const handleChanged = useCallback(() => {
    onChanged();
    void load();
  }, [onChanged, load]);

  return (
    <>
      <Modal
        open
        size="2xl"
        onClose={onClose}
        title={credit ? `Credit Sale · ${credit.saleNumber}` : "Credit Sale"}
      >
        {loading && !credit ? (
          <div className="flex flex-col gap-4" aria-hidden>
            <div className="h-8 w-48 rounded bg-[#E6ECE2]/70 animate-pulse" />
            <div className="h-24 rounded-xl bg-[#E6ECE2]/50 animate-pulse" />
            <div className="h-40 rounded-xl bg-[#E6ECE2]/50 animate-pulse" />
          </div>
        ) : notFound ? (
          <EmptyState
            title="Credit sale not found"
            description={error ?? "This credit balance no longer exists."}
          />
        ) : error && !credit ? (
          <InlineError message={error} onRetry={load} />
        ) : !credit ? (
          <EmptyState title="Credit sale not found" description={error ?? undefined} />
        ) : (
          <div className="flex flex-col gap-4">
            {/* Header strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6ECE2] bg-[#E6ECE2]/30 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-lg font-bold text-[#333333]">{credit.saleNumber}</span>
                <CreditStatusBadge status={credit.paymentStatus} />
                {!settled && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                    Outstanding {fmtMoney(outstanding)}
                  </span>
                )}
              </div>
              {credit.cashier && (
                <p className="text-xs text-[#666666]">
                  Cashier:{" "}
                  <span className="font-semibold text-[#333333]">{credit.cashier.name}</span>
                </p>
              )}
            </div>

            {notice && (
              <p className="text-xs text-green-800 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                {notice}
              </p>
            )}
            {error && credit && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Could not refresh this balance — showing the last loaded data.{" "}
                <button onClick={load} className="font-semibold underline">
                  Retry
                </button>
              </p>
            )}

            {/* Customer — free text recorded on the sale; there is no customer entity. */}
            <Panel title="Customer & Sale">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 px-5 py-4">
                <InfoRow label="Customer" value={credit.customerName ?? "—"} />
                <InfoRow label="Phone" value={credit.customerPhone ?? "—"} />
                <InfoRow label="Sale Date" value={fmtDate(credit.saleDate)} />
                <InfoRow label="Location" value={credit.location?.name ?? "—"} />
                <InfoRow label="Cashier" value={credit.cashier?.name ?? "—"} />
              </div>
            </Panel>

            {/* Balance */}
            <Panel title="Balance">
              <div className="divide-y divide-[#E6ECE2] py-1">
                <SummaryRow label="Total Amount" value={fmtMoney(credit.totalAmount)} />
                <SummaryRow label="Paid" value={fmtMoney(credit.paidAmount)} />
                <SummaryRow
                  label="Outstanding"
                  value={fmtMoney(outstanding)}
                  emphasis
                  tone={settled ? "success" : "outstanding"}
                />
              </div>
            </Panel>

            {/* What the balance was for */}
            <Panel title={`Items (${credit.items?.length ?? 0})`}>
              {(credit.items?.length ?? 0) === 0 ? (
                <p className="px-5 py-4 text-sm text-[#666666]">
                  The backend returned no line items for this credit sale.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b border-[#E6ECE2] text-left">
                        {["Product", "SKU", "Unit", "Qty", "Unit Price", "Line Total"].map((h) => (
                          <th
                            key={h}
                            className={`px-4 py-2.5 font-semibold text-[#666666] ${
                              ["Qty", "Unit Price", "Line Total"].includes(h) ? "text-right" : ""
                            }`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6ECE2]">
                      {credit.items!.map((item) => (
                        <tr key={item.id} className="align-top">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[#333333]">
                              {item.product?.name ?? "—"}
                            </p>
                            {/* FEFO allocations, read-only. */}
                            {(item.batchAllocations?.length ?? 0) > 0 && (
                              <ul className="mt-1.5">
                                {item.batchAllocations!.map((alloc) => (
                                  <li
                                    key={alloc.batchId}
                                    className="text-[11px] text-[#666666] bg-[#F5F8F2] rounded px-1.5 py-0.5 inline-block mr-1"
                                  >
                                    Batch {alloc.batchNumber ?? "—"} ·{" "}
                                    {alloc.expiryDate ? fmtDate(alloc.expiryDate) : "no expiry"} ·{" "}
                                    {fmtNumber(alloc.baseQuantity)} base
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
                            {fmtNumber(item.quantity)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-[#666666]">
                            {fmtMoney(item.actualUnitPrice)}
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

            {/* Payment history */}
            <Panel
              title={`Payment History (${credit.payments?.length ?? 0})`}
              action={
                <span className="text-xs text-[#666666]">
                  Paid{" "}
                  <span className="font-bold text-[#333333]">{fmtMoney(credit.paidAmount)}</span>
                </span>
              }
            >
              {(credit.payments?.length ?? 0) === 0 ? (
                <p className="px-5 py-4 text-sm text-[#666666]">
                  No payments have been recorded against this sale.
                </p>
              ) : (
                <ul className="divide-y divide-[#E6ECE2]">
                  {credit.payments.map((p) => (
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

            {/* ── Record payment (inline: no stacked overlays) ────────────── */}
            {showPayment && (
              <div className="rounded-xl border border-[#B6C8AF] bg-[#F5F8F2] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-[#333333]">Record Payment</h4>
                  <button
                    onClick={() => setShowPayment(false)}
                    disabled={paying}
                    className="text-xs font-semibold text-[#666666] hover:underline disabled:opacity-50"
                  >
                    Close
                  </button>
                </div>

                <p className="text-sm text-[#666666]">
                  Sale <span className="font-semibold text-[#333333]">{credit.saleNumber}</span> ·
                  Outstanding balance{" "}
                  <span className="font-bold text-amber-700">{fmtMoney(outstanding)}</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Select
                    label="Payment Method"
                    value={method}
                    disabled={paying}
                    onChange={(e) => setMethod(e.target.value as RecordCreditPaymentMethod)}
                  >
                    {RECORD_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="credit-amount" className="text-sm font-medium text-[#333333]">
                      Amount
                    </label>
                    <input
                      id="credit-amount"
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
                      htmlFor="credit-reference"
                      className="text-sm font-medium text-[#333333]"
                    >
                      Reference <span className="text-[#999999] font-normal">(optional)</span>
                    </label>
                    <input
                      id="credit-reference"
                      type="text"
                      value={reference}
                      disabled={paying}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Cheque or transfer ref"
                      className="rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
                    />
                  </div>
                </div>

                {/* Client-side guard only — the backend stays the authority and its
                    422 message is surfaced verbatim below. */}
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
                  <Button
                    variant="secondary"
                    onClick={() => setShowPayment(false)}
                    disabled={paying}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handlePayment} disabled={!canSubmitPayment} loading={paying}>
                    {paying ? "Recording payment…" : "Record Payment"}
                  </Button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#E6ECE2] pt-4">
              {settled && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mr-auto">
                  This balance is fully settled — nothing further to collect.
                </p>
              )}
              {/* Sales owns the receipt. Credit links to it rather than
                  duplicating the whole sale-detail view. */}
              <Button
                variant="secondary"
                onClick={() => setViewSaleId(creditId)}
                className="mr-auto"
              >
                View Sale
              </Button>
              {!settled && (
                <Button onClick={() => setShowPayment(true)} className="mr-auto">
                  Record Payment
                </Button>
              )}
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* The receipt reuses the Sales page's own detail modal — one implementation. */}
      {viewSaleId && (
        <SaleDetailModal
          saleId={viewSaleId}
          onClose={() => setViewSaleId(null)}
          onChanged={handleChanged}
        />
      )}
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CreditPage() {
  // Three separate text filters because the backend exposes three separate
  // parameters. A single combined box would have to guess which one to send,
  // and sending all three would AND them into a query that matches nothing.
  const [customerInput, setCustomerInput] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [saleInput, setSaleInput] = useState("");
  const [saleNumber, setSaleNumber] = useState("");

  const [status, setStatus] = useState<CreditStatusFilter>("ALL");
  const [locationId, setLocationId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [credits, setCredits] = useState<CreditSaleListItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Debounce the typed filters so each keystroke does not fire a request.
  useEffect(() => {
    const id = setTimeout(() => setCustomerName(customerInput.trim()), 350);
    return () => clearTimeout(id);
  }, [customerInput]);
  useEffect(() => {
    const id = setTimeout(() => setCustomerPhone(phoneInput.trim()), 350);
    return () => clearTimeout(id);
  }, [phoneInput]);
  useEffect(() => {
    const id = setTimeout(() => setSaleNumber(saleInput.trim()), 350);
    return () => clearTimeout(id);
  }, [saleInput]);

  useEffect(() => {
    let active = true;
    listLocations({ limit: 100, isActive: true })
      .then((res) => {
        if (active) setLocations(res.data ?? []);
      })
      .catch(() => {
        /* The filter simply stays as "All locations". */
      });
    return () => {
      active = false;
    };
  }, []);

  // A narrowed result set can no longer contain the current page.
  useEffect(() => {
    setPage(1);
  }, [customerName, customerPhone, saleNumber, status, locationId, dateFrom, dateTo]);

  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      // The API accepts ALL explicitly; an empty date removes its parameter
      // entirely rather than sending an invalid empty value.
      status,
      ...(customerName ? { customerName } : {}),
      ...(customerPhone ? { customerPhone } : {}),
      ...(saleNumber ? { saleNumber } : {}),
      ...(locationId ? { locationId } : {}),
      ...(dateFrom ? { dateFrom: dayStartIso(dateFrom) } : {}),
      ...(dateTo ? { dateTo: dayEndIso(dateTo) } : {}),
    }),
    [page, status, customerName, customerPhone, saleNumber, locationId, dateFrom, dateTo],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await listCreditSales(query);
      setCredits(res.data ?? []);
      setMeta(res.meta ?? { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
    } catch (e) {
      setListError(errorMessage(e, "Unable to load credit balances."));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load, reloadTick]);

  const hasFilters = Boolean(
    customerName || customerPhone || saleNumber || locationId || dateFrom || dateTo || status !== "ALL",
  );

  function clearFilters() {
    setCustomerInput("");
    setCustomerName("");
    setPhoneInput("");
    setCustomerPhone("");
    setSaleInput("");
    setSaleNumber("");
    setStatus("ALL");
    setLocationId("");
    setDateFrom("");
    setDateTo("");
  }

  const currentPage = Math.max(1, meta.page);
  const effectiveLimit = meta.limit > 0 ? meta.limit : PAGE_SIZE;
  const firstRow = meta.total === 0 ? 0 : (currentPage - 1) * effectiveLimit + 1;
  const lastRow = Math.min(currentPage * effectiveLimit, meta.total);

  /**
   * Sum of the rows currently loaded. Scoped to this page on purpose and labelled
   * as such — the backend exposes no portfolio total, and rolling every page up
   * in the browser would be a number the API never reported.
   */
  const outstandingOnPage = credits.reduce(
    (sum, c) => sum + Math.max(0, c.outstandingAmount ?? 0),
    0,
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b border-[#E6ECE2] bg-white">
        <PageHeader
          breadcrumb="Dashboard"
          title="Credit"
          subtitle="Customer outstanding balances"
          actions={
            <Button
              variant="secondary"
              onClick={() => setReloadTick((t) => t + 1)}
              disabled={loading}
              loading={loading}
              className="!bg-[#7A9076] !text-white hover:!bg-[#4F6B4A] focus-visible:!ring-[#7A9076]"
            >
              Refresh
            </Button>
          }
        />
      </div>

      <DashboardSubNav />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        {/* ── Summary ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard
            title="Credit Sales"
            value={loading && credits.length === 0 ? "—" : fmtNumber(meta.total)}
            icon={<IconReceipt />}
            subtitle={
              loading && credits.length === 0
                ? "Loading credit balances…"
                : "Matching the current filters, counted by the backend."
            }
          />
          <MetricCard
            title="Outstanding on this page"
            value={loading && credits.length === 0 ? "—" : fmtMoney(outstandingOnPage)}
            icon={<IconBanknotes />}
            subtitle="Sum of the rows loaded now — the API exposes no portfolio total."
          />
        </div>

        {/* ── Filters ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-[#E6ECE2] bg-white p-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Wrapping <label> associates with the nested input implicitly, so no
                shared component needs an id prop. */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#333333]">Customer name</span>
              <SearchInput
                value={customerInput}
                onChange={setCustomerInput}
                placeholder="Search customer name..."
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#333333]">Customer phone</span>
              <SearchInput
                value={phoneInput}
                onChange={setPhoneInput}
                placeholder="Search phone..."
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#333333]">Sale number</span>
              <SearchInput
                value={saleInput}
                onChange={setSaleInput}
                placeholder="Search sale number..."
              />
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#333333]">Payment status</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Payment status">
                {STATUS_CHIPS.map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    title={chip.hint}
                    aria-pressed={status === chip.value}
                    onClick={() => setStatus(chip.value)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      status === chip.value
                        ? "border-[#7A9076] bg-[#E6ECE2] text-[#4F6B4A]"
                        : "border-[#C6D4BF] bg-white text-[#666666] hover:bg-[#F5F8F2]"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <Select
              label="Location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#333333]">Date From</label>
                <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="From" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#333333]">Date To</label>
                <DatePicker value={dateTo} onChange={setDateTo} placeholder="To" />
              </div>
            </div>
          </div>

          {hasFilters && (
            <div className="flex items-center justify-between gap-3 border-t border-[#E6ECE2] pt-3">
              <p className="text-xs text-[#666666]">
                {listError
                  ? "Filters are applied on the next successful load."
                  : `${plural(meta.total, "credit sale")} match the current filters.`}
              </p>
              <Button variant="secondary" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          )}
        </div>

        {/* ── Table ───────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-[#E6ECE2] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {loading && credits.length === 0 ? (
              <SkeletonRows rows={8} cols={8} />
            ) : listError && credits.length === 0 ? (
              <InlineError message={listError} onRetry={load} />
            ) : credits.length === 0 ? (
              hasFilters ? (
                <EmptyState
                  title="No matching credit balances"
                  description="Try changing the search or filters."
                  action={
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="No outstanding credit"
                  description="There are currently no customer balances requiring payment."
                />
              )
            ) : (
              <table className="w-full text-sm min-w-[980px]">
                <thead>
                  <tr className="border-b border-[#E6ECE2] text-left">
                    {[
                      { h: "Sale Number", align: "left" as const },
                      { h: "Customer", align: "left" as const },
                      { h: "Sale Date", align: "left" as const },
                      { h: "Total Amount", align: "right" as const },
                      { h: "Paid", align: "right" as const },
                      { h: "Outstanding", align: "right" as const },
                      { h: "Status", align: "left" as const },
                      { h: "Payments", align: "left" as const },
                      { h: "", align: "right" as const },
                    ].map((col, i) => (
                      <th
                        key={col.h || `act-${i}`}
                        className={`px-4 py-3 font-semibold text-[#666666] whitespace-nowrap ${
                          col.align === "right" ? "text-right" : ""
                        }`}
                      >
                        {col.h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6ECE2]">
                  {credits.map((credit) => {
                    const outstanding = Math.max(0, credit.outstandingAmount ?? 0);
                    const settled = outstanding <= 0;
                    return (
                      <tr key={credit.id} className="hover:bg-[#F5F8F2]">
                        <td className="px-4 py-3 font-semibold text-[#333333] whitespace-nowrap">
                          {credit.saleNumber}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="flex items-center gap-1.5 text-[#333333]">
                            <IconUser className="w-3.5 h-3.5 text-[#999999]" />
                            {credit.customerName ?? "—"}
                          </span>
                          {credit.customerPhone && (
                            <span className="block text-[11px] text-[#999999]">
                              {credit.customerPhone}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                          {fmtDate(credit.saleDate)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#333333] whitespace-nowrap">
                          {fmtMoney(credit.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#666666] whitespace-nowrap">
                          {fmtMoney(credit.paidAmount)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                          {settled ? (
                            <span className="text-[#999999]">{fmtMoney(0)}</span>
                          ) : (
                            <span className="font-semibold text-amber-700">
                              {fmtMoney(outstanding)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <CreditStatusBadge status={credit.paymentStatus} />
                        </td>
                        <td
                          className="px-4 py-3 text-[#666666] whitespace-nowrap"
                          title={plural(credit.payments?.length ?? 0, "payment")}
                        >
                          {plural(credit.payments?.length ?? 0, "payment")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setDetailId(credit.id)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#4F6B4A] border border-[#C6D4BF] hover:bg-[#E6ECE2] transition-colors whitespace-nowrap"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination is driven by the backend's meta, never by row count. */}
          {!loading && credits.length > 0 && (
            <>
              {listError && (
                <p className="mx-4 mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  Could not refresh the list — showing the last loaded page.{" "}
                  <button onClick={load} className="font-semibold underline">
                    Retry
                  </button>
                </p>
              )}
              <Pagination
                page={currentPage}
                totalPages={Math.max(1, meta.totalPages)}
                onPageChange={setPage}
                label={
                  <>
                    Showing <span className="font-medium text-[#333333]">{firstRow}</span>–
                    <span className="font-medium text-[#333333]">{lastRow}</span> of{" "}
                    <span className="font-medium text-[#333333]">{meta.total}</span> credit sales
                  </>
                }
              />
            </>
          )}
        </div>
      </div>

      {detailId && (
        <CreditSaleModal
          creditId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={() => setReloadTick((t) => t + 1)}
        />
      )}
    </div>
  );
}