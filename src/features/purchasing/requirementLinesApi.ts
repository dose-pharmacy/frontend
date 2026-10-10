// ── Purchase Requirement Lines API client ────────────────────────────────────
// Product-oriented view of purchase requirements. Each row is ONE requirement
// line (one product inside one requirement), so purchasers can search, filter
// and select individual products to order.
//
//   GET /api/v1/purchase/requirement-lines          (list, paginated + filtered)
//   GET /api/v1/purchase/requirement-lines/{lineId} (one line + PO allocations)
//
// The backend documents the canonical route above and exposes a `GET
// /requirement-lines` alias. All requests use the existing authenticated
// session cookie (`credentials: "include"`), matching the rest of the
// purchasing API clients.
//
// The response fields are tolerant of the backend's documented aliases (for
// example a purchase order may be reported as either `purchaseOrderNumber` or
// `poNumber`, and a quantity as either `remainingToOrder` or
// `remainingQuantity`). Everything is normalised by the adapters below so the
// UI only ever reads one stable shape.

import { API_BASE_URL } from "../auth/authApi"
import { RequirementsApiError } from "./requirementsApi"
import type { RequirementLineStatus } from "./requirementsApi"

// ─── API DTOs (mirror the documented response shape) ─────────────────────────

export interface RequirementLineSupplierRefDto {
  id?: string
  name?: string
}

/** One purchase-order allocation against a requirement line (detail response). */
export interface RequirementLinePurchaseOrderDto {
  id?: string
  purchaseOrderId?: string
  /** Documented primary field. */
  purchaseOrderNumber?: string
  /** Documented alias of `purchaseOrderNumber`. */
  poNumber?: string
  supplierId?: string
  supplier?: RequirementLineSupplierRefDto | null
  supplierName?: string
  purchaseOrderStatus?: string
  /** Some responses nest the order status under `status`. */
  status?: string
  quantityAllocated?: number
  allocatedQuantity?: number
  quantityOrdered?: number
  orderedQuantity?: number
  quantityReceived?: number
  receivedQuantity?: number
  outstandingQuantity?: number
  /** Quantity already ordered but not yet received. */
  remainingToReceive?: number
  quantityDelivered?: number
  unitCost?: number
  orderDate?: string
  createdAt?: string
  expectedDeliveryDate?: string
  [key: string]: unknown
}

/**
 * Row of the `data` array. Only `id` is guaranteed; every other field is read
 * through the adapter so a missing alias never crashes the table.
 */
export interface RequirementLineDto {
  id: string
  requirementId?: string
  requirementReference?: string
  requirementStatus?: string
  /** Canonical derived line status. */
  lineStatus?: RequirementLineStatus
  /** Alias used by some backend versions. */
  status?: RequirementLineStatus
  productId?: string
  productName?: string
  productSku?: string
  productBrand?: string
  product?: {
    id?: string
    name?: string
    sku?: string
    brand?: string
  } | null
  unitId?: string | null
  unitName?: string
  unitSymbol?: string
  unit?: { id?: string; name?: string; symbol?: string } | null
  requiredQuantity?: number
  quantityNeeded?: number
  orderedQuantity?: number
  quantityOrdered?: number
  quantityDelivered?: number
  remainingToOrder?: number
  remainingQuantity?: number
  remainingToReceive?: number
  reasonCode?: string | null
  notes?: string | null
  requiredBy?: string | null
  createdBy?: { id?: string; name?: string } | string | null
  createdAt?: string
  updatedAt?: string
  activeOrderCount?: number
  purchaseOrders?: RequirementLinePurchaseOrderDto[] | null
  [key: string]: unknown
}

export interface RequirementLineListMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

/** Server-computed status counts over the filtered dataset (when supplied). */
export interface RequirementLineSummaryDto {
  open?: number
  partiallyFulfilled?: number
  fulfilled?: number
  closed?: number
  total?: number
}

export interface RequirementLineListResult {
  data: RequirementLineDto[]
  meta: RequirementLineListMeta
  summary?: RequirementLineSummaryDto
}

