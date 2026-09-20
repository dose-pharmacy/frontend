import { API_BASE_URL } from "../auth/authApi"

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
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
  createdById: string
  confirmedAt: string | null
  confirmedById: string | null
  items: GRItemDto[]
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
  confirmedBy?: {
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
  search?: string
} = {}): Promise<PaginatedResponse<GoodsReceiptDto>> {
  const q = new URLSearchParams()
  if (params.page) q.set("page", params.page.toString())
  if (params.limit) q.set("limit", params.limit.toString())
  if (params.purchaseOrderId) q.set("purchaseOrderId", params.purchaseOrderId)
  if (params.status) q.set("status", params.status)
  if (params.search) q.set("search", params.search)

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
