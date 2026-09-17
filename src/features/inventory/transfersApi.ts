// ── Transfers API client ─────────────────────────────────────────────────────
// Talks to the pharmacy backend's inventory transfer endpoints:
//   POST   /api/v1/inventory/transfers                       (create)
//   GET    /api/v1/inventory/transfers                       (list, paginated)
//   GET    /api/v1/inventory/transfers/{id}                  (detail)
//   PATCH  /api/v1/inventory/transfers/{id}                  (update the transfer)
//   POST   /api/v1/inventory/transfers/{transferId}/items     (add item)
//   PATCH  /api/v1/inventory/transfers/{transferId}/items/{itemId}  (edit item)
//   DELETE /api/v1/inventory/transfers/{transferId}/items/{itemId}  (remove item)
//   POST   /api/v1/inventory/transfers/{id}/complete          (complete)
//   POST   /api/v1/inventory/transfers/{id}/cancel            (cancel)
//
// All requests require the authenticated admin session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";

// ─── Types (mirror the Swagger request/response shapes) ──────────────────────

export type TransferStatusDto = "DRAFT" | "COMPLETED" | "CANCELLED";

export interface TransferItemDto {
  id: string;
  productId: string;
  batchId: string;
  unitId: string;
  quantity: number;
}

/** Item embedded in a transfer response. */
export interface TransferItemFullDto extends TransferItemDto {
  product?: { id: string; name?: string; sku?: string } | Record<string, never>;
  batch?: { id: string; batchNumber?: string } | Record<string, never>;
  unit?: { id: string; name?: string } | Record<string, never>;
}

export interface TransferLocationRefDto {
  id: string;
  name?: string;
}

export interface TransferDto {
  id: string;
  transferNumber?: string;
  fromLocation: TransferLocationRefDto;
  toLocation: TransferLocationRefDto;
  transferDate: string;
  reason?: string | null;
  status: TransferStatusDto;
  items: TransferItemFullDto[];
}

