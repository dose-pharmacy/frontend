import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  getReorderDashboard,
  getReorderSuggestions,
  ReorderApiError,
  type ReorderDashboardItemDto,
  type ReorderSuggestionDto,
} from "../../features/inventory/reorderApi";
import PageHeader from "../../components/ui/PageHeader";
import MetricCard from "../../components/ui/MetricCard";
import Button from "../../components/ui/Button";
import FormError from "../../components/ui/FormError";
import GenerateRequirementsModal from "./ReorderReq";

export default function ReorderManagementPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<ReorderDashboardItemDto[]>([]);
  const [summary, setSummary] = useState({ critical: 0, high: 0, medium: 0, low: 0, totalItems: 0, totalSuggestedQuantity: 0 });
  const [suggestions, setSuggestions] = useState<ReorderSuggestionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getReorderDashboard({ page: 1, limit: 100 }), getReorderSuggestions({ page: 1, limit: 100 })])
      .then(([dash, sugg]) => {
        if (cancelled) return;
        setDashboard(dash.items);
        setSummary(dash.summary);
        setSuggestions(sugg.data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ReorderApiError ? err.message : "Failed to load reorder data. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function refresh() {
    setLoading(true);
    Promise.all([getReorderDashboard({ page: 1, limit: 100 }), getReorderSuggestions({ page: 1, limit: 100 })])
      .then(([dash, sugg]) => {
        setDashboard(dash.items);
        setSummary(dash.summary);
        setSuggestions(sugg.data);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof ReorderApiError ? err.message : "Failed to load reorder data. Please try again.");
      })
      .finally(() => setLoading(false));
  }

  const avgSales = suggestions.length
    ? (suggestions.reduce((s, d) => s + (d.averageDailySales ?? 0), 0) / suggestions.length).toFixed(1)
    : "0";

  const modalSuggestions = suggestions.map((s) => ({
    id: s.product.id,
    name: s.product.name,
    suggestedQty: s.suggestedQuantity,
    status: "Draft",
  }));

  const urgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "CRITICAL":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700"><span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />Critical</span>;
      case "HIGH":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700"><span className="h-1.5 w-1.5 rounded-full bg-orange-500" aria-hidden />High</span>;
      case "MEDIUM":
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />Medium</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DBEFF3] px-2.5 py-0.5 text-xs font-medium text-[#49B0C1]"><span className="h-1.5 w-1.5 rounded-full bg-[#49B0C1]" aria-hidden />Low</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <PageHeader
        breadcrumb="Inventory / Reorder"
        title="Reorder"
        subtitle="Review low-stock products and suggested reorder quantities."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/inventory/reorder/configuration")}>Configure Thresholds</Button>
            <Button onClick={() => setShowGenerate(true)}>Generate Requirements</Button>
          </div>
        }
      />

      <div className="p-6 flex flex-col gap-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <MetricCard title="Below Threshold" value={summary.totalItems} icon={<AlertIcon />} subtitle="items need attention" />
          <MetricCard title="Avg Daily Sales" value={avgSales} icon={<TrendIcon />} subtitle="units/day" />
          <MetricCard title="Total Suggested Qty" value={summary.totalSuggestedQuantity} icon={<OrderIcon />} subtitle="units to reorder" />
        </div>

        {error && (
          <FormError message={error} />
        )}

        {loading ? (
          <div className="space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-[#DBEFF3] rounded-xl" />)}</div>
        ) : !error ? (
          <>
            {/* Low stock alerts */}
            <section>
              <div className="bg-[#49B0C1] px-4 py-2.5 rounded-t-xl flex items-center justify-between">
                <p className="text-sm font-bold text-white">LOW STOCK ALERTS ({dashboard.length} items)</p>
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
                      {dashboard.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-[#333333]/60">No low-stock alerts right now.</td>
                        </tr>
                      ) : (
                        dashboard.map((d, i) => (
                          <tr key={d.product.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"}>
                            <td className="px-4 py-3 font-medium text-[#333333]">{d.product.name}</td>
                            <td className={`px-4 py-3 font-bold ${d.currentStock <= d.minimumThreshold ? "text-red-600" : "text-[#333333]"}`}>{d.currentStock}</td>
                            <td className="px-4 py-3 text-[#666666]">{d.minimumThreshold}</td>
                            <td className="px-4 py-3 text-[#666666]">—</td>
                            <td className="px-4 py-3 font-semibold text-[#333333]">{d.suggestedQuantity}</td>
                            <td className="px-4 py-3">{urgencyBadge(d.urgency)}</td>
                          </tr>
                        ))
                      )}
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
                      {suggestions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-[#333333]/60">No reorder suggestions right now.</td>
                        </tr>
                      ) : (
                        suggestions.map((s, i) => (
                          <tr key={s.product.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"}>
                            <td className="px-4 py-3 font-medium text-[#333333]">{s.product.name}</td>
                            <td className="px-4 py-3 text-[#666666]">{s.averageDailySales}</td>
                            <td className="px-4 py-3 text-[#666666]">{s.leadTimeDays}</td>
                            <td className="px-4 py-3 font-semibold text-[#49B0C1]">{s.suggestedQuantity}</td>
                            <td className="px-4 py-3">
                              <Button onClick={() => alert("Create purchase order — Purchasing module coming soon.")}>Order</Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>

      <GenerateRequirementsModal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        suggestions={modalSuggestions}
        onGenerate={() => refresh()}
      />
    </div>
  );
}

function AlertIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>; }
function TrendIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/></svg>; }
function OrderIcon() { return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/></svg>; }