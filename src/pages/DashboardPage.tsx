import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import { fmtMoney, fmtNumber, fmtDate, fmtDateTime, timeAgo } from "../utils/format";
import {
  getDashboardSummary,
  getDashboardAttention,
  getDashboardRecentActivity,
  DashboardApiError,
  type DashboardSummary,
  type DashboardAttention,
  type RecentActivityItem,
  type RecentActivityType,
} from "../features/dashboard/dashboardApi";

// ── Small building blocks ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold text-[#666666] uppercase tracking-widest">{children}</p>
  );
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-[#E6ECE2] p-6">
      <div className="flex flex-col items-center justify-center py-6 gap-4">
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">{message}</p>
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </div>
  );
}

function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="px-5 py-4 flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 rounded-lg bg-[#E6ECE2]/50 animate-pulse" />
      ))}
    </div>
  );
}

function CompactEmpty({ text }: { text: string }) {
  return <p className="px-5 py-9 text-center text-sm text-[#666666]">{text}</p>;
}

function PanelHeader({
  title,
  count,
  viewAllTo,
  viewAllLabel = "View All",
}: {
  title: string;
  count?: number;
  viewAllTo?: string;
  viewAllLabel?: string;
}) {
  return (
    <div className="px-5 py-4 border-b border-[#E6ECE2] flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-[#333333]">{title}</h3>
        {typeof count === "number" && count > 0 && (
          <span className="rounded-full bg-[#E6ECE2] px-2 py-0.5 text-[11px] font-bold text-[#7A9076]">
            {count}
          </span>
        )}
      </div>
      {viewAllTo && (
        <Link to={viewAllTo} className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap">
          {viewAllLabel}
        </Link>
      )}
    </div>
  );
}

const rowClass =
  "w-full text-left px-5 py-3.5 hover:bg-[#E6ECE2]/30 transition-colors border-b border-[#E6ECE2] last:border-b-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6C8AF]";

// ── Recent activity ──────────────────────────────────────────────────────────

const ACTIVITY_DOT: Record<string, string> = {
  SALE_COMPLETED: "bg-green-500",
  GOODS_RECEIVED: "bg-[#B6C8AF]",
  PURCHASE_ORDER_CREATED: "bg-blue-500",
};

