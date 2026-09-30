// ── Notifications context / provider ──────────────────────────────────────────
// Single source of truth for the notification bell, the Notifications page and
// the notification settings page. REST is the source of the initial state;
// WebSocket (one connection, created HERE — never per-component) feeds live
// updates. No polling. Notification `id` is the unique identifier used to keep
// REST + socket data from duplicating.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "../auth/AuthContext";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  getNotificationSettings,
  updateNotificationSettings,
  NotificationsApiError,
  severityTone,
  type NotificationDto,
  type NotificationSettingsDto,
  type NotificationsListMeta,
} from "./notificationsApi";
import {
  connectNotificationSocket,
  extractNotification,
  type NotificationSocketHandle,
} from "./notificationsSocket";

export interface NotificationsFilters {
  page: number;
  limit: number;
  isRead?: boolean;
  type?: string;
}

interface NewNotificationToast {
  id: number;
  title: string;
  message: string;
  severity: string;
}

interface NotificationsContextValue {
  // List + metadata (current filter)
  notifications: NotificationDto[];
  unreadCount: number;
  meta: NotificationsListMeta;
  loading: boolean;
  error: string;
  filters: NotificationsFilters;
  socketConnected: boolean;
  refresh: () => Promise<void>;
  setFilters: (patch: Partial<NotificationsFilters>) => void;
  goToPage: (page: number) => void;
  markRead: (id: string) => Promise<boolean>;
  markAllRead: () => Promise<boolean>;
  // Settings
  settings: NotificationSettingsDto | null;
  settingsLoading: boolean;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: NotificationSettingsDto) => Promise<NotificationSettingsDto>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}

const DEFAULT_FILTERS: NotificationsFilters = { page: 1, limit: 10 };
const MAX_WS_LIST_ITEMS = 50;

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [meta, setMeta] = useState<NotificationsListMeta>({
    page: 1,
    limit: DEFAULT_FILTERS.limit,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [filters, setFiltersState] = useState<NotificationsFilters>(DEFAULT_FILTERS);

  const [settings, setSettings] = useState<NotificationSettingsDto | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [toast, setToast] = useState<NewNotificationToast | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Refs so socket handlers always see the latest state without reconnecting.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;
  const unreadCountRef = useRef(unreadCount);
  unreadCountRef.current = unreadCount;

  // ── Fetch (REST = source of truth) ─────────────────────────────────────────

  const refresh = useCallback(
    async (f: NotificationsFilters = filtersRef.current) => {
      setLoading(true);
      setError("");
      try {
        const res = await getNotifications({
          page: f.page,
          limit: f.limit,
          isRead: f.isRead,
          type: f.type || undefined,
        });
        setNotifications(res.data);
        setMeta(res.meta);
        // The backend's unreadCount drives the badge — never computed client-side.
        if (typeof res.unreadCount === "number") setUnreadCount(res.unreadCount);
      } catch (e) {
        setError(
          e instanceof NotificationsApiError
            ? e.message
            : "Unable to load notifications.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Fetch whenever the filter changes (covers the initial load too).
  useEffect(() => {
    void refresh(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const setFilters = useCallback((patch: Partial<NotificationsFilters>) => {
    setFiltersState((prev) => {
      const next = { ...prev, ...patch };
      // Changing the read-status or type filter resets back to page 1.
      if ("isRead" in patch || "type" in patch) next.page = 1;
      return next;
    });
  }, []);

  const goToPage = useCallback((page: number) => {
    setFiltersState((prev) => ({ ...prev, page: Math.max(1, page) }));
  }, []);

  const markRead = useCallback(async (id: string): Promise<boolean> => {
    const target = notificationsRef.current.find((n) => n.id === id);
    const wasUnread = Boolean(target && !target.isRead);
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, isRead: true, readAt: n.readAt ?? new Date().toISOString() }
            : n,
        ),
      );
      // Locally adjust the backend's unreadCount (the PATCH response carries no
      // count), mirroring "mark as read, then update local state" behavior.
      if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
      return true;
    } catch {
      return false;
    }
  }, []);

  const markAllRead = useCallback(async (): Promise<boolean> => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((n) =>
          n.isRead ? n : { ...n, isRead: true, readAt: new Date().toISOString() },
        ),
      );
      setUnreadCount(0);
      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Settings ────────────────────────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const s = await getNotificationSettings();
      setSettings(s);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const saveSettings = useCallback(
    async (next: NotificationSettingsDto): Promise<NotificationSettingsDto> => {
      const updated = await updateNotificationSettings(next);
      // Use the backend's returned object (may differ from what was submitted).
      setSettings(updated);
      return updated;
    },
    [],
  );

  // ── WebSocket (single connection for the whole app) ────────────────────────

  useEffect(() => {
    if (!user) return;

    let handle: NotificationSocketHandle | null = null;
    let mounted = true;

    handle = connectNotificationSocket({
      onOpen: () => {
        if (mounted) setSocketConnected(true);
      },
      onMessage: (event) => {
        if (typeof event.data !== "string") return;
        const n = extractNotification(event.data);
        if (!n) return; // Not a recognizable notification — ignore (no invented contract).

        const alreadyKnown = notificationsRef.current.some((p) => p.id === n.id);
        setNotifications((prev) => {
          const exists = prev.some((p) => p.id === n.id);
          if (exists) {
            return prev.map((p) => (p.id === n.id ? { ...p, ...n } : p));
          }
          // Only surface it in the visible list when it matches the active filter.
          const f = filtersRef.current;
          const matches =
            (!f.type || f.type === n.type) &&
            (f.isRead === undefined || f.isRead === n.isRead);
          if (!matches) return prev;
          return [n, ...prev].slice(0, MAX_WS_LIST_ITEMS);
        });

        // Bump unread only for genuinely new unread notifications.
        if (!alreadyKnown && !n.isRead) {
          setUnreadCount((c) => c + 1);
        }

        if (mounted && !n.isRead) {
          setToast({ id: Date.now(), title: n.title, message: n.message, severity: n.severity });
          if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
          toastTimerRef.current = window.setTimeout(() => setToast(null), 5000);
        }
      },
      onClose: () => {
        if (mounted) setSocketConnected(false);
      },
    });

    return () => {
      mounted = false;
      handle?.close();
      if (toastTimerRef.current != null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [user]);

  const value: NotificationsContextValue = {
    notifications,
    unreadCount,
    meta,
    loading,
    error,
    filters,
    socketConnected,
    refresh: () => refresh(),
    setFilters,
    goToPage,
    markRead,
    markAllRead,
    settings,
    settingsLoading,
    loadSettings,
    saveSettings,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[100] max-w-sm rounded-lg border border-[#E6ECE2] bg-white shadow-lg p-3.5">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${
                severityTone(toast.severity) === "danger"
                  ? "bg-red-500"
                  : severityTone(toast.severity) === "warning"
                    ? "bg-yellow-500"
                    : "bg-[#B6C8AF]"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#333333] leading-snug">{toast.title}</p>
              {toast.message && (
                <p className="text-xs text-[#666666] mt-0.5 line-clamp-2">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-[#999999] hover:text-[#333333] text-sm leading-none"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </NotificationsContext.Provider>
  );
}