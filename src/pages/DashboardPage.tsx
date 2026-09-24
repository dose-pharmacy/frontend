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
import { defaultDateRange } from "./reports/reportHelpers";
import { listLocations } from "../features/inventory/locationsApi";
import DatePicker from "../components/ui/DatePicker";
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

function IconCalendar({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconMapPin({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconFilter({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74zm10.582 12.268c.068.022.144.042.221.061l.641.171-.641-.171c.193-.37.33-.77.406-1.19l.02-.096a3.072 3.072 0 01-.647.846l-.594.38zm2.19-2.412a4.597 4.597 0 01-.024 1.546l-.004.02-.005.019c-.117.769-.364 1.506-.732 2.18l-.065.119a.75.75 0 01-1.299-.75l.14-.253c.252-.455.433-.94.54-1.446l.03-.135.065-.3a.75.75 0 011.354-.553l.015.018.008.01c.16.242.262.486.342.734l-.457.847a.75.75 0 01-.564.405l-1.186.317c-.036.01-.072.02-.109.027-.003.002-.006.002-.009.004"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconTrendUp({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M12.577 4.878a.75.75 0 01.919-.53l4.78 1.281a.75.75 0 01.531.919l-1.281 4.78a.75.75 0 01-1.449-.387l.81-3.022a19.407 19.407 0 00-5.594 5.203.75.75 0 01-1.139.093L7 10.06l-4.72 4.72a.75.75 0 01-1.06-1.061l5.25-5.25a.75.75 0 011.06 0l3.074 3.073a20.923 20.923 0 014.545-4.094l-3.01-.8a.75.75 0 01-.53-.919z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold text-[#4F6B4A] uppercase tracking-[0.14em]">
      {children}
    </h2>
  );
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-[#E6ECE2] p-6">
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
        <div key={i} className="h-14 rounded-lg bg-[#E6ECE2]/60 animate-pulse" />
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
    <div className={`bg-white rounded-xl border border-[#E6ECE2] shadow-sm overflow-hidden min-w-0 ${className}`}>
      <div className="px-5 py-4 border-b border-[#E6ECE2] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-bold text-[#333333] truncate">{title}</h3>
          {typeof count === "number" && count > 0 && (
            <span className="rounded-full bg-[#E6ECE2] px-2 py-0.5 text-[11px] font-bold text-[#4F6B4A]">
              {fmtNumber(count)}
            </span>
          )}
        </div>
        {viewAllTo && (
          <Link
            to={viewAllTo}
            className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
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
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A9076]/40 focus-visible:ring-offset-1";

// ── Recent activity ──────────────────────────────────────────────────────────

const ACTIVITY_META: Record<
  string,
  { icon: React.ReactNode; iconColor: string; bubble: string }
> = {
  SALE_COMPLETED: {
    icon: <IconReceipt />,
    iconColor: "text-[#4F6B4A]",
    bubble: "bg-[#E6ECE2]",
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
          <span className="absolute left-1/2 top-10 -bottom-4 w-px -translate-x-1/2 bg-[#E6ECE2]" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#333333] truncate">{item.description}</p>
          {item.reference && (
            <p className="text-xs font-medium text-[#7A9076] mt-0.5">{item.reference}</p>
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

function QuickActionCard({ action }: { action: (typeof QUICK_ACTIONS)[number] }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(action.to)}
      className={`group bg-white rounded-xl border border-[#C6D4BF] p-5 text-left transition-all hover:border-[#7A9076] hover:bg-[#E6ECE2]/40 flex items-start justify-between gap-3 ${focusRing}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#E6ECE2] text-[#4F6B4A] transition-colors group-hover:bg-[#7A9076] group-hover:text-white">
          {action.icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#333333]">{action.label}</p>
          <p className="text-xs text-[#666666] mt-0.5">{action.caption}</p>
        </div>
      </div>
      <span className="flex-shrink-0 mt-1 text-[#7A9076]">
        <IconArrowUpRight />
      </span>
    </button>
  );
}

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

  const attentionCounts = {
    lowStock: summary?.inventory.lowStockCount ?? (attention?.lowStock.length ?? 0),
    expiring: summary?.inventory.expiringSoonCount ?? (attention?.expiringSoon.length ?? 0),
    awaiting: summary?.purchasing.awaitingDelivery ?? (attention?.awaitingDelivery.length ?? 0),
    invoices: summary?.purchasing.outstandingInvoices ?? (attention?.outstandingInvoices.length ?? 0),
  };

  // ── Derived presentation for summary-based sections ────────────────────────

  const invBars = summary
    ? [
        { label: "Low Stock", value: summary.inventory.lowStockCount, fill: "bg-yellow-500" },
        { label: "Expiring Soon", value: summary.inventory.expiringSoonCount, fill: "bg-orange-500" },
        { label: "Expired", value: summary.inventory.expiredCount, fill: "bg-red-500" },
        { label: "Out of Stock", value: summary.inventory.outOfStockCount, fill: "bg-red-700" },
        { label: "Requirements", value: summary.purchasing.openRequirements, fill: "bg-blue-500" },
        { label: "Awaiting", value: summary.purchasing.partiallyReceived, fill: "bg-yellow-600" },
        { label: "Slow Moving", value: summary.slowMoving.flaggedCount, fill: "bg-green-500" },
      ]
    : [];
  const invMax = Math.max(...invBars.map((b) => b.value), 1);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="border-b border-[#E6ECE2] bg-white">
        <PageHeader
          breadcrumb="Dashboard"
          title="Dashboard"
          subtitle="Overview of today's activity and items needing care."
          actions={
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={refreshing}
                loading={refreshing}
                className="!bg-[#7A9076] !text-white hover:!bg-[#4F6B4A] focus-visible:!ring-[#7A9076]"
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
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
              <div className="xl:col-span-2 bg-white rounded-lg border border-[#E6ECE2] px-3.5 py-3">
                <div className="h-2 w-20 rounded bg-[#E6ECE2]/70 animate-pulse" />
                <div className="h-5 w-32 rounded bg-[#E6ECE2]/50 animate-pulse mt-2" />
                <div className="h-2 w-28 rounded bg-[#E6ECE2]/70 animate-pulse mt-2" />
              </div>
              <div className="xl:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border border-[#E6ECE2] px-3.5 py-3">
                  <div className="h-2 w-24 rounded bg-[#E6ECE2]/70 animate-pulse" />
                  <div className="h-5 w-36 rounded bg-[#E6ECE2]/50 animate-pulse mt-2" />
                </div>
                <div className="bg-white rounded-lg border border-[#E6ECE2] px-3.5 py-3">
                  <div className="h-2 w-24 rounded bg-[#E6ECE2]/70 animate-pulse" />
                  <div className="h-5 w-36 rounded bg-[#E6ECE2]/50 animate-pulse mt-2" />
                </div>
              </div>
              <div className="xl:col-span-2 bg-white rounded-lg border border-[#E6ECE2] px-3.5 py-3">
                <div className="h-2 w-16 rounded bg-[#E6ECE2]/70 animate-pulse" />
                <div className="h-5 w-24 rounded bg-[#E6ECE2]/50 animate-pulse mt-2" />
              </div>
              <div className="xl:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border border-[#E6ECE2] px-3.5 py-3">
                  <div className="h-2 w-24 rounded bg-[#E6ECE2]/70 animate-pulse" />
                  <div className="h-5 w-36 rounded bg-[#E6ECE2]/50 animate-pulse mt-2" />
                </div>
                <div className="bg-white rounded-lg border border-[#E6ECE2] px-3.5 py-3">
                  <div className="h-2 w-24 rounded bg-[#E6ECE2]/70 animate-pulse" />
                  <div className="h-5 w-36 rounded bg-[#E6ECE2]/50 animate-pulse mt-2" />
                </div>
              </div>
            </div>
          ) : summaryError && !summary ? (
            <SectionError message={summaryError} onRetry={loadSummary} />
          ) : summary ? (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
              {/* Today's Sales — 2/5 */}
              <div className="xl:col-span-2 rounded-lg border border-[#C6D4BF] bg-[#E6ECE2]/40 px-4 py-3 flex flex-col justify-center min-w-0">
                <p className="text-[10px] font-bold text-[#4F6B4A] uppercase tracking-wide">
                  Today's Sales
                </p>
                <p className="text-lg font-bold text-[#4F6B4A] mt-0.5 leading-tight truncate">
                  {fmtMoney(summary.sales.today)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[10px] text-[#666666]">
                  <span className="whitespace-nowrap">
                    <span className="font-bold text-[#333333]">{fmtNumber(summary.sales.transactions)}</span>{" "}
                    Transactions
                  </span>
                  <span className="whitespace-nowrap">
                    <span className="font-bold text-[#333333]">{fmtMoney(summary.sales.averageTransaction)}</span>{" "}
                    Avg Transaction
                  </span>
                </div>
              </div>

              {/* New Sale + Purchase Requirement — 3/5, side by side */}
              <div className="xl:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <QuickActionCard action={QUICK_ACTIONS[0]} />
                <QuickActionCard action={QUICK_ACTIONS[1]} />
              </div>

              {/* Stock Value — 2/5 */}
              <div className="xl:col-span-2 bg-white rounded-lg border border-[#E6ECE2] px-4 py-3 flex items-center justify-between gap-3 min-w-0">
                <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wide whitespace-nowrap">
                  Stock Value
                </span>
                <span className="text-sm font-bold text-[#333333] truncate">
                  {fmtMoney(summary.inventory.stockValue)}
                </span>
              </div>

              {/* New Purchase Order + Receive Goods — 3/5, side by side */}
              <div className="xl:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <QuickActionCard action={QUICK_ACTIONS[2]} />
                <QuickActionCard action={QUICK_ACTIONS[3]} />
              </div>
            </div>
          ) : null}
        </section>

        {/* ── 3. Inventory overview + Expiry monitor ──────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-stretch">
          <DashPanel title="Inventory Overview" className="flex flex-col xl:col-span-3">
            {summaryLoading ? (
              <div className="px-5 py-4 flex-1 flex flex-col justify-center">
                <div className="flex items-end gap-2 sm:gap-3 border-b-2 border-[#C6D4BF] pb-1">
                  {Array.from({ length: 7 }, (_, i) => (
                    <div key={i} className="flex-1 min-w-0 flex flex-col items-center gap-2">
                      <div className="h-5 w-7 rounded bg-[#E6ECE2]/70 animate-pulse" />
                      <div
                        className="w-full max-w-[6.5rem] rounded-t-lg bg-[#E6ECE2]/50 animate-pulse"
                        style={{ height: `${120 + ((i * 20) % 120)}px` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 flex items-start gap-2 sm:gap-3">
                  {Array.from({ length: 7 }, (_, i) => (
                    <div key={i} className="flex-1 min-w-0 flex justify-center">
                      <div className="h-3 w-full max-w-[3.5rem] rounded bg-[#E6ECE2]/60 animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ) : !summary ? (
              <CompactEmpty text="Inventory overview unavailable" />
            ) : (
              <div className="px-5 py-4 flex-1 flex flex-col justify-center">
                <div className="flex items-end gap-2 sm:gap-3 border-b-2 border-[#C6D4BF] pb-1">
                  {invBars.map((bar) => (
                    <div
                      key={bar.label}
                      className="flex-1 min-w-0 flex flex-col items-center gap-2"
                      title={`${bar.label}: ${fmtNumber(bar.value)}`}
                    >
                      <p className="text-lg font-bold text-[#4F6B4A] leading-none">
                        {fmtNumber(bar.value)}
                      </p>
                      <div
                        className={`w-full max-w-[6.5rem] rounded-t-lg ${bar.fill}`}
                        style={{ height: `${Math.max(Math.round((bar.value / invMax) * 240), 0)}px` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 flex items-start gap-2 sm:gap-3">
                  {invBars.map((bar) => (
                    <p
                      key={bar.label}
                      title={bar.label}
                      className="flex-1 min-w-0 text-[11px] font-medium text-[#666666] text-center truncate leading-tight"
                    >
                      {bar.label}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </DashPanel>

          <DashPanel title="Expiry Monitor" count={attentionCounts.expiring} viewAllTo="/inventory/batches-expiry" className="xl:col-span-2">
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
                                ? "bg-[#7A9076] border-[#7A9076]"
                                : "bg-white border-[#C6D4BF]"
                            }`}
                            aria-hidden
                          />
                          {i < sorted.length - 1 && (
                            <span
                              className="absolute left-[17px] top-[40px] bottom-1 w-px bg-[#E6ECE2]"
                              aria-hidden
                            />
                          )}
                          <button
                            className={`w-full text-left rounded-xl border border-transparent px-3 py-2.5 hover:bg-[#E6ECE2]/40 hover:border-[#C6D4BF] transition-colors ${focusRing}`}
                            onClick={() => navigate(`/inventory/batches/${item.batchId}`)}
                            title={`Open batch: ${item.batchNumber}`}
                          >
                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className="w-14 flex-shrink-0 text-right">
                                <p className="text-xl font-bold text-[#4F6B4A] leading-none">
                                  {fmtNumber(item.remainingQuantity)}
                                </p>
                                <p className="text-[10px] text-[#999999] uppercase tracking-wide">
                                  {item.baseUnitName?.toLowerCase() ?? "units"}
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
                                    i === 0 ? "text-[#4F6B4A]" : "text-[#333333]"
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

        {/* ── 4. Low stock ─────────────────────────────────────────────────── */}
        <DashPanel title="Low Stock" count={attentionCounts.lowStock} viewAllTo="/inventory/stock">
          {attentionLoading ? (
            <PanelSkeleton rows={4} />
          ) : attentionError && !attention ? (
            <PanelError message={attentionError} onRetry={loadAttention} />
          ) : attention && attention.lowStock.length > 0 ? (
            <div className="divide-y divide-[#E6ECE2]">
              <div className="hidden md:grid grid-cols-[1.7fr_minmax(0,1fr)_auto] items-center gap-6 px-5 py-2.5 bg-[#E6ECE2]/30 text-[10px] font-bold uppercase tracking-widest text-[#666666]">
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
                    className={`w-full grid grid-cols-1 md:grid-cols-[1.7fr_minmax(0,1fr)_auto] md:items-center gap-2.5 md:gap-6 px-5 py-3.5 text-left hover:bg-[#E6ECE2]/30 transition-colors ${focusRing}`}
                    onClick={() => navigate(`/inventory/products/${item.productId}`)}
                    title={`Open product: ${item.productName}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#333333] truncate">{item.productName}</p>
                      <p className="text-xs text-[#666666]">{item.sku}</p>
                    </div>
                    <div className="min-w-0">
                      <div className="h-2 rounded-full bg-[#E6ECE2] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${status === "Critical" ? "bg-red-500" : "bg-[#C7B05F]"}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-[#666666] mt-1">
                        {fmtNumber(item.availableStock)} / {fmtNumber(item.reorderPoint)}{" "}
                        <span className="hidden sm:inline">
                          of reorder point ({item.baseUnitName?.toLowerCase() ?? "unit"})
                        </span>
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

        {/* ── 5. Awaiting delivery + Outstanding invoices ─────────────────── */}
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
                  <div className="hidden sm:grid sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_100px] items-center gap-4 border-b border-[#E6ECE2] bg-[#E6ECE2]/30 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[#666666]">
                    <span>PO Number</span>
                    <span>Supplier</span>
                    <span>Expected Delivery</span>
                    <span>Status</span>
                  </div>
                </div>
                <div className="px-5 divide-y divide-[#E6ECE2] pb-4">
                  {attention.awaitingDelivery.map((item) => (
                    <button
                      key={item.purchaseOrderId}
                      className={`w-full text-left py-3 hover:bg-[#E6ECE2]/30 transition-colors rounded-lg px-2 -mx-2 ${focusRing}`}
                      onClick={() => navigate(`/purchasing/orders/${item.purchaseOrderId}`)}
                      title={`Open purchase order: ${item.poNumber}`}
                    >
                      <div className="sm:grid sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_100px] sm:items-center sm:gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#4F6B4A] truncate">{item.poNumber}</p>
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
                  <div className="divide-y divide-[#E6ECE2] pb-4">
                    <button
                      className={`w-full text-left px-5 py-4 hover:bg-[#E6ECE2]/30 transition-colors flex items-center justify-between gap-4 ${focusRing}`}
                      onClick={() => navigate(`/purchasing/invoices/${first.invoiceId}`)}
                      title={`Open invoice: ${first.invoiceNumber}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#7A9076] truncate">
                          {first.invoiceNumber}
                        </p>
                        <p className="text-xs text-[#666666] truncate">{first.supplierName}</p>
                        <p className="text-xs text-[#666666] mt-1">
                          {first.dueDate ? `Due ${fmtDate(first.dueDate)}` : "Due date not set"}
                        </p>
                      </div>
                      <p className="text-3xl font-bold text-[#4F6B4A] whitespace-nowrap flex-shrink-0">
                        {fmtMoney(first.outstandingBalance)}
                      </p>
                    </button>
                    {rest.map((item) => (
                      <button
                        key={item.invoiceId}
                        className={`w-full text-left px-5 py-3 hover:bg-[#E6ECE2]/30 transition-colors flex items-center justify-between gap-4 ${focusRing}`}
                        onClick={() => navigate(`/purchasing/invoices/${item.invoiceId}`)}
                        title={`Open invoice: ${item.invoiceNumber}`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#7A9076] truncate">
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

        {/* ── 6. Recent activity ───────────────────────────────────────────── */}
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

        {/* ── 7. Sales analytics (report overview merged in, no duplication) ── */}
        <SalesAnalyticsSection />
      </div>
    </div>
  );
}

// ── Sales analytics (the report overview merged into the dashboard) ──────────
// Shared with /reports (ReportsDashboardPage) so both screens render the SAME
// section — filters, financial overview card, trend chart, payment methods and
// top products — without a second copy drifting apart.

const ANALYTICS_PERIODS: { value: SalesTrendPeriod; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "ANNUAL", label: "Annual" },
];

export function SalesAnalyticsSection() {
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

  return (
    <section aria-label="Sales analytics" className="flex flex-col gap-3">
      <FinancialOverviewCard
        dateFrom={dateFrom}
        dateTo={dateTo}
        locationId={locationId}
        locations={locations}
        locationsLoading={locationsLoading}
        onDateFromChange={(v) => setDateFrom(v)}
        onDateToChange={(v) => setDateTo(v)}
        onLocationChange={(v) => setLocationId(v)}
        onApplyFilters={() => {
          loadSummary();
          loadTrend();
        }}
        summary={summary}
        summaryLoading={summaryLoading}
        summaryError={summaryError}
        onRetry={loadSummary}
      />

      {/* Trend chart */}
      <div className="bg-white rounded-xl border border-[#E6ECE2] shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#333333]">Sales Trend</h3>
            <p className="text-xs text-[#666666] mt-0.5">
              Revenue by {period === "DAILY" ? "day" : period === "MONTHLY" ? "month" : "year"} for the selected period
            </p>
          </div>
          <div className="flex rounded-lg border border-[#C6D4BF] overflow-hidden">
            {ANALYTICS_PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3.5 py-1.5 text-xs font-semibold transition-colors ${period === p.value ? "bg-[#7A9076] text-white" : "bg-white text-[#666666] hover:bg-[#E6ECE2]/60"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {trendLoading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#7A9076] animate-spin" />
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
                    <stop offset="0%" stopColor="#7A9076" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#7A9076" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6ECE2" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#666666" }} tickLine={false} axisLine={{ stroke: "#E6ECE2" }} />
                <YAxis tick={{ fontSize: 11, fill: "#666666" }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} tickLine={false} axisLine={false} width={52} />
                <Tooltip formatter={(v: unknown) => fmtMoney(Number(v))} contentStyle={{ borderRadius: 12, borderColor: "#E6ECE2", fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#7A9076" strokeWidth={2.5} fill="url(#analyticsRevenueFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Payment methods + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E6ECE2] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6ECE2]">
            <h3 className="text-sm font-bold text-[#333333]">Payment Methods</h3>
            <p className="text-xs text-[#666666] mt-0.5">Share of sales by payment method</p>
          </div>
          {summaryLoading ? (
            <PanelSkeleton rows={4} />
          ) : !summary || (summary.paymentsByMethod?.length ?? 0) === 0 ? (
            <CompactEmpty text="No payment data for this period." />
          ) : (
            <div className="divide-y divide-[#E6ECE2]">
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

        <div className="bg-white rounded-xl border border-[#E6ECE2] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6ECE2]">
            <h3 className="text-sm font-bold text-[#333333]">Top Products</h3>
            <p className="text-xs text-[#666666] mt-0.5">Best sellers by quantity and revenue</p>
          </div>
          {summaryLoading ? (
            <PanelSkeleton rows={4} />
          ) : !summary || (summary.topProducts?.length ?? 0) === 0 ? (
            <CompactEmpty text="No product data for this period." />
          ) : (
            <div className="divide-y divide-[#E6ECE2]">
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

// ── Financial Overview card (merged filters + hero + waterfall) ──────────────

function FinancialOverviewCard({
  dateFrom,
  dateTo,
  locationId,
  locations,
  locationsLoading,
  onDateFromChange,
  onDateToChange,
  onLocationChange,
  onApplyFilters,
  summary,
  summaryLoading,
  summaryError,
  onRetry,
}: {
  dateFrom: string;
  dateTo: string;
  locationId?: string;
  locations?: { id: string; name: string }[];
  locationsLoading?: boolean;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onLocationChange?: (v: string) => void;
  onApplyFilters: () => void;
  summary: SalesSummaryDto | null;
  summaryLoading: boolean;
  summaryError: string | null;
  onRetry: () => void;
}) {
  const maxVal = Math.max(
    summary?.totalSubtotal ?? 0,
    summary?.totalSales ?? 0,
    summary?.totalDiscount ?? 0,
    1,
  );
  const pct = (v: number) => Math.min(Math.max((v / maxVal) * 100, 0), 100);
  const discount = summary?.totalDiscount ?? 0;

  const rows = [
    {
      label: "Gross Subtotal",
      value: fmtMoney(summary?.totalSubtotal),
      width: pct(summary?.totalSubtotal ?? 0),
      fill: "bg-[#7A9076]",
    },
    {
      label: "Discounts",
      value: `-${fmtMoney(discount)}`,
      width: Math.max(pct(discount), 2),
      fill: discount > 0 ? "bg-[#E3C8C5]" : "bg-[#E0E0DA]",
    },
    {
      label: "Net Total Sales",
      value: fmtMoney(summary?.totalSales),
      width: pct(summary?.totalSales ?? 0),
      fill: "bg-gradient-to-r from-[#7A9076] to-[#4F6B4A]",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#E6ECE2] shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="px-6 py-5 border-b border-[#E6ECE2] flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#E6ECE2] to-[#C6D4BF] text-[#4F6B4A]">
            <IconTrendUp className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#333333]">Financial Overview</h2>
            <p className="text-xs text-[#666666] mt-0.5">Sales summary for the selected period</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date range pill */}
          <div className="flex items-center gap-2 rounded-xl border border-[#C6D4BF] bg-white px-3 py-2">
            <IconCalendar className="h-4 w-4 shrink-0 text-[#7A9076]" />
            <div className="flex items-center gap-1.5 text-sm">
              <DatePicker
                value={dateFrom}
                onChange={onDateFromChange}
                placeholder="From date"
              />
              <span className="text-[#999999]">–</span>
              <DatePicker
                value={dateTo}
                onChange={onDateToChange}
                placeholder="To date"
              />
            </div>
          </div>

          {/* Location selector */}
          <div className="flex items-center gap-2 rounded-xl border border-[#C6D4BF] bg-white px-3 py-2">
            <IconMapPin className="h-4 w-4 shrink-0 text-[#7A9076]" />
            <select
              value={locationId || ""}
              onChange={(e) => onLocationChange?.(e.target.value || "")}
              disabled={locationsLoading}
              className="bg-transparent text-sm font-semibold text-[#333333] outline-none cursor-pointer disabled:cursor-wait max-w-[10rem]"
              aria-label="Filter by location"
            >
              <option value="">All Locations</option>
              {(locations ?? []).map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter action */}
          <button
            type="button"
            onClick={onApplyFilters}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F6B4A] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3B4F35] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6B4A]/40"
          >
            <IconFilter className="h-4 w-4" />
            Filter
          </button>
        </div>
      </div>

      {/* Card body */}
      {summaryLoading ? (
        <div className="px-6 py-6">
          <div className="h-3 w-28 rounded bg-[#E6ECE2]/70 animate-pulse" />
          <div className="h-10 w-52 rounded bg-[#E6ECE2]/40 animate-pulse mt-3" />
          <div className="h-4 w-40 rounded bg-[#E6ECE2]/60 animate-pulse mt-4" />
          <div className="my-6 border-t border-[#E6ECE2]" />
          <div className="flex flex-col gap-6">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 w-32 rounded bg-[#E6ECE2]/70 animate-pulse" />
                <div className="flex-1">
                  <div
                    className="h-3.5 rounded-full bg-[#E6ECE2]/50 animate-pulse"
                    style={{ width: `${96 - i * 14}%` }}
                  />
                </div>
                <div className="h-4 w-28 rounded bg-[#E6ECE2]/70 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : summaryError && !summary ? (
        <div className="px-6 py-8 flex flex-col items-center gap-4">
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">
            {summaryError}
          </p>
          <Button onClick={onRetry}>Retry</Button>
        </div>
      ) : summary ? (
        <div className="px-6 py-6">
          {/* Hero */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#666666]">
                Total Sales
              </p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight text-[#333333] leading-none">
                {fmtMoney(summary.totalSales)}
              </p>
              <p className="mt-2 text-xs text-[#666666]">
                Avg{" "}
                <span className="font-semibold text-[#333333]">
                  {fmtMoney(summary.averageTransaction)}
                </span>{" "}
                per transaction
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E1EAD9] px-3 py-1.5 text-xs font-bold text-[#5C7A52]">
              <IconTrendUp className="h-3.5 w-3.5" />
              {fmtNumber(summary.transactionCount)} transactions
            </span>
          </div>

          {/* Divider */}
          <div className="my-6 border-t border-[#E6ECE2]" />

          {/* Waterfall breakdown */}
          <div className="flex flex-col gap-5">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center gap-4">
                <div className="w-36 shrink-0">
                  <p className="text-sm font-semibold text-[#333333]">{row.label}</p>
                </div>
                <div className="flex-1">
                  <div className="h-3.5 rounded-full bg-[#F5F5F0] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${row.fill}`}
                      style={{ width: `${row.width}%` }}
                    />
                  </div>
                </div>
                <p className="w-32 shrink-0 text-right text-sm font-bold text-[#333333] tabular-nums">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}