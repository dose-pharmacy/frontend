import { Boxes, Receipt, ShoppingCart, TrendingUp } from "lucide-react"
import { fmtMoney, fmtNumber } from "../../utils/format"
import { type DashboardSummary } from "../../features/dashboard/dashboardApi"
import { SectionLabel, SectionError } from "./Panel"
import { splitMoney } from "./dashboardView"

interface DashboardKpiSectionProps {
  summary: DashboardSummary | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

/** Smaller supporting KPI — deliberately not the same weight as Today's Sales. */
function SmallKpi({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[#DBEFF3] bg-white p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#666666]">
          {label}
        </p>
        <span
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[#DBEFF3] text-[#2A7F8C]"
          aria-hidden
        >
          {icon}
        </span>
      </div>
      <p className="text-xl font-bold leading-tight text-[#333333] break-words">
        {value}
      </p>
    </div>
  )
}

export default function DashboardKpiSection({
  summary,
  loading,
  error,
  onRetry,
}: DashboardKpiSectionProps) {
  if (loading && !summary) {
    return (
      <section
        aria-label="Business performance"
        className="flex flex-col gap-3"
      >
        <SectionLabel>Business Performance</SectionLabel>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="md:col-span-2 xl:row-span-2 rounded-xl border border-[#DBEFF3] bg-white p-6">
            <div className="h-3 w-24 animate-pulse rounded bg-[#DBEFF3]/60" />
            <div className="mt-4 h-10 w-48 animate-pulse rounded bg-[#DBEFF3]/40" />
            <div className="mt-6 h-14 w-full animate-pulse rounded bg-[#DBEFF3]/40" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[#DBEFF3] bg-white p-4"
            >
              <div className="h-3 w-20 animate-pulse rounded bg-[#DBEFF3]/60" />
              <div className="mt-3 h-7 w-24 animate-pulse rounded bg-[#DBEFF3]/40" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (error && !summary) {
    return (
      <section
        aria-label="Business performance"
        className="flex flex-col gap-3"
      >
        <SectionLabel>Business Performance</SectionLabel>
        <SectionError message={error} onRetry={onRetry} />
      </section>
    )
  }

  if (!summary) return null

  const sales = splitMoney(fmtMoney(summary.sales.today))

  return (
    <section aria-label="Business performance" className="flex flex-col gap-3">
      <SectionLabel>Business Performance</SectionLabel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Primary KPI — visually dominant */}
        <div className="relative overflow-hidden rounded-xl border border-[#DBEFF3] bg-white p-5 shadow-sm md:col-span-2 xl:row-span-2 md:p-6">
          <span
            className="absolute inset-y-0 left-0 w-1 bg-[#49B0C1]"
            aria-hidden
          />
          <div className="flex items-start justify-between gap-4 pl-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-[#2A7F8C]">
                Today's Sales
              </p>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="text-4xl font-bold tracking-tight text-[#333333] sm:text-5xl">
                  {sales.amount}
                </span>
                {sales.currency && (
                  <span className="text-sm font-semibold text-[#666666]">
                    {sales.currency}
                  </span>
                )}
              </p>
            </div>
            <span
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-[#DBEFF3] text-[#2A7F8C]"
              aria-hidden
            >
              <TrendingUp className="h-5 w-5" />
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#DBEFF3] pt-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#666666]">
                Transactions
              </p>
              <p className="mt-1 text-lg font-bold text-[#333333]">
                {fmtNumber(summary.sales.transactions)}
              </p>
            </div>
            <div className="border-l border-[#DBEFF3] pl-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#666666]">
                Average Transaction
              </p>
              <p className="mt-1 text-lg font-bold text-[#333333] break-words">
                {fmtMoney(summary.sales.averageTransaction)}
              </p>
            </div>
          </div>
        </div>

        {/* Supporting KPIs */}
        <SmallKpi
          label="Stock Value"
          value={fmtMoney(summary.inventory.stockValue)}
          icon={<Boxes className="h-4 w-4" />}
        />
        <SmallKpi
          label="Transactions"
          value={fmtNumber(summary.sales.transactions)}
          icon={<Receipt className="h-4 w-4" />}
        />
        <div className="md:col-span-2">
          <SmallKpi
            label="Average Transaction"
            value={fmtMoney(summary.sales.averageTransaction)}
            icon={<ShoppingCart className="h-4 w-4" />}
          />
        </div>
      </div>
    </section>
  )
}
