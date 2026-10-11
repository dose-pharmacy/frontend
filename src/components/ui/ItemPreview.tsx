export interface ItemPreviewValue {
  first: string
  additionalCount: number
}

/**
 * Compact medicine preview for a list row: the first product plus a muted
 * "+N more" when the record holds additional distinct products. Falls back to a
 * neutral label when the record has no resolvable products.
 */
export default function ItemPreview({
  preview,
  fallback = "—",
}: {
  preview?: ItemPreviewValue | null
  fallback?: string
}) {
  if (!preview || !preview.first) {
    return <span className="text-[#999999]">{fallback}</span>
  }
  return (
    <span className="text-[#333333]">
      {preview.first}
      {preview.additionalCount > 0 && (
        <span className="text-[#999999]"> +{preview.additionalCount} more</span>
      )}
    </span>
  )
}
