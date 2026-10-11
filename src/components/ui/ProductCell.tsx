/**
 * Shared medicine/product cell: the product name with an optional muted
 * sub-line carrying {@code genericName · brand}. Used across inventory and
 * purchasing lists so a brand is always visible where a product is shown, and
 * so the "—" fallback is consistent everywhere.
 */
export default function ProductCell({
  name,
  genericName,
  brand,
  className = "",
}: {
  name?: string | null
  genericName?: string | null
  brand?: string | null
  className?: string
}) {
  const sub = [genericName, brand].filter(
    (part): part is string => Boolean(part && part.trim()),
  )
  return (
    <div className={`leading-tight min-w-0 ${className}`}>
      <div className="font-medium text-[#333333] truncate">{name || "—"}</div>
      {sub.length > 0 && (
        <div className="text-xs text-[#999999] mt-0.5 truncate">
          {sub.join(" · ")}
        </div>
      )}
    </div>
  )
}
