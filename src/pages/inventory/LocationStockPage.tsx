import { useEffect, useMemo, useState } from "react";
import { getLocationStock } from "../../features/inventory/inventoryService";
import PageHeader from "../../components/ui/PageHeader";
import SearchInput from "../../components/ui/SearchInput";
import MetricCard from "../../components/ui/MetricCard";
import EmptyState from "../../components/ui/EmptyState";

export default function LocationStockPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getLocationStock>>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { getLocationStock().then((d) => { setData(d); setLoading(false); }); }, []);

  const filtered = useMemo(() =>
    search ? data.filter((r) => r.productName.toLowerCase().includes(search.toLowerCase())) : data
  , [data, search]);

  const totalMain = data.reduce((s, r) => s + r.mainStore, 0);
  const totalDisp = data.reduce((s, r) => s + r.dispensingArea, 0);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader title="Stock by Location" subtitle="View stock levels across all locations" />

      <div className="p-6 flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <MetricCard title="Main Store Total" value={totalMain} icon={<StoreIcon />} subtitle="units in stock" />
          <MetricCard title="Dispensing Area Total" value={totalDisp} icon={<DispIcon />} subtitle="units in stock" />
        </div>

        <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search products..." />
        </div>

        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-[#DBEFF3] rounded-lg" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No products found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#DBEFF3]">
                    {["Product", "Main Store", "Dispensing Area", "Total"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.productId} className={`transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"} hover:bg-[#ABDBE3]/20`}>
                      <td className="px-4 py-3 font-medium text-[#333333]">{r.productName}</td>
                      <td className="px-4 py-3 text-[#333333]">{r.mainStore}</td>
                      <td className="px-4 py-3 text-[#333333]">{r.dispensingArea}</td>
                      <td className="px-4 py-3 font-bold text-[#49B0C1]">{r.mainStore + r.dispensingArea}</td>
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

function StoreIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z"/></svg>; }
function DispIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819"/></svg>; }
