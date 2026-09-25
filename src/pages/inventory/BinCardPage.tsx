import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { getBinCard, type BinCardResult } from "../../features/inventory/stockApi";
import { listLocations } from "../../features/inventory/locationsApi";
import { listProductBatches, type BatchDto } from "../../features/inventory/batchesApi";
import { searchProducts, searchLocations } from "../../features/inventory/searchSelectors";
import { useProductUnits } from "../../features/inventory/useProductUnits";
import { useSearchableResource } from "../../hooks/useSearchableResource";
import SearchableSelect from "../../components/ui/SearchableSelect";
import type { SearchableOption } from "../../components/ui/SearchableSelect";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import DatePicker from "../../components/ui/DatePicker";

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function prettyType(t: string) {
  if (!t) return "";
  const spaced = t.replace(/_/g, " ");
  if (spaced === spaced.toUpperCase()) return spaced.charAt(0) + spaced.slice(1).toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function TxTypeBadge({ type }: { type: string }) {
  // Keys match the backend StockTransactionType enum (lowercased).
  const map: Record<string, string> = {
    opening:           "bg-[#E6ECE2] text-[#7A9076]",
    purchase:          "bg-green-100 text-green-700",
    sale:              "bg-blue-100 text-blue-700",
    transfer_in:       "bg-purple-100 text-purple-700",
    transfer_out:      "bg-purple-100 text-purple-700",
    adjustment_in:     "bg-orange-100 text-orange-700",
    adjustment_out:    "bg-orange-100 text-orange-700",
    return_in:         "bg-yellow-100 text-yellow-700",
    return_out:        "bg-yellow-100 text-yellow-700",
    return_to_supplier:"bg-yellow-100 text-yellow-700",
    expiry:            "bg-amber-100 text-amber-700",
    disposal:          "bg-red-100 text-red-700",
    correction:        "bg-slate-200 text-slate-700",
    clearance_sale:    "bg-cyan-100 text-cyan-700",
    closing:           "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 capitalize ${map[type.toLowerCase()] ?? "bg-gray-100 text-gray-600"}`}>
      {prettyType(type)}
    </span>
  );
}

export default function BinCardPage() {
  const [params, setParams] = useSearchParams();
  const initProductId = params.get("productId") || "";
  const initBatchId = params.get("batchId") || "";
  const initLocationId = params.get("locationId") || "";

  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [batches, setBatches] = useState<BatchDto[]>([]);

  const [productId, setProductId] = useState(initProductId);
  const [batchId, setBatchId] = useState(initBatchId);
  const [locationId, setLocationId] = useState(initLocationId);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

  const [card, setCard] = useState<BinCardResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const productSearch = useSearchableResource(searchProducts);
  const unitsProd = useProductUnits(initProductId || productId);

  const selectedProductOption = productSearch.options.find((o) => o.value === productId)
    ?? (unitsProd.product && productId === unitsProd.product?.id
      ? { value: unitsProd.product.id, label: unitsProd.product.name }
      : null)
  const productOptions: SearchableOption[] = selectedProductOption
    ? [selectedProductOption, ...productSearch.options.filter((o) => o.value !== productId)]
    : productSearch.options

  const locationSearch = useSearchableResource(searchLocations);
  const locationOptions: SearchableOption[] = [
    ...locations.map((l) => ({ value: l.id, label: l.name })),
    ...locationSearch.options.filter((o) => !locations.some((l) => l.id === o.value)),
  ]

  useEffect(() => {
    listLocations({ limit: 100 })
      .then((res) => setLocations(res.data.filter((x) => x.isActive).map((x) => ({ id: x.id, name: x.name }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!productId) {
      setBatches([]);
      return;
    }
    listProductBatches(productId, { limit: 100 })
      .then((b) => setBatches(b.data))
      .catch(() => setBatches([]));
  }, [productId]);

  const hasSelection = !!(productId && locationId);

  useEffect(() => {
    if (!hasSelection) {
      setCard(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    getBinCard({
      productId,
      locationId,
      batchId: batchId || undefined,
      startDate: fromDate || undefined,
      endDate: toDate || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => { if (!cancelled) setCard(res); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load bin card"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hasSelection, productId, locationId, batchId, fromDate, toDate, page, reloadKey]);

  const tx = card?.transactions ?? [];
  const totals = useMemo(
    () => ({
      in: tx.reduce((a, t) => a + (t.in || 0), 0),
      out: tx.reduce((a, t) => a + (t.out || 0), 0),
    }),
    [tx],
  );

  const selectedProduct = unitsProd.product ?? (selectedProductOption ? { name: selectedProductOption.label } : null);
  const selectedLocation = locations.find((l) => l.id === locationId);
  const selectedBatch = batches.find((b) => b.id === batchId);
  const unit = card?.baseUnit?.name || unitsProd.product?.baseUnit?.name || "";
  const unitLabel = unit ? `${unit}s` : "";

  function handleExportCSV() {
    const header = "Date,Reference,Type,Notes,In,Out,Balance,Cost\n";
    const rows = tx
      .map((e) => [
        e.date,
        (e.reference || "").replace(/,/g, " "),
        e.transactionType,
        (e.notes || "").replace(/,/g, " "),
        e.in || 0,
        e.out || 0,
        e.balance,
        e.costPrice ?? "",
      ].join(","))
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bin-card.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title={selectedProduct ? `Bin Card — ${selectedProduct.name}` : "Bin Card"}
        subtitle="Stock movement history and ledger"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => window.print()} disabled={!card}>Print</Button>
            <Button onClick={handleExportCSV} disabled={!card || tx.length === 0}>Export CSV</Button>
          </div>
        }
      />

      <div className="p-6 flex flex-col gap-6 overflow-y-auto">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4 flex flex-col gap-4">
          <p className="text-sm font-semibold text-[#333333]">Bin Card Selection</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#666666]">Product *</label>
              <SearchableSelect
                value={productId || null}
                onChange={(v) => { setProductId(v); setBatchId(""); setPage(1); setParams({}); }}
                options={productOptions}
                onSearch={productSearch.setTerm}
                loading={productSearch.loading}
                error={productSearch.error}
                onRetry={productSearch.retry}
                placeholder="Search and select a product..."
                searchPlaceholder="Search by name or SKU..."
                emptyMessage="No products found"
                noResultsMessage="No products matching your search"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#666666]">Location *</label>
              <SearchableSelect
                value={locationId || null}
                onChange={(v) => { setLocationId(v); setPage(1); setParams({}); }}
                options={locationOptions}
                onSearch={locationSearch.setTerm}
                loading={locationSearch.loading}
                error={locationSearch.error}
                onRetry={locationSearch.retry}
                placeholder="Search and select a location..."
                searchPlaceholder="Search locations..."
                emptyMessage="No locations found"
                noResultsMessage="No locations matching your search"
              />
            </div>
            <Select label="Batch" value={batchId} onChange={(e) => { setBatchId(e.target.value); setPage(1); setParams({}); }} disabled={!productId}>
              <option value="">All Batches</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.batchNumber}</option>)}
            </Select>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#666666]">From Date</label>
              <DatePicker
                value={fromDate}
                onChange={(v) => { setFromDate(v); setPage(1); }}
                placeholder="From date"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#666666]">To Date</label>
              <DatePicker
                value={toDate}
                onChange={(v) => { setToDate(v); setPage(1); }}
                placeholder="To date"
              />
            </div>
          </div>
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(""); setToDate(""); setPage(1); }} className="text-xs font-semibold text-[#7A9076] hover:underline self-end">Clear Date Range</button>
          )}
        </div>

        {!hasSelection ? (
          <EmptyState title="Select Product and Location" description="A product and location must be selected to view the bin card." />
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setReloadKey((k) => k + 1)} className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap">Retry</button>
          </div>
        ) : loading && !card ? (
          <div className="p-6 space-y-3 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-[#E6ECE2] rounded-lg" />)}</div>
        ) : card ? (
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="rounded-xl bg-[#E6ECE2]/40 p-4 border border-[#E6ECE2]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-[#666666] mb-1">Product</p>
                  <p className="font-bold text-[#333333]">{selectedProduct?.name}</p>
                </div>
                <div>
                  <p className="text-[#666666] mb-1">Location</p>
                  <p className="font-semibold text-[#333333]">{selectedLocation?.name}</p>
                </div>
                <div>
                  <p className="text-[#666666] mb-1">Batch</p>
                  <p className="font-mono font-semibold text-[#333333]">{selectedBatch ? selectedBatch.batchNumber : "All Batches"}</p>
                </div>
                <div>
                  <p className="text-[#666666] mb-1">Unit</p>
                  <p className="font-semibold text-[#333333]">{unitLabel || "—"}</p>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {([
                ["Opening Balance", card.openingBalance.toLocaleString()],
                ["Total IN", `+${totals.in.toLocaleString()}`],
                ["Total OUT", `−${totals.out.toLocaleString()}`],
                ["Closing Balance", card.closingBalance.toLocaleString()],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="bg-white rounded-xl border border-[#E6ECE2] p-4">
                  <p className="text-xs text-[#666666]">{label}</p>
                  <p className="text-2xl font-bold text-[#333333] mt-1">{value}</p>
                </div>
              ))}
            </div>

            {/* Ledger */}
            <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#E6ECE2] text-left">
                      <th className="px-4 py-3 font-semibold text-[#333333]">Date</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Reference</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Type</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden xl:table-cell">Batch</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] text-right">IN</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] text-right">OUT</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] text-right">Balance</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] text-right hidden lg:table-cell">Cost</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden lg:table-cell">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tx.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-sm text-[#999]">No movements in the selected range.</td>
                      </tr>
                    ) : (
                      tx.map((t, i) => {
                        const batchRef = (t.batch as { batchNumber?: string } | undefined)?.batchNumber;
                        const userRef = (t.user as { name?: string } | undefined)?.name;
                        return (
                          <tr key={t.transactionId} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}>
                            <td className="px-4 py-3 text-[#666666] whitespace-nowrap text-xs">{fmtDateTime(t.date)}</td>
                            <td className="px-4 py-3 font-mono text-xs text-[#666666]">{t.reference || "—"}</td>
                            <td className="px-4 py-3"><TxTypeBadge type={t.transactionType} /></td>
                            <td className="px-4 py-3 font-mono text-xs text-[#666666] hidden xl:table-cell">{batchRef ?? "—"}</td>
                            <td className="px-4 py-3 text-right font-semibold text-green-700">{t.in > 0 ? t.in.toLocaleString() : <span className="text-[#999] font-normal">—</span>}</td>
                            <td className="px-4 py-3 text-right font-semibold text-red-600">{t.out > 0 ? t.out.toLocaleString() : <span className="text-[#999] font-normal">—</span>}</td>
                            <td className="px-4 py-3 text-right font-semibold text-[#333333]">{t.balance.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-[#666666] hidden lg:table-cell">{t.costPrice != null ? `${t.costPrice.toLocaleString()} ETB` : "—"}</td>
                            <td className="px-4 py-3 text-[#666666] hidden lg:table-cell">{userRef ?? "—"}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {card.totalPages && card.totalPages > 1 && (
                <div className="border-t border-[#E6ECE2] px-5 py-3 flex items-center justify-between">
                  <p className="text-xs text-[#666666]">
                    Page {page} of {card.totalPages} · {card.total ?? tx.length} movements
                  </p>
                  <div className="flex gap-1">
                    <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg px-3 py-1.5 text-xs border border-[#C6D4BF] text-[#666666] hover:bg-[#E6ECE2] disabled:opacity-40 transition-colors">← Prev</button>
                    <button disabled={page >= (card.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} className="rounded-lg px-3 py-1.5 text-xs border border-[#C6D4BF] text-[#666666] hover:bg-[#E6ECE2] disabled:opacity-40 transition-colors">Next →</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}