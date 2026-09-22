import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Calculator,
  ClipboardList,
  FileText,
  Package,
  PackageCheck,
  PackageX,
  Receipt,
  ShoppingCart,
  Truck,
  Wallet,
} from "lucide-react";
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
} from "../features/dashboard/dashboardApi";

// ── Small building blocks ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-[11px] font-bold text-[#666666] uppercase tracking-[0.14em] whitespace-nowrap">
        {children}
      </p>
      <span className="h-px flex-1 bg-[#E6ECE2]" aria-hidden />
    </div>
  );
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E6ECE2] p-6 shadow-[0_1px_2px_rgba(51,51,51,0.04)]">
      <div className="flex flex-col items-center justify-center py-6 gap-4">
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">{message}</p>
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </div>
  );
}

/** Neutral card shell shared by every operational panel. */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-[#E6ECE2] shadow-[0_1px_2px_rgba(51,51,51,0.04)] overflow-hidden ${className}`}
    >
      {children}
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

/** Skeleton that keeps the panel header so layout height stays stable. */
function PanelCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <div className="px-5 py-4 border-b border-[#E6ECE2]">
        <div className="h-3.5 w-28 rounded bg-[#E6ECE2]/60 animate-pulse" />
      </div>
      <PanelSkeleton rows={rows} />
    </Card>
  );
}

function CompactEmpty({ text }: { text: string }) {
  return (
    <div className="px-5 py-9 flex flex-col items-center gap-2 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F4F6F3] text-[#666666]/70">
        <Package className="h-4 w-4" aria-hidden />
      </span>
      <p className="text-sm text-[#666666]">{text}</p>
    </div>
  );
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
      <div className="flex items-center gap-2 min-w-0">
        <h3 className="text-sm font-bold text-[#333333] truncate">{title}</h3>
        {typeof count === "number" && count > 0 && (
          <span className="rounded-lg bg-accent-tint px-2 py-0.5 text-[11px] font-bold text-accent border border-accent-border">
            {count}
          </span>
        )}
      </div>
      {viewAllTo && (
        <Link
          to={viewAllTo}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#7A9076] hover:text-[#4F6B4A] transition-colors whitespace-nowrap"
        >
          {viewAllLabel}
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      )}
    </div>
  );
}

const rowClass =
  "w-full text-left px-5 py-3.5 hover:bg-[#E6ECE2]/30 transition-colors border-b border-[#E6ECE2] last:border-b-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6C8AF]";

// ── Business snapshot (stat cards) ───────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  caption,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="group bg-white rounded-2xl border border-accent-border p-5 shadow-[0_1px_2px_rgba(51,51,51,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(73,176,193,0.15)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">{label}</p>
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-tint text-accent transition-transform duration-200 group-hover:scale-105">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-[#333333] tracking-tight leading-tight">{value}</p>
      <p className="mt-1 text-[11px] text-[#666666]/80">{caption}</p>
    </div>
  );
}

// ── Needs attention (compact tiles) ──────────────────────────────────────────

type AttentionTone = "critical" | "warning" | "info" | "quiet";

const ATTENTION_TONE: Record<AttentionTone, { tile: string; value: string }> = {
  critical: { tile: "bg-red-50 text-red-600", value: "text-red-600" },
  warning: { tile: "bg-amber-50 text-amber-600", value: "text-amber-600" },
  info: { tile: "bg-accent-tint text-accent", value: "text-[#333333]" },
  quiet: { tile: "bg-[#F4F6F3] text-[#666666]", value: "text-[#333333]" },
};

function AttentionTile({
  icon,
  label,
  count,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: AttentionTone;
}) {
  const t = ATTENTION_TONE[tone];
  const quiet = tone === "quiet";
  return (
    <div
      className={`rounded-xl border px-4 py-3.5 transition-colors ${
        quiet ? "border-[#E6ECE2] bg-white" : "border-[#E6ECE2] bg-[#FCFDFB]"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.tile}`}>{icon}</span>
        <p className="text-xs font-medium text-[#666666] leading-tight">{label}</p>
      </div>
      <p className={`mt-2 text-xl font-bold leading-none ${quiet && count === 0 ? "text-[#333333]/45" : t.value}`}>
        {fmtNumber(count)}
      </p>
    </div>
  );
}

