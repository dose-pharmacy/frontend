import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import PurchasingSubNav from "./PurchasingSubNav";
import PageHeader from "../../components/ui/PageHeader";
import { getPurchaseOrder, getSuppliers, fmtMoney } from "../../features/purchasing/purchasingService";
import type { PurchaseOrder, Supplier, POItem } from "../../features/purchasing/purchasingMock";

const PRODUCT_LIST = [
  { name: "Panadol 500mg", brand: "Panadol", price: 250 },
  { name: "Amoxicillin 500mg", brand: "Amoxicillin", price: 320 },
  { name: "Vitamin C 1000mg", brand: "VitaCare", price: 180 },
  { name: "Metformin 500mg", brand: "Glucophage", price: 95 },
  { name: "Omeprazole 20mg", brand: "Prilosec", price: 210 },
  { name: "Ibuprofen 400mg", brand: "Brufen", price: 120 },
  { name: "Aspirin 100mg", brand: "Disprin", price: 85 },
  { name: "Insulin Glargine", brand: "Lantus", price: 850 },
  { name: "Amlodipine 5mg", brand: "Norvasc", price: 145 },
  { name: "Vitamin D3 1000IU", brand: "D-Care", price: 220 },
];

const UNITS = ["Box", "Strip", "Tablet", "Bottle", "Vial", "Sachet"];

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-400 text-white",
  sent: "bg-[#49B0C1] text-white",
  delivered: "bg-purple-500 text-white",
  received: "bg-yellow-400 text-[#333333]",
  completed: "bg-green-500 text-white",
};

