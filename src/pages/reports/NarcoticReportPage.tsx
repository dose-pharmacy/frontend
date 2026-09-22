import { useCallback, useEffect, useState } from "react";
import ReportsSubNav from "./ReportsSubNav";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import NarcoticBadge from "../../components/ui/NarcoticBadge";
import ReportFilterBar from "./ReportFilterBar";
import { fmtNumber, fmtDate, fmtDateTime, defaultDateRange } from "./reportHelpers";
import SearchInput from "../../components/ui/SearchInput";
import Select from "../../components/ui/Select";
import { listLocations } from "../../features/inventory/locationsApi";
import { listInventoryProducts, type InventoryProductDto } from "../../features/inventory/productsApi";
import {
  getNarcoticReport,
  getNarcoticActivity,
  ReportsApiError,
  type NarcoticSummaryDto,
  type NarcoticActivityDto,
} from "../../features/reports/reportsApi";

const PAGE_SIZE = 20;

type Tab = "summary" | "activity";

// ─── Contact-sheet reusable internals ────────────────────────────────────────

function fmtQty(n: number | undefined): string {
  return n === undefined ? "—" : fmtNumber(n);
}

export default function NarcoticReportPage() {
  const range = defaultDateRange();
  const [tab, setTab] = useState<Tab>("summary");

  const [dateFrom, setDateFrom] = useState(range.from);
  const [dateTo, setDateTo] = useState(range.to);
  const [locationId, setLocationId] = useState("");
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [products, setProducts] = useState<InventoryProductDto[]>([]);

  const [movementType, setMovementType] = useState("");

  const [rows, setRows] = useState<NarcoticSummaryDto[] | NarcoticActivityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    listLocations({ limit: 100, isActive: true })
      .then((r) => setLocations(r.data))
      .catch(() => setLocations([]))
      .finally(() => setLocationsLoading(false));
  }, []);

  // Product picker options for the summary tab (narcotic products only).
  useEffect(() => {
    let cancelled = false;
    listInventoryProducts({ limit: 100, isActive: true })
      .then((res) => {
        if (cancelled) return;
        setProducts(res.data.filter((p) => p.isNarcotic));
      })
      .catch(() => { if (!cancelled) setProducts([]); });
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "summary") {
        const res = await getNarcoticReport({
          page,
          limit: PAGE_SIZE,
          search: search.trim() || undefined,
          productId: productId || undefined,
          locationId: locationId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });
        setRows(res.data);
        setTotalPages(res.meta.totalPages);
        setTotalCount(res.meta.total);
      } else {
        const res = await getNarcoticActivity({
          page,
          limit: PAGE_SIZE,
          productId: productId || undefined,
          locationId: locationId || undefined,
          movementType: movementType || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });
        setRows(res.data);
        setTotalPages(res.meta.totalPages);
        setTotalCount(res.meta.total);
      }
    } catch (e) {
      setError(e instanceof ReportsApiError ? e.message : "Failed to load the narcotics report.");
    } finally {
      setLoading(false);
    }
  }, [tab, page, search, productId, locationId, movementType, dateFrom, dateTo]);

  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  function resetPage() {
    setPage(1);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Reports / Narcotics"
        title="Narcotics Report"
        subtitle="Narcotic/controlled product balances and movement for the selected period."
      />
      <ReportsSubNav />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        <ReportFilterBar
          dateFrom={dateFrom}
          dateTo={dateTo}
          locationId={locationId}
          locations={locations}
          locationsLoading={locationsLoading}
          onDateFromChange={(v) => { setDateFrom(v); resetPage(); }}
          onDateToChange={(v) => { setDateTo(v); resetPage(); }}
          onLocationChange={(v) => { setLocationId(v); resetPage(); }}
          extra={
            <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
              <label className="text-sm font-medium text-[#333333]">Product</label>
              <Select
                value={productId}
                onChange={(e) => { setProductId(e.target.value); resetPage(); }}
                className="w-full"
              >
                <option value="">All Narcotics</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
          }
        />

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-[#DBEFF3] p-1 w-fit">
          {([
            { key: "summary", label: "Product Summary" },
            { key: "activity", label: "Movement Activity" },
          ] as { key: Tab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); resetPage(); }}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                tab === t.key ? "bg-[#49B0C1] text-white" : "text-[#666666] hover:text-[#333333]"
              }`}
            >
              {t.label}
            </button>
          ))}
          <div className="pl-1 pr-2 border-l border-[#DBEFF3] flex gap-2 items-center">
            {tab === "summary" ? (
              <SearchInput value={search} onChange={(v) => { setSearch(v); resetPage(); }} placeholder="Search narcotics..." />
            ) : (
              <Select value={movementType} onChange={(e) => { setMovementType(e.target.value); resetPage(); }}>
                <option value="">All Movements</option>
                {[["PURCHASE", "Purchase"], ["OPENING", "Opening Stock"], ["SALE", "Sale"], ["RETURN_IN", "Customer Return"], ["RETURN_OUT", "Supplier Return"], ["ADJUSTMENT_IN", "Adjustment In"], ["ADJUSTMENT_OUT", "Adjustment Out"], ["TRANSFER_IN", "Transfer In"], ["TRANSFER_OUT", "Transfer Out"], ["EXPIRY_DISPOSE", "Expiry Dispose"]].map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-8 w-8 rounded-full border-4 border-[#DBEFF3] border-t-[#49B0C1] animate-spin" />
              <p className="text-sm text-[#666666]">Loading narcotics report...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 px-6">
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">{error}</p>
              <Button onClick={() => void load()}>Retry</Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="font-semibold text-[#333333]">No narcotics found</p>
              <p className="text-sm text-[#666666]">No data matches the selected period and filters.</p>
            </div>
          ) : tab === "summary" ? (
            <SummaryTable rows={rows as NarcoticSummaryDto[]} />
          ) : (
            <ActivityTable rows={rows as NarcoticActivityDto[]} />
          )}
        </div>

        <div className="px-2 pb-4 flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-[#666666]">
            Showing {totalCount === 0 ? 0 : Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–{Math.min(page * PAGE_SIZE, totalCount)} of {fmtNumber(totalCount)}
          </p>
          {totalPages > 1 && (
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg px-3 py-1.5 text-xs border border-[#ABDBE3] text-[#666666] hover:bg-[#DBEFF3] disabled:opacity-40 transition-colors">←</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${p === page ? "bg-[#49B0C1] text-white" : "border border-[#ABDBE3] text-[#666666] hover:bg-[#DBEFF3]"}`}>{p}</button>
              ))}
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg px-3 py-1.5 text-xs border border-[#ABDBE3] text-[#666666] hover:bg-[#DBEFF3] disabled:opacity-40 transition-colors">→</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Summary table ───────────────────────────────────────────────────────────

function SummaryTable({ rows }: { rows: NarcoticSummaryDto[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#DBEFF3] text-left">
            {["Product", "SKU", "Batches", "Sold", "Purchased", "Returned", "Adjusted"].map((h) => (
              <th key={h} className="px-4 py-3 font-semibold text-[#333333]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.productId} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/15"}>
              <td className="px-4 py-3">
                <p className="font-medium text-[#333333]">
                  {row.productName}
                  <NarcoticBadge className="ml-2 align-middle" />
                </p>
                <p className="text-xs text-[#666666]">{row.genericName ?? "—"} · {row.brand ?? "—"}</p>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-[#666666]">{row.sku}</td>
              <td className="px-4 py-3">
                {row.batches.length === 0 ? (
                  <span className="text-xs text-[#999]">No stock</span>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {row.batches.map((b) => (
                      <span key={b.batchId} className="text-xs text-[#666666] whitespace-nowrap">
                        {b.batchNumber} · {fmtQty(b.currentQuantity)} @ {b.locationName} · Exp {fmtDate(b.expiryDate)}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-[#333333]">{fmtQty(row.soldQuantity)}</td>
              <td className="px-4 py-3 text-right text-[#666666]">{fmtQty(row.purchasedQuantity)}</td>
              <td className="px-4 py-3 text-right text-[#666666]">{fmtQty(row.returnedQuantity)}</td>
              <td className="px-4 py-3 text-right text-[#666666]">{fmtQty(row.adjustedQuantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Activity table ──────────────────────────────────────────────────────────

const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE: "Purchase",
  OPENING: "Opening Stock",
  SALE: "Sale",
  RETURN_IN: "Customer Return",
  RETURN_OUT: "Supplier Return",
  ADJUSTMENT_IN: "Adjustment In",
  ADJUSTMENT_OUT: "Adjustment Out",
  TRANSFER_IN: "Transfer In",
  TRANSFER_OUT: "Transfer Out",
  EXPIRY_DISPOSE: "Expiry Dispose",
};

function ActivityTable({ rows }: { rows: NarcoticActivityDto[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#DBEFF3] text-left">
            {["Date", "Product", "Batch", "Location", "Movement", "Qty", "Balance After", "Reference"].map((h) => (
              <th key={h} className="px-4 py-3 font-semibold text-[#333333]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.transactionId} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/15"}>
              <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{fmtDateTime(row.date)}</td>
              <td className="px-4 py-3">
                <p className="font-medium text-[#333333]">{row.productName}</p>
                <p className="text-xs font-mono text-[#666666]">{row.sku}</p>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-[#666666] whitespace-nowrap">
                {row.batchNumber} · Exp {fmtDate(row.expiryDate)}
              </td>
              <td className="px-4 py-3 text-[#666666]">{row.locationName}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${row.direction === "IN" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {row.direction === "IN" ? "▲" : "▼"} {MOVEMENT_LABELS[row.movementType] ?? row.movementType}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-[#333333]">{fmtQty(row.quantity)}</td>
              <td className="px-4 py-3 text-right text-[#666666]">{fmtQty(row.balanceAfter)}</td>
              <td className="px-4 py-3 font-mono text-xs text-[#666666]">{row.reference ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}