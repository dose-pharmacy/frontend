import { useState } from "react";
import { useNavigate } from "react-router";
import ReportsSubNav from "./ReportsSubNav";
import PageHeader from "../../components/ui/PageHeader";
import { MOCK_PRODUCT_GROUPS, MOCK_MARGIN_PRODUCTS } from "../../features/reports/reportsMock";

const fmtMoney = (n: number) =>
  `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;

export default function ProfitMarginConfigPage() {
  const navigate = useNavigate();
  const [selectedGroupId, setSelectedGroupId] = useState("g1");
  const [defaultMargin, setDefaultMargin] = useState(15);
  const [minMargin, setMinMargin] = useState(10);
  const [maxMargin, setMaxMargin] = useState(25);
  const [calcMethod, setCalcMethod] = useState<"auto" | "reference">("auto");
  const [applying, setApplying] = useState(false);
  const [success, setSuccess] = useState(false);

  const group = MOCK_PRODUCT_GROUPS.find((g) => g.id === selectedGroupId)!;
  const products = MOCK_MARGIN_PRODUCTS.filter((p) => p.groupId === selectedGroupId);

  function getNewSellPrice(costPrice: number) {
    return costPrice * (1 + defaultMargin / 100);
  }

  function getMarginColor(margin: number) {
    if (margin > 18) return "text-green-600";
    if (margin > 12) return "text-yellow-500";
    return "text-red-500";
  }

  async function handleApply() {
    setApplying(true);
    await new Promise((r) => setTimeout(r, 900));
    setApplying(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }

  const estimatedImpact = products.reduce((s, p) => {
    const newPrice = getNewSellPrice(p.costPrice);
    return s + (newPrice - p.currentSellPrice) * 100;
  }, 0);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Profit Margin Configuration"
        subtitle="Reports → Margins"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/70">Last Updated: Today, 10:30 AM</span>
            <button className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/20 transition-colors">Export</button>
          </div>
        }
      />
      <ReportsSubNav />

      <div className="flex-1 overflow-y-auto pb-24">
        {success && (
          <div className="mx-4 sm:mx-6 mt-4 rounded-lg bg-green-50 border border-green-300 px-4 py-2.5 text-sm text-green-700">
            ✅ Margin configuration applied to all products in {group.name}.
          </div>
        )}

        {/* Group selector */}
        <div className="px-4 sm:px-6 pt-4">
          <div className="bg-[#DBEFF3] rounded-xl p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-[#666666]">Select Product Group</label>
              <select
                value={selectedGroupId}
                onChange={(e) => {
                  setSelectedGroupId(e.target.value);
                  const g = MOCK_PRODUCT_GROUPS.find((g) => g.id === e.target.value)!;
                  setDefaultMargin(g.defaultMargin);
                  setMinMargin(g.minMargin);
                  setMaxMargin(g.maxMargin);
                  setCalcMethod(g.calcMethod);
                }}
                className="rounded-lg border border-[#ABDBE3] bg-white px-4 py-2 text-sm font-semibold text-[#333333] focus:border-[#49B0C1] focus:outline-none min-w-[180px]"
              >
                {MOCK_PRODUCT_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="flex gap-4 flex-wrap text-sm">
              <span className="text-[#666666]">Products: <span className="font-semibold text-[#333333]">{group.productCount}</span></span>
              <span className="text-[#666666]">Avg Margin: <span className="font-semibold text-green-600">{group.avgMargin}%</span></span>
              <span className="text-[#666666] text-xs">Updated: 02/15/2026</span>
            </div>
          </div>
        </div>

        {/* Settings form */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-white rounded-xl border border-[#DBEFF3] p-5">
            <h2 className="text-base font-bold text-[#333333] mb-4">Margin Settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className="block text-sm text-[#666666] mb-1">Product Group</label>
                <div className="rounded-lg bg-[#DBEFF3] px-3 py-2 text-base font-bold text-[#333333]">{group.name}</div>
              </div>

              {[
                { label: "Default Margin", helper: "Default margin percentage for all products in this group", value: defaultMargin, setter: setDefaultMargin },
                { label: "Minimum Allowed Margin", helper: "Lowest margin allowed for any product in this group", value: minMargin, setter: setMinMargin },
                { label: "Maximum Allowed Margin", helper: "Highest margin allowed for any product in this group", value: maxMargin, setter: setMaxMargin },
              ].map(({ label, helper, value, setter }) => (
                <div key={label}>
                  <label className="block text-sm text-[#666666] mb-1">{label}</label>
                  <div className="relative w-32">
                    <input
                      type="number"
                      value={value}
                      min={0}
                      max={100}
                      onChange={(e) => setter(Number(e.target.value))}
                      className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 pr-7 text-sm focus:border-[#49B0C1] focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#666666]">%</span>
                  </div>
                  <p className="text-xs text-[#666666] mt-1">{helper}</p>
                </div>
              ))}

              <div className="sm:col-span-2">
                <label className="block text-sm text-[#666666] mb-2">Margin Calculation Method</label>
                <div className="flex flex-wrap gap-4">
                  {[
                    { value: "auto", label: "Auto-calculate Selling Price", sub: "Cost Price + Margin = Selling Price" },
                    { value: "reference", label: "Reference / Reporting Only", sub: "Margin used for reporting only" },
                  ].map((opt) => (
                    <label key={opt.value} className={`flex items-start gap-3 rounded-lg border-2 px-4 py-3 cursor-pointer transition-all ${calcMethod === opt.value ? "border-[#49B0C1] bg-[#DBEFF3]" : "border-[#ABDBE3] bg-white"}`}>
                      <input type="radio" name="calcMethod" value={opt.value} checked={calcMethod === opt.value} onChange={() => setCalcMethod(opt.value as "auto" | "reference")} className="mt-0.5 accent-[#49B0C1]" />
                      <div>
                        <p className="text-sm font-semibold text-[#333333]">{opt.label}</p>
                        <p className="text-xs text-[#666666]">{opt.sub}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Impact preview */}
        <div className="px-4 sm:px-6">
          <div className="bg-[#DBEFF3] rounded-xl p-4">
            <p className="font-bold text-[#333333] mb-3">Impact Preview</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Average Margin", value: `${defaultMargin}%`, sub: `Configured for ${group.name}`, subColor: "text-[#49B0C1]" },
                { label: "Products Affected", value: `${group.productCount} products`, sub: "All products in this group", subColor: "text-[#666666]" },
                { label: "Estimated Impact", value: `+${Math.abs(Math.round(estimatedImpact)).toLocaleString()} ETB`, sub: "Projected monthly increase", subColor: "text-green-600" },
              ].map(({ label, value, sub, subColor }) => (
                <div key={label} className="bg-white rounded-xl p-4 border border-[#ABDBE3]/30">
                  <p className="text-xs text-[#666666]">{label}</p>
                  <p className="text-2xl font-bold text-[#49B0C1] mt-1">{value}</p>
                  <p className={`text-xs mt-0.5 ${subColor}`}>{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Products table */}
        <div className="px-4 sm:px-6 py-4">
          <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#ABDBE3]">
                  {["#", "Product", "Brand", "Cost Price", "Current Sell Price", "Current Margin", "New Sell Price", "New Margin"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => {
                  const newSell = getNewSellPrice(p.costPrice);
                  const diff = newSell - p.currentSellPrice;
                  return (
                    <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-4 py-3 text-[#666666]">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-[#333333]">{p.name}</td>
                      <td className="px-4 py-3 text-[#666666]">{p.brand}</td>
                      <td className="px-4 py-3 text-[#333333]">{fmtMoney(p.costPrice)}</td>
                      <td className="px-4 py-3 text-[#333333]">{fmtMoney(p.currentSellPrice)}</td>
                      <td className={`px-4 py-3 font-semibold ${getMarginColor(p.currentMargin)}`}>{p.currentMargin.toFixed(1)}%</td>
                      <td className="px-4 py-3 font-semibold text-[#49B0C1] flex items-center gap-1">
                        {fmtMoney(newSell)}
                        {Math.abs(diff) > 0.1 && (
                          <span className={`text-xs ${diff > 0 ? "text-green-600" : "text-yellow-500"}`}>{diff > 0 ? "↑" : "↓"}</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 font-semibold ${getMarginColor(defaultMargin)}`}>{defaultMargin}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#DBEFF3] px-4 sm:px-6 py-3 flex items-center justify-end gap-3 z-30">
        <button onClick={() => navigate("/reports")} className="rounded-lg bg-red-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors">Cancel</button>
        <button className="rounded-lg bg-[#ABDBE3] px-5 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#9acbd5] transition-colors">👁 Preview Changes</button>
        <button
          onClick={handleApply}
          disabled={applying}
          className="rounded-lg bg-[#49B0C1] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#3a9baf] transition-colors disabled:opacity-40"
        >
          {applying ? "Applying…" : "✓ Apply to All"}
        </button>
      </div>
    </div>
  );
}
