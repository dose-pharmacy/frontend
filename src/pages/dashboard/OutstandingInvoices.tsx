import { useNavigate } from "react-router"
import { fmtDate, fmtMoney } from "../../utils/format"
import { type DashboardAttention } from "../../features/dashboard/dashboardApi"
import { Panel, PanelSkeleton, PanelEmpty, PanelError } from "./Panel"
import { splitMoney } from "./dashboardView"

interface OutstandingInvoicesProps {
  attention: DashboardAttention | null
  count: number
  loading: boolean
  error: string | null
  onRetry: () => void
  className?: string
}

export default function OutstandingInvoices({
  attention,
  count,
  loading,
  error,
  onRetry,
  className,
}: OutstandingInvoicesProps) {
  const navigate = useNavigate()
  const items = attention?.outstandingInvoices ?? []

  // Sum of the balances already returned by the dashboard attention endpoint.
  const total = items.reduce(
    (sum, item) => sum + (item.outstandingBalance ?? 0),
    0,
  )
  const money = splitMoney(fmtMoney(total))

  return (
    <Panel
      title="Outstanding Invoices"
      count={count}
      viewAllTo="/purchasing/invoices"
      className={className}
    >
      {loading && !attention ? (
        <PanelSkeleton rows={3} />
      ) : error && !attention ? (
        <PanelError message={error} onRetry={onRetry} />
      ) : attention ? (
        <>
          {/* Dominant amount */}
          <div className="border-b border-[#DBEFF3] bg-[#DBEFF3]/30 px-5 py-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#666666]">
              Total outstanding
            </p>
            <p className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-4xl font-bold leading-none tracking-tight text-[#333333] break-words">
                {money.amount}
              </span>
              {money.currency && (
                <span className="text-sm font-semibold text-[#666666]">
                  {money.currency}
                </span>
              )}
            </p>
          </div>

          {items.length === 0 ? (
            <PanelEmpty text="No outstanding invoices" />
          ) : (
            <div className="divide-y divide-[#DBEFF3]">
              {items.map((item) => (
                <button
                  key={item.invoiceId}
                  className="w-full px-5 py-3.5 text-left transition-colors hover:bg-[#DBEFF3]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#49B0C1]"
                  onClick={() =>
                    navigate(`/purchasing/invoices/${item.invoiceId}`)
                  }
                  title={`Open invoice: ${item.invoiceNumber}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#2A7F8C]">
                        {item.invoiceNumber}
                      </p>
                      <p className="truncate text-xs text-[#666666]">
                        {item.supplierName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#666666]">
                        {item.dueDate
                          ? `Due ${fmtDate(item.dueDate)}`
                          : "Due date not set"}
                      </p>
                    </div>
                    <p className="flex-shrink-0 whitespace-nowrap text-sm font-bold text-[#333333]">
                      {fmtMoney(item.outstandingBalance)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : null}
    </Panel>
  )
}
