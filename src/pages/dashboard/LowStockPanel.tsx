import { useNavigate } from "react-router"
import StatusChip from "../../components/ui/StatusChip"
import { fmtNumber } from "../../utils/format"
import {
  type DashboardAttention,
  type LowStockAttentionItem,
} from "../../features/dashboard/dashboardApi"
import { Panel, PanelSkeleton, PanelEmpty, PanelError } from "./Panel"
import { stockRatio, stockStatus } from "./dashboardView"

interface LowStockPanelProps {
  attention: DashboardAttention | null
  count: number
  loading: boolean
  error: string | null
  onRetry: () => void
}

// Shared column layout for the header row and each data row.
const COLS =
  "md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] md:items-center md:gap-5"

const ROW =
  "w-full text-left px-5 py-3.5 hover:bg-[#DBEFF3]/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#49B0C1]"

function LowStockRow({
  item,
  onOpen,
}: {
  item: LowStockAttentionItem
  onOpen: () => void
}) {
  const ratio = stockRatio(item.availableStock, item.reorderPoint)
  const status = stockStatus(ratio)
  const pct = Math.round(ratio * 100)

  return (
    <button
      className={ROW}
      onClick={onOpen}
      title={`Open product: ${item.productName}`}
    >
      <div className={`flex flex-col gap-2.5 ${COLS}`}>
        <div className="flex items-center justify-between gap-3 md:block">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#333333]">
              {item.productName}
            </p>
            <p className="truncate text-xs text-[#666666]">{item.sku}</p>
          </div>
          <div className="flex-shrink-0 md:hidden">
            <StatusChip label={status.label} tone={status.tone} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-[#DBEFF3]"
            role="progressbar"
            aria-valuenow={item.availableStock}
            aria-valuemin={0}
            aria-valuemax={item.reorderPoint}
            aria-label={`Stock level for ${item.productName}`}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: status.color }}
            />
          </div>
          <p className="whitespace-nowrap text-xs text-[#666666]">
            <span className="font-bold text-[#333333]">
              {fmtNumber(item.availableStock)}
            </span>{" "}
            / {fmtNumber(item.reorderPoint)}
            <span className="hidden xl:inline"> of reorder point</span>
          </p>
        </div>

        <div className="hidden md:flex md:justify-end">
          <StatusChip label={status.label} tone={status.tone} />
        </div>
      </div>
    </button>
  )
}

export default function LowStockPanel({
  attention,
  count,
  loading,
  error,
  onRetry,
}: LowStockPanelProps) {
  const navigate = useNavigate()
  const items = attention?.lowStock ?? []

  return (
    <Panel title="Low Stock" count={count} viewAllTo="/inventory/stock">
      {loading && !attention ? (
        <PanelSkeleton rows={4} />
      ) : error && !attention ? (
        <PanelError message={error} onRetry={onRetry} />
      ) : attention ? (
        items.length === 0 ? (
          <PanelEmpty text="No low-stock products" />
        ) : (
          <>
            <div
              className={`hidden border-b border-[#DBEFF3] bg-[#DBEFF3]/30 px-5 py-2.5 ${COLS}`}
            >
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#666666]">
                Product
              </p>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#666666]">
                Stock Level
              </p>
              <p className="text-right text-[11px] font-bold uppercase tracking-widest text-[#666666]">
                Status
              </p>
            </div>
            <div className="divide-y divide-[#DBEFF3]">
              {items.map((item) => (
                <LowStockRow
                  key={item.productId}
                  item={item}
                  onOpen={() =>
                    navigate(`/inventory/products/${item.productId}`)
                  }
                />
              ))}
            </div>
          </>
        )
      ) : null}
    </Panel>
  )
}