export interface RequirementLinesQuery {
  page?: number
  limit?: number
  /** Product name, SKU or requirement reference — resolved by the backend. */
  search?: string
  /** Single backend enum value (OPEN | PARTIALLY_FULFILLED | FULFILLED | CLOSED). */
  status?: string
  /** Multiple values; serialised as a comma-separated list. */
  statuses?: string | string[]
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

// ─── Normalised UI shapes ────────────────────────────────────────────────────

/** A single requirement-line row, normalised for the UI. */
export interface RequirementLineRow {
  id: string
  requirementId: string
  requirementReference: string
  requirementStatus: string
  lineStatus: string
  productId: string
  productName: string
  productSku: string
  productBrand: string
  unitId: string | null
  unitName: string
  unitSymbol: string
  requiredQuantity: number
  orderedQuantity: number
  quantityDelivered: number
  remainingToOrder: number
  remainingToReceive: number
  reasonCode: string | null
  notes: string
  requiredBy: string | null
  createdByName: string
  createdAt: string
  updatedAt: string
  activeOrderCount: number
  purchaseOrders: RequirementLinePurchaseOrder[]
}

/** One purchase-order allocation linked to a requirement line. */
export interface RequirementLinePurchaseOrder {
  id: string
  purchaseOrderId: string
  purchaseOrderNumber: string
  supplierId: string
  supplierName: string
  status: string
  quantityAllocated: number
  quantityOrdered: number
  quantityReceived: number
  outstandingQuantity: number
  unitCost: number
  orderDate: string
  expectedDeliveryDate: string
}

// ─── Adapters ────────────────────────────────────────────────────────────────

function num(...values: unknown[]): number {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (
      typeof v === "string" &&
      v.trim() !== "" &&
      Number.isFinite(Number(v))
    ) {
      return Number(v)
    }
  }
  return 0
}

function str(...values: unknown[]): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim() !== "") return v
  }
  return ""
}

function firstDefined<T>(...values: T[]): T | undefined {
  for (const v of values) if (v !== undefined && v !== null) return v
  return undefined
}

function toPurchaseOrder(
  dto: RequirementLinePurchaseOrderDto,
): RequirementLinePurchaseOrder {
  const supplierName = str(dto.supplierName, dto.supplier?.name)
  const ordered = num(dto.quantityOrdered, dto.orderedQuantity)
  const received = num(dto.quantityReceived, dto.receivedQuantity)
  const allocated = num(dto.quantityAllocated, dto.allocatedQuantity)
  // Outstanding delivery: backend value when present, else ordered - received.
  const outstandingExplicit = firstDefined(
    dto.outstandingQuantity,
    dto.remainingToReceive,
  )
  const outstanding =
    typeof outstandingExplicit === "number"
      ? num(outstandingExplicit)
      : Math.max(0, ordered - received)
  return {
    id: str(dto.id, dto.purchaseOrderId),
    purchaseOrderId: str(dto.purchaseOrderId),
    purchaseOrderNumber: str(dto.purchaseOrderNumber, dto.poNumber),
    supplierId: str(dto.supplierId, dto.supplier?.id),
    supplierName: supplierName || "—",
    status: str(dto.purchaseOrderStatus, dto.status).toUpperCase(),
    quantityAllocated: allocated,
    quantityOrdered: ordered,
    quantityReceived: received,
    outstandingQuantity: outstanding,
    unitCost: num(dto.unitCost),
    orderDate: str(dto.orderDate, dto.createdAt),
    expectedDeliveryDate: str(dto.expectedDeliveryDate),
  }
}

