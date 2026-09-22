import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { fmtNumber } from "../../utils/format"
import { type DashboardSummary } from "../../features/dashboard/dashboardApi"
import { Panel, PanelSkeleton, PanelError } from "./Panel"

interface InventoryOverviewProps {
  summary: DashboardSummary | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

// Colours are presentation only; every value comes straight from the summary.
const BARS = (summary: DashboardSummary) => [
  {
    key: "low",
    label: "Low Stock",
    value: summary.inventory.lowStockCount,
    color: "#49B0C1",
  },
  {
    key: "expiring",
    label: "Expiring Soon",
    value: summary.inventory.expiringSoonCount,
    color: "#D0A23C",
  },
  {
    key: "expired",
    label: "Expired",
    value: summary.inventory.expiredCount,
    color: "#B0574A",
  },
  {
    key: "out",
    label: "Out of Stock",
    value: summary.inventory.outOfStockCount,
    color: "#7C3C34",
  },
]

export default function InventoryOverview({
  summary,
  loading,
  error,
  onRetry,
}: InventoryOverviewProps) {
  const rows = summary ? BARS(summary) : []
  const total = rows.reduce((sum, r) => sum + r.value, 0)

  return (
    <Panel title="Inventory Overview">
      {loading && !summary ? (
        <PanelSkeleton rows={4} />
      ) : error && !summary ? (
        <PanelError message={error} onRetry={onRetry} />
      ) : summary ? (
        <div className="flex flex-col gap-5 px-5 py-5">
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
                barCategoryGap={14}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={96}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#666666" }}
                />
                <Tooltip
                  cursor={{ fill: "#DBEFF3" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #DBEFF3",
                    fontSize: 12,
                    color: "#333333",
                  }}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                >
                  {rows.map((r) => (
                    <Cell key={r.key} fill={r.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#DBEFF3] pt-4">
            {rows.map((r) => (
              <span
                key={r.key}
                className="flex items-center gap-2 text-xs text-[#666666]"
              >
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                  style={{ backgroundColor: r.color }}
                  aria-hidden
                />
                {r.label}
                <span className="font-bold text-[#333333]">
                  {fmtNumber(r.value)}
                </span>
              </span>
            ))}
            <span className="ml-auto text-xs text-[#666666]">
              Total flagged{" "}
              <span className="font-bold text-[#333333]">
                {fmtNumber(total)}
              </span>
            </span>
          </div>
        </div>
      ) : null}
    </Panel>
  )
}
