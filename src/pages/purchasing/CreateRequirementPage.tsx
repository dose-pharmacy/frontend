import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, Search, Trash2 } from "lucide-react";
import PurchasingSubNav from "./PurchasingSubNav";
import PageHeader from "../../components/ui/PageHeader";
import { listProducts, type ProductDto } from "../../features/inventory/productsApi";
import { createRequirement, type CreateRequirementInput, type RequirementReasonCode } from "../../features/purchasing/requirementsApi";

interface ProductRow {
  id: string; // Temporary UI id
  productId: string;
  productName: string;
  quantityNeeded: number;
  reasonCode: RequirementReasonCode;
  notes: string;
}

export default function CreateRequirementPage() {
  const navigate = useNavigate();
  const [requiredBy, setRequiredBy] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  
  // Search state
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<ProductDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Add row state
  const [addQty, setAddQty] = useState(50);
  const [addReason, setAddReason] = useState<RequirementReasonCode>("LOW_STOCK");
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (search.length < 2) {
        setSuggestions([]);
        return;
      }
      setIsSearching(true);
      try {
        const result = await listProducts({ search, limit: 10, isActive: true });
        setSuggestions(result.data);
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [search]);

  function handleSearchChange(v: string) {
    setSearch(v);
  }

  function addProduct(product: ProductDto) {
    if (products.some((p) => p.productId === product.id)) {
      return; // Already added
    }
    setProducts((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        productId: product.id,
        productName: product.name,
        quantityNeeded: addQty,
        reasonCode: addReason,
        notes: "",
      },
    ]);
    setSearch("");
    setSuggestions([]);
    setAddQty(50);
    setAddReason("LOW_STOCK");
  }

  function removeProduct(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  function updateProduct(id: string, field: keyof ProductRow, value: any) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  const totalQty = products.reduce((s, p) => s + p.quantityNeeded, 0);

  async function handleSave() {
    if (products.length === 0) {
      setError("Please add at least one product.");
      return;
    }
    const duplicate = products.some(
      (p, i) => products.findIndex((x) => x.productId === p.productId) !== i,
    );
    if (duplicate) {
      setError("Duplicate products are not allowed — each product can appear once.");
      return;
    }
    setError("");
    setSaving(true);

    try {
      // POST /requirements — requiredBy and notes are optional on the backend
      // contract; reasonCode/notes are omitted (not sent as null) per line.
      const body = {
        ...(requiredBy ? { requiredBy: new Date(`${requiredBy}T00:00:00Z`).toISOString() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines: products.map((p) => ({
          productId: p.productId,
          quantityNeeded: p.quantityNeeded,
          ...(p.reasonCode ? { reasonCode: p.reasonCode } : {}),
          ...(p.notes?.trim() ? { notes: p.notes.trim() } : {}),
        })),
      };
      await createRequirement(body as CreateRequirementInput);
      navigate("/purchasing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create requirement.");
      setSaving(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Create Purchase Requirement"
        subtitle="Purchasing / Requirements / New"
      />
      
      <div className="flex-1 overflow-y-auto pb-24">
        {error && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        {/* Requirement details form */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
            <h2 className="text-base font-bold text-[#333333] mb-4">Requirement Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#666666] mb-1">Required By Date</label>
                <input type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-[#666666] mb-1">Notes</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none resize-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Products section */}
        <div className="px-4 sm:px-6">
          <div className="bg-[#E6ECE2] rounded-xl p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#C6D4BF] mb-3">
              <div>
                <p className="font-bold text-[#333333]">Products</p>
                <p className="text-xs text-[#666666]">Add products to this requirement</p>
              </div>
              <span className="text-sm font-medium text-[#7A9076]">{products.length} products added</span>
            </div>

            {/* Add product row */}
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <div className="relative flex-1 min-w-[180px]">
                <label className="block text-xs text-[#666666] mb-1">Product Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]" aria-hidden />
                  <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search for a product..." className="w-full rounded-lg border border-[#C6D4BF] bg-white pl-9 pr-4 py-2.5 text-sm text-[#333333] placeholder:text-[#999] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20 transition-all" />
                </div>
                {suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 bg-white border border-[#C6D4BF] rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                    {suggestions.map((s) => (
                      <button key={s.id} onClick={() => addProduct(s)} className="w-full text-left px-3 py-2 text-sm text-[#333333] hover:bg-[#E6ECE2] transition-colors">
                        <span className="font-medium">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-[#666666] mb-1">Qty Needed</label>
                <input type="number" value={addQty} min={1} onChange={(e) => setAddQty(Number(e.target.value))} className="w-24 rounded-lg border border-[#C6D4BF] bg-white px-2 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-[#666666] mb-1">Reason</label>
                <select value={addReason} onChange={(e) => setAddReason(e.target.value as RequirementReasonCode)} className="w-36 rounded-lg border border-[#C6D4BF] bg-white px-2 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none">
                  <option value="LOW_STOCK">Low Stock</option>
                  <option value="REORDER_ALERT">Reorder Alert</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </div>
            </div>

            {/* Selected products table */}
            {products.length > 0 ? (
              <div className="rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="bg-[#C6D4BF]">
                      {["#", "Product", "Qty Needed", "Reason", "Notes", ""].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-[#333333] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => (
                      <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/40"}>
                        <td className="px-3 py-2.5 text-[#666666]">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-[#333333]">{p.productName}</td>
                        <td className="px-3 py-2.5">
                          <input type="number" min={1} value={p.quantityNeeded} onChange={(e) => updateProduct(p.id, "quantityNeeded", Number(e.target.value))} className="w-20 rounded-lg border border-[#C6D4BF] bg-white px-2 py-1 text-xs focus:border-[#B6C8AF] focus:outline-none" />
                        </td>
                        <td className="px-3 py-2.5">
                          <select value={p.reasonCode} onChange={(e) => updateProduct(p.id, "reasonCode", e.target.value)} className="rounded-lg border border-[#C6D4BF] bg-white px-2 py-1 text-xs focus:border-[#B6C8AF] focus:outline-none">
                            <option value="LOW_STOCK">Low Stock</option>
                            <option value="REORDER_ALERT">Reorder Alert</option>
                            <option value="MANUAL">Manual</option>
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <input type="text" value={p.notes} onChange={(e) => updateProduct(p.id, "notes", e.target.value)} placeholder="Optional note" className="w-full rounded-lg border border-[#C6D4BF] bg-white px-2 py-1 text-xs focus:border-[#B6C8AF] focus:outline-none" />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button onClick={() => removeProduct(p.id)} className="text-red-400 hover:text-red-600" aria-label="Remove">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl bg-white border-2 border-dashed border-[#C6D4BF] py-8 text-center text-[#666666] text-sm">
                Search for products above to add them to this requirement.
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        {products.length > 0 && (
          <div className="px-4 sm:px-6 py-4">
            <div className="bg-white rounded-xl border border-[#E6ECE2] p-4 flex items-center justify-between flex-wrap gap-4">
              <div className="flex gap-8">
                <div><p className="text-xs text-[#666666]">Total Items</p><p className="text-sm font-bold text-[#333333]">{products.length} products</p></div>
                <div><p className="text-xs text-[#666666]">Total Quantity Needed</p><p className="text-sm font-bold text-[#333333]">{totalQty} units</p></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E6ECE2] px-4 sm:px-6 py-3 flex items-center justify-end gap-3 z-30">
        <button onClick={() => navigate("/purchasing")} className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors">Cancel</button>
        <button
          onClick={handleSave}
          disabled={products.length === 0 || saving}
          className="rounded-lg bg-[#B6C8AF] px-6 py-2.5 text-sm font-bold text-[#333333] hover:bg-[#A0B59C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? "Saving…" : (<span className="inline-flex items-center gap-1.5">Create Requirement <ChevronRight className="h-4 w-4" /></span>)}
        </button>
      </div>
    </div>
  );
}
