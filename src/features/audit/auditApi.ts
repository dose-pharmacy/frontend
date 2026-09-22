// ── Audit trail API client ──────────────────────────────────────────────────
// Talks to the pharmacy backend's generic audit endpoints:
//   GET /api/v1/audit                            (list, paginated + filters)
//   GET /api/v1/audit/entity/{entity}/{entityId} (per-record history)
//   GET /api/v1/audit/user/{userId}              (per-user history)
//
// All requests require the authenticated session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";

// ─── Types (mirror the Swagger response shapes) ──────────────────────────────

export interface AuditTrailEntryDto {
  id: string;
  /** Actor; NULL only for system/background events. */
  userId: string | null;
  user: { id: string; name: string; email: string } | null;
  /** CREATE / UPDATE / DELETE / CONFIRM / CLOSE / ... */
  action: string;
  /** PRODUCT / GOODS_RECEIPT / PURCHASE_RETURN / ... */
  entity: string;
  entityId: string;
  oldData: unknown;
  newData: unknown;
  /** Composite event name, e.g. GOODS_RECEIPT_CONFIRMED. */
  description: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/**
 * Every audit endpoint nests pagination inside `data` (the service returns
 * `{ data, total, page, pageSize, totalPages }` which `sendSuccess` wraps).
 * Note `pageSize` (not `limit`) and `totalPages` may be 0 when empty.
 */
export interface AuditTrailPageResult {
  data: AuditTrailEntryDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditTrailQuery {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditTrailPageQuery {
  page?: number;
  limit?: number;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class AuditApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, options: { status: number; code?: string } = { status: 0 }) {
    super(message);
    this.name = "AuditApiError";
    this.status = options.status;
    this.code = options.code;
  }
}

function friendlyStatusMessage(status: number, code?: string): string {
  switch (status) {
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "Only administrators can view the audit trail.";
    case 404:
      return "The requested audit records no longer exist.";
    case 422:
      return "The audit query was rejected — check the filters.";
    default:
      if (code) return `Audit request failed (${code}).`;
      return `Request failed (HTTP ${status}).`;
  }
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const AUDIT_BASE = `${API_BASE_URL}/api/v1/audit`;

async function auditRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${AUDIT_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new AuditApiError(
      "Cannot reach the server. Please check your connection and try again.",
    );
  }

  if (!res.ok) {
    let message = friendlyStatusMessage(res.status);
    let code: string | undefined;
    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string };
        message?: string;
      } | null;
      if (body?.error?.code) {
        code = body.error.code;
        message = friendlyStatusMessage(res.status, code);
      }
      if (body?.error?.message) message = body.error.message;
      else if (body?.message) message = body.message;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new AuditApiError(message, { status: res.status, code });
  }

  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

function emptyPage(query: AuditTrailQuery | AuditTrailPageQuery = {}): AuditTrailPageResult {
  return {
    data: [],
    total: 0,
    page: query.page ?? 1,
    pageSize: query.limit ?? 20,
    totalPages: 0,
  };
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

/**
 * GET /audit — paginated audit list. Unwraps `{ success, data: { data, total,
 * page, pageSize, totalPages } }` defensively and degrades to an empty page.
 */
export async function listAuditTrail(
  query: AuditTrailQuery = {},
): Promise<AuditTrailPageResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    page: query.page,
    limit: query.limit,
    userId: query.userId,
    action: query.action,
    entity: query.entity,
    entityId: query.entityId,
    startDate: query.startDate,
    endDate: query.endDate,
  })) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  const result = await auditRequest<{
    data?: AuditTrailPageResult | null;
  }>(qs ? `?${qs}` : "");
  const page = result?.data;
  if (!page || !Array.isArray(page.data)) return emptyPage(query);
  return {
    data: page.data,
    total: page.total ?? 0,
    page: page.page ?? query.page ?? 1,
    pageSize: page.pageSize ?? query.limit ?? 20,
    totalPages: page.totalPages ?? 0,
  };
}

/** GET /audit/entity/{entity}/{entityId} — every occurrence of one record. */
export async function getAuditTrailByEntity(
  entity: string,
  entityId: string,
  query: AuditTrailPageQuery = {},
): Promise<AuditTrailPageResult> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  const result = await auditRequest<{ data?: AuditTrailPageResult | null }>(
    `/entity/${encodeURIComponent(entity)}/${encodeURIComponent(entityId)}${qs ? `?${qs}` : ""}`,
  );
  const page = result?.data;
  if (!page || !Array.isArray(page.data)) return emptyPage(query);
  return {
    data: page.data,
    total: page.total ?? 0,
    page: page.page ?? query.page ?? 1,
    pageSize: page.pageSize ?? query.limit ?? 20,
    totalPages: page.totalPages ?? 0,
  };
}

/** GET /audit/user/{userId} — everything one user did. */
export async function getAuditTrailByUser(
  userId: string,
  query: AuditTrailPageQuery = {},
): Promise<AuditTrailPageResult> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  const result = await auditRequest<{ data?: AuditTrailPageResult | null }>(
    `/user/${encodeURIComponent(userId)}${qs ? `?${qs}` : ""}`,
  );
  const page = result?.data;
  if (!page || !Array.isArray(page.data)) return emptyPage(query);
  return {
    data: page.data,
    total: page.total ?? 0,
    page: page.page ?? query.page ?? 1,
    pageSize: page.pageSize ?? query.limit ?? 20,
    totalPages: page.totalPages ?? 0,
  };
}
