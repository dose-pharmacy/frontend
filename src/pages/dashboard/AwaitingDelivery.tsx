import { useNavigate } from "react-router"
import { fmtDate, fmtNumber } from "../../utils/format"
import { type DashboardAttention } from "../../features/dashboard/dashboardApi"
import { Panel, PanelSkeleton, PanelEmpty, PanelError } from "./Panel"

interface AwaitingDeliveryProps {
  attention: DashboardAttention | null
  count: number
  loading: boolean
  error: string | null
  onRetry: () => void
  className?: string
}

export default function AwaitingDelivery({
  attention,
  count,
  loading,
  error,
  onRetry,
  className,
}: AwaitingDeliveryProps) {
  const navigate = useNavigate()
  const items = attention?.awaitingDelivery ?? []

  return (
    <Panel
      title="Awaiting Delivery"
      count={count}
      viewAllTo="/purchasing/deliveries"
      className={className}
    >
      {loading && !attention ? (
        <PanelSkeleton rows={4} />
      ) : error && !attention ? (
        <PanelError message={error} onRetry={onRetry} />
      ) : attention ? (
        items.length === 0 ? (
          <PanelEmpty text="No deliveries awaiting receipt" />
        ) : (
          <>
            {/* Headline count */}
            <div className="flex items-baseline gap-3 border-b border-[#DBEFF3] bg-[#DBEFF3]/30 px-5 py-4">
              <p className="text-3xl font-bold leading-none text-[#333333]">
                {fmtNumber(count)}
              </p>
              <p className="text-xs text-[#666666]">
                items/orders awaiting delivery
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#DBEFF3] bg-[#DBEFF3]/20">
                    <th className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-[#666666]">
                      PO Number
                    </th>
                    <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-[#666666]">
                      Supplier
                    </th>
                    <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-[#666666] whitespace-nowrap">
                      Expected Delivery
                    </th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-bold uppercase tracking-widest text-[#666666] whitespace-nowrap">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DBEFF3]">
                  {items.map((item) => (
                    <tr
                      key={item.purchaseOrderId}
                      className="cursor-pointer transition-colors hover:bg-[#DBEFF3]/30 focus:outline-none focus-visible:bg-[#DBEFF3]/50"
                      onClick={() =>
                        navigate(`/purchasing/orders/${item.purchaseOrderId}`)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          navigate(`/purchasing/orders/${item.purchaseOrderId}`)
                        }
                      }}
                      tabIndex={0}
                      title={`Open purchase order: ${item.poNumber}`}
                    >
                      <td className="px-5 py-3 text-sm font-semibold text-[#2A7F8C] whitespace-nowrap">
                        {item.poNumber}
                      </td>
                      <td className="max-w-[10rem] truncate px-3 py-3 text-sm text-[#333333]">
                        {item.supplierName}
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {item.expectedDeliveryDate ? (
                          <span className="text-[#333333]">
                            {fmtDate(item.expectedDeliveryDate)}
                          </span>
                        ) : (
                          <span className="text-[#999999]">
                            Delivery date not set
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DBEFF3] px-2.5 py-0.5 text-[11px] font-semibold text-[#2A7F8C] whitespace-nowrap">
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-[#49B0C1]"
                            aria-hidden
                          />
                          Expected
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : null}
    </Panel>
  )
}
