type Status = "in_stock" | "low_stock" | "out_of_stock" | "available" | "depleted" | "expired";

const CONFIG: Record<Status, { label: string; dot: string; bg: string; text: string }> = {
  in_stock:     { label: "In Stock",     dot: "bg-green-500",  bg: "bg-green-50",  text: "text-green-700" },
  low_stock:    { label: "Low Stock",    dot: "bg-yellow-500", bg: "bg-yellow-50", text: "text-yellow-700" },
  out_of_stock: { label: "Out of Stock", dot: "bg-red-500",    bg: "bg-red-50",    text: "text-red-700" },
  available:    { label: "Available",    dot: "bg-green-500",  bg: "bg-green-50",  text: "text-green-700" },
  depleted:     { label: "Depleted",     dot: "bg-gray-400",   bg: "bg-gray-100",  text: "text-gray-600" },
  expired:      { label: "Expired",      dot: "bg-red-500",    bg: "bg-red-50",    text: "text-red-700" },
};

interface StatusBadgeProps {
  status: Status;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const c = CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} aria-hidden />
      {c.label}
    </span>
  );
}
