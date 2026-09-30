// ── Notification WebSocket service ────────────────────────────────────────────
//
// ⚠️ BACKEND CONTRACT GAP
// The backend documentation provided for this task does NOT specify:
//   • the WebSocket authentication method (no token/query param documented),
//   • whether the Better Auth session cookie is sent / accepted on the socket,
//   • event names or the JSON message envelope,
//   • whether a subscription/ping message is required,
//   • whether the server sends an initial connection event.
//
// Per the task instructions we must NOT invent any of that. This module:
//   • configures the URL from VITE_WS_URL (with a production default),
//   • opens a plain WebSocket with no invented auth parameters,
//   • parses incoming messages DEFENSIVELY — a message only becomes a
//     notification if it actually looks like the documented NotificationDto
//     shape (has an `id` and a title/type/message), anything else is ignored,
//   • reconnects with capped exponential backoff.
// Real-time delivery therefore depends on the backend's actual socket contract
// (see the final report) — the REST endpoints remain the source of truth.

export const WS_URL: string =
  (import.meta.env.VITE_WS_URL as string | undefined)?.replace(/\/+$/, "") ||
  "wss://backend-1-esjr.onrender.com/ws";

import type { NotificationDto } from "./notificationsApi";

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30_000;

export interface NotificationSocketHandle {
  /** Closes the connection and cancels any pending reconnect. */
  close: () => void;
}

interface NotificationSocketOptions {
  onOpen?: () => void;
  onMessage?: (event: MessageEvent<unknown>) => void;
  onClose?: () => void;
}

/** Opens a single WebSocket connection with auto-reconnect + backoff. */
export function connectNotificationSocket(opts: NotificationSocketOptions): NotificationSocketHandle {
  let ws: WebSocket | null = null;
  let closed = false;
  let attempts = 0;
  let retryTimer: number | null = null;

  function open() {
    if (closed) return;
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      attempts = 0;
      opts.onOpen?.();
    };
    ws.onmessage = (event) => opts.onMessage?.(event);
    // onerror intentionally has no alarm UI — disconnects are surfaced through
    // onClose and reconnected quietly.
    ws.onerror = () => {
      // no-op
    };
    ws.onclose = () => {
      opts.onClose?.();
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (closed || retryTimer != null) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempts, RECONNECT_MAX_MS);
    attempts += 1;
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      open();
    }, delay);
  }

  open();

  return {
    close() {
      closed = true;
      if (retryTimer != null) window.clearTimeout(retryTimer);
      retryTimer = null;
      if (ws) {
        ws.onclose = null;
        try {
          ws.close();
        } catch {
          // already closed
        }
        ws = null;
      }
    },
  };
}

/**
 * Defensive convert of an incoming socket payload into a NotificationDto.
 * Returns null when the message is not a recognizable notification (connection
 * acks, pings, unrelated events, non-JSON frames, etc.). Because the backend
 * event envelope is undocumented, this accepts a few common envelope shapes
 * ({data}, {notification}, or the object itself) and only trusts fields that
 * exist. Unknown messages are silently ignored — never treated as events.
 */
export function extractNotification(payload: string): NotificationDto | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  const candidate: Record<string, unknown> | null =
    parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  if (!candidate) return null;

  let notif: Record<string, unknown> = candidate;
  if (typeof candidate.data === "object" && candidate.data !== null) {
    notif = candidate.data as Record<string, unknown>;
  } else if (typeof candidate.notification === "object" && candidate.notification !== null) {
    notif = candidate.notification as Record<string, unknown>;
  } else if (typeof candidate.event === "object" && candidate.event !== null) {
    const event = candidate.event as Record<string, unknown>;
    if (typeof event.data === "object" && event.data !== null) {
      notif = event.data as Record<string, unknown>;
    }
  }

  if (typeof notif.id !== "string" || notif.id.length === 0) return null;
  const hasText = typeof notif.title === "string" || typeof notif.type === "string";
  if (!hasText) return null;

  const now = new Date().toISOString();
  return {
    id: notif.id,
    type: typeof notif.type === "string" ? notif.type : "PRODUCT_EXPIRED",
    title: typeof notif.title === "string" ? notif.title : "Notification",
    message:
      typeof notif.message === "string"
        ? notif.message
        : typeof notif.title === "string"
          ? notif.title
          : "",
    severity: typeof notif.severity === "string" ? notif.severity : "INFO",
    entityType: typeof notif.entityType === "string" ? notif.entityType : null,
    entityId: typeof notif.entityId === "string" ? notif.entityId : null,
    // A freshly pushed notification is always unread until the server says otherwise.
    isRead: typeof notif.isRead === "boolean" ? notif.isRead : false,
    readAt: typeof notif.readAt === "string" ? notif.readAt : null,
    createdAt: typeof notif.createdAt === "string" ? notif.createdAt : now,
  };
}