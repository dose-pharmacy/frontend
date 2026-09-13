import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getReorderData } from "../../features/inventory/inventoryService";
import PageHeader from "../../components/ui/PageHeader";
import MetricCard from "../../components/ui/MetricCard";
import Button from "../../components/ui/Button";

export default function ReorderManagementPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof getReorderData>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getReorderData().then((d) => { setData(d); setLoading(false); }); }, []);

  const criticalCount = data.filter((d) => d.urgency === "critical").length;
  const avgSales = data.length ? (data.reduce((s, d) => s + d.avgDailySales, 0) / data.length).toFixed(1) : "0";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Inventory / Reorder"
        title="Reorder"
        subtitle="Review low-stock products and suggested reorder quantities."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/inventory/reorder/configuration")}>Configure Thresholds</Button>
            <Button onClick={() => alert("Generate purchase requirements — backend pending")}>Generate Requirements</Button>
          </div>
        }
      />

      <div className="p-6 flex flex-col gap-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <MetricCard title="Below Threshold" value={data.length} icon={<AlertIcon />} subtitle="items need attention" />
          <MetricCard title="Avg Daily Sales" value={avgSales} icon={<TrendIcon />} subtitle="units/day" />
          <MetricCard title="Pending Orders" value={0} icon={<OrderIcon />} subtitle="purchase orders" />
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-[#DBEFF3] rounded-xl" />)}</div>
        ) : (
          <>
            {/* Low stock alerts */}
            <section>
              <div className="bg-[#49B0C1] px-4 py-2.5 rounded-t-xl flex items-center justify-between">
                <p className="text-sm font-bold text-white">LOW STOCK ALERTS ({data.length} items)</p>
              </div>
              <div className="bg-white rounded-b-xl border border-t-0 border-[#DBEFF3] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#DBEFF3]">
                        {["Product", "Current Stock", "Threshold", "Velocity (units/day)", "Suggested Qty", "Urgency"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((d, i) => (
                        <tr key={d.productId} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"}>
                          <td className="px-4 py-3 font-medium text-[#333333]">{d.productName}</td>
                          <td className="px-4 py-3 font-bold text-red-600">{d.currentStock}</td>
                          <td className="px-4 py-3 text-[#666666]">{d.threshold}</td>
                          <td className="px-4 py-3 text-[#666666]">{d.velocity}</td>
                          <td className="px-4 py-3 font-semibold text-[#333333]">{d.suggestedQty}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
                              Critical
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Suggested reorder quantities */}
            <section>
              <div className="bg-[#ABDBE3] px-4 py-2.5 rounded-t-xl">
                <p className="text-sm font-bold text-[#333333]">SUGGESTED REORDER QUANTITIES</p>
              </div>
              <div className="bg-white rounded-b-xl border border-t-0 border-[#DBEFF3] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#DBEFF3]">
                        {["Product", "Avg Daily Sales", "Lead Time (days)", "Suggested Qty", "Action"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((d, i) => (
                        <tr key={d.productId} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"}>
                          <td className="px-4 py-3 font-medium text-[#333333]">{d.productName}</td>
                          <td className="px-4 py-3 text-[#666666]">{d.avgDailySales}</td>
                          <td className="px-4 py-3 text-[#666666]">{d.leadTime}</td>
                          <td className="px-4 py-3 font-semibold text-[#49B0C1]">{d.suggestedQty}</td>
                          <td className="px-4 py-3">
                            <Button onClick={() => alert("Create purchase order — Purchasing module coming soon.")}>Order</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function AlertIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>; }
function TrendIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/></svg>; }
function OrderIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/></svg>; }
