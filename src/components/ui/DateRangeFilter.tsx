import DatePicker from "./DatePicker"

export type DatePresetValue = "" | "today" | "this_week" | "this_month"

export interface DateRangeValue {
  preset: DatePresetValue
  /** Inclusive `YYYY-MM-DD` lower bound (ignored while a preset is set). */
  from: string
  /** Inclusive `YYYY-MM-DD` upper bound (ignored while a preset is set). */
  to: string
}

export const EMPTY_DATE_RANGE: DateRangeValue = { preset: "", from: "", to: "" }

export function isDateRangeActive(value: DateRangeValue): boolean {
  return Boolean(value.preset || value.from || value.to)
}

/** Human label for the active date filter, for use in a filter chip. */
export function dateRangeLabel(value: DateRangeValue): string {
  if (value.preset === "today") return "Today"
  if (value.preset === "this_week") return "This Week"
  if (value.preset === "this_month") return "This Month"
  if (value.from && value.to) return `${value.from} → ${value.to}`
  if (value.from) return `From ${value.from}`
  if (value.to) return `Until ${value.to}`
  return ""
}

/**
 * Maps the range onto the backend's list date contract. A preset is mutually
 * exclusive with custom bounds (the backend rejects both), so the preset wins
 * and the bounds are omitted.
 */
export function dateRangeQuery(value: DateRangeValue): {
  datePreset?: "today" | "this_week" | "this_month"
  dateFrom?: string
  dateTo?: string
} {
  if (value.preset) return { datePreset: value.preset }
  const query: { dateFrom?: string; dateTo?: string } = {}
  if (value.from) query.dateFrom = value.from
  if (value.to) query.dateTo = value.to
  return query
}

const SELECT_CLS =
  "w-full rounded-xl border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"

/**
 * Date-range secondary filter: a preset dropdown plus a From/To custom range.
 * Rendered as a React fragment so its three controls drop straight into the
 * {@link ListPageFilter} children grid as individual cells.
 */
export default function DateRangeFilter({
  value,
  onChange,
  label = "Date",
}: {
  value: DateRangeValue
  onChange: (next: DateRangeValue) => void
  label?: string
}) {
  const presetActive = value.preset !== ""
  return (
    <>
      <div>
        <label className="block text-xs font-semibold text-[#666666] mb-1.5 truncate">
          {label} Range
        </label>
        <select
          value={value.preset}
          onChange={(e) =>
            onChange({
              preset: e.target.value as DatePresetValue,
              from: "",
              to: "",
            })
          }
          className={SELECT_CLS}
        >
          <option value="">Any Time</option>
          <option value="today">Today</option>
          <option value="this_week">This Week</option>
          <option value="this_month">This Month</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-[#666666] mb-1.5 truncate">
          From
        </label>
        <DatePicker
          value={value.from}
          onChange={(v) => onChange({ preset: "", from: v, to: value.to })}
          disabled={presetActive}
          placeholder="From date"
          ariaLabel={`${label} from`}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-[#666666] mb-1.5 truncate">
          To
        </label>
        <DatePicker
          value={value.to}
          onChange={(v) => onChange({ preset: "", from: value.from, to: v })}
          disabled={presetActive}
          placeholder="To date"
          ariaLabel={`${label} to`}
        />
      </div>
    </>
  )
}
