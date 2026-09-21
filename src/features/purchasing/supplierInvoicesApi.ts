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

export type SupplierInvoiceStatus = "OPEN" | "PARTIALLY_PAID" | "PAID"
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CHECK" | "CREDIT_CARD" | "OTHER"

export interface InvoicePaymentDto {
  id: string
  invoiceId: string
  paymentDate: string
  amount: number
  notes: string | null
  createdAt: string
  createdById: string
  recordedById?: string
  recordedBy?: {
    id: string
    name: string
  }
  createdBy?: {
    id: string
    name: string
  }
}

/** One invoice line — a PO item allocation (PO-linked invoices only). */
export interface SupplierInvoiceItemDto {
  id: string
  supplierInvoiceId: string
  purchaseOrderItemId: string
  /** Quantity invoiced, in the PO item's ordered unit. */
  quantity: number
  unitId: string | null
  unitCost: number
  goodsAmount: number
  purchaseOrderItem?: {
    id: string
    productId: string
    quantityOrdered: number
    quantityReceived: number
    product?: { id: string; name: string; sku: string }
    unit?: { id: string; name: string; symbol: string }
  } | null
  unit?: { id: string; name: string; symbol: string } | null
}

export interface SupplierInvoiceDto {
  id: string
  invoiceNumber: string
  supplierId: string
  purchaseOrderId: string | null
  invoiceDate: string | null
  dueDate: string | null
  /** Value of received goods being billed. */
  goodsAmount: number
  taxAmount: number
  additionalChargesAmount: number
  discountAmount: number
  /** totalAmount = goods + tax + charges − discount (never negative). */
  totalAmount: number
  /** Backend legacy alias mirroring `totalAmount`. */
  invoiceAmount: number
  /** Backend reports the remaining balance. Paid amount = totalAmount − outstandingBalance. */
  outstandingBalance: number
  status: SupplierInvoiceStatus
  paymentTerms: string | null
  createdAt: string
  updatedAt?: string
  createdById: string
  supplier?: {
    id: string
    name: string
  }
  purchaseOrder?: {
    id: string
    poNumber: string
  } | null
  createdBy?: {
    id: string
    name: string
  }
  payments?: InvoicePaymentDto[]
  /** Detail responses embed the goods allocation lines. */
  items?: SupplierInvoiceItemDto[]
}

export function invoiceOutstanding(inv: Pick<SupplierInvoiceDto, "totalAmount" | "invoiceAmount" | "outstandingBalance">): number {
  return typeof inv.outstandingBalance === "number" ? inv.outstandingBalance : inv.totalAmount ?? inv.invoiceAmount
}

export function invoicePaid(inv: Pick<SupplierInvoiceDto, "totalAmount" | "invoiceAmount" | "outstandingBalance">): number {
  const total = inv.totalAmount ?? inv.invoiceAmount
  return Math.max(0, total - invoiceOutstanding(inv))
}

export class SupplierInvoicesApiError extends Error {
  constructor(public message: string, public code?: string) {
    super(message)
    this.name = "SupplierInvoicesApiError"
  }
}

async function invoiceRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api/v1/purchasing/supplier-invoices${endpoint}`, {
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
    let code: string | undefined
    try {
      const b = await res.json()
      if (b?.message) msg = b.message
      if (b?.error?.message) msg = b.error.message
      if (b?.error?.code) code = b.error.code
      if (!code && b?.code) code = b.code
    } catch {}
    if (code === "DUPLICATE_INVOICE_NUMBER")
      msg = "An invoice with this number already exists for this supplier."
    if (code === "SUPPLIER_INVOICE_NOT_FOUND")
      msg = "This supplier invoice no longer exists."
    if (code === "SUPPLIER_INVOICE_EXCEEDS_RECEIVED")
      msg = "The invoiced quantity exceeds the received-but-not-yet-invoiced quantity for one or more items."
    if (code === "SUPPLIER_INVOICE_PAYMENT_EXCEEDS_BALANCE")
      msg = "The payment amount cannot exceed the outstanding balance."
    if (code === "SUPPLIER_NOT_FOUND") msg = "The selected supplier was not found."
    if (code === "PURCHASE_ORDER_NOT_FOUND") msg = "The linked purchase order was not found."
    if (code === "BAD_REQUEST" && res.status === 422)
      msg = "The purchase order belongs to a different supplier."
    if (res.status === 409 && code === "BAD_REQUEST")
      msg = "This invoice cannot be modified in its current state."
    throw new SupplierInvoicesApiError(msg, code)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

export async function listSupplierInvoices(params: {
  page?: number
  limit?: number
  supplierId?: string
  status?: SupplierInvoiceStatus
  search?: string
} = {}): Promise<PaginatedResponse<SupplierInvoiceDto>> {
  const q = new URLSearchParams()
  if (params.page) q.set("page", params.page.toString())
  if (params.limit) q.set("limit", params.limit.toString())
  if (params.supplierId) q.set("supplierId", params.supplierId)
  if (params.status) q.set("status", params.status)
  if (params.search) q.set("search", params.search)

  const qs = q.toString()
  return await invoiceRequest<PaginatedResponse<SupplierInvoiceDto>>(qs ? `?${qs}` : "")
}

export async function getSupplierInvoice(id: string): Promise<SupplierInvoiceDto> {
  const result = await invoiceRequest<{ data: SupplierInvoiceDto }>(`/${encodeURIComponent(id)}`)
  return result.data
}

/**
 * Body for POST /supplier-invoices.
 * PO-linked invoices (purchaseOrderId present) MUST allocate their goods via
 * `items`; the backend derives goodsAmount from those allocations and prevents
 * double-invoicing of received goods. Non-PO invoices supply `goodsAmount`
 * directly and must not include `items`. The backend computes:
 *   totalAmount = goodsAmount + taxAmount + additionalChargesAmount − discountAmount
 */
export interface CreateSupplierInvoiceInput {
  supplierId: string
  purchaseOrderId?: string
  invoiceNumber: string
  invoiceDate?: string
  dueDate?: string
  goodsAmount?: number
  taxAmount?: number
  additionalChargesAmount?: number
  discountAmount?: number
  paymentTerms?: string
  items?: {
    purchaseOrderItemId: string
    /** Quantity invoiced, in the PO item's ordered unit. */
    quantity: number
    /** Optional per-item unit-cost override; defaults to the PO item's unitCost. */
    unitCost?: number
  }[]
}

export async function createSupplierInvoice(input: CreateSupplierInvoiceInput): Promise<SupplierInvoiceDto> {
  const result = await invoiceRequest<{ data: SupplierInvoiceDto }>("", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return result.data
}

export interface RecordPaymentInput {
  paymentDate?: string
  amount: number
  notes?: string
}

export interface UpdateSupplierInvoiceInput {
  dueDate?: string | null
  paymentTerms?: string | null
}

export async function updateSupplierInvoice(
  id: string,
  patch: UpdateSupplierInvoiceInput,
): Promise<SupplierInvoiceDto> {
  const result = await invoiceRequest<{ data: SupplierInvoiceDto }>(`/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
  return result.data
}

export async function recordInvoicePayment(id: string, input: RecordPaymentInput): Promise<InvoicePaymentDto> {
  const result = await invoiceRequest<{ data: InvoicePaymentDto }>(`/${encodeURIComponent(id)}/payments`, {
    method: "POST",
    body: JSON.stringify(input),
  })
  return result.data
}

export async function deleteSupplierInvoice(id: string): Promise<void> {
  await invoiceRequest(`/${encodeURIComponent(id)}`, { method: "DELETE" })
}
