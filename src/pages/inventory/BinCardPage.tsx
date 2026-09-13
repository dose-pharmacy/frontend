import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { getProducts, getBatches, getBinCard } from "../../features/inventory/inventoryService";
import type { BinCardEntry, Product, Batch } from "../../features/inventory/inventoryMock";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";

export default function BinCardPage() {
  const { productId: paramProductId } = useParams<{ productId: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [entries, setEntries] = useState<BinCardEntry[]>([]);
  const [selectedProduct, setSelectedProduct] = useState(paramProductId ?? "");
  const [selectedBatch, setSelectedBatch] = useState("all");
  const [location, setLocation] = useState("Main Store");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([getProducts(), getBatches()]).then(([p, b]) => {
      setProducts(p);
      setBatches(b);
      if (!selectedProduct && p.length) setSelectedProduct(p[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;
    setLoading(true);
    getBinCard(selectedProduct, selectedBatch !== "all" ? selectedBatch : undefined).then((e) => {
      setEntries(e); setLoading(false);
    });
  }, [selectedProduct, selectedBatch]);

  const productBatches = batches.filter((b) => b.productId === selectedProduct);

  const filtered = useMemo(() => {
    let list = entries;
    if (location) list = list.filter((e) => e.location === location);
    if (dateFrom) list = list.filter((e) => e.date >= dateFrom);
    if (dateTo) list = list.filter((e) => e.date <= dateTo);
    return list;
  }, [entries, location, dateFrom, dateTo]);

  const summary = useMemo(() => ({
    opening: filtered[0]?.balance ?? 0,
    received: filtered.reduce((s, e) => s + e.in, 0),
    issued: filtered.reduce((s, e) => s + e.out, 0),
    closing: filtered[filtered.length - 1]?.balance ?? 0,
  }), [filtered]);

  function handleExportCSV() {
    const header = "Date,Reference,In,Out,Balance,User\n";
    const rows = filtered.map((e) => `${e.date},${e.reference},${e.in},${e.out},${e.balance},${e.user}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "bin-card.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const productName = products.find((p) => p.id === selectedProduct)?.name ?? "";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title={productName ? `Bin Card — ${productName}` : "Bin Card"}
        subtitle="Stock movement history"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => window.print()}>Print</Button>
            <Button onClick={handleExportCSV}>Export CSV</Button>
          </div>
        }
      />

      <div className="p-6 flex flex-col gap-6">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select label="Product" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select label="Batch" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
            <option value="all">All Batches</option>
            {productBatches.map((b) => <option key={b.id} value={b.id}>{b.batchNumber}</option>)}
          </Select>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">From Date</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">To Date</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none" />
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Opening Balance", value: summary.opening },
            { label: "Total Received", value: summary.received },
            { label: "Total Issued", value: summary.issued },
            { label: "Closing Balance", value: summary.closing },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#DBEFF3] rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-[#666666] font-medium">{label}</p>
              <p className="text-xl font-bold text-[#333333] mt-1">{value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-[#DBEFF3] rounded-lg" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No entries found" description="Adjust the filters or select a different product." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#DBEFF3]">
                    {["Date", "Reference", "In", "Out", "Balance", "User"].map((h) => (
                      <th key={h} className={`px-4 py-3 text-left font-semibold text-[#333333] ${h === "In" || h === "Out" ? "text-center" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, i) => (
                    <tr key={e.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"}>
                      <td className="px-4 py-3 text-[#666666]">{e.date}</td>
                      <td className="px-4 py-3 text-[#333333]">{e.reference}</td>
                      <td className="px-4 py-3 text-center font-semibold text-green-600">{e.in > 0 ? `+${e.in}` : "—"}</td>
                      <td className="px-4 py-3 text-center font-semibold text-red-500">{e.out > 0 ? `-${e.out}` : "—"}</td>
                      <td className="px-4 py-3 font-bold text-[#333333]">{e.balance}</td>
                      <td className="px-4 py-3 text-[#666666]">{e.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
