// ── Notifications API client ─────────────────────────────────────────────────
// Talks to the pharmacy backend's notification endpoints (authenticated with
// the existing Better Auth session cookie — `credentials: "include"`):
//   GET   /api/v1/notifications                           (list, filters, unreadCount)
//   PATCH /api/v1/notifications/{id}/read                 (mark one as read — no body)
//   PATCH /api/v1/notifications/read-all                  (mark all as read — canonical)
//   GET   /api/v1/notifications/settings                  (notification preferences)
//   PATCH /api/v1/notifications/settings                  (update preferences)
//   POST  /api/v1/notifications/run/payment-reminders     (ADMIN-only manual run)
//   POST  /api/v1/notifications/run/expiry-alerts         (ADMIN-only manual run)
//
// The base URL is reused from the existing auth client — never duplicated.

import { API_BASE_URL } from "../auth/authApi";

// ─── Types (mirror the documented Swagger response shapes) ───────────────────

/** Notification types exposed by the backend. Do not add values here. */
export const NOTIFICATION_TYPES = [
  "PAYMENT_APPROACHING_DUE",
  "PAYMENT_DUE_TODAY",
  "PAYMENT_OVERDUE",
  "EXPIRING_WITHIN_1_YEAR",
  "EXPIRING_WITHIN_6_MONTHS",
  "PRODUCT_EXPIRED",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Human-readable labels for the backend enum values (display only — the raw
 * enum value is what gets sent in API requests). */
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  PAYMENT_APPROACHING_DUE: "Payment Approaching Due",
  PAYMENT_DUE_TODAY: "Payment Due Today",
  PAYMENT_OVERDUE: "Payment Overdue",
  EXPIRING_WITHIN_1_YEAR: "Product Expiring Within 1 Year",
  EXPIRING_WITHIN_6_MONTHS: "Product Expiring Within 6 Months",
  PRODUCT_EXPIRED: "Product Expired",
};

export function notificationTypeLabel(type: string | null | undefined): string {
  if (!type) return "Notification";
  return NOTIFICATION_TYPE_LABELS[type] ?? type;
}

export type NotificationSeverity = "INFO" | "WARNING" | "ERROR" | (string & {});

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  [key: string]: unknown;
}

export interface NotificationsListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface NotificationsResponse {
  data: NotificationDto[];
  meta: NotificationsListMeta;
  /** Provided by the backend — always use it for the unread badge, never
   * compute the count from the list (the list may be filtered/paginated). */
  unreadCount: number;
}

export interface NotificationSettingsDto {
  paymentRemindersEnabled: boolean;
  remindBeforeDueDays: number;
  remindOnDueDate: boolean;
  remindWhenOverdue: boolean;
  expiryAlertsEnabled: boolean;
  alertWithin6Months: boolean;
  alertWithin1Year: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SchedulerRunResultDto {
  created: number;
  skipped: number;
}

/** Display tone for a backend severity value — known values map to existing
 * design tokens; anything else falls back to a neutral tone. */
export type SeverityTone = "info" | "warning" | "danger" | "neutral";

export function severityTone(severity: string | null | undefined): SeverityTone {
  const s = severity?.toUpperCase();
  if (s === "ERROR" || s === "CRITICAL") return "danger";
  if (s === "WARNING") return "warning";
  if (s === "INFO") return "info";
  return "neutral";
}

/** Compact relative/fallback date for list rows. */
export function formatNotificationTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const minutes = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class NotificationsApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "NotificationsApiError";
    this.status = status;
  }
}

// ─── Request helper ──────────────────────────────────────────────────────────

