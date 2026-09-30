// ── Notifications page (/notifications) ───────────────────────────────────────
// All / Unread tabs, type filter, pagination, and mark-read actions. Data comes
// from the shared NotificationsContext (REST source of truth + socket updates).

import { useState } from "react";
import PageHeader from "../../components/ui/PageHeader";
import { useNotifications } from "../../features/notifications/NotificationsContext";
import {
  NOTIFICATION_TYPES,
  notificationTypeLabel,
  severityTone,
  formatNotificationTime,
} from "../../features/notifications/notificationsApi";

function SeverityDot({ severity }: { severity: string }) {
  const tone = severityTone(severity);
  const color =
    tone === "danger"
      ? "bg-red-500"
      : tone === "warning"
        ? "bg-yellow-500"
        : tone === "info"
          ? "bg-[#7A9076]"
          : "bg-gray-300";
  return <span className={`h-2 w-2 flex-shrink-0 rounded-full ${color}`} aria-hidden />;
}

function NotificationListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-[#E6ECE2] bg-white p-4">
          <div className="h-3 w-1/3 animate-pulse rounded bg-[#E6ECE2]" />
          <div className="mt-2 h-2.5 w-2/3 animate-pulse rounded bg-[#E6ECE2]" />
          <div className="mt-2 h-2.5 w-1/2 animate-pulse rounded bg-[#E6ECE2]" />
        </div>
      ))}
    </div>
  );
}

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    meta,
    loading,
    error,
    filters,
    setFilters,
    goToPage,
    markRead,
    markAllRead,
    refresh,
  } = useNotifications();

  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const activeTab: "all" | "unread" = filters.isRead === false ? "unread" : "all";

  function handleTab(tab: "all" | "unread") {
    setActionError("");
    if (tab === "all") setFilters({ isRead: undefined });
    else setFilters({ isRead: false });
  }

  function handleTypeChange(type: string) {
    setActionError("");
    setFilters({ type: type || undefined });
  }

  async function handleMarkAll() {
    setActionError("");
    setMarkingAll(true);
    const ok = await markAllRead();
    setMarkingAll(false);
    if (!ok) setActionError("Could not mark notifications as read. Please try again.");
  }

  async function handleMarkOne(id: string) {
    setActionError("");
    setMarkingId(id);
    const ok = await markRead(id);
    setMarkingId(null);
    if (!ok) setActionError("Could not update this notification. Please try again.");
  }

  const totalPages = Math.max(1, meta.totalPages || 1);

  return (
    <div className="min-h-full">
      <PageHeader
        breadcrumb="Notifications"
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
            : "You're all caught up"
        }
        actions={
          <>
            <button
              onClick={() => setFilters({ isRead: undefined, page: 1, type: undefined })}
              className="rounded-lg bg-[#E6ECE2] hover:bg-[#C6D4BF] transition-colors px-3 py-1.5 text-xs font-semibold text-[#333333]"
            >
              Clear filters
            </button>
            <button
              onClick={() => void handleMarkAll()}
              disabled={markingAll || unreadCount === 0}
              className="rounded-lg bg-[#4F6B4A] disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-[#3F5A3A] transition-colors px-3 py-1.5 text-xs font-semibold text-white"
            >
              {markingAll ? "Marking…" : "Mark all as read"}
            </button>
          </>
        }
      />

      <div className="mx-auto max-w-3xl px-6 py-5">
        {/* Tabs + type filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="inline-flex rounded-lg border border-[#E6ECE2] bg-white p-0.5">
            {(["all", "unread"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTab(tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === tab
                    ? "bg-[#E6ECE2] text-[#333333]"
                    : "text-[#666666] hover:text-[#333333]"
                }`}
              >
                {tab === "all" ? "All" : "Unread"}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-[#666666]">
            <span className="font-medium">Type</span>
            <select
              value={filters.type ?? ""}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="rounded-lg border border-[#E6ECE2] bg-white px-2.5 py-1.5 text-xs text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]"
            >
              <option value="">All types</option>
              {NOTIFICATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {notificationTypeLabel(t)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {actionError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {actionError}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
            <button
              onClick={() => void refresh()}
              className="ml-2 font-semibold underline hover:text-red-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* List */}
        {loading && notifications.length === 0 ? (
          <NotificationListSkeleton />
        ) : notifications.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#E6ECE2] bg-white px-6 py-12 text-center">
            <p className="text-sm font-semibold text-[#333333]">
              {activeTab === "unread" ? "No unread notifications" : "No notifications"}
            </p>
            <p className="text-xs text-[#999999] mt-1">
              New activity will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => {
              const unread = !n.isRead;
              const busy = markingId === n.id;
              return (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 rounded-lg border bg-white p-4 ${
                    unread ? "border-[#C6D4BF] bg-[#FBFDF9]" : "border-[#E6ECE2]"
                  }`}
                >
                  <span className="mt-1">
                    <SeverityDot severity={n.severity} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p
                        className={`text-sm leading-snug text-[#333333] ${
                          unread ? "font-semibold" : "font-medium"
                        }`}
                      >
                        {n.title}
                      </p>
                      <span className="text-[10px] text-[#999999] whitespace-nowrap flex-shrink-0">
                        {formatNotificationTime(n.createdAt)}
                      </span>
                    </div>
                    {n.message && (
                      <p className="text-xs text-[#666666] mt-1 leading-relaxed">{n.message}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="rounded-full bg-[#E6ECE2] px-2 py-0.5 text-[10px] font-semibold text-[#4F6B4A]">
                        {notificationTypeLabel(n.type)}
                      </span>
                      {unread && (
                        <button
                          onClick={() => void handleMarkOne(n.id)}
                          disabled={busy}
                          className="text-[10px] font-semibold text-[#7A9076] hover:underline disabled:opacity-50"
                        >
                          {busy ? "Updating…" : "Mark as read"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination */}
        {!loading && notifications.length > 0 && totalPages > 1 && (
          <div className="mt-5 flex items-center justify-between">
            <button
              onClick={() => goToPage(meta.page - 1)}
              disabled={meta.page <= 1}
              className="rounded-lg border border-[#E6ECE2] bg-white px-3 py-1.5 text-xs font-semibold text-[#333333] disabled:opacity-40 hover:bg-[#F5F5F0]"
            >
              Previous
            </button>
            <span className="text-xs text-[#666666]">
              Page {meta.page} of {totalPages}
            </span>
            <button
              onClick={() => goToPage(meta.page + 1)}
              disabled={meta.page >= totalPages}
              className="rounded-lg border border-[#E6ECE2] bg-white px-3 py-1.5 text-xs font-semibold text-[#333333] disabled:opacity-40 hover:bg-[#F5F5F0]"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}