export type StatusTone = "green" | "amber" | "orange" | "red" | "blue" | "purple" | "yellow" | "gray" | "sage"

const TONE_CLASSES: Record<StatusTone, { chip: string, dot: string }> = {
  green: { chip: "bg-green-50 text-green-700", dot: "bg-green-600" },
  amber: { chip: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  orange: { chip: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },
  red: { chip: "bg-red-50 text-red-700", dot: "bg-red-500" },
  blue: { chip: "bg-blue-50 text-blue-700", dot: "bg-blue-600" },
  purple: { chip: "bg-purple-50 text-purple-700", dot: "bg-purple-500" },
  yellow: { chip: "bg-yellow-50 text-yellow-700", dot: "bg-yellow-500" },
  gray: { chip: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
  sage: { chip: "bg-[#E6ECE2] text-[#7A9076]", dot: "bg-[#A0B59C]" },
}

interface StatusChipProps {
  label: string
  tone: StatusTone
  dot?: boolean
}

export default function StatusChip({
  label,
  tone,
  dot = true,
}: StatusChipProps) {
  const c = TONE_CLASSES[tone]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.chip}`}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} aria-hidden />
      )}
      {label}
    </span>
  )
}
