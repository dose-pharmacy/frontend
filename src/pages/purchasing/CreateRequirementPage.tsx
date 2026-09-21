import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import PurchasingSubNav from "./PurchasingSubNav";
import PageHeader from "../../components/ui/PageHeader";
import { listProducts, type ProductDto } from "../../features/inventory/productsApi";
import { createRequirement, type CreateRequirementInput, type RequirementReasonCode } from "../../features/purchasing/requirementsApi";
import { useProductUnits } from "../../features/inventory/useProductUnits";
import { toBaseQuantity, formatFactor } from "../../features/inventory/unitOptions";

interface ProductRow {
  id: string; // Temporary UI id
  productId: string;
  productName: string;
  /** null = use the product's base unit. */
  unitId: string | null;
  quantityNeeded: number;
  reasonCode: RequirementReasonCode;
  notes: string;
}

/** Compact per-row quantity + unit picker with a base-unit conversion preview. */
function ProductUnitRowEditor({ row, onUpdate }: {
  row: ProductRow
  onUpdate: (patch: Partial<ProductRow>) => void
}) {
  const { units, baseUnit, options, loading, error } = useProductUnits(row.productId)
  const unitId = row.unitId ?? baseUnit?.id ?? ""
  const productUnit = units.find((u) => u.unitId === unitId)
  const qty = row.quantityNeeded || 0
  const baseQty = toBaseQuantity(qty, productUnit)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          step="any"
          value={qty}
          onChange={(e) => onUpdate({ quantityNeeded: Number(e.target.value) })}
          className="w-20 rounded border border-gray-200 px-2 py-1"
        />
        <select
          value={unitId}
          onChange={(e) => onUpdate({ unitId: e.target.value || null })}
          className="rounded border border-gray-200 px-2 py-1 text-xs max-w-[120px]"
        >
          {loading && <option value="">Loading units…</option>}
          {error && <option value="">Error loading units</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {qty > 0 && row.unitId && baseQty !== null && baseUnit && productUnit && !productUnit.isBaseUnit && (
        <p className="text-[10px] text-[#49B0C1]">
          = {baseQty} {baseUnit.name} ({formatFactor(productUnit.conversionFactor)}×)
        </p>
      )}
    </div>
  )
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
        unitId: null,
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

  function patchProduct(id: string, patch: Partial<ProductRow>) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
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
          ...(p.unitId ? { unitId: p.unitId } : {}),
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
        subtitle="Purchasing → Requirements → New"
      />
      
      <div className="flex-1 overflow-y-auto pb-24">
        {error && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        {/* Requirement details form */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-white rounded-xl border border-[#DBEFF3] p-5">
            <h2 className="text-base font-bold text-[#333333] mb-4">Requirement Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#666666] mb-1">Required By Date</label>
                <input type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-[#666666] mb-1">Notes</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none resize-none" />
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
                  <div className="absolute top-full left-0 right-0 z-20 bg-white border border-[#ABDBE3] rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                    {suggestions.map((s) => (
                      <button key={s.id} onClick={() => addProduct(s)} className="w-full text-left px-3 py-2 text-sm text-[#333333] hover:bg-[#DBEFF3] transition-colors">
                        <span className="font-medium">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-[#666666] mb-1">Qty Needed</label>
                <input type="number" value={addQty} min={1} onChange={(e) => setAddQty(Number(e.target.value))} className="w-24 rounded-lg border border-[#ABDBE3] bg-white px-2 py-2 text-sm focus:border-[#49B0C1] focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-[#666666] mb-1">Reason</label>
                <select value={addReason} onChange={(e) => setAddReason(e.target.value as RequirementReasonCode)} className="w-36 rounded-lg border border-[#ABDBE3] bg-white px-2 py-2 text-sm focus:border-[#49B0C1] focus:outline-none">
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
                    <tr className="bg-[#ABDBE3]">
                      {["#", "Product", "Qty & Unit", "Reason", "Notes", ""].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-[#333333] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => (
                      <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/40"}>
                        <td className="px-3 py-2.5 text-[#666666]">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-[#333333]">{p.productName}</td>
                        <td className="px-3 py-2.5">
                          <ProductUnitRowEditor row={p} onUpdate={(patch) => patchProduct(p.id, patch)} />
                        </td>
                        <td className="px-3 py-2.5">
                          <select value={p.reasonCode} onChange={(e) => updateProduct(p.id, "reasonCode", e.target.value)} className="rounded border border-gray-200 px-2 py-1 text-xs">
                            <option value="LOW_STOCK">Low Stock</option>
                            <option value="REORDER_ALERT">Reorder Alert</option>
                            <option value="MANUAL">Manual</option>
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <input type="text" value={p.notes} onChange={(e) => updateProduct(p.id, "notes", e.target.value)} placeholder="Optional note" className="w-full rounded border border-gray-200 px-2 py-1 text-xs" />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button onClick={() => removeProduct(p.id)} className="text-red-400 hover:text-red-600" aria-label="Remove">
                            <svg className="h-4 w-4 inline-block" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd"/></svg>
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
                <div><p className="text-xs text-[#666666]">Total Quantity Needed</p><p className="text-sm font-bold text-[#333333]">{totalQty} units</p></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#DBEFF3] px-4 sm:px-6 py-3 flex items-center justify-end gap-3 z-30">
        <button onClick={() => navigate("/purchasing")} className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors">Cancel</button>
        <button
          onClick={handleSave}
          disabled={products.length === 0 || saving}
          className="rounded-lg bg-[#49B0C1] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#3a9baf] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? "Saving…" : "Create Requirement →"}
        </button>
      </div>
    </div>
  );
}
