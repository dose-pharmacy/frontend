// ── Return detail modal ──────────────────────────────────────────────────────
// One recorded customer return, read back from the backend:
//
//   GET /pos/returns/{id}  → the return, its items and the batches it restocked
//
// Every figure shown is the API's. Refunds are not recomputed here: a return's
// `refundAmount` was derived from the ORIGINAL sale at processing time, and the
// original sale's own total is displayed next to it as an unchanged reference.
// Batches are listed only when the API published allocations for the lines.

import { useCallback, useEffect, useState } from "react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber } from "../../utils/format";
import {
  ReturnsApiError,
  getReturn,
  type ReturnItem,
  type SaleReturn,
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
import { RestockBadge, unitLabel } from "./returnsView";

interface Props {
  returnId: string;
  onClose: () => void;
}

export default function ReturnDetailModal({ returnId, onClose }: Props) {
  const [record, setRecord] = useState<SaleReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      setRecord(await getReturn(returnId));
    } catch (e) {
      setError(errorMessage(e, "Unable to load this return."));
      setNotFound(e instanceof ReturnsApiError && e.status === 404);
    } finally {
      setLoading(false);
    }
  }, [returnId]);

  useEffect(() => {
    void load();
  }, [load]);

  const restockedItems = (record?.items ?? []).filter(
    (i) => i.restock && (i.batchAllocations?.length ?? 0) > 0,
  );

  return (
    <Modal
      open
      size="2xl"
      onClose={onClose}
      title={record ? `Return #${record.returnNumber}` : "Return"}
    >
      {loading && !record ? (
        <div className="flex flex-col gap-4" aria-hidden>
          <div className="h-8 w-56 rounded bg-[#E6ECE2]/70 animate-pulse" />
          <div className="h-24 rounded-xl bg-[#E6ECE2]/50 animate-pulse" />
          <div className="h-40 rounded-xl bg-[#E6ECE2]/50 animate-pulse" />
        </div>
      ) : notFound ? (
        <EmptyState
          title="Return not found"
          description={error ?? "This return does not exist."}
        />
      ) : error && !record ? (
        <InlineError message={error} onRetry={load} />
      ) : !record ? (
        <EmptyState title="Return unavailable" description={error ?? undefined} />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Header strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6ECE2] bg-[#E6ECE2]/30 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-lg font-bold text-[#333333]">
                Return #{record.returnNumber}
              </span>
              {record.sale?.status && <SaleStatusBadge status={record.sale.status} />}
            </div>
            <p className="text-xs text-[#666666]">
              Processed {record.createdAt ? fmtDateTime(record.createdAt) : "—"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <InfoRow
              label="Original Sale"
              value={record.sale?.saleNumber ?? record.saleId}
            />
            <InfoRow label="Location" value={record.location?.name ?? "—"} />
            <InfoRow label="Created By" value={record.createdBy?.name ?? "—"} />
            <InfoRow label="Inventory" value={<RestockBadge items={record.items} />} />
          </div>

          {/* Refund */}
          <Panel title="Refund">
            <div className="divide-y divide-[#E6ECE2] py-1">
              <SummaryRow label="Amount" value={fmtMoney(record.refundAmount)} emphasis />
              <SummaryRow label="Method" value={paymentMethodLabel(record.refundMethod)} />
              <SummaryRow
                label="Reference"
                value={record.refundReference || "—"}
                tone="muted"
              />
              <SummaryRow label="Reason" value={record.reason || "—"} />
              {record.notes && (
                <SummaryRow label="Notes" value={record.notes} tone="muted" />
              )}
              {/* The original sale total is shown unchanged — a return records
                  money out, it does not rewrite the sale. */}
              {record.sale && (
                <SummaryRow
                  label="Original Sale Total"
                  value={fmtMoney(record.sale.totalAmount)}
                  tone="muted"
                />
              )}
            </div>
          </Panel>

          {/* Returned items */}
          <Panel title={`Returned Items (${record.items?.length ?? 0})`}>
            {(record.items?.length ?? 0) === 0 ? (
              <p className="px-5 py-4 text-sm text-[#666666]">
                The response contained no item lines for this return.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[820px]">
                  <thead>
                    <tr className="border-b border-[#E6ECE2] text-left">
                      {[
                        { h: "Product", align: "left" as const },
                        { h: "Unit", align: "left" as const },
                        { h: "Quantity", align: "right" as const },
                        { h: "Original Price", align: "right" as const },
                        { h: "Net Unit Price", align: "right" as const },
                        { h: "Refund", align: "right" as const },
                        { h: "Restock", align: "left" as const },
                        { h: "Reason", align: "left" as const },
                      ].map((col) => (
                        <th
                          key={col.h}
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
                    {record.items.map((item) => (
                      <tr key={item.id} className="hover:bg-[#F5F8F2]">
                        <td className="px-4 py-3 font-semibold text-[#333333]">
                          {item.product?.name ?? "—"}
                          <span className="block text-[11px] font-normal text-[#999999]">
                            SKU: {item.product?.sku || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                          {unitLabel(item.unit)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#666666] whitespace-nowrap">
                          {fmtNumber(item.quantity)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#666666] whitespace-nowrap">
                          {fmtMoney(item.unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#666666] whitespace-nowrap">
                          {fmtMoney(item.netUnitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#333333] whitespace-nowrap">
                          {fmtMoney(item.refundAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <RestockBadge items={[item]} />
                        </td>
                        <td className="px-4 py-3 text-[#666666]">{item.reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* Restocked batches — only when the API published allocations. */}
          {restockedItems.length > 0 && (
            <Panel title="Restocked Batches">
              <ul className="divide-y divide-[#E6ECE2]">
                {restockedItems.map((item) => (
                  <RestockedBatches key={item.id} item={item} />
                ))}
              </ul>
            </Panel>
          )}

          <div className="flex justify-end border-t border-[#E6ECE2] pt-4">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function RestockedBatches({ item }: { item: ReturnItem }) {
  return (
    <li className="px-5 py-3">
      <p className="text-xs font-semibold text-[#333333]">
        {item.product?.name ?? "—"}{" "}
        <span className="font-normal text-[#999999]">
          · {unitLabel(item.unit)} × {fmtNumber(item.quantity)}
        </span>
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {item.batchAllocations.map((b) => (
          <li
            key={b.batchId}
            className="rounded-lg border border-[#E6ECE2] bg-[#F5F8F2] px-3 py-1.5 text-[11px] text-[#666666]"
          >
            <span className="font-semibold text-[#333333]">{b.batch?.batchNumber ?? "—"}</span>
            <span className="ml-2">Expiry {b.batch?.expiryDate ? fmtDate(b.batch.expiryDate) : "—"}</span>
            <span className="ml-2 tabular-nums">
              {plural(b.baseQuantity, "base unit")}
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}
