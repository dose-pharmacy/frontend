import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import {
  getInventoryOverview,
  InventoryOverviewApiError,
  type InventoryMetricsDto,
} from "../../features/inventory/inventoryOverviewApi"
import {
  getReorderDashboard,
  type ReorderDashboardItemDto,
} from "../../features/inventory/reorderApi"
import {
  listExpiryBatches,
  dedupeBatchesById,
  type ExpiryBatchDto,
} from "../../features/inventory/expiryApi"
import {
  getProductTransactions,
  type StockTransactionDto,
} from "../../features/inventory/stockApi"
import MetricCard from "../../components/ui/MetricCard"
import PageHeader from "../../components/ui/PageHeader"
import Button from "../../components/ui/Button"

export default function InventoryDashboardPage() {
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<InventoryMetricsDto | null>(null)
  const [lowStock, setLowStock] = useState<ReorderDashboardItemDto[]>([])
  const [expiringSoonBatches, setExpiringSoonBatches] = useState<ExpiryBatchDto[]>([])
  const [recentActivity, setRecentActivity] = useState<StockTransactionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    // KPIs come from GET /inventory/dashboard. The overview payload is
    // counts-only, so the panels below pull from the dedicated reorder /
    // expiry / stock endpoints. A failing panel degrades to its empty state.
    void (async () => {
      try {
        const [dashR, reorderR, expiryR] = await Promise.allSettled([
          getInventoryOverview({ thresholds: [30, 60, 90] }),
          getReorderDashboard({ limit: 5 }),
          listExpiryBatches({ thresholds: [30, 60, 90], limit: 100, page: 1 }),
        ])
        if (cancelled) return

        if (dashR.status === "fulfilled") {
          setMetrics(dashR.value)
          setError(null)
        } else {
          setError(
            dashR.reason instanceof InventoryOverviewApiError
              ? dashR.reason.message
              : "Failed to load inventory metrics. Please try again."
          )
        }
        if (reorderR.status === "fulfilled") setLowStock(reorderR.value.items)

        let expiring: ExpiryBatchDto[] = []
        if (expiryR.status === "fulfilled") {
          // The list endpoint can repeat a batch across threshold windows — dedupe.
          expiring = dedupeBatchesById(expiryR.value.data)
            .filter((b) => b.daysRemaining >= 0 && b.daysRemaining <= 60 && b.stock.quantity > 0)
            .sort((a, b) => a.daysRemaining - b.daysRemaining)
          setExpiringSoonBatches(expiring.slice(0, 5))
        }

        // Recent activity: the backend only exposes per-product transaction
        // ledgers, so sample the products surfaced by the panels above.
        const ids = new Set<string>()
        if (reorderR.status === "fulfilled") {
          for (const i of reorderR.value.items) ids.add(i.product.id)
        }
        for (const b of expiring.slice(0, 3)) ids.add(b.product.id)
        const sampleIds = [...ids].slice(0, 3)
        const ledgers = await Promise.all(
          sampleIds.map((id) =>
            getProductTransactions(id, { page: 1, limit: 5 }).catch(() => ({ data: [] as StockTransactionDto[] })),
          ),
        )
        if (cancelled) return
        setRecentActivity(
          ledgers
            .flatMap((l) => l.data)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 8),
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // KPI values from the overview endpoint. The API has no explicit
  // "in stock" count, so derive it from the stock-health figures.
  const kpis = useMemo(
    () => ({
      total: metrics?.totalProducts ?? 0,
      inStock: Math.max(0, (metrics?.totalProducts ?? 0) - (metrics?.lowStock ?? 0) - (metrics?.outOfStock ?? 0)),
      lowStock: metrics?.lowStock ?? 0,
      outOfStock: metrics?.outOfStock ?? 0,
      expiringSoon: metrics?.nearExpiry ?? 0,
    }),
    [metrics]
  )

  function formatTime(value: string) {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Inventory / Overview"
        title="Inventory Overview"
        subtitle="Monitor your pharmacy inventory and identify items that need attention."
        actions={
          <Button onClick={() => navigate("/inventory/products")}>
            Manage Products
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            title="Total Products"
            value={loading ? "—" : kpis.total}
            icon={<BoxIcon />}
          />
          <MetricCard
            title="In Stock"
            value={loading ? "—" : kpis.inStock}
            icon={<CheckIcon />}
          />
          <MetricCard
            title="Low Stock"
            value={loading ? "—" : kpis.lowStock}
            icon={<WarnIcon />}
            subtitle="Needs attention"
          />
          <MetricCard
            title="Out of Stock"
            value={loading ? "—" : kpis.outOfStock}
            icon={<AlertIcon />}
            subtitle="Action required"
          />
          <MetricCard
            title="Expiring Soon"
            value={loading ? "—" : kpis.expiringSoon}
            icon={<ClockIcon />}
            subtitle="Within 30 days"
          />
        </div>

        {/* Attention Required */}
        {!loading && (kpis.outOfStock > 0 || kpis.lowStock > 0 || kpis.expiringSoon > 0) && (
          <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#DBEFF3]">
              <p className="font-semibold text-[#333333]">Attention Required</p>
            </div>
            <div className="divide-y divide-[#DBEFF3]">
              {kpis.outOfStock > 0 && (
                <div className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 flex-shrink-0" />
                    <span className="text-sm text-[#333333]">
                      <span className="font-semibold">{kpis.outOfStock}</span> product{kpis.outOfStock !== 1 ? "s" : ""} out of stock
                    </span>
                  </div>
                  <button onClick={() => navigate("/inventory/products")} className="text-xs font-semibold text-[#49B0C1] hover:underline">View →</button>
                </div>
              )}
              {kpis.lowStock > 0 && (
                <div className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-400 flex-shrink-0" />
                    <span className="text-sm text-[#333333]">
                      <span className="font-semibold">{kpis.lowStock}</span> product{kpis.lowStock !== 1 ? "s" : ""} low in stock
                    </span>
                  </div>
                  <button onClick={() => navigate("/inventory/reorder")} className="text-xs font-semibold text-[#49B0C1] hover:underline">View →</button>
                </div>
              )}
              {kpis.expiringSoon > 0 && (
                <div className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 flex-shrink-0" />
                    <span className="text-sm text-[#333333]">
                      <span className="font-semibold">{kpis.expiringSoon}</span> batch{kpis.expiringSoon !== 1 ? "es" : ""} expiring within 30 days
                    </span>
                  </div>
                  <button onClick={() => navigate("/inventory/batches-expiry")} className="text-xs font-semibold text-[#49B0C1] hover:underline">View →</button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expiring Soon */}
          <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#DBEFF3]">
              <div>
                <p className="font-semibold text-[#333333]">Expiring Soon</p>
                <p className="text-xs text-[#666666] mt-0.5">
                  Batches expiring within 60 days
                </p>
              </div>
              <button
                onClick={() => navigate("/inventory/expiry")}
                className="text-xs font-semibold text-[#49B0C1] hover:underline"
              >
                View All
              </button>
            </div>
            {loading ? (
              <LoadingSkeleton rows={4} />
            ) : expiringSoonBatches.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#666666]">
                No batches expiring soon.
              </p>
            ) : (
              <div className="divide-y divide-[#DBEFF3]">
                {expiringSoonBatches.map((b) => {
                  const days = b.daysRemaining
                  const urgent = days <= 30
                  return (
                    <div
                      key={b.id}
                      className="flex items-center justify-between px-5 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#333333] truncate">
                          {b.product.name}
                        </p>
                        <p className="text-xs text-[#666666] font-mono">
                          {b.batchNumber}
                        </p>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p
                          className={`text-sm font-bold ${urgent ? "text-red-600" : "text-yellow-600"}`}
                        >
                          {days}d left
                        </p>
                        <p className="text-xs text-[#666666]">
                          {b.stock.quantity.toLocaleString()} units
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Low Stock */}
          <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#DBEFF3]">
              <div>
                <p className="font-semibold text-[#333333]">Low Stock Alert</p>
                <p className="text-xs text-[#666666] mt-0.5">
                  Products at or below reorder point
                </p>
              </div>
              <button
                onClick={() => navigate("/inventory/reorder")}
                className="text-xs font-semibold text-[#49B0C1] hover:underline"
              >
                View Reorder
              </button>
            </div>
            {loading ? (
              <LoadingSkeleton rows={4} />
            ) : lowStock.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#666666]">
                All products are adequately stocked.
              </p>
            ) : (
              <div className="divide-y divide-[#DBEFF3]">
                {lowStock.map((i) => (
                  <div
                    key={i.product.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#333333] truncate">
                        {i.product.name}
                      </p>
                      <p className="text-xs text-[#666666]">
                        Reorder at {i.reorderPoint.toLocaleString()}{" "}
                        {i.product.baseUnit?.name ?? i.product.baseUnit?.symbol ?? "unit"}s
                      </p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p
                        className={`text-sm font-bold ${i.currentStock <= 0 ? "text-red-600" : "text-yellow-600"}`}
                      >
                        {i.currentStock.toLocaleString()} {i.product.baseUnit?.name ?? i.product.baseUnit?.symbol ?? "unit"}s
                      </p>
                      <span
                        className={`text-xs font-semibold rounded-full px-2 py-0.5 ${i.currentStock <= 0 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}
                      >
                        {i.currentStock <= 0 ? "Out of Stock" : "Low Stock"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#DBEFF3]">
            <div>
              <p className="font-semibold text-[#333333]">Recent Stock Activity</p>
              <p className="text-xs text-[#666666] mt-0.5">
                Latest inventory movements
              </p>
            </div>
            <button
              onClick={() => navigate("/inventory/stock")}
              className="text-xs font-semibold text-[#49B0C1] hover:underline"
            >
              View All Movements
            </button>
          </div>
          {loading ? (
            <LoadingSkeleton rows={5} />
          ) : recentActivity.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[#666666]">
              No stock activity recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#DBEFF3] text-left">
                    {["Date", "Product", "Type", "Location", "Qty In", "Qty Out", "Ref"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 font-semibold text-[#333333]"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((t, i) => {
                    const productName =
                      (t.product as { name?: string } | undefined)?.name ?? t.productId
                    const locationName =
                      (t.location as { name?: string } | undefined)?.name ?? "—"
                    const batchNumber =
                      (t.batch as { batchNumber?: string } | undefined)?.batchNumber
                    const isIn = t.direction === "IN"
                    const qtyLabel = `${t.quantity.toLocaleString()}${batchNumber ? ` · ${batchNumber}` : ""}`
                    return (
                      <tr
                        key={t.id}
                        className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}
                      >
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                          {formatTime(t.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-[#333333] font-medium">
                          {productName}
                        </td>
                        <td className="px-4 py-3">
                          <TxTypeBadge type={t.transactionType} />
                        </td>
                        <td className="px-4 py-3 text-[#666666]">{locationName}</td>
                        <td className="px-4 py-3 text-green-700 font-semibold">
                          {isIn ? `+${qtyLabel}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-red-600 font-semibold">
                          {!isIn ? `−${qtyLabel}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#666666] font-mono">
                          {t.referenceType ?? t.referenceId ?? "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-8 rounded-lg bg-[#DBEFF3]" />
      ))}
    </div>
  )
}

function TxTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    RECEIPT: { label: "Received", cls: "bg-green-100 text-green-700" },
    SALE: { label: "Sale", cls: "bg-blue-100 text-blue-700" },
    TRANSFER: { label: "Transfer", cls: "bg-purple-100 text-purple-700" },
    ADJUSTMENT: { label: "Adjustment", cls: "bg-orange-100 text-orange-700" },
    OPENING: { label: "Opening", cls: "bg-[#DBEFF3] text-[#49B0C1]" },
    DISPOSAL: { label: "Disposal", cls: "bg-red-100 text-red-700" },
    RETURN: { label: "Return", cls: "bg-yellow-100 text-yellow-700" },
  }
  const cfg = map[type] ?? { label: type, cls: "bg-gray-100 text-gray-700" }
  return (
    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 capitalize ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Sub-navigation ────────────────────────────────────────────────────────
const SUB_LINKS = [
  { to: "/inventory", label: "Overview", key: "overview" },
  { to: "/inventory/products", label: "Products", key: "products" },
  { to: "/inventory/stock", label: "Stock", key: "stock" },
  { to: "/inventory/batches-expiry", label: "Batches & Expiry", key: "batches-expiry" },
  { to: "/inventory/transfers", label: "Transfers", key: "transfers" },
  { to: "/inventory/reorder", label: "Reorder", key: "reorder" },
  { to: "/inventory/groups", label: "Product Groups", key: "groups", separator: true },
  { to: "/inventory/units", label: "Units", key: "units" },
  { to: "/inventory/locations", label: "Locations", key: "locations" },
]

export function InventorySubNav({ active }: { active: string }) {
  const navigate = useNavigate()

  return (
    <div className="bg-white border-b border-[#DBEFF3] overflow-x-auto">
      <div className="flex gap-0 px-6 min-w-max items-stretch">
        {SUB_LINKS.map(({ to, label, key, separator }: { to: string; label: string; key: string; separator?: boolean }) => {
          const isActive = active === key
          return (
            <div key={to} className="flex items-stretch">
              {separator && (
                <div className="flex items-center mx-1">
                  <div className="h-5 w-px bg-[#DBEFF3]" />
                </div>
              )}
              <button
                onClick={() => navigate(to)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-[#49B0C1] text-[#49B0C1]"
                    : "border-transparent text-[#666666] hover:text-[#333333] hover:border-[#ABDBE3]"
                }`}
              >
                {label}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Icons ─────────────────────────────────────────────────────────────────
function BoxIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function WarnIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  )
}
function AlertIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
