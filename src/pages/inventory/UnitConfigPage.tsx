import { useEffect, useState } from "react";
import { getMasterUnits } from "../../features/inventory/inventoryService";
import type { MasterUnit } from "../../features/inventory/inventoryMock";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";

export default function UnitConfigPage() {
  const [units, setUnits] = useState<MasterUnit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMasterUnits().then((u) => {
      setUnits(u);
      setLoading(false);
    });
  }, []);

  const active = units.filter((u) => u.isActive);
  const inactive = units.filter((u) => !u.isActive);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Settings / Units"
        title="Units"
        subtitle="Manage reusable inventory units."
        actions={
          <Button onClick={() => alert("Add Unit — backend integration pending")}>
            + Add Unit
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
            <p className="text-xs font-medium text-[#666666] uppercase tracking-wide">Total Units</p>
            <p className="text-2xl font-bold text-[#333333] mt-1">{loading ? "—" : units.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
            <p className="text-xs font-medium text-[#666666] uppercase tracking-wide">Active</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{loading ? "—" : active.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
            <p className="text-xs font-medium text-[#666666] uppercase tracking-wide">Inactive</p>
            <p className="text-2xl font-bold text-[#666666] mt-1">{loading ? "—" : inactive.length}</p>
          </div>
        </div>

        {/* Units Table */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-[#DBEFF3]" />
              ))}
            </div>
          ) : units.length === 0 ? (
            <EmptyState
              title="No units configured"
              description="Add master units to configure product packaging and conversions."
              action={<Button onClick={() => alert("Add Unit — backend pending")}>+ Add Unit</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#DBEFF3] text-left">
                    <th className="px-4 py-3 font-semibold text-[#333333]">Unit Name</th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">Symbol</th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">Products Using</th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">Status</th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u, i) => (
                    <tr key={u.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-4 py-3 font-semibold text-[#333333]">{u.name}</td>
                      <td className="px-4 py-3 font-mono text-sm text-[#666666]">{u.symbol}</td>
                      <td className="px-4 py-3 text-[#666666]">
                        {u.productsUsing} product{u.productsUsing !== 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold rounded-full px-2.5 py-1 ${u.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                        >
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => alert(`Edit ${u.name} — backend pending`)}
                          className="text-xs font-semibold text-[#49B0C1] hover:underline mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => alert(`${u.isActive ? "Deactivate" : "Activate"} ${u.name} — backend pending`)}
                          className="text-xs font-semibold text-[#666666] hover:underline"
                        >
                          {u.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info note */}
        <div className="rounded-xl bg-[#DBEFF3] px-5 py-4 flex gap-3 items-start">
          <svg className="h-5 w-5 text-[#49B0C1] mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-[#333333]">Master Units are reusable</p>
            <p className="text-xs text-[#666666] mt-0.5">
              These units are shared across all products. Product-specific conversions and pricing are configured inside each product.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