const newRef = `PO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;

export default function CreatePurchaseOrderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id && id !== "new");
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(isEdit);

  const [suppId, setSuppId] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [delivDate, setDelivDate] = useState("");
  const [payTerms, setPayTerms] = useState("Net 30");
  const [orderNotes, setOrderNotes] = useState("");
  const [address, setAddress] = useState("Pharmacy Main Store, Addis Ababa");
  const [items, setItems] = useState<POItem[]>([]);
  const [status, setStatus] = useState<string>("draft");

  const [addSearch, setAddSearch] = useState("");
  const [addQty, setAddQty] = useState(10);
  const [addUnit, setAddUnit] = useState("Box");
  const [addPrice, setAddPrice] = useState(0);
  const [addSuggestions, setAddSuggestions] = useState<typeof PRODUCT_LIST>([]);
  const [selectedAddProduct, setSelectedAddProduct] = useState<typeof PRODUCT_LIST[0] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      isEdit ? getPurchaseOrder(id!) : Promise.resolve(undefined),
      getSuppliers(),
    ]).then(([existingPo, sups]) => {
      setSuppliers(sups);
      if (existingPo) {
        setPo(existingPo);
        setSuppId(existingPo.supplierId);
        setOrderDate(existingPo.date);
        setDelivDate(existingPo.expectedDelivery);
        setPayTerms(existingPo.paymentTerms);
        setOrderNotes(existingPo.notes);
        setItems([...existingPo.items]);
        setStatus(existingPo.status);
      }
      setLoading(false);
    });
  }, [id, isEdit]);

  const supplier = suppliers.find((s) => s.id === suppId);
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  function handleAddSearch(v: string) {
    setAddSearch(v);
    if (v.length >= 2) setAddSuggestions(PRODUCT_LIST.filter((p) => p.name.toLowerCase().includes(v.toLowerCase())));
    else setAddSuggestions([]);
  }

  function selectProduct(p: typeof PRODUCT_LIST[0]) {
    setSelectedAddProduct(p);
    setAddSearch(p.name);
    setAddPrice(p.price);
    setAddSuggestions([]);
  }

  function addItem() {
    if (!selectedAddProduct || addQty <= 0 || addPrice <= 0) return;
    setItems((prev) => [...prev, {
      id: Date.now().toString(),
      productId: Date.now().toString(),
      productName: selectedAddProduct.name,
      brand: selectedAddProduct.brand,
      quantity: addQty,
      unit: addUnit,
      price: addPrice,
      total: addQty * addPrice,
    }]);
    setAddSearch("");
    setSelectedAddProduct(null);
    setAddQty(10);
    setAddPrice(0);
  }

  function removeItem(id: string) { setItems((prev) => prev.filter((i) => i.id !== id)); }

  async function handleSend() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 900));
    setSaving(false);
    navigate("/purchasing/orders");
  }

  const reference = isEdit && po ? po.reference : newRef;
  const currentStatus = isEdit && po ? (po.status) : "draft";

  if (loading) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <PageHeader title="Purchase Order" subtitle="Purchasing → Orders" />
        <PurchasingSubNav />
        <div className="flex-1 flex items-center justify-center text-[#666666]">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title={`Purchase Order: ${reference}`}
        subtitle={`Purchasing → Orders → ${isEdit ? "Edit" : "New"}`}
        actions={
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_BADGE[currentStatus]}`}>{currentStatus}</span>
            <button onClick={handleSend} disabled={items.length === 0 || !suppId || saving} className="rounded-lg bg-white/20 border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? "Sending…" : "✈ Send Order"}
            </button>
          </div>
        }
      />
      <PurchasingSubNav />

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Order form */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-white rounded-xl border border-[#DBEFF3] p-5">
            <h2 className="text-base font-bold text-[#333333] mb-4">Order Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#666666] mb-1">PO Number</label>
                <input readOnly value={reference} className="w-full rounded-lg border border-[#ABDBE3] bg-[#DBEFF3] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Supplier <span className="text-red-500">*</span></label>
                <select value={suppId} onChange={(e) => setSuppId(e.target.value)} className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none">
                  <option value="">— Select Supplier —</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Order Date</label>
                <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Expected Delivery</label>
                <input type="date" value={delivDate} onChange={(e) => setDelivDate(e.target.value)} className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-[#666666] mb-1">Supplier Contact</label>
                <input readOnly value={supplier ? `${supplier.contact} — ${supplier.phone}` : ""} placeholder="Auto-filled from supplier selection" className="w-full rounded-lg border border-[#ABDBE3] bg-[#DBEFF3] px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-[#666666] mb-1">Shipping Address</label>
                <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none resize-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Status update (edit mode) */}
        {isEdit && (
          <div className="px-4 sm:px-6">
            <div className="bg-[#DBEFF3] rounded-xl p-4 flex flex-wrap items-center gap-4">
              <label className="text-sm text-[#666666]">Update Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none">
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="received">Received</option>
                <option value="completed">Completed</option>
              </select>
              <button className="rounded-lg bg-[#49B0C1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3a9baf] transition-colors">Update</button>
              <span className="text-xs text-[#666666] ml-auto">Last updated: {new Date().toLocaleDateString("en-GB")}</span>
            </div>
          </div>
        )}

        {/* Order items */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-[#DBEFF3] rounded-xl p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ABDBE3] mb-3">
              <div>
                <p className="font-bold text-[#333333]">Order Items</p>
                <p className="text-xs text-[#666666]">Products to be ordered</p>
              </div>
              <span className="text-sm font-medium text-[#49B0C1]">{items.length} items</span>
            </div>

            {/* Add product row */}
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <div className="relative flex-1 min-w-[160px]">
                <label className="block text-xs text-[#666666] mb-1">Product</label>
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#666666]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd"/></svg>
                  <input value={addSearch} onChange={(e) => handleAddSearch(e.target.value)} placeholder="Add product..." className="w-full rounded-lg border border-[#ABDBE3] bg-white pl-8 pr-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none" />
                </div>
                {addSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 bg-white border border-[#ABDBE3] rounded-lg shadow-lg mt-1 overflow-hidden">
                    {addSuggestions.map((s) => (
                      <button key={s.name} onClick={() => selectProduct(s)} className="w-full text-left px-3 py-2 text-sm text-[#333333] hover:bg-[#DBEFF3] transition-colors">{s.name} — <span className="text-xs text-[#666666]">{fmtMoney(s.price)}</span></button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-[#666666] mb-1">Qty</label>
                <input type="number" value={addQty} min={1} onChange={(e) => setAddQty(Number(e.target.value))} className="w-20 rounded-lg border border-[#ABDBE3] bg-white px-2 py-2 text-sm focus:border-[#49B0C1] focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-[#666666] mb-1">Unit</label>
                <select value={addUnit} onChange={(e) => setAddUnit(e.target.value)} className="w-24 rounded-lg border border-[#ABDBE3] bg-white px-2 py-2 text-sm focus:border-[#49B0C1] focus:outline-none">
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#666666] mb-1">Price (ETB)</label>
                <input type="number" value={addPrice} min={0} onChange={(e) => setAddPrice(Number(e.target.value))} className="w-28 rounded-lg border border-[#ABDBE3] bg-white px-2 py-2 text-sm focus:border-[#49B0C1] focus:outline-none" />
              </div>
              <button onClick={addItem} disabled={!selectedAddProduct} className="rounded-lg bg-[#49B0C1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3a9baf] transition-colors disabled:opacity-40">+ Add</button>
            </div>

            {items.length > 0 ? (
              <div className="rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#ABDBE3]">
                      {["#", "Product", "Qty", "Unit", "Price", "Total", ""].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-[#333333]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/40"}>
                        <td className="px-3 py-2.5 text-[#666666]">{i + 1}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-[#333333]">{item.productName}</p>
                          <p className="text-xs text-[#666666]">{item.brand}</p>
                        </td>
                        <td className="px-3 py-2.5 text-[#333333]">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-[#333333]">{item.unit}</td>
                        <td className="px-3 py-2.5 text-[#333333]">{fmtMoney(item.price)}</td>
                        <td className="px-3 py-2.5 font-semibold text-[#333333]">{fmtMoney(item.total)}</td>
                        <td className="px-3 py-2.5">
                          <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600">
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd"/></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl bg-white border-2 border-dashed border-[#ABDBE3] py-8 text-center text-[#666666] text-sm">
                Search for products above to add them to this order.
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="px-4 sm:px-6 pb-4">
          <div className="bg-white rounded-xl border border-[#DBEFF3] p-5">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <p className="font-bold text-[#333333] mb-3">Order Summary</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-[#666666]">Subtotal</span><span className="text-[#333333]">{fmtMoney(subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-[#666666]">Tax (15%)</span><span className="text-[#333333]">{fmtMoney(tax)}</span></div>
                  <div className="flex justify-between"><span className="text-[#666666]">Shipping</span><span className="text-[#333333]">{fmtMoney(0)}</span></div>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm text-[#666666]">Total Amount</p>
                  <p className="text-3xl font-bold text-[#49B0C1]">{fmtMoney(total)}</p>
                </div>
                <div>
                  <label className="block text-xs text-[#666666] mb-1">Payment Terms</label>
                  <select value={payTerms} onChange={(e) => setPayTerms(e.target.value)} className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none">
                    <option>Net 30</option>
                    <option>Net 60</option>
                    <option>Cash on Delivery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#666666] mb-1">Special Instructions</label>
                  <textarea rows={2} value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Please ensure all items have valid expiry dates" className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none resize-none" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#DBEFF3] px-4 sm:px-6 py-3 flex items-center justify-end gap-3 z-30">
        <button onClick={() => navigate("/purchasing/orders")} className="rounded-lg bg-red-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors">Cancel</button>
        <button className="rounded-lg bg-[#ABDBE3] px-5 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#9acbd5] transition-colors">Save as Draft</button>
        <button
          onClick={handleSend}
          disabled={items.length === 0 || !suppId || saving}
          className="rounded-lg bg-[#49B0C1] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#3a9baf] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Sending…" : "✈ Send Order"}
        </button>
      </div>
    </div>
  );
}