export interface TransferListResult {
  data: TransferDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Body for POST /inventory/transfers. */
export interface CreateTransferInput {
  fromLocationId: string;
  toLocationId: string;
  transferDate: string; // ISO timestamp, e.g. "2026-09-16T06:18:22.972Z"
  reason?: string;
  items: {
    productId: string;
    batchId: string;
    unitId: string;
    quantity: number;
  }[];
}

/**
 * Body for PATCH /inventory/transfers/{id} — updates the transfer itself
 * (not its items).
 */
export interface UpdateTransferInput {
  transferDate?: string;
  reason?: string;
}

/** Body for POST /inventory/transfers/{transferId}/items. */
export interface AddTransferItemInput {
  productId: string;
  batchId: string;
  unitId: string;
  quantity: number;
}

/** Body for PATCH /inventory/transfers/{transferId}/items/{itemId}. */
export interface UpdateTransferItemInput {
  quantity: number;
}

export interface TransfersQuery {
  page?: number;
  limit?: number;
  status?: TransferStatusDto;
  fromLocationId?: string;
  toLocationId?: string;
  search?: string;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class TransfersApiError extends Error {
  readonly status: number;
  readonly code?: string;
  /** Per-field validation messages from the backend, when provided. */
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    options: { status: number; code?: string; details?: Record<string, unknown> } = {
      status: 0,
    },
  ) {
    super(message);
    this.name = "TransfersApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

function friendlyStatusMessage(status: number): string {
  switch (status) {
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to manage transfers.";
    case 404:
      return "This transfer no longer exists.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

async function parseErrorResponse(res: Response): Promise<TransfersApiError> {
  let message = friendlyStatusMessage(res.status);
  let code: string | undefined;
  let details: Record<string, unknown> | undefined;

  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string; details?: Record<string, unknown> };
      message?: string;
      code?: string;
    } | null;
    if (body?.error?.message) message = body.error.message;
    else if (body?.message) message = body.message;
    if (body?.error?.code) code = body.error.code;
    if (body?.error?.details) details = body.error.details;
  } catch {
    // Non-JSON error body — keep the generic message.
  }

  return new TransfersApiError(message, { status: res.status, code, details });
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const TRANSFERS_BASE = `${API_BASE_URL}/api/v1/inventory/transfers`;

async function transfersRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${TRANSFERS_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new TransfersApiError(
      "Cannot reach the server. Please check your connection and try again.",
    );
  }

  if (!res.ok) throw await parseErrorResponse(res);

  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

function buildQueryString(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Some endpoints wrap the entity in `.data`, others return it raw. Unwrap
 * defensively so call sites never depend on the unconfirmed envelope.
 */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === "object" && "data" in (body as Record<string, unknown>)) {
    const inner = (body as { data: unknown }).data;
    if (inner && typeof inner === "object" && !("items" in (inner as Record<string, unknown>))) {
      // `data` on a transfer list is an array; only unwrap when it's an entity.
      if (Array.isArray(inner)) return body as T;
    }
    return inner as T;
  }
  return body as T;
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

/**
 * POST /inventory/transfers — create a transfer with its items.
 * Response shape confirmed from Swagger: the transfer entity incl. items.
 */
export async function createTransfer(input: CreateTransferInput): Promise<TransferDto> {
  const result = await transfersRequest<unknown>("", {
    method: "POST",
    body: JSON.stringify({
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      transferDate: input.transferDate,
      ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
      items: input.items,
    }),
  });
  return unwrap<TransferDto>(result);
}

/** GET /inventory/transfers — paginated list for the Transfers page. */
export async function listTransfers(query: TransfersQuery = {}): Promise<TransferListResult> {
  const qs = buildQueryString({
    page: query.page,
    limit: query.limit,
    status: query.status,
    fromLocationId: query.fromLocationId,
    toLocationId: query.toLocationId,
    search: query.search,
  });
  const result = await transfersRequest<TransferListResult>(qs);
  return (
    result ?? {
      data: [],
      pagination: { page: query.page ?? 1, limit: query.limit ?? 10, total: 0, totalPages: 1 },
    }
  );
}

/** GET /inventory/transfers/{id} — transfer detail incl. items. */
export async function getTransfer(id: string): Promise<TransferDto> {
  const result = await transfersRequest<unknown>(
    `/${encodeURIComponent(id)}`,
  );
  return unwrap<TransferDto>(result);
}

/**
 * PATCH /inventory/transfers/{id} — update the transfer itself (date/reason).
 * ⚠️ The exact accepted fields are not fully confirmed; only send what the
 * Swagger definition documents as updatable.
 */
export async function updateTransfer(
  id: string,
  input: UpdateTransferInput,
): Promise<TransferDto> {
  const body: Record<string, unknown> = {};
  if (input.transferDate !== undefined) body.transferDate = input.transferDate;
  if (input.reason !== undefined) body.reason = input.reason;

  const result = await transfersRequest<unknown>(`/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return unwrap<TransferDto>(result);
}

/** POST /inventory/transfers/{transferId}/items — add an item to a transfer. */
export async function addTransferItem(
  transferId: string,
  input: AddTransferItemInput,
): Promise<TransferItemDto> {
  const result = await transfersRequest<unknown>(
    `/${encodeURIComponent(transferId)}/items`,
    {
      method: "POST",
      body: JSON.stringify({
        productId: input.productId,
        batchId: input.batchId,
        unitId: input.unitId,
        quantity: input.quantity,
      }),
    },
  );
  return unwrap<TransferItemDto>(result);
}

/**
 * PATCH /inventory/transfers/{transferId}/items/{itemId} — update an item
 * (quantity).
 */
export async function updateTransferItem(
  transferId: string,
  itemId: string,
  input: UpdateTransferItemInput,
): Promise<TransferItemDto> {
  const result = await transfersRequest<unknown>(
    `/${encodeURIComponent(transferId)}/items/${encodeURIComponent(itemId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ quantity: input.quantity }),
    },
  );
  return unwrap<TransferItemDto>(result);
}

/**
 * DELETE /inventory/transfers/{transferId}/items/{itemId}.
 * ⚠️ The exact Swagger response body is unconfirmed — don't rely on it; the
 * caller should refetch the transfer after a successful delete.
 */
export async function deleteTransferItem(
  transferId: string,
  itemId: string,
): Promise<void> {
  await transfersRequest<unknown>(
    `/${encodeURIComponent(transferId)}/items/${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  );
}

/**
 * POST /inventory/transfers/{id}/complete — completes the transfer and moves
 * the stock. No request body.
 * ⚠️ Response schema not fully confirmed — the caller refetches after this.
 */
export async function completeTransfer(id: string): Promise<TransferDto> {
  const result = await transfersRequest<unknown>(
    `/${encodeURIComponent(id)}/complete`,
    { method: "POST", body: JSON.stringify({}) },
  );
  return unwrap<TransferDto>(result);
}

/**
 * POST /inventory/transfers/{id}/cancel — cancels the transfer. No request
 * body. ⚠️ Response schema not fully confirmed — the caller refetches.
 */
export async function cancelTransfer(id: string): Promise<TransferDto> {
  const result = await transfersRequest<unknown>(
    `/${encodeURIComponent(id)}/cancel`,
    { method: "POST", body: JSON.stringify({}) },
  );
  return unwrap<TransferDto>(result);
}
