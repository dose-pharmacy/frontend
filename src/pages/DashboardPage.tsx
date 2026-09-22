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
} from "../features/dashboard/dashboardApi";
import DashboardSubNav from "./dashboard/DashboardSubNav";
import ReportFilterBar from "./reports/ReportFilterBar";
import { defaultDateRange } from "./reports/reportHelpers";
import { listLocations } from "../features/inventory/locationsApi";
import {
  getSalesSummary,
  getSalesTrend,
  ReportsApiError,
  type SalesSummaryDto,
  type SalesTrendPeriod,
  type SalesTrendPointDto,
} from "../features/reports/reportsApi";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// ── Icons (small, inline, theme-colored) ─────────────────────────────────────

type IconProps = { className?: string };

function IconCart({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z" />
      <path d="M16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
    </svg>
  );
}

function IconBox({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
    </svg>
  );
}

function IconReceipt({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconChart({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  );
}

function IconTrend({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconTruck({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h3.05a2.5 2.5 0 014.9 0H19a1 1 0 001-1v-3.414a1 1 0 00-.293-.707l-2.586-2.586A1 1 0 0016.414 7H15V5a1 1 0 00-1-1H3z" />
    </svg>
  );
}

function IconClipboard({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1.5-1.5A1.5 1.5 0 006 2v1h8V2a1.5 1.5 0 00-1.5-1.5h-5zM11 8a1 1 0 100 2h4a1 1 0 100-2h-4zm-4 5a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconDoc({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M11 1.5A1.5 1.5 0 009.5 3v.5H5A2.5 2.5 0 002.5 6v9A2.5 2.5 0 005 17.5h10a2.5 2.5 0 002.5-2.5V6a2.5 2.5 0 00-2.5-2.5h-4.5V3A1.5 1.5 0 0011 1.5zM8 8a1 1 0 100 2h4a1 1 0 100-2H8zm-1 4a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" />
    </svg>
  );
}

function IconArrowUpRight({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconTag({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M1 6.5A3.5 3.5 0 014.5 3h5.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0116 8.622V13.5a3.5 3.5 0 01-3.5 3.5h-6A3.5 3.5 0 013 13.5v-7z" />
    </svg>
  );
}

function IconPercent({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M8.984.974a.75.75 0 00-1.06 0L5.6 3.6a5.854 5.854 0 00-.64.361L2.027.974a.75.75 0 00-1.06 1.06l2.768 2.769-.304.56a5.854 5.854 0 000 5.236l.304.56L.967 13.908a.75.75 0 001.06 1.06l2.768-2.768.56.304a5.854 5.854 0 005.236 0l.56-.304 2.768 2.768a.75.75 0 001.06-1.06l-2.768-2.769.304-.56a5.854 5.854 0 000-5.236l-.304-.56L13.908.967a.75.75 0 00-1.06-1.06l-2.769 2.768-.56-.304a5.854 5.854 0 00-5.236 0l-.56.304L.967 1.703a.75.75 0 00-1.06 1.06zM6.5 4.5a2 2 0 100 4 2 2 0 000-4zm7 5a2 2 0 110 4 2 2 0 010-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold text-[#2A7F8C] uppercase tracking-[0.14em]">
      {children}
    </h2>
  );
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-[#DBEFF3] p-6">
      <div className="flex flex-col items-center justify-center py-6 gap-4">
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">{message}</p>
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </div>
  );
}

function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="px-5 py-6 flex flex-col items-center gap-3">
      <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 text-center">{message}</p>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  );
}

function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="px-5 py-4 flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 rounded-lg bg-[#DBEFF3]/60 animate-pulse" />
      ))}
    </div>
  );
}

function PanelSkeletonBars({ rows = 4 }: { rows?: number }) {
  return (
    <div className="px-5 py-4 flex flex-col gap-5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-3 w-24 rounded bg-[#DBEFF3]/70 animate-pulse" />
          <div className="h-2.5 flex-1 rounded-full bg-[#DBEFF3]/50 animate-pulse" />
          <div className="h-3 w-8 rounded bg-[#DBEFF3]/70 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function CompactEmpty({ text }: { text: string }) {
  return <p className="px-5 py-9 text-center text-sm text-[#666666]">{text}</p>;
}

function DashPanel({
  title,
  count,
  viewAllTo,
  viewAllLabel = "View All",
  children,
  className = "",
}: {
  title: string;
  count?: number;
  viewAllTo?: string;
  viewAllLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-[#DBEFF3] shadow-sm overflow-hidden min-w-0 ${className}`}>
      <div className="px-5 py-4 border-b border-[#DBEFF3] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-bold text-[#333333] truncate">{title}</h3>
          {typeof count === "number" && count > 0 && (
            <span className="rounded-full bg-[#DBEFF3] px-2 py-0.5 text-[11px] font-bold text-[#2A7F8C]">
              {fmtNumber(count)}
            </span>
          )}
        </div>
        {viewAllTo && (
          <Link
            to={viewAllTo}
            className="text-xs font-semibold text-[#49B0C1] hover:underline whitespace-nowrap"
          >
            {viewAllLabel}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#49B0C1]/40 focus-visible:ring-offset-1";

// ── Recent activity ──────────────────────────────────────────────────────────

const ACTIVITY_META: Record<
  string,
  { icon: React.ReactNode; iconColor: string; bubble: string }
> = {
  SALE_COMPLETED: {
    icon: <IconReceipt />,
    iconColor: "text-[#2A7F8C]",
    bubble: "bg-[#DBEFF3]",
  },
  GOODS_RECEIVED: {
    icon: <IconBox />,
    iconColor: "text-[#5C7A52]",
    bubble: "bg-[#E1EAD9]",
  },
  PURCHASE_ORDER_CREATED: {
    icon: <IconDoc />,
    iconColor: "text-[#5A7590]",
    bubble: "bg-[#DFE7ED]",
  },
};

function ActivityRow({ item, index, total }: { item: RecentActivityItem; index: number; total: number }) {
  const meta = ACTIVITY_META[item.type] ?? {
    icon: <IconReceipt />,
    iconColor: "text-[#666666]",
    bubble: "bg-[#E6ECE2]",
  };
  return (
    <li className="relative flex gap-4 py-4">
      <span className="relative z-10 flex-shrink-0">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full ${meta.bubble} ${meta.iconColor}`}
        >
          {meta.icon}
        </span>
        {index < total - 1 && (
          <span className="absolute left-1/2 top-10 -bottom-4 w-px -translate-x-1/2 bg-[#DBEFF3]" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#333333] truncate">{item.description}</p>
          {item.reference && (
            <p className="text-xs font-medium text-[#49B0C1] mt-0.5">{item.reference}</p>
          )}
        </div>
        <p
          className="text-xs text-[#666666] whitespace-nowrap flex-shrink-0"
          title={fmtDateTime(item.createdAt)}
        >
          {timeAgo(item.createdAt)}
        </p>
      </div>
    </li>
  );
}

// ── Quick actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "New Sale", caption: "Open point of sale", icon: <IconCart className="h-5 w-5" />, to: "/pos" },
  { label: "Purchase Requirement", caption: "Create a requirement", icon: <IconClipboard className="h-5 w-5" />, to: "/purchasing/requirements/new" },
  { label: "New Purchase Order", caption: "Create a purchase order", icon: <IconDoc className="h-5 w-5" />, to: "/purchasing/orders/new" },
  { label: "Receive Goods", caption: "Register a delivery", icon: <IconTruck className="h-5 w-5" />, to: "/purchasing/deliveries/new" },
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

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      setSummary(await getDashboardSummary());
      setLastUpdated(new Date());
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
      setLastUpdated(new Date());
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
      setLastUpdated(new Date());
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

  const attentionCounts = {
    lowStock: summary?.inventory.lowStockCount ?? (attention?.lowStock.length ?? 0),
    expiring: summary?.inventory.expiringSoonCount ?? (attention?.expiringSoon.length ?? 0),
    awaiting: summary?.purchasing.awaitingDelivery ?? (attention?.awaitingDelivery.length ?? 0),
    invoices: summary?.purchasing.outstandingInvoices ?? (attention?.outstandingInvoices.length ?? 0),
  };

  // ── Derived presentation for summary-based sections ────────────────────────

  const healthCells = summary
    ? [
        { label: "Out of Stock", count: fmtNumber(summary.inventory.outOfStockCount), caption: "Needs action", dot: "bg-red-500", tint: "bg-red-50/70", border: "border-red-100/90", capColor: "text-red-600" },
        { label: "Expired", count: fmtNumber(summary.inventory.expiredCount), caption: "Critical", dot: "bg-orange-500", tint: "bg-orange-50/70", border: "border-orange-100/90", capColor: "text-orange-600" },
        { label: "Requirements", count: fmtNumber(summary.purchasing.openRequirements), caption: "Open", dot: "bg-blue-500", tint: "bg-blue-50/70", border: "border-blue-100/90", capColor: "text-blue-600" },
        { label: "Awaiting", count: fmtNumber(summary.purchasing.partiallyReceived), caption: "Partial/active", dot: "bg-yellow-500", tint: "bg-yellow-50/70", border: "border-yellow-100/90", capColor: "text-yellow-600" },
        { label: "Slow Moving", count: fmtNumber(summary.slowMoving.flaggedCount), caption: "No flags", dot: "bg-green-500", tint: "bg-green-50/70", border: "border-green-100/90", capColor: "text-green-600" },
      ]
    : [];

  const invBars = summary
    ? [
        { label: "Low Stock", value: summary.inventory.lowStockCount, fill: "bg-yellow-500" },
        { label: "Expiring Soon", value: summary.inventory.expiringSoonCount, fill: "bg-orange-500" },
        { label: "Expired", value: summary.inventory.expiredCount, fill: "bg-red-500" },
        { label: "Out of Stock", value: summary.inventory.outOfStockCount, fill: "bg-red-700" },
      ]
    : [];
  const invMax = Math.max(...invBars.map((b) => b.value), 1);

  const kpiCards = summary
    ? [
        { label: "Stock Value", value: fmtMoney(summary.inventory.stockValue), icon: <IconBox /> },
        { label: "Transactions", value: fmtNumber(summary.sales.transactions), icon: <IconReceipt /> },
        { label: "Average Transaction", value: fmtMoney(summary.sales.averageTransaction), icon: <IconTrend /> },
      ]
    : [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="border-b border-[#DBEFF3] bg-white">
        <PageHeader
          breadcrumb="Dashboard"
          title="Dashboard"
          subtitle="Overview of today's activity and items needing care."
          actions={
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <p className="text-xs text-[#666666]">
                  Last updated{" "}
                  <span className="font-semibold text-[#333333]">
                    {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </p>
              )}
              <Button
                variant="secondary"
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={refreshing}
                loading={refreshing}
                className="!bg-[#49B0C1] !text-white hover:!bg-[#2A7F8C] focus-visible:!ring-[#49B0C1]"
              >
                Refresh
              </Button>
            </div>
          }
        />
      </div>

      <DashboardSubNav />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* ── 2. Business performance ─────────────────────────────────────── */}
        <section aria-label="Business performance" className="flex flex-col gap-3">
          <SectionLabel>Business Performance</SectionLabel>
          {summaryLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
              <div className="md:col-span-2 xl:col-span-3 bg-white rounded-xl border border-[#DBEFF3] p-6">
                <div className="h-3 w-28 rounded bg-[#DBEFF3]/70 animate-pulse" />
                <div className="h-9 w-52 rounded bg-[#DBEFF3]/50 animate-pulse mt-3" />
                <div className="h-12 rounded-lg bg-[#DBEFF3]/40 animate-pulse mt-5" />
              </div>
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#DBEFF3] p-5">
                  <div className="h-3 w-20 rounded bg-[#DBEFF3]/70 animate-pulse" />
                  <div className="h-7 w-28 rounded bg-[#DBEFF3]/50 animate-pulse mt-3" />
                </div>
              ))}
            </div>
          ) : summaryError && !summary ? (
            <SectionError message={summaryError} onRetry={loadSummary} />
          ) : summary ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 items-stretch">
              {/* Hero — Today's Sales */}
              <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-[#ABDBE3] bg-[#DBEFF3]/40 p-5 md:p-6 relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#2A7F8C] uppercase tracking-widest">
                      Today's Sales
                    </p>
                    <p className="text-3xl xl:text-4xl font-bold text-[#2A7F8C] mt-2 leading-tight">
                      {fmtMoney(summary.sales.today)}
                    </p>
                  </div>
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#49B0C1] text-white">
                    <IconChart className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#ABDBE3] pt-4">
                  <div>
                    <p className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">
                      Transactions
                    </p>
                    <p className="text-xl font-bold text-[#333333] mt-0.5">
                      {fmtNumber(summary.sales.transactions)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">
                      Average Transaction
                    </p>
                    <p className="text-xl font-bold text-[#333333] mt-0.5">
                      {fmtMoney(summary.sales.averageTransaction)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Supporting KPIs */}
              {kpiCards.map((k) => (
                <div
                  key={k.label}
                  className="bg-white rounded-xl border border-[#DBEFF3] p-5 flex flex-col justify-between min-w-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#666666]">{k.label}</p>
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#DBEFF3] text-[#2A7F8C]">
                      {k.icon}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-[#333333] mt-3 leading-tight truncate">
                    {k.value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {/* ── 3. Operational health ───────────────────────────────────────── */}
        <section aria-label="Operational health" className="flex flex-col gap-3">
          <DashPanel title="Operational Health">
            {summaryLoading ? (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="h-[104px] rounded-xl bg-[#DBEFF3]/50 animate-pulse" />
                ))}
              </div>
            ) : !summary ? (
              <CompactEmpty text="Operational data unavailable" />
            ) : (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                {healthCells.map((c) => (
                  <div
                    key={c.label}
                    className={`rounded-xl border ${c.border} ${c.tint} p-4 flex flex-col gap-1.5`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden />
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${c.capColor}`}>
                        {c.caption}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-[#333333] leading-none mt-1">{c.count}</p>
                    <p className="text-xs font-semibold text-[#666666]">{c.label}</p>
                  </div>
                ))}
              </div>
            )}
          </DashPanel>
        </section>

        {/* ── 4. Inventory overview + Expiry monitor ──────────────────────── */}
        <div className="grid xl:grid-cols-2 gap-4 items-start">
          <DashPanel title="Inventory Overview">
            {summaryLoading ? (
              <PanelSkeletonBars rows={4} />
            ) : !summary ? (
              <CompactEmpty text="Inventory overview unavailable" />
            ) : (
              <div className="px-5 py-4 flex flex-col gap-5">
                {invBars.map((bar) => (
                  <div key={bar.label}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-[#666666]">{bar.label}</span>
                      <span className="font-bold text-[#2A7F8C]">{fmtNumber(bar.value)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[#DBEFF3] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${bar.fill}`}
                        style={{ width: `${(bar.value / invMax) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashPanel>

          <DashPanel title="Expiry Monitor" count={attentionCounts.expiring} viewAllTo="/inventory/batches-expiry">
            {attentionLoading ? (
              <PanelSkeleton rows={4} />
            ) : attentionError && !attention ? (
              <PanelError message={attentionError} onRetry={loadAttention} />
            ) : attention && attention.expiringSoon.length > 0 ? (
              (() => {
                const sorted = [...attention.expiringSoon].sort(
                  (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
                );
                return (
                  <div className="px-5 py-4">
                    <ol className="relative">
                      {sorted.map((item, i) => (
                        <li
                          key={item.batchId}
                          className={`relative pl-9 ${i < sorted.length - 1 ? "pb-4" : "pb-1"}`}
                        >
                          <span
                            className={`absolute left-[16px] top-[26px] h-3 w-3 rounded-full border-2 ${
                              i === 0
                                ? "bg-[#49B0C1] border-[#49B0C1]"
                                : "bg-white border-[#ABDBE3]"
                            }`}
                            aria-hidden
                          />
                          {i < sorted.length - 1 && (
                            <span
                              className="absolute left-[17px] top-[40px] bottom-1 w-px bg-[#DBEFF3]"
                              aria-hidden
                            />
                          )}
                          <button
                            className={`w-full text-left rounded-xl border border-transparent px-3 py-2.5 hover:bg-[#DBEFF3]/40 hover:border-[#ABDBE3] transition-colors ${focusRing}`}
                            onClick={() => navigate(`/inventory/batches/${item.batchId}`)}
                            title={`Open batch: ${item.batchNumber}`}
                          >
                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className="w-14 flex-shrink-0 text-right">
                                <p className="text-xl font-bold text-[#2A7F8C] leading-none">
                                  {fmtNumber(item.remainingQuantity)}
                                </p>
                                <p className="text-[10px] text-[#999999] uppercase tracking-wide">
                                  units
                                </p>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-[#333333] truncate">
                                  {item.productName}
                                </p>
                                <p className="text-xs text-[#666666]">Batch {item.batchNumber}</p>
                              </div>
                              <div className="flex-shrink-0 text-right">
                                <p
                                  className={`text-sm font-bold ${
                                    i === 0 ? "text-[#2A7F8C]" : "text-[#333333]"
                                  }`}
                                >
                                  {fmtDate(item.expiryDate)}
                                </p>
                                {i === 0 ? (
                                  <p className="text-[10px] font-bold text-[#B06B66] uppercase tracking-wide">
                                    Soonest
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-[#999999]">expiry</p>
                                )}
                              </div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })()
            ) : attention ? (
              <CompactEmpty text="No batches expiring soon" />
            ) : null}
          </DashPanel>
        </div>

        {/* ── 5. Low stock ─────────────────────────────────────────────────── */}
        <DashPanel title="Low Stock" count={attentionCounts.lowStock} viewAllTo="/inventory/stock">
          {attentionLoading ? (
            <PanelSkeleton rows={4} />
          ) : attentionError && !attention ? (
            <PanelError message={attentionError} onRetry={loadAttention} />
          ) : attention && attention.lowStock.length > 0 ? (
            <div className="divide-y divide-[#DBEFF3]">
              <div className="hidden md:grid grid-cols-[1.7fr_minmax(0,1fr)_auto] items-center gap-6 px-5 py-2.5 bg-[#DBEFF3]/30 text-[10px] font-bold uppercase tracking-widest text-[#666666]">
                <span>Product</span>
                <span>Stock level / reorder point</span>
                <span className="justify-self-end pr-1">Status</span>
              </div>
              {attention.lowStock.map((item) => {
                const pct = item.reorderPoint > 0 ? (item.availableStock / item.reorderPoint) * 100 : 0;
                const status = item.availableStock === 0 || pct <= 15 ? "Critical" : "Low";
                return (
                  <button
                    key={item.productId}
                    className={`w-full grid grid-cols-1 md:grid-cols-[1.7fr_minmax(0,1fr)_auto] md:items-center gap-2.5 md:gap-6 px-5 py-3.5 text-left hover:bg-[#DBEFF3]/30 transition-colors ${focusRing}`}
                    onClick={() => navigate(`/inventory/products/${item.productId}`)}
                    title={`Open product: ${item.productName}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#333333] truncate">{item.productName}</p>
                      <p className="text-xs text-[#666666]">{item.sku}</p>
                    </div>
                    <div className="min-w-0">
                      <div className="h-2 rounded-full bg-[#DBEFF3] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${status === "Critical" ? "bg-red-500" : "bg-[#C7B05F]"}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-[#666666] mt-1">
                        {fmtNumber(item.availableStock)} / {fmtNumber(item.reorderPoint)}{" "}
                        <span className="hidden sm:inline">of reorder point</span>
                      </p>
                    </div>
                    <div className="md:justify-self-end">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                          status === "Critical"
                            ? "bg-red-50 text-red-700 border-red-100"
                            : "bg-orange-50 text-orange-700 border-orange-100"
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : attention ? (
            <CompactEmpty text="No low-stock products" />
          ) : null}
        </DashPanel>

        {/* ── 7. Awaiting delivery + Outstanding invoices ─────────────────── */}
        <div className="grid xl:grid-cols-2 gap-4 items-start">
          <DashPanel title="Awaiting Delivery" count={attentionCounts.awaiting} viewAllTo="/purchasing/deliveries">
            {attentionLoading ? (
              <PanelSkeleton rows={3} />
            ) : attentionError && !attention ? (
              <PanelError message={attentionError} onRetry={loadAttention} />
            ) : attention && attention.awaitingDelivery.length > 0 ? (
              <div>
                <p className="px-5 pt-3.5 pb-2 text-xs text-[#666666]">
                  {fmtNumber(attention.awaitingDelivery.length)} items/orders awaiting delivery
                </p>
                <div className="px-5">
                  <div className="hidden sm:grid sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_100px] items-center gap-4 border-b border-[#DBEFF3] bg-[#DBEFF3]/30 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[#666666]">
                    <span>PO Number</span>
                    <span>Supplier</span>
                    <span>Expected Delivery</span>
                    <span>Status</span>
                  </div>
                </div>
                <div className="px-5 divide-y divide-[#DBEFF3] pb-4">
                  {attention.awaitingDelivery.map((item) => (
                    <button
                      key={item.purchaseOrderId}
                      className={`w-full text-left py-3 hover:bg-[#DBEFF3]/30 transition-colors rounded-lg px-2 -mx-2 ${focusRing}`}
                      onClick={() => navigate(`/purchasing/orders/${item.purchaseOrderId}`)}
                      title={`Open purchase order: ${item.poNumber}`}
                    >
                      <div className="sm:grid sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_100px] sm:items-center sm:gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#2A7F8C] truncate">{item.poNumber}</p>
                          <p className="text-xs text-[#666666] truncate sm:hidden">{item.supplierName}</p>
                        </div>
                        <span className="hidden sm:block text-xs text-[#666666] truncate">
                          {item.supplierName}
                        </span>
                        <p className="text-xs text-[#666666] mt-1.5 sm:mt-0">
                          <span className="sm:hidden font-medium text-[#333333]">Expected: </span>
                          {item.expectedDeliveryDate
                            ? fmtDate(item.expectedDeliveryDate)
                            : "Delivery date not set"}
                        </p>
                        <span
                          className={`mt-2 sm:mt-0 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                            item.expectedDeliveryDate
                              ? "bg-blue-50 text-blue-700 border-blue-100"
                              : "bg-[#F5F5F0] text-[#666666] border-[#E0E0DA]"
                          }`}
                        >
                          {item.expectedDeliveryDate ? "Expected" : "No date set"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : attention ? (
              <CompactEmpty text="No deliveries awaiting receipt" />
            ) : null}
          </DashPanel>

          <DashPanel title="Outstanding Invoices" count={attentionCounts.invoices} viewAllTo="/purchasing/invoices">
            {attentionLoading ? (
              <PanelSkeleton rows={2} />
            ) : attentionError && !attention ? (
              <PanelError message={attentionError} onRetry={loadAttention} />
            ) : attention && attention.outstandingInvoices.length > 0 ? (
              (() => {
                const [first, ...rest] = attention.outstandingInvoices;
                return (
                  <div className="divide-y divide-[#DBEFF3] pb-4">
                    <button
                      className={`w-full text-left px-5 py-4 hover:bg-[#DBEFF3]/30 transition-colors flex items-center justify-between gap-4 ${focusRing}`}
                      onClick={() => navigate(`/purchasing/invoices/${first.invoiceId}`)}
                      title={`Open invoice: ${first.invoiceNumber}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#49B0C1] truncate">
                          {first.invoiceNumber}
                        </p>
                        <p className="text-xs text-[#666666] truncate">{first.supplierName}</p>
                        <p className="text-xs text-[#666666] mt-1">
                          {first.dueDate ? `Due ${fmtDate(first.dueDate)}` : "Due date not set"}
                        </p>
                      </div>
                      <p className="text-3xl font-bold text-[#2A7F8C] whitespace-nowrap flex-shrink-0">
                        {fmtMoney(first.outstandingBalance)}
                      </p>
                    </button>
                    {rest.map((item) => (
                      <button
                        key={item.invoiceId}
                        className={`w-full text-left px-5 py-3 hover:bg-[#DBEFF3]/30 transition-colors flex items-center justify-between gap-4 ${focusRing}`}
                        onClick={() => navigate(`/purchasing/invoices/${item.invoiceId}`)}
                        title={`Open invoice: ${item.invoiceNumber}`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#49B0C1] truncate">
                            {item.invoiceNumber}
                          </p>
                          <p className="text-xs text-[#666666] truncate">{item.supplierName}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-[#333333]">
                            {fmtMoney(item.outstandingBalance)}
                          </p>
                          <p className="text-[11px] text-[#666666]">
                            {item.dueDate ? `Due ${fmtDate(item.dueDate)}` : "Due date not set"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()
            ) : attention ? (
              <CompactEmpty text="No outstanding invoices" />
            ) : null}
          </DashPanel>
        </div>

        {/* ── 9. Recent activity ───────────────────────────────────────────── */}
        <DashPanel title="Recent Activity" count={recent.length}>
          {recentLoading ? (
            <PanelSkeleton rows={5} />
          ) : recentError ? (
            <PanelError message={recentError} onRetry={loadRecent} />
          ) : recent.length === 0 ? (
            <CompactEmpty text="No recent activity" />
          ) : (
            <div className="px-5 max-h-[400px] overflow-y-auto">
              <ol>
                {recent.map((item, i) => (
                  <ActivityRow key={`${item.type}-${item.reference}-${i}`} item={item} index={i} total={recent.length} />
                ))}
              </ol>
            </div>
          )}
        </DashPanel>

        {/* ── 10. Quick actions ────────────────────────────────────────────── */}
        <section aria-label="Quick actions" className="flex flex-col gap-3 pb-2">
          <SectionLabel>Quick Actions</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.label}
                onClick={() => navigate(a.to)}
                className={`group bg-white rounded-xl border border-[#ABDBE3] p-5 text-left transition-all hover:border-[#49B0C1] hover:bg-[#DBEFF3]/40 flex items-start justify-between gap-3 ${focusRing}`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#DBEFF3] text-[#2A7F8C] transition-colors group-hover:bg-[#49B0C1] group-hover:text-white">
                    {a.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#333333]">{a.label}</p>
                    <p className="text-xs text-[#666666] mt-0.5">{a.caption}</p>
                  </div>
                </div>
                <span className="flex-shrink-0 mt-1 text-[#49B0C1]">
                  <IconArrowUpRight />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── 11. Sales analytics (report overview merged in, no duplication) ── */}
        <SalesAnalyticsSection />
      </div>
    </div>
  );
}

// ── Sales analytics (the report overview merged into the dashboard) ──────────

const ANALYTICS_PERIODS: { value: SalesTrendPeriod; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "ANNUAL", label: "Annual" },
];

function SalesAnalyticsSection() {
  const range = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(range.from);
  const [dateTo, setDateTo] = useState(range.to);
  const [locationId, setLocationId] = useState("");
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [period, setPeriod] = useState<SalesTrendPeriod>("MONTHLY");

  const [summary, setSummary] = useState<SalesSummaryDto | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [trend, setTrend] = useState<SalesTrendPointDto[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState<string | null>(null);

  useEffect(() => {
    listLocations({ limit: 100, isActive: true })
      .then((r) => setLocations(r.data))
      .catch(() => setLocations([]))
      .finally(() => setLocationsLoading(false));
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await getSalesSummary({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        locationId: locationId || undefined,
      });
      setSummary(data);
    } catch (e) {
      setSummaryError(e instanceof ReportsApiError ? e.message : "Failed to load sales summary.");
    } finally {
      setSummaryLoading(false);
    }
  }, [dateFrom, dateTo, locationId]);

  const loadTrend = useCallback(async () => {
    setTrendLoading(true);
    setTrendError(null);
    try {
      const data = await getSalesTrend({
        period,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        locationId: locationId || undefined,
      });
      setTrend(data ?? []);
    } catch (e) {
      setTrendError(e instanceof ReportsApiError ? e.message : "Failed to load sales trend.");
    } finally {
      setTrendLoading(false);
    }
  }, [period, dateFrom, dateTo, locationId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  // Period-filtered summary. Today's Sales / Transactions / Average Transaction
  // are already the hero snapshot above, so keep only the figures not shown yet.
  const kpis = [
    { label: "Total Sales", value: fmtMoney(summary?.totalSales), icon: <IconTrend /> },
    { label: "Subtotal", value: fmtMoney(summary?.totalSubtotal), icon: <IconTag /> },
    { label: "Discounts", value: fmtMoney(summary?.totalDiscount), icon: <IconPercent /> },
  ];

  return (
    <section aria-label="Sales analytics" className="flex flex-col gap-3">
      <SectionLabel>Sales Analytics</SectionLabel>

      <ReportFilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        locationId={locationId}
        locations={locations}
        locationsLoading={locationsLoading}
        onDateFromChange={(v) => setDateFrom(v)}
        onDateToChange={(v) => setDateTo(v)}
        onLocationChange={(v) => setLocationId(v)}
      />

      {summaryLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#DBEFF3] p-5">
              <div className="h-3 w-20 rounded bg-[#DBEFF3]/70 animate-pulse" />
              <div className="h-7 w-28 rounded bg-[#DBEFF3]/50 animate-pulse mt-3" />
            </div>
          ))}
        </div>
      ) : summaryError && !summary ? (
        <SectionError message={summaryError} onRetry={loadSummary} />
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="bg-white rounded-xl border border-[#DBEFF3] p-5 flex flex-col justify-between min-w-0"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[#666666]">{k.label}</p>
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#DBEFF3] text-[#2A7F8C]">
                  {k.icon}
                </span>
              </div>
              <p className="text-2xl font-bold text-[#333333] mt-3 leading-tight truncate">
                {k.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Trend chart */}
      <div className="bg-white rounded-xl border border-[#DBEFF3] shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#333333]">Sales Trend</h3>
            <p className="text-xs text-[#666666] mt-0.5">
              Revenue by {period === "DAILY" ? "day" : period === "MONTHLY" ? "month" : "year"} for the selected period
            </p>
          </div>
          <div className="flex rounded-lg border border-[#ABDBE3] overflow-hidden">
            {ANALYTICS_PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3.5 py-1.5 text-xs font-semibold transition-colors ${period === p.value ? "bg-[#49B0C1] text-white" : "bg-white text-[#666666] hover:bg-[#DBEFF3]/60"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {trendLoading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="h-8 w-8 rounded-full border-4 border-[#DBEFF3] border-t-[#49B0C1] animate-spin" />
            <p className="text-sm text-[#666666]">Loading trend...</p>
          </div>
        ) : trendError ? (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">{trendError}</p>
            <Button onClick={loadTrend}>Retry</Button>
          </div>
        ) : trend.length === 0 ? (
          <p className="text-sm text-[#666666] text-center py-14">
            No sales trend data for the selected period.
          </p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#49B0C1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#49B0C1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#DBEFF3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#666666" }} tickLine={false} axisLine={{ stroke: "#DBEFF3" }} />
                <YAxis tick={{ fontSize: 11, fill: "#666666" }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} tickLine={false} axisLine={false} width={52} />
                <Tooltip formatter={(v: unknown) => fmtMoney(Number(v))} contentStyle={{ borderRadius: 12, borderColor: "#DBEFF3", fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#49B0C1" strokeWidth={2.5} fill="url(#analyticsRevenueFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Payment methods + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#DBEFF3] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#DBEFF3]">
            <h3 className="text-sm font-bold text-[#333333]">Payment Methods</h3>
            <p className="text-xs text-[#666666] mt-0.5">Share of sales by payment method</p>
          </div>
          {summaryLoading ? (
            <PanelSkeleton rows={4} />
          ) : !summary || (summary.paymentsByMethod?.length ?? 0) === 0 ? (
            <CompactEmpty text="No payment data for this period." />
          ) : (
            <div className="divide-y divide-[#DBEFF3]">
              {summary.paymentsByMethod.map((p) => (
                <div key={p.method} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-sm font-medium text-[#333333] capitalize">
                    {p.method.replace(/_/g, " ").toLowerCase()}
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#333333]">{fmtMoney(p.amount)}</p>
                    {typeof p.count === "number" && (
                      <p className="text-xs text-[#666666]">{fmtNumber(p.count)} payments</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#DBEFF3] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#DBEFF3]">
            <h3 className="text-sm font-bold text-[#333333]">Top Products</h3>
            <p className="text-xs text-[#666666] mt-0.5">Best sellers by quantity and revenue</p>
          </div>
          {summaryLoading ? (
            <PanelSkeleton rows={4} />
          ) : !summary || (summary.topProducts?.length ?? 0) === 0 ? (
            <CompactEmpty text="No product data for this period." />
          ) : (
            <div className="divide-y divide-[#DBEFF3]">
              {summary.topProducts.map((p) => (
                <div key={p.productId} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#333333] truncate">{p.name}</p>
                    {p.sku && <p className="text-xs text-[#666666]">{p.sku}</p>}
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="text-sm font-semibold text-[#333333]">{fmtMoney(p.revenue)}</p>
                    <p className="text-xs text-[#666666]">{fmtNumber(p.quantitySold)} sold</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}