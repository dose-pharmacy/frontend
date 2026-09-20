import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import PageHeader from "../../components/ui/PageHeader";
import { listPurchaseOrders, getPurchaseOrder, type PurchaseOrderDto, type POItemDto, PurchaseOrdersApiError } from "../../features/purchasing/purchaseOrdersApi";
import { createGoodsReceipt, type CreateGoodsReceiptInput, GoodsReceiptsApiError } from "../../features/purchasing/goodsReceiptsApi";
import { listLocations, type LocationDto } from "../../features/inventory/locationsApi";

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
        po.items.map((item: POItemDto) => ({
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
        subtitle="Purchasing → Goods Receipts → New"
        actions={
          <button
            onClick={handleSubmit}
            disabled={!selectedPoId || saving || items.length === 0}
            className="rounded-lg bg-white/20 border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Registering…" : "Register Receipt →"}
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
          <div className="bg-[#DBEFF3] rounded-xl p-5">
            <h2 className="text-base font-bold text-[#333333] mb-4">Delivery Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#666666] mb-1">Purchase Order</label>
                <select
                  value={selectedPoId}
                  onChange={(e) => handlePoSelect(e.target.value)}
                  disabled={ordersLoading}
                  className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none"
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
                <input readOnly value={selectedPo?.supplier?.name ?? ""} placeholder="Auto-filled from PO" className="w-full rounded-lg border border-[#ABDBE3] bg-[#DBEFF3] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Received Date</label>
                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Expected Delivery</label>
                <input readOnly value={fmtDate(selectedPo?.expectedDeliveryDate)} className="w-full rounded-lg border border-[#ABDBE3] bg-[#DBEFF3] px-3 py-2 text-sm" />
              </div>
              {hasDiscrepancy && (
                <div className="sm:col-span-2">
                  <label className="block text-sm text-[#666666] mb-1">Discrepancy Note <span className="text-red-500">(required when quantities differ)</span></label>
                  <textarea rows={2} value={discrepancyNote} onChange={(e) => setDiscrepancyNote(e.target.value)} placeholder="Explain the discrepancy…" className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none resize-none" />
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
            <div className="rounded-xl border border-[#DBEFF3] overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-[#ABDBE3]">
                    {["#", "Product", "Ordered", "Location", "Delivered Qty", "Actual Qty", "Batch #", "Mfg Date", "Expiry Date"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-[#333333] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const isDiscrepancy = item.actualQty !== item.quantityOrdered;
                    return (
                      <tr key={item.purchaseOrderItemId} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                        <td className="px-3 py-2.5 text-[#666666]">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-[#333333]">{item.productName}</td>
                        <td className="px-3 py-2.5 text-[#333333] font-semibold">{item.quantityOrdered}</td>
                        <td className="px-3 py-2.5">
                          <select
                            value={item.locationId}
                            onChange={(e) => updateItem(item.purchaseOrderItemId, "locationId", e.target.value)}
                            className="rounded border border-[#ABDBE3] bg-white px-2 py-1 text-xs focus:border-[#49B0C1] focus:outline-none w-full"
                          >
                            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <input type="number" min={0} value={item.deliveredQty} onChange={(e) => updateItem(item.purchaseOrderItemId, "deliveredQty", Number(e.target.value))} className="w-16 rounded border border-[#ABDBE3] bg-white px-2 py-1 text-sm focus:outline-none" />
                        </td>
                        <td className="px-3 py-2.5">
                          <input type="number" min={0} value={item.actualQty} onChange={(e) => updateItem(item.purchaseOrderItemId, "actualQty", Number(e.target.value))} className={`w-16 rounded border px-2 py-1 text-sm focus:outline-none ${isDiscrepancy ? "border-red-300 bg-red-50" : "border-[#ABDBE3] bg-white"}`} />
                        </td>
                        <td className="px-3 py-2.5">
                          <input value={item.batchNumber} onChange={(e) => updateItem(item.purchaseOrderItemId, "batchNumber", e.target.value)} placeholder="BATCH-001" className="w-24 rounded border border-[#ABDBE3] bg-white px-2 py-1 text-xs focus:outline-none" />
                        </td>
                        <td className="px-3 py-2.5">
                          <input type="date" value={item.manufacturingDate} onChange={(e) => updateItem(item.purchaseOrderItemId, "manufacturingDate", e.target.value)} className="w-32 rounded border border-[#ABDBE3] bg-white px-2 py-1 text-xs focus:outline-none" />
                        </td>
                        <td className="px-3 py-2.5">
                          <input type="date" value={item.expiryDate} onChange={(e) => updateItem(item.purchaseOrderItemId, "expiryDate", e.target.value)} className="w-32 rounded border border-[#ABDBE3] bg-white px-2 py-1 text-xs focus:outline-none" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasDiscrepancy && (
              <div className="mt-3 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-2.5 text-sm text-yellow-700">
                ⚠ Some quantities differ from what was ordered — this receipt will be marked as <strong>DISCREPANCY</strong> and require resolution before confirmation.
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
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#DBEFF3] px-4 sm:px-6 py-3 flex items-center justify-end gap-3 z-30">
        <button onClick={() => navigate("/purchasing/orders")} className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors">Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={!selectedPoId || saving || items.length === 0}
          className="rounded-lg bg-[#49B0C1] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#3a9baf] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Registering…" : "Register Receipt →"}
        </button>
      </div>
    </div>
  );
}