function ActivityRow({ item, index }: { item: RecentActivityItem; index: number }) {
  const dot = ACTIVITY_DOT[item.type] ?? "bg-gray-400";
  return (
    <li
      className={`flex items-center gap-3 px-5 py-3.5 ${index % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/15"}`}
      title={fmtDateTime(item.createdAt)}
    >
      <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${dot}`} aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#333333] truncate">{item.description}</p>
        {item.reference && <p className="text-xs text-[#666666]">{item.reference}</p>}
      </div>
      <p className="text-xs text-[#666666] whitespace-nowrap">{timeAgo(item.createdAt)}</p>
    </li>
  );
}

// ── Quick actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "New Sale", caption: "Open point of sale", to: "/pos" },
  { label: "Purchase Requirement", caption: "Create a requirement", to: "/purchasing/requirements/new" },
  { label: "New Purchase Order", caption: "Create a purchase order", to: "/purchasing/orders/new" },
  { label: "Receive Goods", caption: "Register a delivery", to: "/purchasing/deliveries/new" },
];

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [attention, setAttention] = useState<DashboardAttention | null>(null);
  const [attentionLoading, setAttentionLoading] = useState(true);
  const [attentionError, setAttentionError] = useState<string | null>(null);

  const [recent, setRecent] = useState<RecentActivityItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      setSummary(await getDashboardSummary());
    } catch (e) {
      setSummaryError(e instanceof DashboardApiError ? e.message : "Failed to load summary.");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadAttention = useCallback(async () => {
    setAttentionLoading(true);
    setAttentionError(null);
    try {
      setAttention(await getDashboardAttention());
    } catch (e) {
      setAttentionError(e instanceof DashboardApiError ? e.message : "Failed to load attention items.");
    } finally {
      setAttentionLoading(false);
    }
  }, []);

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    setRecentError(null);
    try {
      setRecent(await getDashboardRecentActivity());
    } catch (e) {
      setRecentError(e instanceof DashboardApiError ? e.message : "Failed to load recent activity.");
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    loadAttention();
    loadRecent();
  }, [refreshKey, loadSummary, loadAttention, loadRecent]);

  const refreshing = summaryLoading || attentionLoading || recentLoading;

  const snapshotMetrics = summary
    ? [
        { label: "Today's Sales", value: fmtMoney(summary.sales.today) },
        { label: "Transactions", value: fmtNumber(summary.sales.transactions) },
        { label: "Average Transaction", value: fmtMoney(summary.sales.averageTransaction) },
        { label: "Stock Value", value: fmtMoney(summary.inventory.stockValue) },
      ]
    : [];

  const attentionCounts = {
    lowStock: summary?.inventory.lowStockCount ?? (attention?.lowStock.length ?? 0),
    expiring: summary?.inventory.expiringSoonCount ?? (attention?.expiringSoon.length ?? 0),
    awaiting: summary?.purchasing.awaitingDelivery ?? (attention?.awaitingDelivery.length ?? 0),
    invoices: summary?.purchasing.outstandingInvoices ?? (attention?.outstandingInvoices.length ?? 0),
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Dashboard"
        title="Dashboard"
        subtitle="Overview of today's activity and items needing care."
        actions={
          <Button variant="secondary" onClick={() => setRefreshKey((k) => k + 1)} disabled={refreshing} loading={refreshing}>
            Refresh
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Level 1 — Business Snapshot */}
        <section aria-label="Business snapshot" className="flex flex-col gap-3">
          <SectionLabel>Business Snapshot</SectionLabel>
          {summaryLoading ? (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#E6ECE2] p-5">
                  <div className="h-3 w-20 rounded bg-[#E6ECE2]/60 animate-pulse" />
                  <div className="h-8 w-28 rounded bg-[#E6ECE2]/40 animate-pulse mt-3" />
                </div>
              ))}
            </div>
          ) : summaryError && !summary ? (
            <SectionError message={summaryError} onRetry={loadSummary} />
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {snapshotMetrics.map((m) => (
                <div key={m.label} className="bg-white rounded-xl border border-[#E6ECE2] p-5">
                  <p className="text-xs font-medium text-[#666666]">{m.label}</p>
                  <p className="text-2xl font-bold text-[#333333] mt-1 leading-tight">{m.value}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Level 2 — Needs Attention */}
        <section aria-label="Needs attention" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <SectionLabel>Needs Attention</SectionLabel>
            {summary && !summaryLoading && (
              <p className="text-xs text-[#666666] flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>Out of stock <span className="font-semibold text-[#333333]">{fmtNumber(summary.inventory.outOfStockCount)}</span></span>
                <span>Expired <span className="font-semibold text-[#333333]">{fmtNumber(summary.inventory.expiredCount)}</span></span>
                <span>Open requirements <span className="font-semibold text-[#333333]">{fmtNumber(summary.purchasing.openRequirements)}</span></span>
                <span>Partially received <span className="font-semibold text-[#333333]">{fmtNumber(summary.purchasing.partiallyReceived)}</span></span>
                <span>Slow-moving flagged <span className="font-semibold text-[#333333]">{fmtNumber(summary.slowMoving.flaggedCount)}</span></span>
              </p>
            )}
          </div>
          {attentionLoading ? (
            <div className="grid md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E6ECE2]">
                    <div className="h-3 w-24 rounded bg-[#E6ECE2]/60 animate-pulse" />
                  </div>
                  <PanelSkeleton rows={3} />
                </div>
              ))}
            </div>
          ) : attentionError && !attention ? (
            <SectionError message={attentionError} onRetry={loadAttention} />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Low Stock */}
              <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
                <PanelHeader title="Low Stock" count={attentionCounts.lowStock} viewAllTo="/inventory/stock" />
                {attention && attention.lowStock.length > 0 ? (
                  <div className="divide-y divide-[#E6ECE2]">
                    {attention.lowStock.map((item) => (
                      <button
                        key={item.productId}
                        className={rowClass}
                        onClick={() => navigate(`/inventory/products/${item.productId}`)}
                        title={`Open product: ${item.productName}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#333333] truncate">{item.productName}</p>
                            <p className="text-xs text-[#666666]">{item.sku}</p>
                          </div>
                          <div className="text-right whitespace-nowrap">
                            <p className="text-sm font-bold text-[#333333]">
                              {fmtNumber(item.availableStock)} <span className="text-xs font-medium text-[#666666]">/ {fmtNumber(item.reorderPoint)}</span>
                            </p>
                            <p className="text-[11px] text-[#666666]">of reorder point</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : attention ? (
                  <CompactEmpty text="No low-stock products" />
                ) : null}
              </div>

              {/* Expiring Soon */}
              <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
                <PanelHeader title="Expiring Soon" count={attentionCounts.expiring} viewAllTo="/inventory/batches-expiry" />
                {attention && attention.expiringSoon.length > 0 ? (
                  <div className="divide-y divide-[#E6ECE2]">
                    {attention.expiringSoon.map((item) => (
                      <button
                        key={item.batchId}
                        className={rowClass}
                        onClick={() => navigate(`/inventory/batches/${item.batchId}`)}
                        title={`Open batch: ${item.batchNumber}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#333333] truncate">{item.productName}</p>
                            <p className="text-xs text-[#666666]">Batch {item.batchNumber}</p>
                          </div>
                          <div className="text-right whitespace-nowrap">
                            <p className="text-sm font-bold text-[#333333]">{fmtDate(item.expiryDate)}</p>
                            <p className="text-[11px] text-[#666666]">{fmtNumber(item.remainingQuantity)} units remaining</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : attention ? (
                  <CompactEmpty text="No batches expiring soon" />
                ) : null}
              </div>

              {/* Awaiting Delivery */}
              <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
                <PanelHeader title="Awaiting Delivery" count={attentionCounts.awaiting} viewAllTo="/purchasing/deliveries" />
                {attention && attention.awaitingDelivery.length > 0 ? (
                  <div className="divide-y divide-[#E6ECE2]">
                    {attention.awaitingDelivery.map((item) => (
                      <button
                        key={item.purchaseOrderId}
                        className={rowClass}
                        onClick={() => navigate(`/purchasing/orders/${item.purchaseOrderId}`)}
                        title={`Open purchase order: ${item.poNumber}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#7A9076]">{item.poNumber}</p>
                            <p className="text-xs text-[#666666] truncate">{item.supplierName}</p>
                          </div>
                          <p className="text-xs text-[#666666] whitespace-nowrap">
                            {item.expectedDeliveryDate ? `Expected ${fmtDate(item.expectedDeliveryDate)}` : "Delivery date not set"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : attention ? (
                  <CompactEmpty text="No deliveries awaiting receipt" />
                ) : null}
              </div>

              {/* Outstanding Invoices */}
              <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
                <PanelHeader title="Outstanding Invoices" count={attentionCounts.invoices} viewAllTo="/purchasing/invoices" />
                {attention && attention.outstandingInvoices.length > 0 ? (
                  <div className="divide-y divide-[#E6ECE2]">
                    {attention.outstandingInvoices.map((item) => (
                      <button
                        key={item.invoiceId}
                        className={rowClass}
                        onClick={() => navigate(`/purchasing/invoices/${item.invoiceId}`)}
                        title={`Open invoice: ${item.invoiceNumber}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#7A9076]">{item.invoiceNumber}</p>
                            <p className="text-xs text-[#666666] truncate">{item.supplierName}</p>
                          </div>
                          <div className="text-right whitespace-nowrap">
                            <p className="text-sm font-bold text-[#333333]">{fmtMoney(item.outstandingBalance)}</p>
                            <p className="text-[11px] text-[#666666]">{item.dueDate ? `Due ${fmtDate(item.dueDate)}` : "Due date not set"}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : attention ? (
                  <CompactEmpty text="No outstanding invoices" />
                ) : null}
              </div>
            </div>
          )}
        </section>

        {/* Level 3 — Recent Activity */}
        <section aria-label="Recent activity" className="flex flex-col gap-3">
          <SectionLabel>Recent Activity</SectionLabel>
          <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
            {recentLoading ? (
              <PanelSkeleton rows={5} />
            ) : recentError ? (
              <div className="p-4">
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">{recentError}</p>
                <div className="flex justify-center mt-3">
                  <Button onClick={loadRecent}>Retry</Button>
                </div>
              </div>
            ) : recent.length === 0 ? (
              <CompactEmpty text="No recent activity" />
            ) : (
              <ul className="divide-y divide-[#E6ECE2]">
                {recent.map((item, i) => (
                  <ActivityRow key={`${item.type}-${item.reference}-${i}`} item={item} index={i} />
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Level 4 — Quick Actions */}
        <section aria-label="Quick actions" className="flex flex-col gap-3">
          <SectionLabel>Quick Actions</SectionLabel>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.label}
                onClick={() => navigate(a.to)}
                className="bg-white rounded-xl border border-[#E6ECE2] px-5 py-4 text-left transition-colors hover:bg-[#E6ECE2]/40 hover:border-[#C6D4BF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6C8AF]"
              >
                <p className="text-sm font-bold text-[#333333]">{a.label}</p>
                <p className="text-xs text-[#666666] mt-1">{a.caption}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}