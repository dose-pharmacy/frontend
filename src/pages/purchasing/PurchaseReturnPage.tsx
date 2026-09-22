import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import ConfirmationDialog from "../../components/ui/ConfirmationDialog";
import {
  createPurchaseReturn,
  listPurchaseReturns,
  type PurchaseReturnDto,
  type PurchaseReturnReason,
  PurchaseReturnsApiError,
} from "../../features/purchasing/purchaseReturnsApi";
import {
  listSupplierProducts,
  getSupplierProductBatches,
  type SupplierProductBatchDto,
} from "../../features/purchasing/suppliersApi";
import {
  searchSuppliers,
  searchLocations,
} from "../../features/inventory/searchSelectors";
import { useSearchableResource } from "../../hooks/useSearchableResource";
import SearchableSelect from "../../components/ui/SearchableSelect";
import type { SearchableOption } from "../../components/ui/SearchableSelect";

const REASON_LABELS: Record<PurchaseReturnReason, string> = {
  EXPIRED: "Expired",
  DAMAGED: "Damaged",
  INCORRECT_DELIVERY: "Incorrect Delivery",
};

const REASON_BADGE: Record<PurchaseReturnReason, string> = {
  EXPIRED: "bg-red-100 text-red-700",
  DAMAGED: "bg-orange-100 text-orange-700",
  INCORRECT_DELIVERY: "bg-blue-100 text-blue-700",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMoney(n: number | null | undefined) {
  return `${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

export default function PurchaseReturnPage() {
  // Form state
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [reason, setReason] = useState<PurchaseReturnReason>("EXPIRED");
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState("");
  const [debitNoteAmount, setDebitNoteAmount] = useState("");
  const [notes, setNotes] = useState("");

  // Supplier-scoped product search (manual — resets whenever the supplier changes)
  const [productTerm, setProductTerm] = useState("");
  const [productOptions, setProductOptions] = useState<SearchableOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const productSeq = useRef(0);
  const productTimer = useRef<number | null>(null);

  // Supplier-owned batches for the selected (supplier, product, location)
  const [batches, setBatches] = useState<SupplierProductBatchDto[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const batchSeq = useRef(0);

  // History
  const [returns, setReturns] = useState<PurchaseReturnDto[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(true);
  const [returnsError, setReturnsError] = useState("");
  const [totalCount, setTotalCount] = useState(0);

  // UI
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadReturns = useCallback(async () => {
    setReturnsLoading(true);
    setReturnsError("");
    try {
      // GET /purchase-returns — supplierId/productId/reason filters supported.
      const r = await listPurchaseReturns({ page: 1, limit: 50 });
      setReturns(r.data);
      setTotalCount(r.meta.total ?? r.data.length);
    } catch (e) {
      setReturnsError(e instanceof PurchaseReturnsApiError ? e.message : "Failed to fetch return list.");
    } finally {
      setReturnsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReturns();
  }, [loadReturns]);

  const supplierSearch = useSearchableResource(searchSuppliers, showForm);
  const locationSearch = useSearchableResource(searchLocations, showForm);
  const selectedSupplierOption = supplierSearch.options.find((o) => o.value === supplierId) ?? null;
  const supplierOptions: SearchableOption[] = selectedSupplierOption
    ? [selectedSupplierOption, ...supplierSearch.options.filter((o) => o.value !== supplierId)]
    : supplierSearch.options;
  const selectedLocationOption = locationSearch.options.find((o) => o.value === locationId) ?? null;
  const locationOptions: SearchableOption[] = selectedLocationOption
    ? [selectedLocationOption, ...locationSearch.options.filter((o) => o.value !== locationId)]
    : locationSearch.options;

  // ── Supplier → product (backend-filtered catalog lookup) ──────────────────

  const loadSupplierProducts = useCallback(async (term: string) => {
    if (!supplierId) {
      setProductOptions([]);
      return;
    }
    const seq = ++productSeq.current;
    setProductsLoading(true);
    setProductsError(null);
    try {
      const res = await listSupplierProducts(supplierId, {
        page: 1,
        limit: 50,
        search: term.trim() || undefined,
        isActive: true,
      });
      if (seq !== productSeq.current) return;
      setProductOptions(
        res.data.map((p) => ({
          value: p.id,
          label: p.name,
          sub: `${p.sku}${p.isNarcotic ? " · Narcotic" : ""}`,
        })),
      );
    } catch (e) {
      if (seq !== productSeq.current) return;
      setProductsError(e instanceof Error ? e.message : "Failed to load supplier products.");
      setProductOptions([]);
    } finally {
      if (seq === productSeq.current) setProductsLoading(false);
    }
  }, [supplierId]);

  // Supplier changed → reset the dependent product/batch selection and reload.
  useEffect(() => {
    if (!supplierId) {
      productSeq.current++;
      setProductOptions([]);
      setProductsError(null);
      setProductId("");
      setBatchId("");
      setBatches([]);
      return;
    }
    productSeq.current++;
    setProductOptions([]);
    setProductId("");
    setBatchId("");
    setBatches([]);
    setProductsLoading(true);
    setProductsError(null);
    void loadSupplierProducts("");
  }, [supplierId, loadSupplierProducts]);

  // Debounced search while typing.
  useEffect(() => {
    if (!supplierId) return;
    if (productTimer.current) window.clearTimeout(productTimer.current);
    productTimer.current = window.setTimeout(() => {
      void loadSupplierProducts(productTerm);
    }, 300);
    return () => {
      if (productTimer.current) window.clearTimeout(productTimer.current);
    };
  }, [productTerm, supplierId, loadSupplierProducts]);

  function handleSupplierChange(v: string) {
    setSupplierId(v);
    setProductId("");
    setBatchId("");
    setBatches([]);
    setProductTerm("");
  }

  function handleProductChange(newProductId: string) {
    setProductId(newProductId);
    setBatchId("");
    setBatches([]);
  }

  function handleLocationChange(newLocationId: string) {
    setLocationId(newLocationId);
    setBatchId("");
  }

  // ── Supplier-owned batches for the selected product (+ location) ───────────

  const loadBatches = useCallback(async () => {
    if (!supplierId || !productId) {
      setBatches([]);
      return;
    }
    const seq = ++batchSeq.current;
    setBatchesLoading(true);
    try {
      // GET /suppliers/{supplierId}/products/{productId}/batches — only batches
      // traceable to the supplier (Batch.supplierId), FEFO-sorted, with stock
      // at the selected location when given.
      const res = await getSupplierProductBatches(supplierId, productId, {
        locationId: locationId || undefined,
        inStock: true,
        excludeExpired: true,
      });
      if (seq !== batchSeq.current) return;
      setBatches(res.data);
    } catch {
      if (seq === batchSeq.current) setBatches([]);
    } finally {
      if (seq === batchSeq.current) setBatchesLoading(false);
    }
  }, [supplierId, productId, locationId]);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  function getAvailableStock(id: string | null): number {
    if (!id) return 0;
    const b = batches.find((x) => x.id === id);
    if (!b) return 0;
    const rows = b.locations ?? [];
    if (locationId) {
      return rows.find((l) => l.locationId === locationId)?.availableQuantity ?? 0;
    }
    return rows.reduce((sum, l) => sum + l.availableQuantity, 0);
  }

  const selectedProductOption = productOptions.find((o) => o.value === productId) ?? null;
  const selectedProductName = selectedProductOption?.label ?? productId;
  const selectedSupplierName = selectedSupplierOption?.label ?? supplierId;
  const selectedLocationName = selectedLocationOption?.label ?? locationId;
  const selectedBatch = batches.find((b) => b.id === batchId) ?? null;
  const parsedUnitCost = parseFloat(unitCost) || 0;
  const parsedDebit = parseFloat(debitNoteAmount) || 0;
  const estimatedValue = Number(quantity) * parsedUnitCost;

  const canSubmit =
    !!supplierId &&
    !!productId &&
    !!locationId &&
    quantity > 0 &&
    parsedUnitCost > 0 &&
    (!batchId || getAvailableStock(batchId) >= quantity);

  function confirmAndSubmit() {
    if (!supplierId || !productId || !locationId) {
      setError("Supplier, Product and Location are required.");
      return;
    }
    if (quantity <= 0 || parsedUnitCost <= 0) {
      setError("Quantity and Unit Cost must be greater than zero.");
      return;
    }
    if (batchId) {
      const available = getAvailableStock(batchId);
      if (quantity > available) {
        setError(`Insufficient stock for the selected batch. Available: ${available}, Requested: ${quantity}`);
        return;
      }
    }
    setError("");
    setSuccess("");
    setConfirmOpen(true);
  }

  async function handleSubmit() {
    if (!supplierId || !productId || !locationId) {
      setError("Supplier, Product and Location are required.");
      return;
    }
    if (quantity <= 0 || parsedUnitCost <= 0) {
      setError("Quantity and Unit Cost must be greater than zero.");
      return;
    }
    if (batchId) {
      const available = getAvailableStock(batchId);
      if (quantity > available) {
        setError(`Insufficient stock for the selected batch. Available: ${available}, Requested: ${quantity}`);
        return;
      }
    }
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      // POST /purchase-returns — the backend re-validates supplier/product/batch
      // ownership and live stock under lock; batchId/unitCost optional fields as
      // documented.
      await createPurchaseReturn({
        supplierId,
        productId,
        batchId: batchId || null,
        locationId,
        reason,
        quantity: Number(quantity),
        unitCost: parsedUnitCost,
        debitNoteAmount: debitNoteAmount ? parsedDebit : undefined,
        notes: notes || null,
      });
      setSuccess("Purchase return recorded successfully.");
      setShowForm(false);
      setConfirmOpen(false);
      setSupplierId("");
      setProductId("");
      setBatchId("");
      setLocationId("");
      setBatches([]);
      setReason("EXPIRED");
      setQuantity(1);
      setUnitCost("");
      setDebitNoteAmount("");
      setNotes("");
      void loadReturns();
    } catch (e) {
      setError(e instanceof PurchaseReturnsApiError ? e.message : "Failed to create purchase return.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none disabled:bg-[#E6ECE2]/40 disabled:text-[#999]";

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Purchase Returns"
        subtitle="Purchasing → Returns"
        actions={
          !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-[#B6C8AF] border border-[#B6C8AF] px-4 py-2 text-sm font-semibold text-[#333333] hover:bg-[#A5B89E] transition-colors"
            >
              + New Return
            </button>
          )
        }
      />

      <div className="flex-1 overflow-y-auto pb-8">
        {success && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm border border-green-200">
            {success}
          </div>
        )}

        {/* New Return Form */}
        {showForm && (
          <div className="px-4 sm:px-6 py-4">
            <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-[#333333]">New Purchase Return</h2>
                <button onClick={() => setShowForm(false)} className="text-sm text-gray-400 hover:text-gray-600">✕ Cancel</button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Supplier *</label>
                  <SearchableSelect
                    value={supplierId || null}
                    onChange={handleSupplierChange}
                    options={supplierOptions}
                    onSearch={supplierSearch.setTerm}
                    loading={supplierSearch.loading}
                    error={supplierSearch.error}
                    onRetry={supplierSearch.retry}
                    placeholder="— Select Supplier —"
                    searchPlaceholder="Search suppliers..."
                    emptyMessage="No suppliers found"
                    noResultsMessage="No suppliers matching your search"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Product *</label>
                  <SearchableSelect
                    value={productId || null}
                    onChange={handleProductChange}
                    options={productOptions}
                    onSearch={(t) => setProductTerm(t)}
                    loading={productsLoading}
                    error={productsError}
                    onRetry={() => void loadSupplierProducts(productTerm)}
                    disabled={!supplierId}
                    placeholder={!supplierId ? "— Select Supplier First —" : "— Select Product —"}
                    searchPlaceholder="Search by name or SKU..."
                    emptyMessage={!supplierId ? "Select a supplier first" : "No products ordered from this supplier"}
                    noResultsMessage="No matching products from this supplier"
                    footerHint="Only products ordered from the selected supplier are listed."
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Location *</label>
                  <SearchableSelect
                    value={locationId || null}
                    onChange={handleLocationChange}
                    options={locationOptions}
                    onSearch={locationSearch.setTerm}
                    loading={locationSearch.loading}
                    error={locationSearch.error}
                    onRetry={locationSearch.retry}
                    placeholder="— Select Location —"
                    searchPlaceholder="Search locations..."
                    emptyMessage="No locations found"
                    noResultsMessage="No locations matching your search"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Batch <span className="text-xs font-normal">(supplier-owned, optional)</span></label>
                  <select
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    className={inputClass}
                    disabled={!productId || batchesLoading}
                  >
                    <option value="">
                      {!supplierId
                        ? "— Select a supplier first —"
                        : !productId
                        ? "— Select a product first —"
                        : batchesLoading
                        ? "Loading batches…"
                        : batches.length === 0
                        ? "— No supplier-owned batches in stock —"
                        : "— No specific batch —"}
                    </option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batchNumber} · Exp: {fmtDate(b.expiryDate)} · Available: {getAvailableStock(b.id)}
                      </option>
                    ))}
                  </select>
                  {batches.length === 0 && productId && !batchesLoading && (
                    <p className="mt-1 text-xs text-[#666666]">
                      This product has no batches yet.{" "}
                      <Link to="/inventory/batches-expiry" className="text-[#49B0C1] hover:underline">Create a batch first</Link>{" "}
                      to return stock against it.
                    </p>
                  )}
                  {batchId && (
                    <p className="mt-1 text-xs text-[#666666]">
                      Available in selected batch: <strong>{getAvailableStock(batchId)}</strong>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Return Reason *</label>
                  <select value={reason} onChange={(e) => setReason(e.target.value as PurchaseReturnReason)} className={inputClass}>
                    {Object.entries(REASON_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Quantity (base units) *</label>
                  <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Unit Cost *</label>
                  <input type="number" min={0.01} step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="0.00" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Debit Note Amount</label>
                  <input type="number" min={0} step="0.01" value={debitNoteAmount} onChange={(e) => setDebitNoteAmount(e.target.value)} placeholder="Optional" className={inputClass} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-[#666666] mb-1">Notes</label>
                  <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." className={`${inputClass} resize-none`} />
                </div>
              </div>

              {productId && quantity > 0 && parsedUnitCost > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-[#E6ECE2] text-sm text-[#333333]">
                  <strong>Summary:</strong> Return {quantity} × {selectedProductName || "?"} — Total Value: <strong>{fmtMoney(estimatedValue)}</strong>
                  {selectedBatch && ` · Batch: ${selectedBatch.batchNumber}`}
                </div>
              )}

              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#E6ECE2]">
                <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button
                  onClick={confirmAndSubmit}
                  disabled={saving || !canSubmit}
                >
                  {saving ? "Recording…" : "Record Return"}
                </Button>
                {canSubmit && !saving && (
                  <span className="text-xs text-[#666666]">
                    Recording a return deducts {quantity} from the selected {locationId ? "location" : "batch"} and cannot be undone.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Returns history */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E6ECE2] flex items-center justify-between">
              <h3 className="font-bold text-[#333333]">Return History</h3>
              <span className="text-sm text-[#666666]">{totalCount} records</span>
            </div>
            {returnsLoading ? (
              <div className="py-8 text-center text-[#666666] text-sm">Loading…</div>
            ) : returnsError ? (
              <div className="py-8 text-center">
                <p className="text-sm text-red-600 mb-3">{returnsError}</p>
                <button onClick={() => void loadReturns()} className="text-sm font-semibold text-[#7A9076] hover:underline">
                  Retry
                </button>
              </div>
            ) : returns.length === 0 ? (
              <div className="py-8 text-center text-[#666666] text-sm">
                No purchase returns recorded yet.
                <button onClick={() => setShowForm(true)} className="ml-2 text-[#7A9076] hover:underline">+ Record a return</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="bg-[#E6ECE2]/50">
                      {["Return #", "Supplier", "Product", "Reason", "Qty", "Unit Cost", "Debit Note", "Returned", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {returns.map((ret, i) => (
                      <tr key={ret.id} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666]">{ret.returnNumber}</td>
                        <td className="px-4 py-3 text-[#333333]">{ret.supplier?.name ?? "—"}</td>
                        <td className="px-4 py-3 font-medium text-[#333333]">{ret.product?.name ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${REASON_BADGE[ret.reason] ?? "bg-gray-100 text-gray-600"}`}>
                            {REASON_LABELS[ret.reason] ?? ret.reason}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-[#333333]">{ret.quantity}</td>
                        <td className="px-4 py-3 text-right text-[#333333]">{fmtMoney(ret.unitCost)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#333333]">{fmtMoney(ret.debitNoteAmount)}</td>
                        <td className="px-4 py-3 text-[#666666]">{fmtDate(ret.returnedDate)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link to={`/purchasing/returns/${ret.id}`} className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap">
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stock-impact confirmation */}
      <ConfirmationDialog
        open={confirmOpen}
        title="Confirm Purchase Return?"
        message={`Return ${quantity} × ${selectedProductName || "product"} to ${selectedBatch ? `batch ${selectedBatch.batchNumber} · ` : ""}${selectedSupplierName || "supplier"}. This will permanently reduce stock at ${selectedLocationName || "the selected location"} by ${quantity} base units — the movement is recorded in the stock ledger and cannot be reversed.`}
        confirmLabel="Record Return"
        danger
        loading={saving}
        onConfirm={() => void handleSubmit()}
        onCancel={() => { setConfirmOpen(false); setError(""); }}
      />
    </div>
  );
}