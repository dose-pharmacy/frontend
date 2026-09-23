import { useState, useEffect, useCallback } from "react"
import PageHeader from "../components/ui/PageHeader"
import Button from "../components/ui/Button"
import {
  getDashboardSummary,
  getDashboardAttention,
  getDashboardRecentActivity,
  DashboardApiError,
  type DashboardSummary,
  type DashboardAttention,
  type RecentActivityItem,
} from "../features/dashboard/dashboardApi"
import DashboardKpiSection from "./dashboard/DashboardKpiSection"
import OperationalHealth from "./dashboard/OperationalHealth"
import InventoryOverview from "./dashboard/InventoryOverview"
import LowStockPanel from "./dashboard/LowStockPanel"
import ExpiryMonitor from "./dashboard/ExpiryMonitor"
import AwaitingDelivery from "./dashboard/AwaitingDelivery"
import OutstandingInvoices from "./dashboard/OutstandingInvoices"
import RecentActivityTimeline from "./dashboard/RecentActivityTimeline"
import QuickActions from "./dashboard/QuickActions"

// ── Dashboard ────────────────────────────────────────────────────────────────
// Data loading is unchanged: the same three endpoints, the same state, the
// same Refresh trigger. Only the presentation lives in ./dashboard/*.

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const [attention, setAttention] = useState<DashboardAttention | null>(null)
  const [attentionLoading, setAttentionLoading] = useState(true)
  const [attentionError, setAttentionError] = useState<string | null>(null)

  const [recent, setRecent] = useState<RecentActivityItem[]>([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [recentError, setRecentError] = useState<string | null>(null)

  const [refreshKey, setRefreshKey] = useState(0)

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      setSummary(await getDashboardSummary())
    } catch (e) {
      setSummaryError(
        e instanceof DashboardApiError ? e.message : "Failed to load summary.",
      )
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  const loadAttention = useCallback(async () => {
    setAttentionLoading(true)
    setAttentionError(null)
    try {
      setAttention(await getDashboardAttention())
    } catch (e) {
      setAttentionError(
        e instanceof DashboardApiError
          ? e.message
          : "Failed to load attention items.",
      )
    } finally {
      setAttentionLoading(false)
    }
  }, [])

  const loadRecent = useCallback(async () => {
    setRecentLoading(true)
    setRecentError(null)
    try {
      setRecent(await getDashboardRecentActivity())
    } catch (e) {
      setRecentError(
        e instanceof DashboardApiError
          ? e.message
          : "Failed to load recent activity.",
      )
    } finally {
      setRecentLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSummary()
    loadAttention()
    loadRecent()
  }, [refreshKey, loadSummary, loadAttention, loadRecent])

  const refreshing = summaryLoading || attentionLoading || recentLoading

  const attentionCounts = {
    lowStock:
      summary?.inventory.lowStockCount ?? attention?.lowStock.length ?? 0,
    expiring:
      summary?.inventory.expiringSoonCount ??
      attention?.expiringSoon.length ?? 0,
    awaiting:
      summary?.purchasing.awaitingDelivery ??
      attention?.awaitingDelivery.length ?? 0,
    invoices:
      summary?.purchasing.outstandingInvoices ??
      attention?.outstandingInvoices.length ?? 0,
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Dashboard"
        title="Dashboard"
        subtitle="Overview of today's activity and items needing care."
        actions={
          <Button
            variant="secondary"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={refreshing}
            loading={refreshing}
          >
            Refresh
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* 1 — Business performance */}
        <DashboardKpiSection
          summary={summary}
          loading={summaryLoading}
          error={summaryError}
          onRetry={loadSummary}
        />

        {/* 2 — Operational health */}
        <OperationalHealth
          summary={summary}
          loading={summaryLoading}
          error={summaryError}
          onRetry={loadSummary}
        />

        {/* 3 — Inventory overview + expiry monitor */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <InventoryOverview
            summary={summary}
            loading={summaryLoading}
            error={summaryError}
            onRetry={loadSummary}
          />
          <ExpiryMonitor
            attention={attention}
            count={attentionCounts.expiring}
            loading={attentionLoading}
            error={attentionError}
            onRetry={loadAttention}
          />
        </div>

        {/* 4 — Low stock */}
        <LowStockPanel
          attention={attention}
          count={attentionCounts.lowStock}
          loading={attentionLoading}
          error={attentionError}
          onRetry={loadAttention}
        />

        {/* 5 — Purchasing + financial attention */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-5">
          <AwaitingDelivery
            attention={attention}
            count={attentionCounts.awaiting}
            loading={attentionLoading}
            error={attentionError}
            onRetry={loadAttention}
            className="xl:col-span-3"
          />
          <OutstandingInvoices
            attention={attention}
            count={attentionCounts.invoices}
            loading={attentionLoading}
            error={attentionError}
            onRetry={loadAttention}
            className="xl:col-span-2"
          />
        </div>

        {/* 6 — Recent activity */}
        <RecentActivityTimeline
          items={recent}
          loading={recentLoading}
          error={recentError}
          onRetry={loadRecent}
        />

        {/* 7 — Quick actions */}
        <QuickActions />
      </div>
    </div>
  )
}
