import { useState } from "react";
import { useNavigate } from "react-router";
import PurchasingSubNav from "./PurchasingSubNav";
import PageHeader from "../../components/ui/PageHeader";
import { MOCK_SUPPLIERS } from "../../features/purchasing/purchasingMock";
import { fmtMoney } from "../../features/purchasing/purchasingService";

interface ProductRow {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  suggestedPrice: number;
}

const PRODUCT_SUGGESTIONS = [
  { name: "Panadol 500mg", price: 250 },
  { name: "Amoxicillin 500mg", price: 320 },
  { name: "Vitamin C 1000mg", price: 180 },
  { name: "Metformin 500mg", price: 95 },
  { name: "Omeprazole 20mg", price: 210 },
  { name: "Ibuprofen 400mg", price: 120 },
  { name: "Aspirin 100mg", price: 85 },
  { name: "Insulin Glargine", price: 850 },
  { name: "Amlodipine 5mg", price: 145 },
  { name: "Vitamin D3 1000IU", price: 220 },
];

const UNITS = ["Box", "Strip", "Tablet", "Bottle", "Tube", "Vial", "Sachet"];

const reference = `PR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;

export default function CreateRequirementPage() {
  const navigate = useNavigate();
  const [priority, setPriority] = useState("medium");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState("");
  const [addQty, setAddQty] = useState(50);
  const [addUnit, setAddUnit] = useState("Box");
  const [suggestions, setSuggestions] = useState<typeof PRODUCT_SUGGESTIONS>([]);
  const [saving, setSaving] = useState(false);

  function handleSearchChange(v: string) {
    setSearch(v);
    if (v.length >= 2) {
      setSuggestions(PRODUCT_SUGGESTIONS.filter((p) => p.name.toLowerCase().includes(v.toLowerCase())));
    } else {
      setSuggestions([]);
    }
  }

  function addProduct(name: string, price: number) {
    setProducts((prev) => [...prev, { id: Date.now().toString(), productName: name, quantity: addQty, unit: addUnit, suggestedPrice: price }]);
    setSearch("");
    setSuggestions([]);
    setAddQty(50);
  }

  function removeProduct(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  const totalCost = products.reduce((s, p) => s + p.quantity * p.suggestedPrice, 0);
  const totalQty = products.reduce((s, p) => s + p.quantity, 0);

  async function handleSave(andContinue = false) {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    if (andContinue) navigate("/purchasing");
    else navigate("/purchasing");
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Create Purchase Requirement"
        subtitle={`Purchasing → Requirements → New · ${reference}`}
        actions={
          <span className="inline-flex items-center rounded-full bg-gray-500 px-3 py-1 text-xs font-semibold text-white">Draft</span>
        }
      />
      

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Requirement details form */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-white rounded-xl border border-[#DBEFF3] p-5">
            <h2 className="text-base font-bold text-[#333333] mb-4">Requirement Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm text-[#666666] mb-1">Reference</label>
                <input readOnly value={reference} className="w-full rounded-lg border border-[#ABDBE3] bg-[#DBEFF3] px-3 py-2 text-sm text-[#333333]" />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none">
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-[#666666] mb-1">Notes</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Monthly restock order..." className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none resize-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Products section */}
        <div className="px-4 sm:px-6">
          <div className="bg-[#DBEFF3] rounded-xl p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ABDBE3] mb-3">
              <div>
                <p className="font-bold text-[#333333]">Products</p>
                <p className="text-xs text-[#666666]">Add products to this requirement</p>
              </div>
              <span className="text-sm font-medium text-[#49B0C1]">{products.length} products added</span>
            </div>

            {/* Add product row */}
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <div className="relative flex-1 min-w-[180px]">
                <label className="block text-xs text-[#666666] mb-1">Product Search</label>
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#666666]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd"/></svg>
                  <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search for a product..." className="w-full rounded-lg border border-[#ABDBE3] bg-white pl-8 pr-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none" />
                </div>
                {suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 bg-white border border-[#ABDBE3] rounded-lg shadow-lg mt-1 overflow-hidden">
                    {suggestions.map((s) => (
                      <button key={s.name} onClick={() => addProduct(s.name, s.price)} className="w-full text-left px-3 py-2 text-sm text-[#333333] hover:bg-[#DBEFF3] transition-colors">
                        <span className="font-medium">{s.name}</span> <span className="text-[#666666] text-xs">— {fmtMoney(s.price)}/{addUnit}</span>
                      </button>
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
                <select value={addUnit} onChange={(e) => setAddUnit(e.target.value)} className="w-28 rounded-lg border border-[#ABDBE3] bg-white px-2 py-2 text-sm focus:border-[#49B0C1] focus:outline-none">
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* Selected products table */}
            {products.length > 0 ? (
              <div className="rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#ABDBE3]">
                      {["#", "Product", "Qty", "Unit", "Suggested Price", "Total", ""].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-[#333333]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => (
                      <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/40"}>
                        <td className="px-3 py-2.5 text-[#666666]">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-[#333333]">{p.productName}</td>
                        <td className="px-3 py-2.5 text-[#333333]">{p.quantity}</td>
                        <td className="px-3 py-2.5 text-[#333333]">{p.unit}</td>
                        <td className="px-3 py-2.5 text-[#333333]">{fmtMoney(p.suggestedPrice)}</td>
                        <td className="px-3 py-2.5 font-semibold text-[#333333]">{fmtMoney(p.quantity * p.suggestedPrice)}</td>
                        <td className="px-3 py-2.5">
                          <button onClick={() => removeProduct(p.id)} className="text-red-400 hover:text-red-600" aria-label="Remove">
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
                Search for products above to add them to this requirement.
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        {products.length > 0 && (
          <div className="px-4 sm:px-6 py-4">
            <div className="bg-white rounded-xl border border-[#DBEFF3] p-4 flex items-center justify-between flex-wrap gap-4">
              <div className="flex gap-8">
                <div><p className="text-xs text-[#666666]">Total Items</p><p className="text-sm font-bold text-[#333333]">{products.length} products</p></div>
                <div><p className="text-xs text-[#666666]">Total Quantity</p><p className="text-sm font-bold text-[#333333]">{totalQty} units</p></div>
                <div><p className="text-xs text-[#666666]">Estimated Cost</p><p className="text-sm font-bold text-[#333333]">{fmtMoney(totalCost)}</p></div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-[#333333]">Requirement Summary</p>
                <p className="text-xs text-[#666666]">{products.length} products</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#DBEFF3] px-4 sm:px-6 py-3 flex items-center justify-end gap-3 z-30">
        <button onClick={() => navigate("/purchasing")} className="rounded-lg bg-red-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors">Cancel</button>
        <button onClick={() => handleSave(false)} className="rounded-lg bg-[#ABDBE3] px-5 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#9acbd5] transition-colors">Save as Draft</button>
        <button
          onClick={() => handleSave(true)}
          disabled={products.length === 0 || saving}
          className="rounded-lg bg-[#49B0C1] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#3a9baf] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? "Saving…" : "Save & Continue →"}
        </button>
      </div>
    </div>
  );
}
