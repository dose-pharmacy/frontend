import { fmtNumber } from "../../utils/format"
import { type DashboardSummary } from "../../features/dashboard/dashboardApi"
import { SectionLabel, SectionError } from "./Panel"

interface OperationalHealthProps {
  summary: DashboardSummary | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

type Tone = "red" | "amber" | "blue" | "sage"

const TONES: Record<Tone, { bar: string; bg: string; text: string; dot: string }> =
  {
    red: {
      bar: "border-l-[#B0574A]",
      bg: "bg-white",
      text: "text-[#97473D]",
      dot: "bg-[#B0574A]",
    },
    amber: {
      bar: "border-l-[#B68932]",
      bg: "bg-white",
      text: "text-[#916D2C]",
      dot: "bg-[#B68932]",
    },
    blue: {
      bar: "border-l-[#537485]",
      bg: "bg-white",
      text: "text-[#455F6D]",
      dot: "bg-[#537485]",
    },
    sage: {
      bar: "border-l-[#B6C8AF]",
      bg: "bg-white",
      text: "text-[#7A9076]",
      dot: "bg-[#A0B59C]",
    },
  }

/**
 * Presentation captions only — no new status logic is derived from the data
 * beyond whether a count is zero.
 */
function indicators(summary: DashboardSummary) {
  const { inventory, purchasing, slowMoving } = summary
  return [
    {
      key: "out-of-stock",
      label: "Out of Stock",
      value: inventory.outOfStockCount,
      caption: "Needs action",
      zeroCaption: "All clear",
      tone: "red" as Tone,
    },
    {
      key: "expired",
      label: "Expired",
      value: inventory.expiredCount,
      caption: "Critical",
      zeroCaption: "All clear",
      tone: "red" as Tone,
    },
    {
      key: "requirements",
      label: "Requirements",
      value: purchasing.openRequirements,
      caption: "Open",
      zeroCaption: "None open",
      tone: "blue" as Tone,
    },
    {
      key: "awaiting",
      label: "Awaiting",
      value: purchasing.partiallyReceived,
      caption: "Partial/active",
      zeroCaption: "None pending",
      tone: "amber" as Tone,
    },
    {
      key: "slow-moving",
      label: "Slow Moving",
      value: slowMoving.flaggedCount,
      caption: "Flagged",
      zeroCaption: "No flags",
      tone: "sage" as Tone,
    },
  ]
}

function IndicatorSkeleton() {
  return (
    <div className="rounded-xl border border-[#DBEFF3] bg-white p-4 shadow-sm">
      <div className="h-3 w-20 animate-pulse rounded bg-[#DBEFF3]/60" />
      <div className="mt-3 h-7 w-12 animate-pulse rounded bg-[#DBEFF3]/40" />
      <div className="mt-3 h-3 w-16 animate-pulse rounded bg-[#DBEFF3]/40" />
    </div>
  )
}

export default function OperationalHealth({
  summary,
  loading,
  error,
  onRetry,
}: OperationalHealthProps) {
  return (
    <section aria-label="Operational health" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <SectionLabel>Operational Health</SectionLabel>
        <p className="text-xs text-[#666666]">
          Items needing attention across the pharmacy
        </p>
      </div>

      {loading && !summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <IndicatorSkeleton key={i} />
          ))}
        </div>
      ) : error && !summary ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {indicators(summary).map((item) => {
            const tone = TONES[item.tone]
            const isZero = item.value === 0
            return (
              <div
                key={item.key}
                className={`flex flex-col gap-2 rounded-xl border border-l-4 border-[#DBEFF3] p-4 shadow-sm ${tone.bg} ${tone.bar}`}
              >
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#666666]">
                  {item.label}
                </p>
                <p className="text-2xl font-bold leading-none text-[#333333]">
                  {fmtNumber(item.value)}
                </p>
                <p
                  className={`flex items-center gap-1.5 text-[11px] font-semibold ${
                    isZero ? "text-[#999999]" : tone.text
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                      isZero ? "bg-[#CCCCCC]" : tone.dot
                    }`}
                    aria-hidden
                  />
                  {isZero ? item.zeroCaption : item.caption}
                </p>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
