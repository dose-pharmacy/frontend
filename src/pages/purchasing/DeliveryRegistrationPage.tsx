import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import PageHeader from "../../components/ui/PageHeader";
import { listPurchaseOrders, getPurchaseOrder, type PurchaseOrderDto, type POItemDto, PurchaseOrdersApiError } from "../../features/purchasing/purchaseOrdersApi";
import { createGoodsReceipt, type CreateGoodsReceiptInput, GoodsReceiptsApiError } from "../../features/purchasing/goodsReceiptsApi";
import { listLocations, type LocationDto } from "../../features/inventory/locationsApi";
import { listSuppliers, type SupplierDto } from "../../features/purchasing/suppliersApi";
import SearchableSelect, { type SearchableOption } from "../../components/ui/SearchableSelect";
import { useSearchableResource } from "../../hooks/useSearchableResource";
import { searchSuppliers } from "../../features/inventory/searchSelectors";
import { IconWarningTriangle, IconTrash } from "../../components/ui/icons";
import DatePicker from "../../components/ui/DatePicker";
import { Toast } from "./PurchaseOrdersPage";

interface GRItemRow {
  purchaseOrderItemId: string;
  productName: string;
  /** Unit the PO quantities are expressed in (blank = base unit). */
  unitLabel: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityShort: number;
  locationId: string;
  deliveredQty: number;
  actualQty: number;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DeliveryRegistrationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Deep-link support: "Go to Deliveries / Receive Goods" on the PO detail page
  // lands here with the PO (and supplier) already selected.
  const prefillPOId = searchParams.get("purchaseOrderId") || "";
  const prefillSupplierId = searchParams.get("supplierId") || "";
  // "scan" is no longer a mode here — Scan / Upload Receipt is its own page
  // (/purchasing/deliveries/new/scan).
  const [mode, setMode] = useState<"manual" | null>(null);
  const [orders, setOrders] = useState<PurchaseOrderDto[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [ordersReload, setOrdersReload] = useState(0);
  const [selectedPoId, setSelectedPoId] = useState("");
  // Receivable-item preview for the currently selected PO (hover card). Fetched
  // once per PO and cached — reused until a different PO is selected.
  const [poProducts, setPoProducts] = useState<POItemDto[] | null>(null);
  const [poProductsLoading, setPoProductsLoading] = useState(false);
  const [poProductsError, setPoProductsError] = useState(false);
  const [showPoPreview, setShowPoPreview] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const supplierSearch = useSearchableResource(searchSuppliers, true);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrderDto | null>(null);
  const [poLoading, setPoLoading] = useState(false);
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
  const [discrepancyNote, setDiscrepancyNote] = useState("");
  const [items, setItems] = useState<GRItemRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  // Delays the post-save navigation so the success toast is visible; cleared
  // if the user leaves before the timer fires.
  const navTimer = useRef<number | null>(null);
  useEffect(() => () => { if (navTimer.current) window.clearTimeout(navTimer.current); }, []);

  // Apply deep-link prefill once: select the supplier and remember to auto-pick
  // the PO once its items can be loaded (locations must already be available).
  useEffect(() => {
    if (prefillSupplierId) setSupplierFilter(prefillSupplierId);
  }, [prefillSupplierId]);

  const autoSelectPending = prefillPOId && !selectedPoId && locations.length > 0;
  useEffect(() => {
    if (autoSelectPending) {
      void handlePoSelect(prefillPOId);
    }
    // Auto-run only once the deep-linked PO is ready to load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectPending]);

  // Load ONLY receivable purchase orders. The backend decides which POs still
  // have remaining quantity via receivable=true (includes AWAITING_DELIVERY and
  // PARTIALLY_RECEIVED) — no client-side status filtering. Selecting a supplier
  // narrows the same receivable query to that supplier.
  useEffect(() => {
    const controller = new AbortController();
    setOrdersLoading(true);
    setOrdersError("");
    listPurchaseOrders({ limit: 100, receivable: true, supplierId: supplierFilter || undefined })
      .then((r) => {
        if (controller.signal.aborted) return;
        setOrders(r.data);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setOrdersError("Failed to load receivable purchase orders.");
        setOrders([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setOrdersLoading(false);
      });
    return () => controller.abort();
  }, [supplierFilter, ordersReload]);

  // Fetch the selected PO's receivable items for the hover preview. Cached per
  // PO: re-requested only when the selected PO changes, never on hover itself.
  useEffect(() => {
    if (!selectedPoId) {
      setPoProducts(null);
      setPoProductsError(false);
      setPoProductsLoading(false);
      return;
    }
    setPoProducts(null);
    setPoProductsError(false);
    setPoProductsLoading(true);
    const controller = new AbortController();
    getPurchaseOrder(selectedPoId, { receivableItems: true })
      .then((dto) => {
        if (controller.signal.aborted) return;
        // The backend already returns only receivable items (quantityRemaining
        // > 0) — display them exactly as returned, no client-side filtering.
        setPoProducts(dto.items ?? []);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setPoProductsError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPoProductsLoading(false);
      });
    return () => controller.abort();
  }, [selectedPoId]);

  useEffect(() => {
    listSuppliers({ limit: 100, isActive: true })
      .then((r) => setSuppliers(r.data))
      .catch(() => {});
    listLocations({ isActive: true, limit: 100 })
      .then((r) => setLocations(r.data))
      .catch(() => {});
  }, []);

  async function handlePoSelect(poId: string) {
    setSelectedPoId(poId);
    if (!poId) {
      setSelectedPo(null);
      setItems([]);
      return;
    }
    setPoLoading(true);
    try {
      const po = await getPurchaseOrder(poId);
      setSelectedPo(po);
      setItems(
        (po.items ?? []).map((item: POItemDto) => {
          const ordered = item.quantityOrdered ?? 0;
          const received = item.quantityReceived ?? 0;
          const short = item.quantityShort ?? 0;
          // Default to what's still outstanding (ordered − received − shortage).
          const remaining = Math.max(0, ordered - received - short);
          return {
            purchaseOrderItemId: item.id,
            productName: (item as any).product?.name ?? `Product (${item.productId.slice(0, 8)})`,
            unitLabel: item.unit?.name ?? "",
            quantityOrdered: ordered,
            quantityReceived: received,
            quantityShort: short,
            locationId: locations[0]?.id ?? "",
            deliveredQty: remaining,
            actualQty: remaining,
            batchNumber: "",
            manufacturingDate: "",
            expiryDate: "",
          };
        })
      );
    } catch (e) {
      setError("Failed to load purchase order details.");
    } finally {
      setPoLoading(false);
    }
  }

  function updateItem(purchaseOrderItemId: string, field: keyof GRItemRow, value: string | number) {
    setItems((prev) =>
      prev.map((item) => item.purchaseOrderItemId === purchaseOrderItemId ? { ...item, [field]: value } : item)
    );
  }

  function removeItem(purchaseOrderItemId: string) {
    setItems((prev) => prev.filter((item) => item.purchaseOrderItemId !== purchaseOrderItemId));
  }

  const hasDiscrepancy = items.some((item) => item.actualQty !== item.deliveredQty);

  const supplierFilterOptions: SearchableOption[] = [
    ...suppliers.map((s) => ({ value: s.id, label: s.name, sub: s.contactPerson ?? (s.email ?? undefined) })),
    ...supplierSearch.options.filter((o) => !suppliers.some((s) => s.id === o.value)),
  ];

  async function handleSubmit() {
    if (!selectedPoId) {
      setError("Please select a Purchase Order.");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one receiving item before registering the receipt.");
      return;
    }
    // Location and quantity checks first — the backend would reject these too,
    // but surfacing them here lets the user correct the form immediately.
    const missingLocation = items.some((i) => !i.locationId);
    if (missingLocation) {
      setError("Please select a receiving location for every item.");
      return;
    }
    const invalidQty = items.some((i) => Number(i.deliveredQty) <= 0 || Number(i.actualQty) <= 0);
    if (invalidQty) {
      setError("Delivered and actual quantities must be greater than zero.");
      return;
    }
    const missingBatch = items.some((i) => Number(i.actualQty) > 0 && !i.batchNumber.trim());
    if (missingBatch) {
      setError("Batch number is required for all items with actual quantity > 0.");
      return;
    }
    const missingExpiry = items.some((i) => Number(i.actualQty) > 0 && !i.expiryDate.trim());
    if (missingExpiry) {
      setError("Expiry date is required for all items with actual quantity > 0.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const input: CreateGoodsReceiptInput = {
        receivedDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
        discrepancyNote: discrepancyNote || undefined,
        items: items.map((item) => ({
          purchaseOrderItemId: item.purchaseOrderItemId,
          locationId: item.locationId,
          deliveredQty: Number(item.deliveredQty),
          actualQty: Number(item.actualQty),
          batchNumber: item.batchNumber || undefined,
          manufacturingDate: item.manufacturingDate ? new Date(item.manufacturingDate).toISOString() : undefined,
          expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString() : undefined,
        })),
      };
      const receipt = await createGoodsReceipt(selectedPoId, input);
      // Keep `saving` true so the buttons stay disabled (no duplicate submit)
      // while the success message shows, then continue the existing flow.
      setToast("Goods receipt registered successfully.");
      navTimer.current = window.setTimeout(() => {
        navigate(`/purchasing/deliveries/${receipt.id}/reconcile`);
      }, 1000);
    } catch (err) {
      if (err instanceof GoodsReceiptsApiError) {
        if (err.status === 401) {
          setError("Your session has expired. Please sign in again.");
        } else if (err.status === 403) {
          setError("You do not have permission to register goods receipts.");
        } else if (err.status === 404) {
          setError("The selected Purchase Order was not found.");
        } else {
          // Backend quantity/validation messages are surfaced as-is.
          setError(err.message);
        }
      } else {
        setError("Failed to create goods receipt. Please try again.");
      }
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Register Goods Receipt"
        subtitle="Purchasing → Goods Receipts → New"
        actions={
          mode === "manual" ? (
            <button
              onClick={handleSubmit}
              disabled={!selectedPoId || saving || items.length === 0}
              className="rounded-lg bg-[#B6C8AF] border border-[#B6C8AF] px-4 py-2 text-sm font-semibold text-[#333333] hover:bg-[#A5B89E] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Registering…" : "Register Receipt →"}
            </button>
          ) : undefined
        }
      />

      {/* Method selector */}
      <div className="px-4 sm:px-6 py-4 flex-shrink-0">
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
          <h2 className="text-base font-bold text-[#333333] mb-1">
            How would you like to register this receipt?
          </h2>
          <p className="text-xs text-[#999] mb-4">
            Choose how you want to capture the delivery and receiving information.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`rounded-xl border p-5 flex flex-col gap-3 transition-colors ${mode === "manual" ? "border-[#7A9076] bg-[#E6ECE2]/40" : "border-[#E6ECE2] bg-white"}`}>
              <div>
                <p className="font-bold text-[#333333]">Enter Manually</p>
                <p className="text-sm text-[#666666] mt-1">
                  Enter delivery and receiving information manually.
                </p>
              </div>
              <button
                onClick={() => setMode("manual")}
                className="mt-auto rounded-lg bg-[#B6C8AF] border border-[#B6C8AF] px-4 py-2 text-sm font-semibold text-[#333333] hover:bg-[#A5B89E] transition-colors"
              >
                Continue Manually
              </button>
            </div>
            <div className={`rounded-xl border p-5 flex flex-col gap-3 transition-colors border-[#E6ECE2] bg-white`}>
              <div>
                <p className="font-bold text-[#333333]">Scan / Upload Receipt</p>
                <p className="text-sm text-[#666666] mt-1">
                  Scan or upload the supplier receipt and let the system extract the receiving information.
                </p>
              </div>
              <button
                onClick={() => navigate("/purchasing/deliveries/new/scan")}
                className="mt-auto rounded-lg bg-[#C6D4BF] border border-[#C6D4BF] px-4 py-2 text-sm font-semibold text-[#333333] hover:bg-[#B5C6AE] transition-colors"
              >
                Scan / Upload Receipt
              </button>
            </div>
          </div>
        </div>
      </div>

      {mode === null && (
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-24">
          <div className="rounded-xl border border-[#E6ECE2] bg-white p-6 text-sm text-[#666666]">
            Select a method above to begin registering this receipt.
          </div>
        </div>
      )}

      {mode === "manual" && (
        <>
          <div className="flex-1 overflow-y-auto pb-24">
        {error && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        {/* PO selection */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-[#E6ECE2] rounded-xl p-5">
            <h2 className="text-base font-bold text-[#333333] mb-4">Delivery Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#666666] mb-1">Supplier</label>
                <SearchableSelect
                  value={supplierFilter || null}
                  onChange={(v) => { setSupplierFilter(v); setSelectedPoId(""); setSelectedPo(null); setItems([]); }}
                  options={supplierFilterOptions}
                  onSearch={supplierSearch.setTerm}
                  loading={supplierSearch.loading}
                  error={supplierSearch.error}
                  onRetry={supplierSearch.retry}
                  allowClear
                  placeholder="All Suppliers"
                  searchPlaceholder="Search by name, contact or email..."
                  emptyMessage="No suppliers available"
                  noResultsMessage="No suppliers matching your search"
                />
              </div>
              <div
                className="relative"
                onMouseEnter={() => {
                  if (selectedPoId) setShowPoPreview(true);
                }}
                onMouseLeave={() => setShowPoPreview(false)}
              >
                <label className="block text-sm text-[#666666] mb-1">Purchase Order</label>
                <select
                  value={selectedPoId}
                  onChange={(e) => handlePoSelect(e.target.value)}
                  onFocus={() => setShowPoPreview(false)}
                  onBlur={() => setShowPoPreview(false)}
                  disabled={ordersLoading}
                  className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none"
                >
                  <option value="">
                    {ordersLoading
                      ? "Loading purchase orders…"
                      : ordersError
                      ? "Failed to load purchase orders — retry below"
                      : "— Select Purchase Order —"}
                  </option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.poNumber} —{" "}
                      {o.supplier?.name ??
                        suppliers.find((s) => s.id === o.supplierId)?.name ??
                        o.supplierId}
                    </option>
                  ))}
                </select>
                {!ordersLoading && !ordersError && orders.length === 0 && (
                  <p className="mt-1.5 text-xs text-[#666666]">No receivable purchase orders found.</p>
                )}
                {ordersError && (
                  <p className="mt-1.5 flex items-center gap-2 text-xs text-red-600">
                    {ordersError}
                    <button
                      type="button"
                      onClick={() => setOrdersReload((t) => t + 1)}
                      className="font-semibold underline underline-offset-2 hover:text-red-700"
                    >
                      Retry
                    </button>
                  </p>
                )}
                {showPoPreview && selectedPoId && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-[#C6D4BF] bg-white shadow-lg">
                    <div className="border-b border-[#E6ECE2] px-3 py-2 text-xs font-semibold text-[#7A9076]">
                      Products in this PO
                    </div>
                    <div className="max-h-56 overflow-y-auto p-2">
                      {poProductsLoading ? (
                        <p className="px-2 py-1.5 text-sm text-[#666666]">Loading products...</p>
                      ) : poProductsError ? (
                        <p className="px-2 py-1.5 text-sm text-red-600">Unable to load PO products.</p>
                      ) : poProducts && poProducts.length > 0 ? (
                        <ul className="flex flex-col">
                          {poProducts.map((item, idx) => (
                            <li key={item.product?.id ?? idx} className="px-2 py-1.5">
                              <p className="text-sm font-semibold text-[#333333]">
                                {item.product?.name ?? "Unnamed product"}
                              </p>
                              <p className="text-xs text-[#666666]">SKU: {item.product?.sku ?? "—"}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="px-2 py-1.5 text-sm text-[#666666]">No receivable products found.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Supplier</label>
                <input readOnly value={selectedPo?.supplier?.name ?? ""} placeholder="Auto-filled from PO" className="w-full rounded-lg border border-[#C6D4BF] bg-[#E6ECE2] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Received Date</label>
                <DatePicker
                  value={deliveryDate}
                  onChange={setDeliveryDate}
                  placeholder="Select received date..."
                />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Expected Delivery</label>
                <input readOnly value={fmtDate(selectedPo?.expectedDeliveryDate)} className="w-full rounded-lg border border-[#C6D4BF] bg-[#E6ECE2] px-3 py-2 text-sm" />
              </div>
              {hasDiscrepancy && (
                <div className="sm:col-span-2">
                  <label className="block text-sm text-[#666666] mb-1">Discrepancy Note <span className="text-red-500">(required when quantities differ)</span></label>
                  <textarea rows={2} value={discrepancyNote} onChange={(e) => setDiscrepancyNote(e.target.value)} placeholder="Explain the discrepancy…" className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none resize-none" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items table */}
        {poLoading && (
          <div className="px-4 sm:px-6 py-4 text-center text-[#666666]">Loading PO items…</div>
        )}
        {!poLoading && items.length > 0 && (
          <div className="px-4 sm:px-6">
            <div className="rounded-xl border border-[#E6ECE2] overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-[#C6D4BF]">
                    {["#", "Product", "Ordered", "Received", "Location", "Delivered Qty", "Actual Qty", "Batch #", "Mfg Date", "Expiry Date"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-[#333333] whitespace-nowrap">{h}</th>
                    ))}
                    <th key="__actions" className="px-3 py-2.5" aria-label="Actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const isDiscrepancy = item.actualQty !== item.deliveredQty;
                    return (
                      <tr key={item.purchaseOrderItemId} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}>
                        <td className="px-3 py-2.5 text-[#666666]">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-[#333333]">{item.productName}</td>
                        <td className="px-3 py-2.5 text-[#333333] font-semibold">
                          {item.quantityOrdered}
                          {item.unitLabel && <span className="ml-1 text-xs font-normal text-[#999]">{item.unitLabel}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-[#666666]">
                          {item.quantityReceived}
                          {item.unitLabel && <span className="ml-1 text-xs font-normal text-[#999]">{item.unitLabel}</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            value={item.locationId}
                            onChange={(e) => updateItem(item.purchaseOrderItemId, "locationId", e.target.value)}
                            className="rounded border border-[#C6D4BF] bg-white px-2 py-1 text-xs focus:border-[#B6C8AF] focus:outline-none w-full"
                          >
                            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <input type="number" min={0} value={item.deliveredQty} onChange={(e) => updateItem(item.purchaseOrderItemId, "deliveredQty", Number(e.target.value))} className="w-16 rounded border border-[#C6D4BF] bg-white px-2 py-1 text-sm focus:outline-none" />
                            {item.unitLabel && <span className="text-[10px] text-[#999] whitespace-nowrap">{item.unitLabel}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <input type="number" min={0} value={item.actualQty} onChange={(e) => updateItem(item.purchaseOrderItemId, "actualQty", Number(e.target.value))} className={`w-16 rounded border px-2 py-1 text-sm focus:outline-none ${isDiscrepancy ? "border-red-300 bg-red-50" : "border-[#C6D4BF] bg-white"}`} />
                            {item.unitLabel && <span className="text-[10px] text-[#999] whitespace-nowrap">{item.unitLabel}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <input value={item.batchNumber} onChange={(e) => updateItem(item.purchaseOrderItemId, "batchNumber", e.target.value)} placeholder="BATCH-001" className="w-24 rounded border border-[#C6D4BF] bg-white px-2 py-1 text-xs focus:outline-none" />
                        </td>
                        <td className="px-3 py-2.5">
                          <DatePicker
                            value={item.manufacturingDate}
                            onChange={(v) => updateItem(item.purchaseOrderItemId, "manufacturingDate", v)}
                            placeholder="Mfg date"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <DatePicker
                            value={item.expiryDate}
                            onChange={(v) => updateItem(item.purchaseOrderItemId, "expiryDate", v)}
                            placeholder="Expiry date"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => removeItem(item.purchaseOrderItemId)}
                            title="Remove item"
                            aria-label={`Remove ${item.productName}`}
                            className="rounded-lg p-1.5 text-[#B6575A] hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <IconTrash className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasDiscrepancy && (
              <div className="mt-3 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-2.5 text-sm text-yellow-700 flex items-start gap-2">
                <IconWarningTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-600" />
                <span>Some quantities differ from what was ordered — this receipt will be marked as <strong>DISCREPANCY</strong> and require resolution before confirmation.</span>
              </div>
            )}
          </div>
        )}

        {!poLoading && selectedPoId && items.length === 0 && (
          <div className="px-4 sm:px-6 py-4 text-center text-[#666666] text-sm">
            No items found for this purchase order.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E6ECE2] px-4 sm:px-6 py-3 flex items-center justify-end gap-3 z-30">
        <button onClick={() => navigate("/purchasing/orders")} className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors">Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={!selectedPoId || saving || items.length === 0}
          className="rounded-lg bg-[#B6C8AF] px-6 py-2.5 text-sm font-bold text-[#333333] hover:bg-[#A5B89E] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Registering…" : "Register Receipt →"}
        </button>
      </div>
        </>
      )}

      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}