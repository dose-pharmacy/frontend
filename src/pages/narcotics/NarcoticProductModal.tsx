// ── Narcotic product detail ───────────────────────────────────────────────────
// Opens from a row in the Controlled Products table and answers the three
// questions that page exists for: what is this controlled medicine, which batches
// and where is its stock, and what controlled-medicine movement is recorded.
//
// Every value comes from GET /financials/reports/narcotics (the row handed in by
// the page, so the modal opens instantly) and
// GET /financials/reports/narcotics/activity?productId=… (server-paginated).
// There is no separate "narcotic detail" endpoint to call.

import { useCallback, useEffect, useState } from "react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Pagination from "../../components/ui/Pagination";
import EmptyState from "../../components/ui/EmptyState";
import NarcoticBadge from "../../components/ui/NarcoticBadge";
import {
  getNarcoticActivity,
  type NarcoticSummaryDto,
  type NarcoticActivityDto,
} from "../../features/reports/reportsApi";
import { fmtDateTime, quantityWithUnit } from "../../utils/format";
import {
  errorMessage,
  ExpiryBadge,
  ExpiryCell,
  InfoRow,
  MovementBadge,
  Panel,
  qty,
} from "./narcoticsView";

const ACTIVITY_PAGE_SIZE = 10;

export default function NarcoticProductModal({
  product,
  unit,
  onClose,
  onViewMovements,
}: {
  product: NarcoticSummaryDto;
  /**
   * The controlled product's base unit, already resolved by the page (the
   * narcotics report publishes no unit of its own). `"—"` when it could not be
   * read — display only, never a guessed unit.
   */
  unit: string;
  onClose: () => void;
  /** Jump to the Movement Activity tab already scoped to this product. */
  onViewMovements: () => void;
}) {
  const [movements, setMovements] = useState<NarcoticActivityDto[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(ACTIVITY_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNarcoticActivity({
        productId: product.productId,
        page,
        limit: ACTIVITY_PAGE_SIZE,
      });
      setMovements(res.data);
      setTotal(res.meta.total);
      setLimit(res.meta.limit);
      // Guard `limit`-of-0 so the pager can never claim "1–0 of 0".
      setTotalPages(Math.max(1, res.meta.limit > 0 ? res.meta.totalPages : 1));
    } catch (e) {
      setError(errorMessage(e, "Unable to load movement history for this product."));
    } finally {
      setLoading(false);
    }
  }, [product.productId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // A product with no stock still appears in the report; say so rather than
  // rendering an empty table with no explanation.
  const batches = product.batches ?? [];
  const stockQty = batches.reduce((sum, b) => sum + (b.currentQuantity ?? 0), 0);

  return (
    <Modal open onClose={onClose} title={product.productName} size="xl">
      <div className="flex flex-col gap-5">
        {/* ── Controlled product ─────────────────────────────────────────── */}
        <Panel
          title="Controlled product"
          action={
            <span title={`isNarcotic: ${product.isNarcotic}`}>
              <NarcoticBadge />
            </span>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5">
            <InfoRow label="Product" value={product.productName} />
            <InfoRow label="SKU" value={<span className="font-mono text-xs">{product.sku}</span>} />
            <InfoRow label="Generic" value={product.genericName ?? "—"} />
            <InfoRow label="Brand" value={product.brand ?? "—"} />
          </div>
        </Panel>

        {/* ── Stock & batches ────────────────────────────────────────────── */}
        <Panel
          title="Stock & batches"
          action={
            batches.length > 0 ? (
              <span className="text-xs text-[#666666]">
                {quantityWithUnit(qty(stockQty), unit)} across {batches.length} batch
                {batches.length === 1 ? "" : "es"}
              </span>
            ) : undefined
          }
        >
          {batches.length === 0 ? (
            <EmptyState
              title="No stock on hand"
              description="The backend reports no current batches for this controlled product."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#E6ECE2] text-left">
                    {["Batch", "Location", "Quantity", "Unit", "Expiry", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 font-semibold text-[#333333]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={`${b.batchId}-${b.locationId}`} className="border-t border-[#E6ECE2]">
                      <td className="px-4 py-3 font-mono text-xs text-[#333333] whitespace-nowrap">
                        {b.batchNumber}
                      </td>
                      <td className="px-4 py-3 text-[#666666]">{b.locationName ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#333333]">
                        {qty(b.currentQuantity)}
                      </td>
                      <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{unit}</td>
                      <td className="px-4 py-3">
                        <ExpiryCell expiryDate={b.expiryDate} />
                      </td>
                      <td className="px-4 py-3">
                        <ExpiryBadge expiryDate={b.expiryDate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* ── Movement history ───────────────────────────────────────────── */}
        <Panel
          title="Movement history"
          action={
            <Button variant="secondary" onClick={onViewMovements} className="!px-3 !py-1.5 !text-xs">
              View on Activity tab
            </Button>
          }
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <div className="h-7 w-7 rounded-full border-4 border-[#E6ECE2] border-t-[#4F6B4A] animate-spin" />
              <p className="text-sm text-[#666666]">Loading movement history...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 px-5 py-6 text-center">
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md">
                {error}
              </p>
              <Button onClick={() => void load()}>Retry</Button>
            </div>
          ) : movements.length === 0 ? (
            <EmptyState
              title="No movements recorded"
              description="The backend returned no stock movements for this controlled product."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#E6ECE2] text-left">
                      {["Date", "Movement", "Batch", "Location", "Qty", "Unit", "Balance after", "Reference"].map(
                        (h) => (
                          <th key={h} className="px-4 py-3 font-semibold text-[#333333]">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.transactionId} className="border-t border-[#E6ECE2]">
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                          {fmtDateTime(m.date)}
                        </td>
                        <td className="px-4 py-3">
                          <MovementBadge movementType={m.movementType} direction={m.direction} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666] whitespace-nowrap">
                          {m.batchNumber ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#666666]">{m.locationName ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#333333]">
                          {qty(m.quantity)}
                        </td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{unit}</td>
                        <td className="px-4 py-3 text-right text-[#666666]">{qty(m.balanceAfter)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666]">
                          {m.reference ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                label={
                  total === 0 || limit === 0
                    ? "No movements"
                    : `Showing ${(page - 1) * limit + 1}–${Math.min(
                        page * limit,
                        total,
                      )} of ${total} movements`
                }
              />
            </>
          )}
        </Panel>
      </div>
    </Modal>
  );
}