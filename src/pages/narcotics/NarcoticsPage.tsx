// ── Dashboard → Narcotics ─────────────────────────────────────────────────────
// A controlled-medicine operational and compliance view: which products the
// backend flags as narcotic, where their batches sit, what is expiring, and what
// controlled-medicine movement has been recorded.
//
// Endpoints used (through the existing reports API client — no second client,
// no new auth):
//
//   GET /financials/reports/narcotics             → controlled products + batches
//   GET /financials/reports/narcotics/activity    → movement ledger
//   GET /inventory/locations                      → the location filter's options
//
// Backend-first notes that shaped this page:
//
//   • Both narcotics endpoints are ABSENT from the published OpenAPI document
//     (which lists 114 paths). They were confirmed live: the server answers 401
//     for them while answering a distinct 404 for a control probe, so the routes
//     exist and are simply undocumented. Their response shapes are therefore the
//     repo's existing DTOs and could not be re-verified; every optional field
//     renders "—" rather than a fabricated default.
//   • There is NO `isNarcotic` query parameter anywhere in the contract, so the
//     product list is produced by the backend's own narcotics report rather than
//     by filtering a general product list in the browser.
//   • `meta.total` from the narcotics report is the backend's own count of
//     controlled products, so it is reported as-is. Every other card is derived
//     from the batches on the CURRENT PAGE and is labelled "on this page",
//     because there is no portfolio-total endpoint to sum against.
//   • There is no narcotic-scoped expiring/expired count (the expiry dashboard
//     summary is global), so those two cards are derived from the loaded batches
//     using the app's existing expiry windows — see expiryRules.ts.
//   • There is NO narcotic-specific mutation endpoint (no dispense, transfer,
//     destroy, adjust, prescription or approval). The page is therefore read-only
//     by design, not by omission.
//
// What this page is NOT (§21, §22, §23):
//   • Not Inventory — it does not reproduce the Inventory module; it shows only
//     the products the backend flags narcotic.
//   • Not Sales — narcotic sale detail lives on the Sales page. `/pos/sales` has
//     no isNarcotic filter, so this page does not attempt to list narcotic sales.
//   • Not Credit, and not Finance — no revenue, profit, margin or payment-method
//     analytics appear here.

import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardSubNav from "../dashboard/DashboardSubNav";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import MetricCard from "../../components/ui/MetricCard";
import Pagination from "../../components/ui/Pagination";
import EmptyState from "../../components/ui/EmptyState";
import SearchInput from "../../components/ui/SearchInput";
import Select from "../../components/ui/Select";
import DatePicker from "../../components/ui/DatePicker";
import {
  IconBell,
  IconBox,
  IconClipboard,
  IconRefresh,
  IconWarningTriangle,
} from "../../components/ui/icons";
import { listLocations, type LocationDto } from "../../features/inventory/locationsApi";
import {
  getNarcoticReport,
  getNarcoticActivity,
  type NarcoticSummaryDto,
  type NarcoticActivityDto,
} from "../../features/reports/reportsApi";
import { fmtDate, fmtDateTime, fmtNumber } from "../../utils/format";
import NarcoticProductModal from "./NarcoticProductModal";
import {
  errorMessage,
  ExpiryBadge,
  ExpiryCell,
  expiryVerdict,
  MovementBadge,
  movementLabel,
  qty,
} from "./narcoticsView";

const PAGE_SIZE = 20;

type Tab = "products" | "activity";

const TABS: { key: Tab; label: string }[] = [
  { key: "products", label: "Controlled Products" },
  { key: "activity", label: "Movement Activity" },
];

// ── Batch-expanded product rows ──────────────────────────────────────────────
// §11: batches the backend distinguishes are never merged into one record. A
// product with no stock still gets a row so it does not silently disappear.

interface BatchRow {
  key: string;
  product: NarcoticSummaryDto;
  batch: NarcoticSummaryDto["batches"][number] | null;
}