export function toRequirementLineRow(
  dto: RequirementLineDto,
): RequirementLineRow {
  const createdBy =
    typeof dto.createdBy === "string" ? dto.createdBy : str(dto.createdBy?.name)
  const status = str(dto.lineStatus, dto.status).toUpperCase()
  const unitName = str(
    dto.unitName,
    dto.unit?.name,
    dto.unitSymbol,
    dto.unit?.symbol,
  )
  const ordered = num(dto.orderedQuantity, dto.quantityOrdered)
  const delivered = num(dto.quantityDelivered)
  // Remaining to order: backend value when present, else required - ordered.
  const remainingToOrderExplicit = firstDefined(
    dto.remainingToOrder,
    dto.remainingQuantity,
  )
  const required = num(dto.requiredQuantity, dto.quantityNeeded)
  const remainingToOrder =
    typeof remainingToOrderExplicit === "number"
      ? num(remainingToOrderExplicit)
      : Math.max(0, required - ordered)
  // Remaining to receive: backend value when present, else ordered - delivered.
  const remainingToReceiveExplicit = firstDefined(dto.remainingToReceive)
  const remainingToReceive =
    typeof remainingToReceiveExplicit === "number"
      ? num(remainingToReceiveExplicit)
      : Math.max(0, ordered - delivered)

  return {
    id: dto.id,
    requirementId: str(dto.requirementId),
    requirementReference: str(dto.requirementReference),
    requirementStatus: str(dto.requirementStatus).toUpperCase(),
    lineStatus: status,
    productId: str(dto.productId, dto.product?.id),
    productName: str(dto.productName, dto.product?.name) || "Unknown product",
    productSku: str(dto.productSku, dto.product?.sku),
    productBrand: str(dto.productBrand, dto.product?.brand),
    unitId: dto.unitId ?? dto.unit?.id ?? null,
    unitName,
    unitSymbol: str(dto.unitSymbol, dto.unit?.symbol),
    requiredQuantity: required,
    orderedQuantity: ordered,
    quantityDelivered: delivered,
    remainingToOrder,
    remainingToReceive,
    reasonCode: (dto.reasonCode ?? null) as string | null,
    notes: str(dto.notes),
    requiredBy: dto.requiredBy ?? null,
    createdByName: createdBy || "—",
    createdAt: str(dto.createdAt),
    updatedAt: str(dto.updatedAt),
    activeOrderCount: num(dto.activeOrderCount, dto.purchaseOrders?.length),
    purchaseOrders: (dto.purchaseOrders ?? []).map(toPurchaseOrder),
  }
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const REQUIREMENT_LINES_BASE = `${API_BASE_URL}/api/v1/purchase/requirement-lines`

/** An already-aborted request should surface as a silent cancellation, not an
 *  error toast — the caller distinguishes it by this code. */
export const REQUEST_CANCELLED = "REQUEST_CANCELLED"

async function requirementLinesRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${REQUIREMENT_LINES_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new RequirementsApiError("Request cancelled.", {
        status: 0,
        code: REQUEST_CANCELLED,
      })
    }
    throw new RequirementsApiError(
      "Cannot reach the server. Please check your connection and try again.",
    )
  }

  if (!res.ok) {
    let message: string
    switch (res.status) {
      case 401:
        message = "Your session has expired. Please sign in again."
        break
      case 403:
        message = "You don't have permission to view purchase requirements."
        break
      case 404:
        message = "This requirement line no longer exists."
        break
      default:
        message = `Request failed (HTTP ${res.status}).`
    }
    let code: string | undefined
    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string }
        message?: string
      } | null
      code = body?.error?.code
      if (body?.error?.message) message = body.error.message
      else if (body?.message) message = body.message
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new RequirementsApiError(message, { status: res.status, code })
  }

  const text = await res.text()
  if (!text) return null as T
  try {
    return JSON.parse(text) as T
  } catch {
    return null as T
  }
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

/**
 * GET /purchase/requirement-lines — paginated, product-oriented requirement
 * lines. When neither `status` nor `statuses` is sent the backend returns the
 * default view: OPEN + PARTIALLY_FULFILLED lines only.
 */
export async function listRequirementLines(
  query: RequirementLinesQuery = {},
  options: { signal?: AbortSignal } = {},
): Promise<RequirementLineListResult> {
  const params = new URLSearchParams()
  const set = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === "") return
    params.set(key, String(value))
  }
  set("page", query.page)
  set("limit", query.limit)
  set("search", query.search)
  set("status", query.status)
  if (Array.isArray(query.statuses)) {
    if (query.statuses.length > 0)
      params.set("statuses", query.statuses.join(","))
  } else {
    set("statuses", query.statuses)
  }
  set("sortBy", query.sortBy)
  set("sortOrder", query.sortOrder)

  const qs = params.toString()
  const result = await requirementLinesRequest<{
    success?: boolean
    data: RequirementLineDto[] | null
    meta?: RequirementLineListMeta
    summary?: RequirementLineSummaryDto
  }>(qs ? `?${qs}` : "", { signal: options.signal })

  const limit = query.limit ?? 20
  return {
    data: result?.data ?? [],
    meta:
      result?.meta && Number.isFinite(result.meta.total)
        ? result.meta
        : { page: query.page ?? 1, limit, total: 0, totalPages: 1 },
    summary: result?.summary,
  }
}

/** GET /purchase/requirement-lines/{lineId} — one line with its PO history. */
export async function getRequirementLine(
  lineId: string,
  options: { signal?: AbortSignal } = {},
): Promise<RequirementLineRow> {
  const result = await requirementLinesRequest<{
    success?: boolean
    data: RequirementLineDto | null
  }>(`/${encodeURIComponent(lineId)}`, { signal: options.signal })
  if (!result?.data)
    throw new RequirementsApiError("Unexpected response from the server.")
  return toRequirementLineRow(result.data)
}

/** True when the error represents a cancelled/superseded request. */
export function isRequestCancelled(e: unknown): boolean {
  return e instanceof RequirementsApiError && e.code === REQUEST_CANCELLED
}

/**
 * A line is eligible for a new purchase order only while it is still open or
 * partially fulfilled AND the backend reports quantity remaining to order.
 * Fulfilled and closed lines are never eligible.
 */
export function isLineOrderable(line: {
  lineStatus: string
  remainingToOrder: number
}): boolean {
  const s = (line.lineStatus || "").toUpperCase()
  return (
    (s === "OPEN" || s === "PARTIALLY_FULFILLED") && line.remainingToOrder > 0
  )
}
