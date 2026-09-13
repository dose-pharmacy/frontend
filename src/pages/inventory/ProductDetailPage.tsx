import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { getProduct, getBatches, getUnits, getTransactions, convertUnits } from "../../features/inventory/inventoryService";
import type { Product, Batch, Unit, Transaction } from "../../features/inventory/inventoryMock";
import Breadcrumb from "../../components/ui/Breadcrumb";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import { InventorySubNav } from "./InventoryDashboardPage";

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Conversion tool state
  const [convFromQty, setConvFromQty] = useState("1");
  const [convFromUnit, setConvFromUnit] = useState("");
  const [convToUnit, setConvToUnit] = useState("");
  const [convResult, setConvResult] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    Promise.all([
      getProduct(productId),
      getBatches(productId),
      getUnits(productId),
      getTransactions(productId),
    ]).then(([p, b, u, t]) => {
      if (!p) { navigate("/inventory"); return; }
      setProduct(p);
      setBatches(b);
      setUnits(u);
      setTransactions(t);
      if (u.length >= 2) { setConvFromUnit(u[0].id); setConvToUnit(u[1].id); }
      setLoading(false);
    });
  }, [productId, navigate]);

  function handleConvert() {
    const from = units.find((u) => u.id === convFromUnit);
    const to = units.find((u) => u.id === convToUnit);
    const qty = parseFloat(convFromQty);
    if (!from || !to || isNaN(qty)) { setConvResult("Invalid input"); return; }
    const result = convertUnits(qty, from, to, units);
    setConvResult(`${qty} ${from.name} = ${result.toFixed(4)} ${to.name}`);
  }

  if (loading) return (
    <div className="flex flex-col">
      <InventorySubNav active="products" />
      <div className="p-6 animate-pulse space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-[#DBEFF3]" />)}
      </div>
    </div>
  );

  if (!product) return null;

  // Build unit hierarchy for visualization
  const rootUnits = units.filter((u) => !u.parentId);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <InventorySubNav active="products" />
      <Breadcrumb items={[{ label: "Inventory", to: "/inventory" }, { label: "Product Details" }]} />

      <div className="p-6 flex flex-col gap-6">
        {/* Product info card */}
        <div className="bg-[#DBEFF3] rounded-xl p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Placeholder image */}
            <div className="h-24 w-24 rounded-xl bg-white/60 flex items-center justify-center text-[#49B0C1] flex-shrink-0 self-start">
              <svg className="h-12 w-12" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                <rect x="8" y="8" width="32" height="32" rx="6"/>
                <path strokeLinecap="round" d="M24 16v16M16 24h16"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold text-[#333333]">{product.name}</h2>
                  <p className="text-sm text-[#666666] mt-0.5">{product.genericName}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Chip label="Brand" value={product.brand} />
                    <Chip label="Category" value={product.category} />
                    <Chip label="Location" value={product.location} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => alert("Edit — backend integration pending")}>Edit</Button>
                  <button
                    onClick={() => alert("Delete — backend integration pending")}
                    className="rounded-lg px-4 py-2.5 text-sm font-semibold text-red-600 border border-red-200 bg-white hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Total Stock" value={product.totalStock} />
                <Stat label="Min Threshold" value={product.minThreshold} />
                <Stat label="Reorder Point" value={product.reorderPoint} />
                <div>
                  <p className="text-xs text-[#666666] font-medium">Status</p>
                  <div className="mt-1"><StatusBadge status={product.status} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Batches */}
        <section>
          <h3 className="text-base font-bold text-[#333333] mb-3">Batches</h3>
          <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#DBEFF3]">
                    {["Batch Number", "Quantity", "Expiry Date", "Received Date", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b, i) => (
                    <tr key={b.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"}>
                      <td className="px-4 py-3 font-mono text-xs text-[#333333]">{b.batchNumber}</td>
                      <td className="px-4 py-3 font-semibold text-[#333333]">{b.quantity}</td>
                      <td className="px-4 py-3 text-[#666666]">{b.expiryDate}</td>
                      <td className="px-4 py-3 text-[#666666]">{b.receivedDate}</td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                  {batches.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#666666]">No batches found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Units & Packaging */}
        {units.length > 0 && (
          <section>
            <h3 className="text-base font-bold text-[#333333] mb-3">Units & Packaging</h3>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Table */}
              <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#DBEFF3]">
                        {["Unit", "Qty / Parent", "Sell Price", "Stock"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {units.map((u, i) => (
                        <tr key={u.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"}>
                          <td className="px-4 py-3 font-medium text-[#333333]">{u.name}</td>
                          <td className="px-4 py-3 text-[#666666]">{u.quantityInParent ?? "—"}</td>
                          <td className="px-4 py-3 text-[#333333]">₱{u.sellPrice.toFixed(2)}</td>
                          <td className="px-4 py-3 font-semibold text-[#333333]">{u.stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Hierarchy + conversion */}
              <div className="flex flex-col gap-4">
                {/* Hierarchy */}
                <div className="bg-[#DBEFF3] rounded-xl p-4">
                  <p className="text-xs font-semibold text-[#49B0C1] uppercase tracking-wide mb-3">Unit Hierarchy</p>
                  <UnitHierarchy units={units} roots={rootUnits} allUnits={units} />
                </div>

                {/* Quick conversion */}
                <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
                  <p className="text-xs font-semibold text-[#49B0C1] uppercase tracking-wide mb-3">Quick Conversion</p>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={convFromQty}
                        onChange={(e) => setConvFromQty(e.target.value)}
                        min="0"
                        className="w-24 rounded-lg border border-[#ABDBE3] px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none focus:ring-2 focus:ring-[#49B0C1]/20"
                        aria-label="Quantity"
                      />
                      <Select value={convFromUnit} onChange={(e) => setConvFromUnit(e.target.value)} className="flex-1">
                        {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </Select>
                    </div>
                    <Select value={convToUnit} onChange={(e) => setConvToUnit(e.target.value)}>
                      {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </Select>
                    <Button onClick={handleConvert} variant="primary">Convert</Button>
                    {convResult && (
                      <p className="rounded-lg bg-[#DBEFF3] px-4 py-2 text-sm font-medium text-[#333333]">{convResult}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Transaction History */}
        {transactions.length > 0 && (
          <section>
            <h3 className="text-base font-bold text-[#333333] mb-3">Transaction History</h3>
            <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#DBEFF3]">
                      {["Date", "Type", "Quantity", "Reference"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t, i) => (
                      <tr key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"}>
                        <td className="px-4 py-3 text-[#666666]">{t.date}</td>
                        <td className="px-4 py-3">
                          <span className="capitalize text-[#333333]">{t.type}</span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#333333]">{t.quantity}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666]">{t.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-3 py-1 text-xs">
      <span className="text-[#666666]">{label}:</span>
      <span className="font-medium text-[#333333]">{value}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-[#666666] font-medium">{label}</p>
      <p className="text-lg font-bold text-[#333333]">{value}</p>
    </div>
  );
}

function UnitHierarchy({ units, roots, allUnits }: { units: Unit[]; roots: Unit[]; allUnits: Unit[] }) {
  function renderUnit(unit: Unit, depth: number): React.ReactNode {
    const children = allUnits.filter((u) => u.parentId === unit.id);
    return (
      <div key={unit.id} style={{ marginLeft: depth * 16 }}>
        <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 mb-1">
          {depth > 0 && <span className="text-[#ABDBE3] text-xs">↳</span>}
          <div>
            <span className="text-sm font-semibold text-[#333333]">{unit.name}</span>
            {unit.quantityInParent && (
              <span className="ml-2 text-xs text-[#666666]">({unit.quantityInParent} per parent)</span>
            )}
          </div>
        </div>
        {children.map((c) => renderUnit(c, depth + 1))}
      </div>
    );
  }
  return <div>{roots.map((r) => renderUnit(r, 0))}</div>;
}
