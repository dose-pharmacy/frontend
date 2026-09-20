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
  createdBy?: {
    id: string
    name: string
  }
}

export interface SupplierInvoiceDto {
  id: string
  invoiceNumber: string
  supplierId: string
  purchaseOrderId: string | null
  invoiceDate: string | null
  dueDate: string | null
  invoiceAmount: number
  paidAmount: number
  balanceDue: number
  status: SupplierInvoiceStatus
  paymentTerms: string | null
  createdAt: string
  createdById: string
  supplier?: {
    id: string
    name: string
  }
  createdBy?: {
    id: string
    name: string
  }
  payments?: InvoicePaymentDto[]
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
    try {
      const b = await res.json()
      if (b?.message) msg = b.message
      if (b?.error?.message) msg = b.error.message
    } catch {}
    throw new SupplierInvoicesApiError(msg)
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

export interface CreateSupplierInvoiceInput {
  supplierId: string
  purchaseOrderId?: string
  invoiceNumber: string
  invoiceDate?: string
  dueDate?: string
  invoiceAmount: number
  paymentTerms?: string
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
