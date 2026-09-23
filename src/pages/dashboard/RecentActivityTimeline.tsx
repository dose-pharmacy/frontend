import { Boxes, PackageCheck, Receipt, AlertTriangle } from "lucide-react"
import { fmtDateTime, timeAgo } from "../../utils/format"
import { type RecentActivityItem } from "../../features/dashboard/dashboardApi"
import { Panel, PanelSkeleton, PanelEmpty, PanelError } from "./Panel"
import { activityTypeLabel } from "./dashboardView"

interface RecentActivityTimelineProps {
  items: RecentActivityItem[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

// Icon + colour treatment per known activity type (presentation only).
const ACTIVITY_STYLE: Record<string, {
  icon: React.ReactNode
  fg: string
  bg: string
  border: string
}> = {
  SALE_COMPLETED: {
    icon: <Receipt className="h-3.5 w-3.5" />,
    fg: "#5A8756",
    bg: "#F2F7F1",
    border: "#C3D8BF",
  },
  GOODS_RECEIVED: {
    icon: <PackageCheck className="h-3.5 w-3.5" />,
    fg: "#2A7F8C",
    bg: "#DBEFF3",
    border: "#49B0C1",
  },
  PURCHASE_ORDER_CREATED: {
    icon: <Boxes className="h-3.5 w-3.5" />,
    fg: "#455F6D",
    bg: "#EFF3F5",
    border: "#BACBD3",
  },
}

const DEFAULT_STYLE = {
  icon: <AlertTriangle className="h-3.5 w-3.5" />,
  fg: "#666666",
  bg: "#F5F5F0",
  border: "#E6ECE2",
}

export default function RecentActivityTimeline({
  items,
  loading,
  error,
  onRetry,
}: RecentActivityTimelineProps) {
  return (
    <Panel title="Recent Activity">
      {loading && items.length === 0 ? (
        <PanelSkeleton rows={5} />
      ) : error && items.length === 0 ? (
        <PanelError message={error} onRetry={onRetry} />
      ) : items.length === 0 ? (
        <PanelEmpty text="No recent activity" />
      ) : (
        <div className="max-h-[22rem] overflow-y-auto">
          <ol className="relative flex flex-col px-5 py-4">
            {items.map((item, index) => {
              const style = ACTIVITY_STYLE[item.type] ?? DEFAULT_STYLE
              const isLast = index === items.length - 1
              return (
                <li
                  key={`${item.type}-${item.reference}-${index}`}
                  className={`relative pl-9 ${isLast ? "" : "pb-4"}`}
                  title={fmtDateTime(item.createdAt)}
                >
                  {!isLast && (
                    <span
                      className="absolute left-[14px] top-7 bottom-0 w-px bg-[#DBEFF3]"
                      aria-hidden
                    />
                  )}
                  <span
                    className="absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full border"
                    style={{
                      color: style.fg,
                      backgroundColor: style.bg,
                      borderColor: style.border,
                    }}
                    aria-hidden
                  >
                    {style.icon}
                  </span>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#333333]">
                        {activityTypeLabel(item.type)}
                      </p>
                      <p className="truncate text-xs text-[#666666]">
                        {item.description}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-[#999999]">
                        {item.reference}
                      </p>
                    </div>
                    <p className="flex-shrink-0 whitespace-nowrap text-[11px] text-[#666666]">
                      {timeAgo(item.createdAt)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </Panel>
  )
}
