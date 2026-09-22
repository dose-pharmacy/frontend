import { API_BASE_URL } from "../auth/authApi"
import { invalidateCachePrefix } from "../inventory/apiCache"

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type PurchaseReturnReason = "EXPIRED" | "DAMAGED" | "INCORRECT_DELIVERY"

export interface PurchaseReturnDto {
  id: string
  returnNumber: string
  supplierId: string
  productId: string
  batchId: string | null
  locationId: string
  /** ISO8601 datetime — the backend returns `returnedDate` (not returnDate). */
  returnedDate: string
  quantity: number
  unitCost: number
  /** number (2 decimals) — quantity × unitCost computed by the backend. */
  debitNoteAmount: number
  reason: PurchaseReturnReason
  notes: string | null
  createdAt: string
  recordedById: string
  supplier?: {
    id: string
    name: string
  }
  product?: {
    id: string
    name: string
    sku: string
  }
  batch?: {
    id: string
    batchNumber: string
    expiryDate: string
  } | null
  location?: {
    id: string
    name: string
  }
  recordedBy?: {
    id: string
    name: string
  }
}

export class PurchaseReturnsApiError extends Error {
  constructor(public message: string, public code?: string) {
    super(message)
    this.name = "PurchaseReturnsApiError"
  }
}

async function returnRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/purchasing/purchase-returns${endpoint}`, {
      ...options,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new PurchaseReturnsApiError(
      "Cannot reach the server. Please check your connection and try again.",
    )
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const b = await res.json()
      if (b?.message) msg = b.message
      if (b?.error?.message) msg = b.error.message
    } catch {}
    throw new PurchaseReturnsApiError(msg)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

function emptyMeta() {
  return { page: 1, limit: 20, total: 0, totalPages: 1 }
}

export interface PurchaseReturnsQuery {
  page?: number
  limit?: number
  supplierId?: string
  productId?: string
  reason?: PurchaseReturnReason
}

/**
 * GET /purchase-returns — paginated list. Unwraps the
 * `{ success, data, meta }` envelope defensively and degrades to an empty
 * page instead of throwing when the payload shape is unexpected.
 */
export async function listPurchaseReturns(
  params: PurchaseReturnsQuery = {},
): Promise<PaginatedResponse<PurchaseReturnDto>> {
  const q = new URLSearchParams()
  if (params.page) q.set("page", params.page.toString())
  if (params.limit) q.set("limit", params.limit.toString())
  if (params.supplierId) q.set("supplierId", params.supplierId)
  if (params.productId) q.set("productId", params.productId)
  if (params.reason) q.set("reason", params.reason)

  const qs = q.toString()
  try {
    const raw = await returnRequest<
      Partial<PaginatedResponse<PurchaseReturnDto>> & { data?: PurchaseReturnDto[] | null } | null
    >(qs ? `?${qs}` : "")
    return {
      data: Array.isArray(raw?.data) ? raw.data : [],
      meta: raw?.meta ?? emptyMeta(),
    }
  } catch (e) {
    if (e instanceof PurchaseReturnsApiError && e.message === "HTTP 401") throw e
    return { data: [], meta: emptyMeta() }
  }
}

export async function getPurchaseReturn(id: string): Promise<PurchaseReturnDto> {
  const result = await returnRequest<{ data: PurchaseReturnDto }>(`/${encodeURIComponent(id)}`)
  if (!result?.data) throw new PurchaseReturnsApiError("Purchase return not found.")
  return result.data
}

/**
 * Body for POST /purchase-returns — locationId is REQUIRED by the backend
 * (it was missing before, which caused 422).  batchId is optional; when
 * omitted the backend picks the first batch with stock at the location.
 * unitCost is REQUIRED (positive money); debitNoteAmount / notes are
 * optional (debitNoteAmount defaults to quantity × unitCost).
 * NOTE: quantity is expressed in the product's base units — the backend
 * records the total stock movement as given and has no per-return unitId.
 */
export interface CreatePurchaseReturnInput {
  supplierId: string
  productId: string
  batchId?: string | null
  locationId: string
  reason: PurchaseReturnReason
  quantity: number
  unitCost: number
  debitNoteAmount?: number
  notes?: string | null
}

export async function createPurchaseReturn(input: CreatePurchaseReturnInput): Promise<PurchaseReturnDto> {
  const body: Record<string, unknown> = {
    supplierId: input.supplierId,
    productId: input.productId,
    locationId: input.locationId,
    reason: input.reason,
    quantity: input.quantity,
  }
  if (input.batchId) body.batchId = input.batchId
  body.unitCost = input.unitCost
  if (input.debitNoteAmount != null) body.debitNoteAmount = input.debitNoteAmount
  if (input.notes) body.notes = input.notes

  const result = await returnRequest<{ data: PurchaseReturnDto }>("", {
    method: "POST",
    body: JSON.stringify(body),
  })
  // A return reduces stock — drop cached product-detail copies.
  invalidateCachePrefix("product:")
  if (!result?.data) throw new PurchaseReturnsApiError("Unexpected response from the server.")
  return result.data
}

/**
 * DELETE /purchase-returns/{id} — the backend refuses to delete returns
 * (409 PURCHASE_RETURN_IMMUTABLE) because the RETURN_TO_SUPPLIER stock
 * movement is already recorded and reversing it would corrupt the ledger.
 * The surfaced message explains that deletion does NOT restore stock.
 */
export async function deletePurchaseReturn(id: string): Promise<void> {
  await returnRequest<{ data: null }>(`/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}
