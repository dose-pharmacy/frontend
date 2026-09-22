import { useEffect, useState } from "react";
import {
  listBatches,
  type BatchDto,
  type BatchStatusDto,
  
} from "../../features/inventory/batchesApi"; // Update the path to the correct location

import PageHeader from "../../components/ui/PageHeader";
import SearchInput from "../../components/ui/SearchInput";
import Select from "../../components/ui/Select";
import StatusBadge from "../../components/ui/StatusBadge";
import MetricCard from "../../components/ui/MetricCard";
import Pagination from "../../components/ui/Pagination";
import EmptyState from "../../components/ui/EmptyState";

const PAGE_SIZE = 20;
function mapBatchStatus(status: BatchStatusDto) {
  switch (status) {
    case "AVAILABLE":
      return "available" as const;

    case "LOW_STOCK":
      return "low_stock" as const;

    case "DEPLETED":
      return "depleted" as const;

    case "EXPIRED":
      return "expired" as const;
  }
}

export default function BatchManagementPage() {
  const [batches, setBatches] = useState<BatchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BatchStatusDto | "">("");
  const [page, setPage] = useState(1);

  const [totalPages, setTotalPages] = useState(1);
  const [totalBatches, setTotalBatches] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadBatches() {
      setLoading(true);
      setLoadError(null);

      try {
        const result = await listBatches({
          page,
          limit: PAGE_SIZE,
          search: search.trim() || undefined,
          status: statusFilter || undefined,
        });

        if (cancelled) return;

        setBatches(result.data);
        setTotalPages(Math.max(1, result.meta.totalPages));
        setTotalBatches(result.meta.total);
      } catch (err) {
        if (cancelled) return;

        setLoadError(
          err instanceof Error
            ? err.message
            : "Failed to load batches. Please try again.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBatches();

    return () => {
      cancelled = true;
    };
  }, [page, search, statusFilter]);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value as BatchStatusDto | "");
    setPage(1);
  }

  const nearExpiryCount = batches.filter(
    (batch) =>
      batch.daysUntilExpiry >= 0 && batch.daysUntilExpiry <= 30,
  ).length;

  const depletedCount = batches.filter(
    (batch) => batch.status === "DEPLETED",
  ).length;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <PageHeader
        title="Batch Management"
        subtitle="Track and manage product batches"
      />

      <div className="flex flex-col gap-6 p-6">
        {/* Error */}
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {loadError}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            title="Total Batches"
            value={totalBatches}
            icon={<BatchIcon />}
          />

          <MetricCard
            title="Near Expiry"
            value={nearExpiryCount}
            icon={<CalIcon />}
            subtitle="Within 30 days"
          />

          <MetricCard
            title="Depleted"
            value={depletedCount}
            icon={<EmptyIcon />}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#E6ECE2] bg-white p-4 sm:flex-row">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={handleSearch}
              placeholder="Search batch number..."
            />
          </div>

          <Select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="sm:w-56"
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="DEPLETED">Depleted</option>
            <option value="EXPIRED">Expired</option>
          </Select>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[#E6ECE2] bg-white">
          {loading ? (
            <div className="space-y-3 p-6 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-lg bg-[#E6ECE2]"
                />
              ))}
            </div>
          ) : batches.length === 0 ? (
            <EmptyState
              title="No batches found"
              description="Try adjusting your search or filter."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#E6ECE2]">
                      {[
                        "Batch Number",
                        "Product",
                        "Quantity",
                        "Expiry Date",
                        "Status",
                        "Actions",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="px-4 py-3 text-left font-semibold text-[#333333]"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {batches.map((batch, index) => (
                      <tr
                        key={batch.id}
                        className={
                          index % 2 === 0
                            ? "bg-white"
                            : "bg-[#E6ECE2]/30"
                        }
                      >
                        {/* Batch Number */}
                        <td className="px-4 py-3 font-mono text-xs text-[#333333]">
                          {batch.batchNumber}
                        </td>

                        {/* Product */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#333333]">
                            {batch.product.name}
                          </div>

                          <div className="text-xs text-[#666666]">
                            SKU: {batch.product.sku}
                            {batch.product.brand
                              ? ` • ${batch.product.brand}`
                              : ""}
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="px-4 py-3 font-semibold text-[#333333]">
                          {batch.totalQuantity}
                        </td>

                        {/* Expiry */}
                        <td className="px-4 py-3">
                          <div
                            className={
                              batch.daysUntilExpiry < 30 &&
                              batch.daysUntilExpiry >= 0
                                ? "font-semibold text-red-600"
                                : batch.daysUntilExpiry < 0
                                  ? "text-red-400"
                                  : "text-[#666666]"
                            }
                          >
                            {formatDate(batch.expiryDate)}
                          </div>

                          <div className="text-xs text-[#666666]">
                            {formatExpiryText(batch.daysUntilExpiry)}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                        <StatusBadge status={mapBatchStatus(batch.status)} />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              window.location.assign(
                                `/inventory/batches/${batch.id}`,
                              )
                            }
                            className="text-xs font-semibold text-[#7A9076] hover:underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function formatExpiryText(days: number) {
  if (days < 0) {
    return "Expired";
  }

  if (days === 0) {
    return "Expires today";
  }

  if (days === 1) {
    return "1 day remaining";
  }

  return `${days} days remaining`;
}

function BatchIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3"
      />
    </svg>
  );
}

function CalIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
      />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}