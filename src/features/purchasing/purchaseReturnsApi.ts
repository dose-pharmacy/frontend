// ── Purchase Returns API client ──────────────────────────────────────────────
// Real backend contract (verified against the live OpenAPI at
// https://dose-backend-ky5q.onrender.com/api-docs):
//
//   GET    /purchasing/purchase-returns                                (list)
//   GET    /purchasing/purchase-returns/{id}                           (detail)
//   POST   /purchasing/purchase-returns                                (create)
//   GET    /purchasing/purchase-order-items/{purchaseOrderItemId}/returnable
//                                                                  ?supplierId=…
//
// Contract facts that shaped this module:
//
// • `PurchaseReturn` publishes ONLY identifiers plus money/reason/quantity —
//   `supplierId`, `productId`, `batchId`, `locationId`. It does NOT embed
//   `supplier`, `product`, `batch` or `location` objects, and it does NOT
//   publish `returnedDate` or `recordedBy`. The record's timestamp field is
//   `createdAt`. Names are therefore resolved by the UI through existing,
//   supported catalogue endpoints (see `purchaseReturnLabels.ts`) — never by
//   inventing fields on this DTO.
//
// • No delete/reversal call exists in this module, on purpose. The only DELETE
//   route in the published contract,
//   `DELETE /purchasing/purchase-order-items/{purchaseOrderItemId}/returnable`,
//   is NOT registered on the deployed backend: a live probe returns 404 at the
//   routing layer while the sibling GET on the same path returns 401. Its
//   Swagger declaration is also self-inconsistent — the path template is
//   `{purchaseOrderItemId}` while the declared parameter is `id`.
//   A router probe does indicate an UNDOCUMENTED `DELETE
//   /purchasing/purchase-returns/{id}` (control: `DELETE
//   /purchasing/purchase-orders/{id}`, GET/PATCH only, correctly 404s). Whether
//   it reverses the RETURN_TO_SUPPLIER movement and the payable application is
//   unverified, so nothing here deletes a return.
//
// • The `returnable` endpoint's documented 200 response is `EmptySuccessResponse`
//   (`{ success: true, data: null }`) and no component schema documents its
//   shape anywhere in the spec. `readPurchaseOrderItemReturnable` below binds
//   it defensively and always keeps the raw payload for display.

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

/** `PurchaseReturn.purchaseOrderItem` — the only PO reference a return carries. */
export interface PurchaseReturnPoItemRef {
  id: string
  unitCost: number
  quantityReceived: number
  purchaseOrder: { id: string; poNumber: string }
}

/** `components.schemas.PurchaseReturn` — mapped field for field. */
export interface PurchaseReturnDto {
  id: string
  returnNumber: string
  supplierId: string
  productId: string
  purchaseOrderItemId: string | null
  purchaseOrderItem: PurchaseReturnPoItemRef | null
  batchId: string | null
  locationId: string
  reason: PurchaseReturnReason
  /** Base units being returned. */
  quantity: number
  unitCost: number
  /** Return value computed by the backend. */
  debitNoteAmount: number
  /** Portion of the return value the backend applied against outstanding payables. */
  appliedToPayable: number
  notes: string | null
  createdAt: string
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class PurchaseReturnsApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message)
    this.name = "PurchaseReturnsApiError"
    this.status = options.status ?? 0
    this.code = options.code
  }
}

