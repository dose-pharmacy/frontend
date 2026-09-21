import { API_BASE_URL } from "../auth/authApi"

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  /** Server-computed status counts over the FILTERED dataset (list responses). */
  summary?: GoodsReceiptListSummary
}

export interface GoodsReceiptListSummary {
  matched: number
  discrepancy: number
  resolved: number
}

export type GoodsReceiptStatus = "MATCHED" | "DISCREPANCY" | "RESOLVED"

export interface GRItemDto {
  id: string
  goodsReceiptId: string
  purchaseOrderItemId: string
  locationId: string
  expectedQty: number
  deliveredQty: number
  actualQty: number
  unitCost: number
  /** Unit the quantities are expressed in (snapshotted from the PO item). */
  unitId: string | null
  /** Embedded on create/confirm/detail responses (and PO receiving detail). */
  unit?: { id: string; name: string; symbol: string } | null
  batchNumber: string | null
  manufacturingDate: string | null
  expiryDate: string | null
  purchaseOrderItem?: {
    id: string
    productId: string
    unitCost: number
    quantityOrdered: number
    quantityReceived: number
    product?: {
      id: string
      name: string
      sku: string | null
    }
  }
  location?: {
    id: string
    name: string
  }
  /** Detail confirm/create responses attach the created or matched batch. */
  batch?: {
    id: string
    batchNumber: string
    expiryDate: string
  } | null
}

export interface GoodsReceiptDto {
  id: string
  receiptNumber: string
  purchaseOrderId: string
  supplierId: string
  receivedDate: string
  status: GoodsReceiptStatus
  discrepancyNote: string | null
  createdAt: string
  updatedAt: string
  createdById: string
  confirmedById: string | null
  /** Detail responses embed the items; the LIST response omits them (use `_count.items`). */
  items: GRItemDto[]
  /** Item count as reported by the backend `_count.items` on list rows. */
  _count?: { items: number }
  /** Confirmation flag — null / absent until the receipt is confirmed. */
  confirmedBy?: { id: string; name: string } | null
  /** Backward-compatible alias used by detail/reconcile pages. */
  confirmedAt?: string | null
  purchaseOrder?: {
    id: string
    poNumber: string
    supplierId: string
    supplier?: {
      id: string
      name: string
    }
  }
  createdBy?: {
    id: string
    name: string
  }
}

export class GoodsReceiptsApiError extends Error {
  constructor(public message: string, public code?: string) {
    super(message)
    this.name = "GoodsReceiptsApiError"
  }
}

async function grRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api/v1/purchasing/goods-receipts${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const b = await res.json()
      if (b?.message) msg = b.message
      if (b?.error?.message) msg = b.error.message
    } catch {}
    throw new GoodsReceiptsApiError(msg)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

async function poGrRequest<T>(poId: string, endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api/v1/purchasing/purchase-orders/${encodeURIComponent(poId)}/goods-receipts${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const b = await res.json()
      if (b?.message) msg = b.message
      if (b?.error?.message) msg = b.error.message
    } catch {}
    throw new GoodsReceiptsApiError(msg)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

export async function listGoodsReceipts(params: {
  page?: number
  limit?: number
  purchaseOrderId?: string
  status?: GoodsReceiptStatus
} = {}): Promise<PaginatedResponse<GoodsReceiptDto>> {
  const q = new URLSearchParams()
  if (params.page) q.set("page", params.page.toString())
  if (params.limit) q.set("limit", params.limit.toString())
  if (params.purchaseOrderId) q.set("purchaseOrderId", params.purchaseOrderId)
  if (params.status) q.set("status", params.status)

  const qs = q.toString()
  return await grRequest<PaginatedResponse<GoodsReceiptDto>>(qs ? `?${qs}` : "")
}

export async function getGoodsReceipt(id: string): Promise<GoodsReceiptDto> {
  const result = await grRequest<{ data: GoodsReceiptDto }>(`/${encodeURIComponent(id)}`)
  return result.data
}

export interface CreateGoodsReceiptInput {
  receivedDate?: string
  discrepancyNote?: string
  items: {
    purchaseOrderItemId: string
    locationId: string
    deliveredQty: number
    actualQty: number
    batchNumber?: string
    manufacturingDate?: string
    expiryDate?: string
  }[]
}

export async function createGoodsReceipt(poId: string, input: CreateGoodsReceiptInput): Promise<GoodsReceiptDto> {
  const result = await poGrRequest<{ data: GoodsReceiptDto }>(poId, "", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return result.data
}

export interface ResolveGoodsReceiptInput {
  discrepancyNote?: string
  items?: {
    id: string
    deliveredQty?: number
    actualQty?: number
    batchNumber?: string | null
    manufacturingDate?: string | null
    expiryDate?: string | null
  }[]
}

export async function resolveGoodsReceipt(id: string, input: ResolveGoodsReceiptInput): Promise<GoodsReceiptDto> {
  const result = await grRequest<{ data: GoodsReceiptDto }>(`/${encodeURIComponent(id)}/resolve`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return result.data
}

export async function confirmGoodsReceipt(id: string): Promise<GoodsReceiptDto> {
  const result = await grRequest<{ data: GoodsReceiptDto }>(`/${encodeURIComponent(id)}/confirm`, {
    method: "POST",
    body: JSON.stringify({}),
  })
  return result.data
}

export async function deleteGoodsReceipt(id: string): Promise<void> {
  await grRequest(`/${encodeURIComponent(id)}`, { method: "DELETE" })
}
