import { useCallback, useEffect, useRef, useState } from "react";
import {
  listLocations,
  getLocation,
  updateLocation,
  deactivateLocation,
  LocationsApiError,
  type LocationDto,
  type LocationListMeta,
} from "../../features/inventory/locationsApi";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import Modal from "../../components/ui/Modal";
import LocationFormModal from "../../components/ui/LocationFormModal";

const PAGE_LIMIT = 20;

type StatusFilter = "all" | "active" | "inactive";

function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof LocationsApiError ? err.message : fallback;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function LocationsPage() {
  // ── List state ──
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [meta, setMeta] = useState<LocationListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const requestSeq = useRef(0);

  // ── Modal state ──
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<LocationDto | null>(null);
  const [detailTarget, setDetailTarget] = useState<LocationDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Deactivate / reactivate confirmation
  const [confirmTarget, setConfirmTarget] = useState<LocationDto | null>(null);
  const [confirmAction, setConfirmAction] = useState<"deactivate" | "reactivate">(
    "deactivate",
  );
  const [confirmBusy, setConfirmBusy] = useState(false);

  // ── Load locations from the API (server-side search + pagination) ──
  const reload = useCallback(
    async (searchTerm: string, pageNum: number, filter: StatusFilter) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setLoadError(null);
      try {
        const res = await listLocations({
          page: pageNum,
          limit: PAGE_LIMIT,
          search: searchTerm.trim() || undefined,
          isActive: filter === "all" ? undefined : filter === "active",
        });
        if (seq !== requestSeq.current) return;
        setLocations(res.data);
        setMeta(res.meta);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setLoadError(
          apiErrorMessage(err, "Failed to load locations. Please try again."),
        );
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const t = setTimeout(
      () => void reload(search, page, statusFilter),
      search ? 300 : 0,
    );
    return () => clearTimeout(t);
  }, [reload, search, page, statusFilter]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  function openAdd() {
    setEditTarget(null);
    setFormMode("add");
  }

  function openEdit(loc: LocationDto) {
    setEditTarget(loc);
    setFormMode("edit");
  }

  // ── Detail: open with row data, then refetch the full record ──
  function openDetail(loc: LocationDto) {
    setDetailTarget(loc);
    setDetailLoading(true);
    getLocation(loc.id)
      .then((fresh) =>
        setDetailTarget((cur) => (cur?.id === fresh.id ? fresh : cur)),
      )
      .catch(() => {
        /* keep the row data if the refetch fails */
      })
      .finally(() => setDetailLoading(false));
  }

  function requestToggleActive(loc: LocationDto) {
    setConfirmAction(loc.isActive ? "deactivate" : "reactivate");
    setConfirmTarget(loc);
  }

  // ── Deactivate = DELETE (soft delete); reactivate = PATCH isActive: true ──
  async function confirmToggleActive() {
    const loc = confirmTarget;
    if (!loc) return;
    setConfirmBusy(true);
    setLoadError(null);
    try {
      if (confirmAction === "deactivate") {
        await deactivateLocation(loc.id);
      } else {
        await updateLocation(loc.id, { isActive: true });
      }
      setConfirmTarget(null);
      await reload(search, page, statusFilter);
    } catch (err) {
      setLoadError(
        apiErrorMessage(
          err,
          "Could not update the location status. Please try again.",
        ),
      );
      setConfirmTarget(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  const totalLocations = meta?.total ?? locations.length;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Settings / Locations"
        title="Locations"
        subtitle="Manage pharmacy storage locations."
        actions={<Button onClick={openAdd}>+ Add Location</Button>}
      />

      <div className="flex-1 overflow-y-auto p-6 pb-12 flex flex-col gap-6">
        {/* Error banner */}
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{loadError}</p>
            <Button
              variant="secondary"
              onClick={() => void reload(search, page, statusFilter)}
              className="flex-shrink-0"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Toolbar: search + status filter + pagination info */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by location name…"
              className="w-full rounded-lg border border-[#E6ECE2] pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#333333]"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(["all", "active", "inactive"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                  statusFilter === s
                    ? "bg-[#B6C8AF] border-[#B6C8AF] text-[#333333]"
                    : "border-[#C6D4BF] text-[#666666] hover:bg-[#E6ECE2]"
                }`}
              >
                {s === "all" ? "All" : s === "active" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>

          {!loading && meta && (
            <span className="text-xs text-[#666666]">
              {totalLocations} location{totalLocations !== 1 ? "s" : ""} · Page{" "}
              {meta.page} of {totalPages}
            </span>
          )}
        </div>

        {/* Location Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-xl bg-[#E6ECE2] animate-pulse"
              />
            ))}
          </div>
        ) : locations.length === 0 ? (
          <EmptyState
            title={
              search.trim() || statusFilter !== "all"
                ? "No locations match your filters"
                : "No locations configured"
            }
            description={
              search.trim() || statusFilter !== "all"
                ? "Try a different search term or filter."
                : "Add storage locations to track stock across your pharmacy."
            }
            action={
              search.trim() || statusFilter !== "all" ? undefined : (
                <Button onClick={openAdd}>Add Location</Button>
              )
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  onClick={() => openDetail(loc)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openDetail(loc);
                  }}
                  className={`group bg-white rounded-xl border p-5 flex flex-col gap-3 cursor-pointer transition-shadow hover:shadow-md ${
                    loc.isActive ? "border-[#E6ECE2]" : "border-gray-200 opacity-60"
                  }`}
                >
                  {/* Header: name/desc + status pill + delete icon on hover */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#333333] truncate">
                        {loc.name}
                      </p>
                      <p className="text-xs text-[#666666] mt-0.5 line-clamp-2">
                        {loc.description || "—"}
                      </p>
                    </div>

                    <div className="ml-3 flex-shrink-0 flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                          loc.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {loc.isActive ? "Active" : "Inactive"}
                      </span>

                      {/* Trash = deactivate (soft delete). Hidden until hover. */}
                      {loc.isActive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            requestToggleActive(loc);
                          }}
                          aria-label={`Deactivate ${loc.name}`}
                          title="Deactivate location"
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded-md p-1.5 text-[#666666] hover:text-red-600 hover:bg-red-50"
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.75 1a.75.75 0 00-.75.75V3H4.5a.75.75 0 000 1.5h.607l.75 11.25A2.25 2.25 0 007.35 18h5.3a2.25 2.25 0 002.243-2.25l.75-11.25H16.5A.75.75 0 0016.5 3h-3.5V1.75a.75.75 0 00-.75-.75h-3.5zM6.113 4.5l.74 11.11c.018.272.245.39.5.39h5.294c.255 0 .482-.118.5-.39l.74-11.11H6.113zM8.5 7.5a.75.75 0 00-1.5 0v6a.75.75 0 001.5 0v-6zm4.5 0a.75.75 0 00-1.5 0v6a.75.75 0 001.5 0v-6z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="flex gap-2 mt-auto pt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        alert(
                          `View stock at ${loc.name} — backend integration pending`,
                        );
                      }}
                      className="flex-1 rounded-lg border border-[#C6D4BF] px-3 py-1.5 text-xs font-semibold text-[#7A9076] hover:bg-[#E6ECE2] transition-colors"
                    >
                      View Stock
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(loc);
                      }}
                      className="flex-1 rounded-lg border border-[#C6D4BF] px-3 py-1.5 text-xs font-semibold text-[#666666] hover:bg-[#E6ECE2] transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  ← Previous
                </Button>
                <span className="text-xs text-[#666666]">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next →
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─────────── Detail Modal ─────────── */}
      <Modal
        open={!!detailTarget}
        title="Location Details"
        onClose={() => setDetailTarget(null)}
        size="sm"
      >
        {detailTarget && (
          <div className="flex flex-col gap-2">
            <DetailRow label="Name" value={detailTarget.name} />
            <DetailRow
              label="Description"
              value={detailLoading ? "…" : detailTarget.description || "—"}
            />
            <DetailRow
              label="Status"
              value={
                <span
                  className={`inline-block text-xs font-semibold rounded-full px-2.5 py-1 ${
                    detailTarget.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {detailTarget.isActive ? "Active" : "Inactive"}
                </span>
              }
            />
            <DetailRow
              label="Created At"
              value={formatDate(detailTarget.createdAt)}
            />
            <DetailRow
              label="Updated At"
              value={formatDate(detailTarget.updatedAt)}
            />

            <div className="flex gap-3 justify-end pt-3">
              <Button variant="secondary" onClick={() => setDetailTarget(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  const loc = detailTarget;
                  setDetailTarget(null);
                  openEdit(loc);
                }}
              >
                Edit Location
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add/Edit location modal (shared — also used by the Add Stock form) */}
      <LocationFormModal
        open={formMode !== null}
        mode={formMode === "edit" ? "edit" : "add"}
        location={editTarget}
        onClose={() => setFormMode(null)}
        onSaved={async () => {
          await reload(search, page, statusFilter)
        }}
      />

      {/* ─────────── Confirm Deactivate / Reactivate Modal ─────────── */}
      <Modal
        open={!!confirmTarget}
        title={
          confirmAction === "deactivate"
            ? "Deactivate Location"
            : "Reactivate Location"
        }
        onClose={() => {
          if (confirmBusy) return;
          setConfirmTarget(null);
        }}
        size="sm"
      >
        {confirmTarget && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  confirmAction === "deactivate"
                    ? "bg-amber-100 text-amber-600"
                    : "bg-green-100 text-green-600"
                }`}
              >
                {confirmAction === "deactivate" ? (
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
                      d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    />
                  </svg>
                ) : (
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>

              <div className="flex-1">
                <p className="text-sm font-semibold text-[#333333]">
                  {confirmAction === "deactivate" ? (
                    <>Deactivate “{confirmTarget.name}”?</>
                  ) : (
                    <>Reactivate “{confirmTarget.name}”?</>
                  )}
                </p>
                <p className="text-sm text-[#666666] mt-1">
                  {confirmAction === "deactivate" ? (
                    <>
                      This is a soft delete — the location becomes inactive and
                      won't be offered for new stock. Existing records keep it.
                      You can reactivate it anytime.
                    </>
                  ) : (
                    <>
                      This location will become available again for stock
                      movements.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => setConfirmTarget(null)}
                disabled={confirmBusy}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void confirmToggleActive()}
                loading={confirmBusy}
              >
                {confirmAction === "deactivate"
                  ? "Yes, Deactivate"
                  : "Yes, Reactivate"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-2 border-b border-[#E6ECE2] last:border-b-0">
      <span className="text-xs font-medium text-[#666666] uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm text-[#333333] text-right">{value}</span>
    </div>
  );
}