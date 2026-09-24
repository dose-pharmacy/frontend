import { useEffect, useMemo, useState, useCallback } from "react";
import {
  getLocationStock,
  type LocationStockGroupDto,
} from "../../features/inventory/stockApi";
import PageHeader from "../../components/ui/PageHeader";
import SearchInput from "../../components/ui/SearchInput";
import MetricCard from "../../components/ui/MetricCard";
import EmptyState from "../../components/ui/EmptyState";

interface GroupRow {
  productId: string;
  productName: string;
  productSku: string;
  byLocation: { locationId: string; locationName: string; quantity: number }[];
  total: number;
}

function adapt(g: LocationStockGroupDto): GroupRow {
  const product = (g.product ?? {}) as { id?: string; name?: string; sku?: string };
  return {
    productId: g.product?.id ?? product.id ?? "",
    productName: product.name ?? g.product?.id ?? "—",
    productSku: product.sku ?? "",
    byLocation: Array.isArray(g.locations) ? g.locations : [],
    total: g.totalQuantity ?? 0,
  };
}

async function walkLocationStock(): Promise<GroupRow[]> {
  const all: GroupRow[] = [];
  const first = await getLocationStock({ page: 1, limit: 100 });
  all.push(...first.data.map(adapt));
  const totalPages = Math.min(first.pagination?.totalPages ?? 1, 20);
  for (let page = 2; page <= totalPages; page++) {
    const next = await getLocationStock({ page, limit: 100 });
    all.push(...next.data.map(adapt));
  }
  return all;
}

export default function LocationStockPage() {
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await walkLocationStock());
    } catch {
      setError("Failed to load stock by location.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const locations = useMemo(
    () => [...new Set(rows.flatMap((r) => r.byLocation.map((l) => l.locationName).filter(Boolean)))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) => r.productName.toLowerCase().includes(q) || r.productSku.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totalAll = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader title="Stock by Location" subtitle="View stock levels across all locations" />

      <div className="p-6 flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <MetricCard title="Total Stock" value={totalAll.toLocaleString()} icon={<StoreIcon />} subtitle="base units" />
          <MetricCard title="Products" value={rows.length} icon={<DispIcon />} subtitle="with stock" />
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => void load()} className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap">Retry</button>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
              <SearchInput value={search} onChange={setSearch} placeholder="Search products..." />
            </div>

            <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
              {loading ? (
                <div className="p-6 space-y-3 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-[#E6ECE2] rounded-lg" />)}</div>
              ) : filtered.length === 0 ? (
                <EmptyState title="No products found" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#E6ECE2]">
                        <th className="px-4 py-3 text-left font-semibold text-[#333333]">Product</th>
                        {locations.map((loc) => (
                          <th key={loc} className="px-4 py-3 text-right font-semibold text-[#333333] whitespace-nowrap">{loc}</th>
                        ))}
                        <th className="px-4 py-3 text-right font-semibold text-[#333333]">Total (base units)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r, i) => (
                        <tr key={r.productId} className={`transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/30"} hover:bg-[#C6D4BF]/20`}>
                          <td className="px-4 py-3 font-medium text-[#333333] whitespace-nowrap">
                            {r.productName}
                            {r.productSku && <span className="ml-2 text-xs text-[#999] font-mono">{r.productSku}</span>}
                          </td>
                          {locations.map((loc) => {
                            const cell = r.byLocation.find((l) => l.locationName === loc);
                            return (
                              <td key={loc} className="px-4 py-3 text-right text-[#333333]">
                                {cell ? cell.quantity.toLocaleString() : "—"}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-right font-bold text-[#7A9076]">{r.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StoreIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z"/></svg>; }
function DispIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819"/></svg>; }