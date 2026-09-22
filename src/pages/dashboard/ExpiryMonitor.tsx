import { useNavigate } from "react-router"
import { fmtDate, fmtNumber } from "../../utils/format"
import { type DashboardAttention } from "../../features/dashboard/dashboardApi"
import { Panel, PanelSkeleton, PanelEmpty, PanelError } from "./Panel"
import { nearestExpiryBatchId } from "./dashboardView"

interface ExpiryMonitorProps {
  attention: DashboardAttention | null
  count: number
  loading: boolean
  error: string | null
  onRetry: () => void
}

export default function ExpiryMonitor({
  attention,
  count,
  loading,
  error,
  onRetry,
}: ExpiryMonitorProps) {
  const navigate = useNavigate()
  const items = attention?.expiringSoon ?? []
  const nearest = nearestExpiryBatchId(items)

  return (
    <Panel
      title="Expiry Monitor"
      count={count}
      viewAllTo="/inventory/batches-expiry"
    >
      {loading && !attention ? (
        <PanelSkeleton rows={4} />
      ) : error && !attention ? (
        <PanelError message={error} onRetry={onRetry} />
      ) : attention ? (
        items.length === 0 ? (
          <PanelEmpty text="No batches expiring soon" />
        ) : (
          <ol className="flex flex-col px-5 py-4">
            {items.map((item, index) => {
              const isNearest = item.batchId === nearest
              const isLast = index === items.length - 1
              return (
                <li
                  key={item.batchId}
                  className={`relative pl-7 ${isLast ? "" : "pb-4"}`}
                >
                  {!isLast && (
                    <span
                      className="absolute left-[7px] top-4 bottom-0 w-px bg-[#DBEFF3]"
                      aria-hidden
                    />
                  )}
                  <span
                    className={`absolute left-0 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ${
                      isNearest
                        ? "bg-[#B0574A] ring-[#FBEFED]"
                        : "bg-[#49B0C1] ring-white"
                    }`}
                    aria-hidden
                  />
                  <button
                    className="w-full rounded-lg text-left transition-colors hover:bg-[#DBEFF3]/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#49B0C1]"
                    onClick={() =>
                      navigate(`/inventory/batches/${item.batchId}`)
                    }
                    title={`Open batch: ${item.batchNumber}`}
                  >
                    <div className="flex items-start justify-between gap-3 py-0.5">
                      <div className="min-w-0">
                        <p
                          className={`truncate text-sm text-[#333333] ${
                            isNearest ? "font-bold" : "font-semibold"
                          }`}
                        >
                          {item.productName}
                        </p>
                        <p className="truncate text-xs text-[#666666]">
                          Batch {item.batchNumber}
                        </p>
                        <p
                          className={`mt-1 text-[11px] font-semibold ${
                            isNearest ? "text-[#97473D]" : "text-[#666666]"
                          }`}
                        >
                          {fmtNumber(item.remainingQuantity)} units remaining
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p
                          className={`text-sm whitespace-nowrap ${
                            isNearest
                              ? "font-bold text-[#B0574A]"
                              : "font-semibold text-[#333333]"
                          }`}
                        >
                          {fmtDate(item.expiryDate)}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-[#999999]">
                          Expiry
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ol>
        )
      ) : null}
    </Panel>
  )
}