// ── Helpers for display-only emphasis (values come straight from the API) ───

/** Whole days until an ISO date; null when the date is missing/invalid. */
function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (isNaN(time)) return null;
  return Math.ceil((time - Date.now()) / 86_400_000);
}

// ── Recent activity (timeline) ───────────────────────────────────────────────

const ACTIVITY_META: Record<string, { icon: React.ReactNode; tile: string }> = {
  SALE_COMPLETED: { icon: <Receipt className="h-4 w-4" />, tile: "bg-green-50 text-green-600" },
  GOODS_RECEIVED: { icon: <PackageCheck className="h-4 w-4" />, tile: "bg-accent-tint text-accent" },
  PURCHASE_ORDER_CREATED: { icon: <FileText className="h-4 w-4" />, tile: "bg-blue-50 text-blue-600" },
};

const ACTIVITY_FALLBACK = { icon: <Package className="h-4 w-4" />, tile: "bg-[#F4F6F3] text-[#666666]" };

function ActivityRow({ item, isLast }: { item: RecentActivityItem; isLast: boolean }) {
  const meta = ACTIVITY_META[item.type] ?? ACTIVITY_FALLBACK;
  return (
    <li className="flex gap-3 px-5 py-3" title={fmtDateTime(item.createdAt)}>
      <div className="flex flex-col items-center flex-shrink-0">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.tile}`} aria-hidden>
          {meta.icon}
        </span>
        {!isLast && <span className="w-px flex-1 my-1 bg-[#E6ECE2]" aria-hidden />}
      </div>
      <div className={`flex-1 min-w-0 flex items-start justify-between gap-3 ${isLast ? "" : "pb-1"}`}>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#333333] truncate">{item.description}</p>
          {item.reference && (
            <p className="mt-1 inline-block max-w-full truncate rounded-md bg-[#E6ECE2]/60 px-1.5 py-0.5 text-[11px] font-medium text-[#666666]">
              {item.reference}
            </p>
          )}
        </div>
        <p className="text-xs text-[#666666] whitespace-nowrap">{timeAgo(item.createdAt)}</p>
      </div>
    </li>
  );
}

// ── Quick actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "New Sale", caption: "Open point of sale", to: "/pos", icon: <ShoppingCart className="h-5 w-5" /> },
  { label: "Purchase Requirement", caption: "Create a requirement", to: "/purchasing/requirements/new", icon: <ClipboardList className="h-5 w-5" /> },
  { label: "New Purchase Order", caption: "Create a purchase order", to: "/purchasing/orders/new", icon: <FileText className="h-5 w-5" /> },
  { label: "Receive Goods", caption: "Register a delivery", to: "/purchasing/deliveries/new", icon: <PackageCheck className="h-5 w-5" /> },
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
        { label: "Today's Sales", value: fmtMoney(summary.sales.today), caption: "Recorded today", icon: <Wallet className="h-5 w-5" /> },
        { label: "Transactions", value: fmtNumber(summary.sales.transactions), caption: "Sales today", icon: <Receipt className="h-5 w-5" /> },
        { label: "Average Transaction", value: fmtMoney(summary.sales.averageTransaction), caption: "Per transaction", icon: <Calculator className="h-5 w-5" /> },
        { label: "Stock Value", value: fmtMoney(summary.inventory.stockValue), caption: "Value on hand", icon: <Boxes className="h-5 w-5" /> },
      ]
    : [];

  const attentionCounts = {
    lowStock: summary?.inventory.lowStockCount ?? (attention?.lowStock.length ?? 0),
    expiring: summary?.inventory.expiringSoonCount ?? (attention?.expiringSoon.length ?? 0),
    awaiting: summary?.purchasing.awaitingDelivery ?? (attention?.awaitingDelivery.length ?? 0),
    invoices: summary?.purchasing.outstandingInvoices ?? (attention?.outstandingInvoices.length ?? 0),
  };

  const attentionTiles = summary
    ? [
        {
          label: "Out of stock",
          count: summary.inventory.outOfStockCount,
          icon: <PackageX className="h-4 w-4" />,
          tone: (summary.inventory.outOfStockCount > 0 ? "critical" : "quiet") as AttentionTone,
        },
        {
          label: "Expired",
          count: summary.inventory.expiredCount,
          icon: <AlertTriangle className="h-4 w-4" />,
          tone: (summary.inventory.expiredCount > 0 ? "critical" : "quiet") as AttentionTone,
        },
        {
          label: "Open requirements",
          count: summary.purchasing.openRequirements,
          icon: <ClipboardList className="h-4 w-4" />,
          tone: (summary.purchasing.openRequirements > 0 ? "info" : "quiet") as AttentionTone,
        },
        {
          label: "Partially received",
          count: summary.purchasing.partiallyReceived,
          icon: <Truck className="h-4 w-4" />,
          tone: (summary.purchasing.partiallyReceived > 0 ? "warning" : "quiet") as AttentionTone,
        },
        {
          label: "Slow-moving flagged",
          count: summary.slowMoving.flaggedCount,
          icon: <Package className="h-4 w-4" />,
          tone: (summary.slowMoving.flaggedCount > 0 ? "warning" : "quiet") as AttentionTone,
        },
      ]
    : [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of today's activity and items needing care."
        actions={
          <Button variant="secondary" onClick={() => setRefreshKey((k) => k + 1)} disabled={refreshing} loading={refreshing}>
            Refresh
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-7">
        {/* Level 2 — Business Snapshot */}
        <section aria-label="Business snapshot" className="flex flex-col gap-3">
          <SectionLabel>Business Snapshot</SectionLabel>
          {summaryLoading ? (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-accent-border p-5">
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
                <StatCard key={m.label} icon={m.icon} label={m.label} value={m.value} caption={m.caption} />
              ))}
            </div>
          )}
        </section>

        {/* Level 3 — Needs Attention */}
        <section aria-label="Needs attention" className="flex flex-col gap-3">
          <SectionLabel>Needs Attention</SectionLabel>
          {summaryLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="rounded-xl border border-[#E6ECE2] bg-white px-4 py-3.5">
                  <div className="h-3 w-24 rounded bg-[#E6ECE2]/60 animate-pulse" />
                  <div className="h-6 w-10 rounded bg-[#E6ECE2]/40 animate-pulse mt-3" />
                </div>
              ))}
            </div>
          ) : summary && attentionTiles.length > 0 ? (
            <Card className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {attentionTiles.map((t) => (
                  <AttentionTile key={t.label} icon={t.icon} label={t.label} count={t.count} tone={t.tone} />
                ))}
              </div>
            </Card>
          ) : null}
        </section>

        {/* Level 4 — Operational information (two columns) */}
        <section aria-label="Operational information" className="flex flex-col gap-3">
          <SectionLabel>Operational Overview</SectionLabel>
          {attentionLoading ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              <div className="flex flex-col gap-4">
                <PanelCardSkeleton rows={3} />
                <PanelCardSkeleton rows={3} />
              </div>
              <div className="flex flex-col gap-4">
                <PanelCardSkeleton rows={3} />
                <PanelCardSkeleton rows={3} />
              </div>
            </div>
          ) : attentionError && !attention ? (
            <SectionError message={attentionError} onRetry={loadAttention} />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              {/* LEFT — Low Stock + Expiring Soon */}
              <div className="flex flex-col gap-4">
                <Card>
                  <PanelHeader title="Low Stock" count={attentionCounts.lowStock} viewAllTo="/inventory/stock" />
                  {attention && attention.lowStock.length > 0 ? (
                    <div className="divide-y divide-[#E6ECE2]">
                      {attention.lowStock.map((item) => {
                        const ratio =
                          item.reorderPoint > 0
                            ? Math.min(1, Math.max(0, item.availableStock / item.reorderPoint))
                            : null;
                        const critical = ratio !== null && ratio <= 0.05;
                        const warning = ratio !== null && !critical && ratio < 0.3;
                        const bar = critical ? "bg-red-500" : warning ? "bg-amber-400" : "bg-[#7A9076]";
                        return (
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
                                <p className={`text-sm font-bold ${critical ? "text-red-600" : "text-[#333333]"}`}>
                                  {fmtNumber(item.availableStock)}{" "}
                                  <span className="text-xs font-medium text-[#666666]">/ {fmtNumber(item.reorderPoint)}</span>
                                </p>
                                <p className="text-[11px] text-[#666666]">of reorder point</p>
                              </div>
                            </div>
                            {ratio !== null && (
                              <div className="mt-2.5 h-1.5 w-full rounded-full bg-[#E6ECE2] overflow-hidden" aria-hidden>
                                <div
                                  className={`h-full rounded-full ${bar}`}
                                  style={{ width: `${(ratio * 100).toFixed(1)}%` }}
                                />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : attention ? (
                    <CompactEmpty text="No low-stock products" />
                  ) : null}
                </Card>

                <Card>
                  <PanelHeader title="Expiring Soon" count={attentionCounts.expiring} viewAllTo="/inventory/batches-expiry" />
                  {attention && attention.expiringSoon.length > 0 ? (
                    <div className="divide-y divide-[#E6ECE2]">
                      {attention.expiringSoon.map((item) => {
                        const days = daysUntil(item.expiryDate);
                        const urgent = days !== null && days <= 7;
                        const soon = days !== null && !urgent && days <= 30;
                        const dateClass = urgent ? "text-red-600" : soon ? "text-amber-600" : "text-[#333333]";
                        return (
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
                                <p className={`text-sm font-bold ${dateClass}`}>{fmtDate(item.expiryDate)}</p>
                                <p className="text-[11px] text-[#666666]">{fmtNumber(item.remainingQuantity)} units remaining</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : attention ? (
                    <CompactEmpty text="No batches expiring soon" />
                  ) : null}
                </Card>
              </div>

              {/* RIGHT — Awaiting Delivery + Outstanding Invoices */}
              <div className="flex flex-col gap-4">
                <Card>
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
                            <p
                              className={`text-xs whitespace-nowrap ${
                                item.expectedDeliveryDate ? "text-[#666666]" : "text-[#666666]/60 italic"
                              }`}
                            >
                              {item.expectedDeliveryDate
                                ? `Expected ${fmtDate(item.expectedDeliveryDate)}`
                                : "Delivery date not set"}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : attention ? (
                    <CompactEmpty text="No deliveries awaiting receipt" />
                  ) : null}
                </Card>

                <Card>
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
                              <p className="text-base font-bold text-[#333333]">{fmtMoney(item.outstandingBalance)}</p>
                              <p className="text-[11px] text-[#666666]">
                                {item.dueDate ? `Due ${fmtDate(item.dueDate)}` : "Due date not set"}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : attention ? (
                    <CompactEmpty text="No outstanding invoices" />
                  ) : null}
                </Card>
              </div>
            </div>
          )}
        </section>

        {/* Level 5 — Recent Activity (full width feed) */}
        <section aria-label="Recent activity" className="flex flex-col gap-3">
          <SectionLabel>Recent Activity</SectionLabel>
          <Card>
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
              <ul className="py-1">
                {recent.map((item, i) => (
                  <ActivityRow
                    key={`${item.type}-${item.reference}-${i}`}
                    item={item}
                    isLast={i === recent.length - 1}
                  />
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* Level 6 — Quick Actions */}
        <section aria-label="Quick actions" className="flex flex-col gap-3">
          <SectionLabel>Quick Actions</SectionLabel>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.label}
                onClick={() => navigate(a.to)}
                className="group bg-white rounded-2xl border border-[#E6ECE2] p-5 text-left shadow-[0_1px_2px_rgba(51,51,51,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-[0_8px_20px_rgba(51,51,51,0.07)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6C8AF]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F4F6F3] text-[#4F6B4A] transition-colors duration-200 group-hover:bg-accent-tint group-hover:text-accent">
                    {a.icon}
                  </span>
                  <ArrowRight
                    className="h-4 w-4 text-[#666666]/50 transition-all duration-200 group-hover:translate-x-1 group-hover:text-accent"
                    aria-hidden
                  />
                </div>
                <p className="mt-4 text-sm font-bold text-[#333333]">{a.label}</p>
                <p className="mt-0.5 text-xs text-[#666666]">{a.caption}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
