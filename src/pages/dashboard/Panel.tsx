import { Link } from "react-router"
import Button from "../../components/ui/Button"

// ── Shared presentational building blocks for the dashboard ─────────────────
// These are UI-only: no data fetching, no calculations, no routing logic.

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-[#2A7F8C]">
      {children}
    </p>
  )
}

interface PanelProps {
  title: string
  count?: number
  viewAllTo?: string
  viewAllLabel?: string
  children: React.ReactNode
  className?: string
}

export function Panel({
  title,
  count,
  viewAllTo,
  viewAllLabel = "View All",
  children,
  className = "",
}: PanelProps) {
  return (
    <section
      className={`flex flex-col overflow-hidden rounded-xl border border-[#DBEFF3] bg-white shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#DBEFF3] px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-bold text-[#333333]">{title}</h3>
          {typeof count === "number" && count > 0 && (
            <span className="rounded-full bg-[#DBEFF3] px-2 py-0.5 text-[11px] font-bold text-[#2A7F8C]">
              {count}
            </span>
          )}
        </div>
        {viewAllTo && (
          <Link
            to={viewAllTo}
            className="whitespace-nowrap text-xs font-semibold text-[#2A7F8C] hover:underline"
          >
            {viewAllLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-lg bg-[#DBEFF3]/60"
        />
      ))}
    </div>
  )
}

export function PanelEmpty({ text }: { text: string }) {
  return <p className="px-5 py-9 text-center text-sm text-[#666666]">{text}</p>
}

/** Error shown inside a panel — keeps the panel chrome, no nested card. */
export function PanelError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-6">
      <p className="max-w-md rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm text-red-600">
        {message}
      </p>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  )
}

/** Error shown in place of a whole section (stands alone as a card). */
export function SectionError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="rounded-xl border border-[#DBEFF3] bg-white p-6 shadow-sm">
      <div className="flex flex-col items-center justify-center gap-4 py-6">
        <p className="max-w-md rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm text-red-600">
          {message}
        </p>
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </div>
  )
}