async function notificationsRequest<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/notifications${endpoint}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new NotificationsApiError("Cannot reach the server. Please check your connection.");
  }

  if (!res.ok) {
    let msg = `Request failed (HTTP ${res.status}).`;
    let backendMessage: string | undefined;
    try {
      const body = (await res.json()) as {
        message?: string;
        error?: { message?: string } | string;
      };
      if (body?.error) {
        backendMessage =
          typeof body.error === "string" ? body.error : body.error.message;
      }
      if (!backendMessage && body?.message) backendMessage = body.message;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    // Prefer the backend's message when one exists; never expose stack traces.
    if (backendMessage) msg = backendMessage;
    throw new NotificationsApiError(msg, res.status);
  }

  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export interface NotificationsQuery {
  page?: number;
  limit?: number;
  /** Filters by read status — send "true"/"false" when set. */
  isRead?: boolean;
  /** Filters by notification type. */
  type?: string;
}

/** GET /api/v1/notifications — list + unreadCount for the current user. */
export async function getNotifications(
  query: NotificationsQuery = {},
): Promise<NotificationsResponse> {
  const params = new URLSearchParams();
  if (query.page != null) params.set("page", String(query.page));
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.isRead != null) params.set("isRead", query.isRead ? "true" : "false");
  if (query.type) params.set("type", query.type);
  const qs = params.toString();

  const raw = await notificationsRequest<{
    data?: NotificationDto[] | null;
    meta?: NotificationsListMeta | null;
    pagination?: NotificationsListMeta | null;
    unreadCount?: number | null;
  }>(qs ? `?${qs}` : "");

  return {
    data: Array.isArray(raw?.data) ? raw.data : [],
    meta:
      raw?.meta ??
      raw?.pagination ?? { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    unreadCount: typeof raw?.unreadCount === "number" ? raw.unreadCount : 0,
  };
}

/** PATCH /api/v1/notifications/{id}/read — no request body.
 * The documented response example is inconsistent (a Location-shaped object) —
 * we only rely on the request succeeding and update local state ourselves. */
export async function markNotificationAsRead(id: string): Promise<void> {
  await notificationsRequest(`/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    body: "{}",
  });
}

/** PATCH /api/v1/notifications/read-all — the ONE canonical "mark all as read"
 * frontend method (the Swagger docs also list PATCH /notifications with the
 * same purpose; we deliberately use a single endpoint). */
export async function markAllNotificationsAsRead(): Promise<void> {
  await notificationsRequest("/read-all", {
    method: "PATCH",
    body: "{}",
  });
}

/** GET /api/v1/notifications/settings — current user's preferences. */
export async function getNotificationSettings(): Promise<NotificationSettingsDto> {
  const raw = await notificationsRequest<{ data?: NotificationSettingsDto | null }>("/settings");
  if (!raw?.data) throw new NotificationsApiError("Unexpected settings response from the server.");
  return raw.data;
}

/** PATCH /api/v1/notifications/settings — send the COMPLETE settings object. */
export async function updateNotificationSettings(
  settings: NotificationSettingsDto,
): Promise<NotificationSettingsDto> {
  const raw = await notificationsRequest<{ data?: NotificationSettingsDto | null }>("/settings", {
    method: "PATCH",
    body: JSON.stringify({
      paymentRemindersEnabled: settings.paymentRemindersEnabled,
      remindBeforeDueDays: settings.remindBeforeDueDays,
      remindOnDueDate: settings.remindOnDueDate,
      remindWhenOverdue: settings.remindWhenOverdue,
      expiryAlertsEnabled: settings.expiryAlertsEnabled,
      alertWithin6Months: settings.alertWithin6Months,
      alertWithin1Year: settings.alertWithin1Year,
    }),
  });
  if (!raw?.data) throw new NotificationsApiError("Unexpected settings response from the server.");
  return raw.data;
}

/** POST /api/v1/notifications/run/payment-reminders — ADMIN-only manual trigger. */
export async function runPaymentReminders(): Promise<SchedulerRunResultDto> {
  const raw = await notificationsRequest<{ data?: SchedulerRunResultDto | null }>(
    "/run/payment-reminders",
    { method: "POST", body: "{}" },
  );
  return raw?.data ?? { created: 0, skipped: 0 };
}

/** POST /api/v1/notifications/run/expiry-alerts — ADMIN-only manual trigger. */
export async function runExpiryAlerts(): Promise<SchedulerRunResultDto> {
  const raw = await notificationsRequest<{ data?: SchedulerRunResultDto | null }>(
    "/run/expiry-alerts",
    { method: "POST", body: "{}" },
  );
  return raw?.data ?? { created: 0, skipped: 0 };
}