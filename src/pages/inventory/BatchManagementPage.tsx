import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { getBatches, getProducts } from "../../features/inventory/inventoryService";
import type { Batch, Product } from "../../features/inventory/inventoryMock";
import PageHeader from "../../components/ui/PageHeader";
import SearchInput from "../../components/ui/SearchInput";
import Select from "../../components/ui/Select";
import StatusBadge from "../../components/ui/StatusBadge";
import MetricCard from "../../components/ui/MetricCard";
import Pagination from "../../components/ui/Pagination";
import EmptyState from "../../components/ui/EmptyState";
import { daysUntilExpiry } from "../../features/inventory/inventoryService";

const PAGE_SIZE = 5;

export default function BatchManagementPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    Promise.all([getBatches(), getProducts()]).then(([b, p]) => {
      setBatches(b); setProducts(p); setLoading(false);
    });
  }, []);

  function productName(id: string) { return products.find((p) => p.id === id)?.name ?? id; }

  const filtered = useMemo(() => {
    let list = batches;
    if (productFilter) list = list.filter((b) => b.productId === productFilter);
    if (search) list = list.filter((b) => b.batchNumber.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [batches, productFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => ({
    total: batches.length,
    nearExpiry: batches.filter((b) => { const d = daysUntilExpiry(b.expiryDate); return d >= 0 && d <= 30; }).length,
    depleted: batches.filter((b) => b.status === "depleted").length,
  }), [batches]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader title="Batch Management" subtitle="Track and manage product batches" />

      <div className="p-6 flex flex-col gap-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <MetricCard title="Total Batches" value={stats.total} icon={<BatchIcon />} />
          <MetricCard title="Near Expiry" value={stats.nearExpiry} icon={<CalIcon />} subtitle="Within 30 days" />
          <MetricCard title="Depleted" value={stats.depleted} icon={<EmptyIcon />} />
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] p-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search batch number..." />
          </div>
          <Select value={productFilter} onChange={(e) => { setProductFilter(e.target.value); setPage(1); }} className="sm:w-56">
            <option value="">All Products</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-[#DBEFF3] rounded-lg" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No batches found" description="Try adjusting your search or filter." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#DBEFF3]">
                      {["Batch Number", "Product", "Quantity", "Expiry Date", "Location", "Status", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((b, i) => {
                      const days = daysUntilExpiry(b.expiryDate);
                      return (
                        <tr key={b.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"}>
                          <td className="px-4 py-3 font-mono text-xs text-[#333333]">{b.batchNumber}</td>
                          <td className="px-4 py-3 text-[#666666]">{productName(b.productId)}</td>
                          <td className="px-4 py-3 font-semibold text-[#333333]">{b.quantity}</td>
                          <td className="px-4 py-3">
                            <span className={days < 30 && days >= 0 ? "text-red-600 font-semibold" : days < 0 ? "text-red-400" : "text-[#666666]"}>
                              {b.expiryDate}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#666666]">{b.location}</td>
                          <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                          <td className="px-4 py-3">
                            <button onClick={() => navigate(`/inventory/batches/${b.id}`)} className="text-xs font-semibold text-[#49B0C1] hover:underline">View</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BatchIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3"/></svg>; }
function CalIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>; }
function EmptyIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>; }
