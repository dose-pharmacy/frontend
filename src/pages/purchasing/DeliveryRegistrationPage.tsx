import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ChevronRight } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import { listPurchaseOrders, getPurchaseOrder, type PurchaseOrderDto, type POItemDto, PurchaseOrdersApiError } from "../../features/purchasing/purchaseOrdersApi";
import { createGoodsReceipt, type CreateGoodsReceiptInput, GoodsReceiptsApiError } from "../../features/purchasing/goodsReceiptsApi";
import { listLocations, type LocationDto } from "../../features/inventory/locationsApi";
import { listSuppliers, type SupplierDto } from "../../features/purchasing/suppliersApi";

interface GRItemRow {
  purchaseOrderItemId: string;
  productName: string;
  quantityOrdered: number;
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
  const [orders, setOrders] = useState<PurchaseOrderDto[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [selectedPoId, setSelectedPoId] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrderDto | null>(null);
  const [poLoading, setPoLoading] = useState(false);
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
  const [discrepancyNote, setDiscrepancyNote] = useState("");
  const [items, setItems] = useState<GRItemRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listPurchaseOrders({ status: "AWAITING_DELIVERY", limit: 100 })
      .then((r) => setOrders(r.data))
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }, []);

  // Reload POs filtered by selected supplier
  useEffect(() => {
    const controller = new AbortController()
    listPurchaseOrders({ status: "AWAITING_DELIVERY", limit: 100, supplierId: supplierFilter || undefined })
      .then((r) => { if (!controller.signal.aborted) setOrders(r.data) })
      .catch(() => {})
    return () => controller.abort()
  }, [supplierFilter]);

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
        (po.items ?? []).map((item: POItemDto) => ({
          purchaseOrderItemId: item.id,
          productName: (item as any).product?.name ?? `Product (${item.productId.slice(0, 8)})`,
          quantityOrdered: item.quantityOrdered,
          locationId: locations[0]?.id ?? "",
          deliveredQty: item.quantityOrdered,
          actualQty: item.quantityOrdered,
          batchNumber: "",
          manufacturingDate: "",
          expiryDate: "",
        }))
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

  const hasDiscrepancy = items.some((item) => item.actualQty !== item.quantityOrdered);

  async function handleSubmit() {
    if (!selectedPoId) {
      setError("Please select a Purchase Order.");
      return;
    }
    const missingBatch = items.some((i) => i.actualQty > 0 && !i.batchNumber.trim());
    if (missingBatch) {
      setError("Batch number is required for all items with actual quantity > 0.");
      return;
    }
    const missingExpiry = items.some((i) => i.actualQty > 0 && !i.expiryDate.trim());
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
      navigate(`/purchasing/deliveries/${receipt.id}/reconcile`);
    } catch (err) {
      if (err instanceof GoodsReceiptsApiError) {
        setError(err.message);
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
        subtitle="Purchasing / Goods Receipts / New"
        actions={
          <button
            onClick={handleSubmit}
            disabled={!selectedPoId || saving || items.length === 0}
            className="rounded-lg border border-[#C6D4BF] bg-white px-4 py-2 text-sm font-semibold text-[#7A9076] hover:bg-[#E6ECE2] transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {saving ? "Registering…" : (<span className="inline-flex items-center gap-1.5">Register Receipt <ChevronRight className="h-4 w-4" /></span>)}
          </button>
        }
      />

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
                <select
                  value={supplierFilter}
                  onChange={(e) => { setSupplierFilter(e.target.value); setSelectedPoId(""); setSelectedPo(null); setItems([]); }}
                  className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none"
                >
                  <option value="">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Purchase Order</label>
                <select
                  value={selectedPoId}
                  onChange={(e) => handlePoSelect(e.target.value)}
                  disabled={ordersLoading}
                  className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none"
                >
                  <option value="">{ordersLoading ? "Loading…" : "— Select PO (Awaiting Delivery) —"}</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.poNumber} — {o.supplier?.name ?? o.supplierId}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Supplier</label>
                <input readOnly value={selectedPo?.supplier?.name ?? ""} placeholder="Auto-filled from PO" className="w-full rounded-lg border border-[#C6D4BF] bg-[#E6ECE2] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Received Date</label>
                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none" />
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
                    {["#", "Product", "Ordered", "Location", "Delivered Qty", "Actual Qty", "Batch #", "Mfg Date", "Expiry Date"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-[#333333] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const isDiscrepancy = item.actualQty !== item.quantityOrdered;
                    return (
                      <tr key={item.purchaseOrderItemId} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}>
                        <td className="px-3 py-2.5 text-[#666666]">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-[#333333]">{item.productName}</td>
                        <td className="px-3 py-2.5 text-[#333333] font-semibold">{item.quantityOrdered}</td>
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
                          <input type="number" min={0} value={item.deliveredQty} onChange={(e) => updateItem(item.purchaseOrderItemId, "deliveredQty", Number(e.target.value))} className="w-16 rounded border border-[#C6D4BF] bg-white px-2 py-1 text-sm focus:outline-none" />
                        </td>
                        <td className="px-3 py-2.5">
                          <input type="number" min={0} value={item.actualQty} onChange={(e) => updateItem(item.purchaseOrderItemId, "actualQty", Number(e.target.value))} className={`w-16 rounded border px-2 py-1 text-sm focus:outline-none ${isDiscrepancy ? "border-red-300 bg-red-50" : "border-[#C6D4BF] bg-white"}`} />
                        </td>
                        <td className="px-3 py-2.5">
                          <input value={item.batchNumber} onChange={(e) => updateItem(item.purchaseOrderItemId, "batchNumber", e.target.value)} placeholder="BATCH-001" className="w-24 rounded border border-[#C6D4BF] bg-white px-2 py-1 text-xs focus:outline-none" />
                        </td>
                        <td className="px-3 py-2.5">
                          <input type="date" value={item.manufacturingDate} onChange={(e) => updateItem(item.purchaseOrderItemId, "manufacturingDate", e.target.value)} className="w-32 rounded border border-[#C6D4BF] bg-white px-2 py-1 text-xs focus:outline-none" />
                        </td>
                        <td className="px-3 py-2.5">
                          <input type="date" value={item.expiryDate} onChange={(e) => updateItem(item.purchaseOrderItemId, "expiryDate", e.target.value)} className="w-32 rounded border border-[#C6D4BF] bg-white px-2 py-1 text-xs focus:outline-none" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasDiscrepancy && (
              <div className="mt-3 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-2.5 text-sm text-yellow-700 flex items-start gap-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden>
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                </svg>
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
          className="rounded-lg bg-[#B6C8AF] px-6 py-2.5 text-sm font-bold text-[#333333] hover:bg-[#A0B59C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {saving ? "Registering…" : (<span className="inline-flex items-center gap-1.5">Register Receipt <ChevronRight className="h-4 w-4" /></span>)}
        </button>
      </div>
    </div>
  );
}