function expandRows(products: NarcoticSummaryDto[]): BatchRow[] {
  const rows: BatchRow[] = [];
  for (const product of products) {
    const batches = product.batches ?? [];
    if (batches.length === 0) {
      rows.push({ key: `${product.productId}-nostock`, product, batch: null });
      continue;
    }
    for (const batch of batches) {
      rows.push({
        key: `${product.productId}-${batch.batchId}-${batch.locationId}`,
        product,
        batch,
      });
    }
  }
  return rows;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NarcoticsPage() {
  const [tab, setTab] = useState<Tab>("products");
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [movementType, setMovementType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  /** Set only from the product modal's "View on Activity tab". */
  const [productId, setProductId] = useState("");
  const [activityProduct, setActivityProduct] = useState<NarcoticSummaryDto | null>(null);
  const [modalProduct, setModalProduct] = useState<NarcoticSummaryDto | null>(null);

  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);

  const [products, setProducts] = useState<NarcoticSummaryDto[]>([]);
  const [productsMeta, setProductsMeta] = useState({ total: 0, totalPages: 1, limit: PAGE_SIZE });
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [activity, setActivity] = useState<NarcoticActivityDto[]>([]);
  const [activityMeta, setActivityMeta] = useState({ total: 0, totalPages: 1, limit: PAGE_SIZE });
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  // Location options are a filter concern, not page data — a failure here must
  // not blank the tables, so it degrades to an empty list.
  useEffect(() => {
    let cancelled = false;
    listLocations({ limit: 100, isActive: true })
      .then((res) => {
        if (!cancelled) setLocations(res.data);
      })
      .catch(() => {
        if (!cancelled) setLocations([]);
      })
      .finally(() => {
        if (!cancelled) setLocationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const res = await getNarcoticReport({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        locationId: locationId || undefined,
      });
      setProducts(res.data);
      setProductsMeta({
        total: res.meta.total,
        // A `limit` of 0 would otherwise let the pager claim "1–0 of N".
        totalPages: Math.max(1, res.meta.limit > 0 ? res.meta.totalPages : 1),
        limit: res.meta.limit,
      });
    } catch (e) {
      setProductsError(errorMessage(e, "Unable to load narcotic inventory."));
    } finally {
      setProductsLoading(false);
    }
  }, [page, search, locationId]);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const res = await getNarcoticActivity({
        page,
        limit: PAGE_SIZE,
        productId: productId || undefined,
        locationId: locationId || undefined,
        movementType: movementType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setActivity(res.data);
      setActivityMeta({
        total: res.meta.total,
        totalPages: Math.max(1, res.meta.limit > 0 ? res.meta.totalPages : 1),
        limit: res.meta.limit,
      });
    } catch (e) {
      setActivityError(errorMessage(e, "Unable to load narcotic movement history."));
    } finally {
      setActivityLoading(false);
    }
  }, [page, productId, locationId, movementType, dateFrom, dateTo]);

  // Only the visible tab is fetched — no request for data nobody is looking at.
  useEffect(() => {
    if (tab === "products") {
      void loadProducts();
    } else {
      void loadActivity();
    }
  }, [tab, loadProducts, loadActivity]);

  // Server-side search: debounce so typing does not fire a request per keystroke.
  useEffect(() => {
    if (!search.trim()) return;
    const t = setTimeout(() => void (tab === "products" ? loadProducts() : loadActivity()), 350);
    return () => clearTimeout(t);
  }, [search, tab, loadProducts, loadActivity]);

  function resetPage() {
    setPage(1);
  }

  function switchTab(next: Tab) {
    setTab(next);
    resetPage();
  }

  function clearFilters() {
    setSearch("");
    setLocationId("");
    setMovementType("");
    setDateFrom("");
    setDateTo("");
    setProductId("");
    setActivityProduct(null);
    resetPage();
  }

  const hasFilters = Boolean(
    search.trim() || locationId || movementType || dateFrom || dateTo || productId,
  );

  const activeLoading = tab === "products" ? productsLoading : activityLoading;
  const activeError = tab === "products" ? productsError : activityError;
  const activeMeta = tab === "products" ? productsMeta : activityMeta;

  // ── Summary cards ──────────────────────────────────────────────────────────
  // `meta.total` is the backend's own count of controlled products. The other
  // three are derived from the batches on the current page only — there is no
  // portfolio-total endpoint — so each says so.
  const rows = useMemo(() => expandRows(products), [products]);
  const cards = useMemo(() => {
    const batches = products.flatMap((p) => p.batches ?? []);
    let totalQty = 0;
    let expiringSoon = 0;
    let expired = 0;
    for (const b of batches) {
      totalQty += b.currentQuantity ?? 0;
      const { status } = expiryVerdict(b.expiryDate);
      if (status === "EXPIRED") expired += 1;
      else if (status === "CRITICAL" || status === "EXPIRING_SOON") expiringSoon += 1;
    }
    return { totalQty, expiringSoon, expired };
  }, [products]);

  /**
   * Movement-type filter options are collected from the values the backend
   * actually returned, unioned with the current selection. The endpoint is
   * undocumented, so no enum is guessed here — an unrecognised type still shows
   * up, is still selectable, and keeps its raw value in the badge tooltip.
   */
  const movementOptions = useMemo(() => {
    const seen = new Set(activity.map((m) => m.movementType).filter(Boolean));
    if (movementType) seen.add(movementType);
    return Array.from(seen).sort();
  }, [activity, movementType]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Dashboard / Narcotics"
        title="Narcotics"
        subtitle="Monitor controlled medicines, stock, batches, movements and compliance activity."
        actions={
          <Button
            variant="secondary"
            onClick={() => void (tab === "products" ? loadProducts() : loadActivity())}
            loading={activeLoading}
          >
            <IconRefresh className="w-4 h-4" />
            Refresh
          </Button>
        }
      />
      <DashboardSubNav />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* ── Summary ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Narcotic Products"
            value={productsError ? "—" : fmtNumber(productsMeta.total)}
            icon={<IconBox className="w-5 h-5" />}
            subtitle="Total controlled products reported by the backend"
          />
          <MetricCard
            title="Total Narcotic Stock"
            value={productsError ? "—" : fmtNumber(cards.totalQty)}
            icon={<IconClipboard className="w-5 h-5" />}
            subtitle="Base units across batches on this page"
          />
          <MetricCard
            title="Expiring Soon"
            value={productsError ? "—" : fmtNumber(cards.expiringSoon)}
            icon={<IconBell className="w-5 h-5" />}
            subtitle="Batches within 90 days on this page"
          />
          <MetricCard
            title="Expired"
            value={productsError ? "—" : fmtNumber(cards.expired)}
            icon={<IconWarningTriangle className="w-5 h-5" />}
            subtitle="Batches past expiry on this page"
          />
        </div>

        {/* ── Tabs + filters ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-white rounded-xl border border-[#E6ECE2] p-1 w-fit">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => switchTab(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                  tab === t.key ? "bg-[#4F6B4A] text-white" : "text-[#666666] hover:text-[#333333]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {hasFilters && (
            <Button variant="secondary" onClick={clearFilters} className="!px-3 !py-1.5 !text-xs">
              Clear filters
            </Button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
          <div className="flex flex-wrap gap-3 items-end">
            {tab === "products" ? (
              <>
                <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                  <label className="text-sm font-medium text-[#333333]">Search</label>
                  <SearchInput
                    value={search}
                    onChange={(v) => {
                      setSearch(v);
                      resetPage();
                    }}
                    placeholder="Search controlled products..."
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
                  <label className="text-sm font-medium text-[#333333]" htmlFor="narc-movement">
                    Movement type
                  </label>
                  <Select
                    id="narc-movement"
                    value={movementType}
                    onChange={(e) => {
                      setMovementType(e.target.value);
                      resetPage();
                    }}
                    className="w-full"
                  >
                    <option value="">All movements</option>
                    {movementOptions.map((m) => (
                      <option key={m} value={m}>
                        {movementLabel(m)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
                  <label className="text-sm font-medium text-[#333333]">From</label>
                  <DatePicker
                    value={dateFrom}
                    onChange={(v) => {
                      setDateFrom(v);
                      resetPage();
                    }}
                    placeholder="From date"
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
                  <label className="text-sm font-medium text-[#333333]">To</label>
                  <DatePicker
                    value={dateTo}
                    onChange={(v) => {
                      setDateTo(v);
                      resetPage();
                    }}
                    placeholder="To date"
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
              <label className="text-sm font-medium text-[#333333]" htmlFor="narc-location">
                Location
              </label>
              <Select
                id="narc-location"
                value={locationId}
                onChange={(e) => {
                  setLocationId(e.target.value);
                  resetPage();
                }}
                className="w-full"
                disabled={locationsLoading}
              >
                <option value="">{locationsLoading ? "Loading locations..." : "All locations"}</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>

            {productId && tab === "activity" && (
              <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-[#333333]">Product</label>
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate rounded-lg border border-[#E6ECE2] bg-[#F7F9F5] px-3 py-2 text-sm text-[#333333]">
                    {activityProduct?.productName ?? "Selected product"}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setProductId("");
                      setActivityProduct(null);
                      resetPage();
                    }}
                    className="!px-3 !py-2 !text-xs"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>

          {tab === "products" && (
            <p className="mt-3 text-xs text-[#999999]">
              Stock and batch quantities are current balances, not period activity. The date
              range applies to the Movement Activity tab.
            </p>
          )}
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
          {activeError ? (
            <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md">
                {tab === "products"
                  ? "Unable to load narcotic inventory"
                  : "Unable to load narcotic movement history"}
              </p>
              <p className="text-xs text-[#666666] max-w-md">{activeError}</p>
              <Button
                onClick={() => void (tab === "products" ? loadProducts() : loadActivity())}
              >
                Retry
              </Button>
            </div>
          ) : activeLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#4F6B4A] animate-spin" />
              <p className="text-sm text-[#666666]">
                {tab === "products"
                  ? "Loading narcotic inventory..."
                  : "Loading narcotic movement history..."}
              </p>
            </div>
          ) : tab === "products" ? (
            rows.length === 0 ? (
              <EmptyState
                title={hasFilters ? "No results found" : "No narcotic products found"}
                description={
                  hasFilters
                    ? "Try changing your search or filters."
                    : "There are currently no controlled/narcotic products matching your filters."
                }
                action={
                  hasFilters ? (
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ProductTable rows={rows} onView={setModalProduct} />
            )
          ) : activity.length === 0 ? (
            <EmptyState
              title={hasFilters ? "No results found" : "No movements recorded"}
              description={
                hasFilters
                  ? "Try changing your search or filters."
                  : "The backend returned no controlled-medicine movements."
              }
              action={
                hasFilters ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ActivityTable rows={activity} />
          )}
        </div>

        <div className="px-2 pb-4">
          <Pagination
            page={page}
            totalPages={activeMeta.totalPages}
            onPageChange={setPage}
            label={
              activeMeta.total === 0 || activeMeta.limit === 0
                ? "No records"
                : `Showing ${(page - 1) * activeMeta.limit + 1}–${Math.min(
                    page * activeMeta.limit,
                    activeMeta.total,
                  )} of ${fmtNumber(activeMeta.total)} ${
                    tab === "products" ? "products" : "movements"
                  }`
            }
          />
        </div>
      </div>

      {modalProduct && (
        <NarcoticProductModal
          product={modalProduct}
          onClose={() => setModalProduct(null)}
          onViewMovements={() => {
            setProductId(modalProduct.productId);
            setActivityProduct(modalProduct);
            setModalProduct(null);
            switchTab("activity");
          }}
        />
      )}
    </div>
  );
}

// ── Controlled products table ────────────────────────────────────────────────

function ProductTable({
  rows,
  onView,
}: {
  rows: BatchRow[];
  onView: (product: NarcoticSummaryDto) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#E6ECE2] text-left">
            {["Product", "SKU", "Location", "Batch", "Quantity", "Expiry", "Status", ""].map((h) => (
              <th key={h} className="px-4 py-3 font-semibold text-[#333333]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, product, batch }) => (
            <tr key={key} className="border-t border-[#E6ECE2] hover:bg-[#F7F9F5]">
              <td className="px-4 py-3">
                <p className="font-medium text-[#333333]">{product.productName}</p>
                <p className="text-xs text-[#666666]">
                  {product.genericName ?? "—"}
                  {product.brand ? ` · ${product.brand}` : ""}
                </p>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-[#666666] whitespace-nowrap">
                {product.sku}
              </td>
              <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                {batch?.locationName ?? "—"}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-[#666666] whitespace-nowrap">
                {batch?.batchNumber ?? "—"}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-[#333333] whitespace-nowrap">
                {batch ? qty(batch.currentQuantity) : "—"}
              </td>
              <td className="px-4 py-3">
                <ExpiryCell expiryDate={batch?.expiryDate} />
              </td>
              <td className="px-4 py-3">
                {batch ? (
                  <ExpiryBadge expiryDate={batch.expiryDate} />
                ) : (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    No stock
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <button
                  onClick={() => onView(product)}
                  className="text-xs font-semibold text-[#4F6B4A] hover:underline"
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Movement activity table ──────────────────────────────────────────────────

function ActivityTable({ rows }: { rows: NarcoticActivityDto[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#E6ECE2] text-left">
            {[
              "Date",
              "Product",
              "Batch",
              "Location",
              "Movement",
              "Qty",
              "Balance after",
              "Reference",
            ].map((h) => (
              <th key={h} className="px-4 py-3 font-semibold text-[#333333]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.transactionId} className="border-t border-[#E6ECE2] hover:bg-[#F7F9F5]">
              <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{fmtDateTime(row.date)}</td>
              <td className="px-4 py-3">
                <p className="font-medium text-[#333333]">{row.productName}</p>
                <p className="text-xs font-mono text-[#666666]">{row.sku}</p>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-[#666666] whitespace-nowrap">
                {row.batchNumber ?? "—"}
                {row.expiryDate ? (
                  <span className="block text-[#999999]">Exp {fmtDate(row.expiryDate)}</span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                {row.locationName ?? "—"}
              </td>
              <td className="px-4 py-3">
                <MovementBadge movementType={row.movementType} direction={row.direction} />
              </td>
              <td className="px-4 py-3 text-right font-semibold text-[#333333]">{qty(row.quantity)}</td>
              <td className="px-4 py-3 text-right text-[#666666]">{qty(row.balanceAfter)}</td>
              <td className="px-4 py-3 font-mono text-xs text-[#666666]">{row.reference ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}