/** Used only when the backend sends no `error.message` of its own. */
function friendlyStatusMessage(status: number, code?: string): string {
  switch (status) {
    case 401:
      return "Your session has expired. Please sign in again."
    case 403:
      return "You don't have permission to record or view purchase returns."
    case 404:
      return "The purchase return or purchase-order item was not found."
    case 409:
      if (code === "INSUFFICIENT_STOCK")
        return "There is not enough stock at the selected batch and location to cover this return."
      if (code === "PURCHASE_RETURN_IMMUTABLE")
        return "This purchase return cannot be removed — its stock movement is already recorded."
      return "The return conflicts with the current stock or billing state."
    case 422:
      return "The return was rejected by validation — check the quantity, supplier, purchase-order item and batch."
    default:
      return `Request failed (HTTP ${status}).`
  }
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const PURCHASING_BASE = `${API_BASE_URL}/api/v1/purchasing`

async function purchasingRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${PURCHASING_BASE}${path}`, {
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
    let message = friendlyStatusMessage(res.status)
    let code: string | undefined
    try {
      const body = (await res.json()) as {
        success?: boolean
        error?: { code?: string; message?: string }
        message?: string
      } | null
      code = body?.error?.code
      // The backend's own message always wins — 409/422 carry the real reason.
      message = body?.error?.message ?? body?.message ?? friendlyStatusMessage(res.status, code)
    } catch {
      // Non-JSON error body — keep the status-derived message.
    }
    throw new PurchaseReturnsApiError(message, { status: res.status, code })
  }

  const text = await res.text()
  if (!text) return null as T
  try {
    return JSON.parse(text) as T
  } catch {
    return null as T
  }
}

// ─── List ────────────────────────────────────────────────────────────────────

export interface PurchaseReturnsQuery {
  page?: number
  limit?: number
  supplierId?: string
  productId?: string
  reason?: PurchaseReturnReason
}

function emptyMeta(query: PurchaseReturnsQuery): PaginatedResponse<never>["meta"] {
  return { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 }
}

/**
 * GET /purchase-returns — server-side filtering and pagination. `supplierId`,
 * `productId` and `reason` are the only filters the backend supports, so the
 * UI must not offer anything else. Errors propagate: this module never
 * degrades a failed request into an empty page, which would look identical to
 * "no returns recorded".
 */
export async function listPurchaseReturns(
  params: PurchaseReturnsQuery = {},
): Promise<PaginatedResponse<PurchaseReturnDto>> {
  const q = new URLSearchParams()
  if (params.page) q.set("page", String(params.page))
  if (params.limit) q.set("limit", String(params.limit))
  if (params.supplierId) q.set("supplierId", params.supplierId)
  if (params.productId) q.set("productId", params.productId)
  if (params.reason) q.set("reason", params.reason)

  const qs = q.toString()
  const raw = await purchasingRequest<{
    success?: boolean
    data?: PurchaseReturnDto[] | null
    meta?: PaginatedResponse<PurchaseReturnDto>["meta"] | null
  }>(`/purchase-returns${qs ? `?${qs}` : ""}`)

  return {
    data: Array.isArray(raw?.data) ? raw.data : [],
    meta: raw?.meta ?? emptyMeta(params),
  }
}

/** GET /purchase-returns/{id} — the detail page's only data source. */
export async function getPurchaseReturn(id: string): Promise<PurchaseReturnDto> {
  const result = await purchasingRequest<{ data?: PurchaseReturnDto | null }>(
    `/purchase-returns/${encodeURIComponent(id)}`,
  )
  if (!result?.data) throw new PurchaseReturnsApiError("Purchase return not found.", { status: 404 })
  return result.data
}

// ─── Returnable quantity for a purchase-order item ───────────────────────────

/**
 * GET /purchase-order-items/{purchaseOrderItemId}/returnable?supplierId=…
 *
 * `supplierId` is REQUIRED by the backend and is validated against the PO
 * item's own supplier, so the UI must only call this once the supplier is
 * known. Returns the raw `data` value from the response envelope, untyped on
 * purpose — see `readPurchaseOrderItemReturnable`.
 */
export async function getPurchaseOrderItemReturnable(
  purchaseOrderItemId: string,
  supplierId: string,
): Promise<unknown> {
  const result = await purchasingRequest<{ data?: unknown }>(
    `/purchase-order-items/${encodeURIComponent(purchaseOrderItemId)}/returnable?supplierId=${encodeURIComponent(supplierId)}`,
  )
  return result?.data ?? null
}

/** Keys the adapter will accept for the returnable base-unit quantity. */
const RETURNABLE_QUANTITY_KEYS = [
  "quantityReturnable",
  "baseQuantityReturnable",
  "returnableQuantity",
  "quantityAvailableToReturn",
  "availableQuantityToReturn",
] as const

/** Keys the adapter will accept for the per-base-unit cost. */
const RETURNABLE_UNIT_COST_KEYS = [
  "unitCost",
  "baseUnitCost",
  "costPerBaseUnit",
  "unitCostPerBaseUnit",
  "returnUnitCost",
] as const

export interface PurchaseOrderItemReturnable {
  /** Base units still returnable, or `null` when the payload could not be bound. */
  quantityReturnable: number | null
  /** Per-base-unit cost from the endpoint, or `null` when it could not be bound. */
  unitCost: number | null
  /**
   * True when the endpoint answered with data but the payload did not match any
   * known shape. The UI must then show the raw payload instead of a number —
   * guessing a value here would fabricate a quantity the backend never sent.
   */
  contractUndocumented: boolean
  /** The literal payload, kept for the diagnostics disclosure. */
  raw: unknown
}

function firstNumber(source: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
  }
  return null
}

/**
 * Bind the undocumented `returnable` payload.
 *
 * The endpoint is documented as returning "how much of the item's received
 * quantity can still be returned … plus the per-base-unit cost", but its
 * Swagger response schema is `EmptySuccessResponse` (`data: null`) and the spec
 * defines no schema for it. We therefore:
 *   1. look for an exact key match on the payload (and on one nested level),
 *   2. use the value only when one is found, and
 *   3. otherwise report `contractUndocumented` and hand the raw payload back so
 *      the UI can display exactly what the server sent.
 *
 * A number is never invented, and the backend stays the authority — a 422 for
 * "exceeds returnable" is still surfaced verbatim.
 */
export function readPurchaseOrderItemReturnable(raw: unknown): PurchaseOrderItemReturnable {
  const result: PurchaseOrderItemReturnable = {
    quantityReturnable: null,
    unitCost: null,
    contractUndocumented: false,
    raw,
  }
  if (raw == null) return result

  if (typeof raw !== "object" || Array.isArray(raw)) {
    result.contractUndocumented = true
    return result
  }

  const levels: Array<Record<string, unknown>> = [raw as Record<string, unknown>]
  // One nested level: some backends wrap a projection like
  // `{ purchaseOrderItem: { … } }` rather than returning the fields directly.
  for (const value of Object.values(raw as Record<string, unknown>)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      levels.push(value as Record<string, unknown>)
    }
  }

  for (const level of levels) {
    const quantity = firstNumber(level, RETURNABLE_QUANTITY_KEYS)
    if (quantity !== null) result.quantityReturnable = quantity
    const cost = firstNumber(level, RETURNABLE_UNIT_COST_KEYS)
    if (cost !== null) result.unitCost = cost
  }

  result.contractUndocumented = result.quantityReturnable === null
  return result
}

// ─── Create ──────────────────────────────────────────────────────────────────

/** `components.schemas.PurchaseReturnCreateInput` — mapped field for field. */
export interface CreatePurchaseReturnInput {
  supplierId: string
  productId: string
  purchaseOrderItemId: string
  batchId: string
  locationId: string
  reason: PurchaseReturnReason
  /** Base units. */
  quantity: number
  /** From the PO item / returnable endpoint — never typed by the user. */
  unitId?: string | null
  /** From the PO item / returnable endpoint — never typed by the user. */
  unitCost?: number | null
  notes?: string | null
  /**
   * Stable for one logical submission and reused for every retry of it, so a
   * double-click or a network retry replays the original record instead of
   * creating a second return.
   */
  idempotencyKey: string
}

export async function createPurchaseReturn(
  input: CreatePurchaseReturnInput,
): Promise<PurchaseReturnDto> {
  const body: Record<string, unknown> = {
    supplierId: input.supplierId,
    productId: input.productId,
    purchaseOrderItemId: input.purchaseOrderItemId,
    batchId: input.batchId,
    locationId: input.locationId,
    reason: input.reason,
    quantity: input.quantity,
    idempotencyKey: input.idempotencyKey,
  }
  if (input.unitId) body.unitId = input.unitId
  if (input.unitCost != null) body.unitCost = input.unitCost
  if (input.notes) body.notes = input.notes
  // `debitNoteAmount` is deliberately NOT sent: the backend derives the return
  // value itself ("applies the derived return value against the purchase
  // order's outstanding invoices") and the POST contract leaves the field
  // optional. Sending a client-computed figure would duplicate backend money
  // logic; the authoritative `debitNoteAmount` / `appliedToPayable` arrive in
  // the response.

  const result = await purchasingRequest<{ data?: PurchaseReturnDto | null }>("/purchase-returns", {
    method: "POST",
    body: JSON.stringify(body),
  })
  // A return moves stock and money — drop cached product-detail copies.
  invalidateCachePrefix("product:")
  if (!result?.data) throw new PurchaseReturnsApiError("Unexpected response from the server.")
  return result.data
}

/**
 * One idempotency key per logical submission.
 *
 * `crypto.randomUUID` needs a secure context, and this app is also served over
 * plain HTTP on the LAN, so fall back to `getRandomValues`.
 */
export function newPurchaseReturnIdempotencyKey(): string {
  const cryptoRef = globalThis.crypto
  if (cryptoRef?.randomUUID) {
    try {
      return cryptoRef.randomUUID()
    } catch {
      // Fall through to getRandomValues.
    }
  }
  const bytes = new Uint8Array(16)
  if (cryptoRef?.getRandomValues) {
    cryptoRef.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  // RFC 4122 v4 layout.
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
