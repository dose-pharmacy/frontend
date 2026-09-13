import { useEffect, useState } from "react"
import { getLocations } from "../../features/inventory/inventoryService"
import type { Location } from "../../features/inventory/inventoryMock"
import PageHeader from "../../components/ui/PageHeader"
import Button from "../../components/ui/Button"
import EmptyState from "../../components/ui/EmptyState"

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLocations().then((data) => {
      setLocations(data)
      setLoading(false)
    })
  }, [])

  const active = locations.filter((l) => l.isActive)
  const inactive = locations.filter((l) => !l.isActive)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Settings / Locations"
        title="Locations"
        subtitle="Manage pharmacy storage locations."
        actions={
          <Button onClick={() => alert("Add Location — backend integration pending")}>
            + Add Location
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
            <p className="text-xs font-medium text-[#666666] uppercase tracking-wide">Total Locations</p>
            <p className="text-2xl font-bold text-[#333333] mt-1">{loading ? "—" : locations.length}</p>
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

        {/* Location Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-[#DBEFF3] animate-pulse" />
            ))}
          </div>
        ) : locations.length === 0 ? (
          <EmptyState
            title="No locations configured"
            description="Add storage locations to track stock across your pharmacy."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className={`bg-white rounded-xl border p-5 flex flex-col gap-3 ${loc.isActive ? "border-[#DBEFF3]" : "border-gray-200 opacity-60"}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#333333] truncate">{loc.name}</p>
                    <p className="text-xs text-[#666666] mt-0.5">{loc.description}</p>
                  </div>
                  <span
                    className={`ml-3 flex-shrink-0 text-xs font-semibold rounded-full px-2.5 py-1 ${loc.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {loc.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-[#666666]">
                  <svg className="h-4 w-4 text-[#49B0C1]" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
                  </svg>
                  <span>
                    {loc.productCount} product{loc.productCount !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="flex gap-2 mt-auto pt-1">
                  <button
                    onClick={() => alert(`View stock at ${loc.name} — backend integration pending`)}
                    className="flex-1 rounded-lg border border-[#ABDBE3] px-3 py-1.5 text-xs font-semibold text-[#49B0C1] hover:bg-[#DBEFF3] transition-colors"
                  >
                    View Stock
                  </button>
                  <button
                    onClick={() => alert(`Edit ${loc.name} — backend integration pending`)}
                    className="flex-1 rounded-lg border border-[#ABDBE3] px-3 py-1.5 text-xs font-semibold text-[#666666] hover:bg-[#DBEFF3] transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
