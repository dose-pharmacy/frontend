import { useState } from "react"
import Modal from "./Modal"

export interface ItemPreviewProduct {
  name: string
  brand?: string | null
}

export interface ItemPreviewValue {
  first: string
  additionalCount: number
  /** Full ordered, de-duplicated product list for the popup. */
  products?: ItemPreviewProduct[]
}

/**
 * Compact medicine preview for a list row: the first product plus a `+N more`
 * button when the record holds additional distinct products. Clicking the
 * button opens a popup listing every product (with its brand). Falls back to a
 * neutral label when the record has no resolvable products.
 */
export default function ItemPreview({
  preview,
  fallback = "—",
  title = "Products",
}: {
  preview?: ItemPreviewValue | null
  fallback?: string
  title?: string
}) {
  const [open, setOpen] = useState(false)

  if (!preview || !preview.first) {
    return <span className="text-[#999999]">{fallback}</span>
  }

  const products = preview.products ?? []
  const hasMore = preview.additionalCount > 0

  return (
    <span className="text-[#333333]">
      {preview.first}
      {hasMore && (
        <>
          {" "}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(true)
            }}
            className="font-semibold text-[#7A9076] hover:underline"
            aria-label={`Show all ${products.length || preview.additionalCount + 1} products`}
          >
            +{preview.additionalCount} more
          </button>
        </>
      )}
      <Modal open={open} title={title} onClose={() => setOpen(false)} size="sm">
        {products.length === 0 ? (
          <p className="text-sm text-[#666666]">No product details available.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[#E6ECE2]">
            {products.map((p, i) => (
              <li
                key={`${p.name}-${i}`}
                className="flex items-start justify-between gap-3 py-2.5"
              >
                <span className="text-sm text-[#333333]">{p.name}</span>
                {p.brand && (
                  <span className="text-xs text-[#7A9076] text-right shrink-0">
                    {p.brand}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </span>
  )
}
