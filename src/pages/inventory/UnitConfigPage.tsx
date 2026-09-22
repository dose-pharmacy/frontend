import { useCallback, useEffect, useRef, useState } from "react";
import {
  createUnit,
  deactivateUnit,
  getUnit,
  listUnits,
  updateUnit,
  UnitsApiError,
  type UnitDto,
} from "../../features/inventory/unitsApi";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type UnitFormData = {
  name: string;
  symbol: string;
  description: string;
  isActive: boolean;
};

const emptyForm: UnitFormData = {
  name: "",
  symbol: "",
  description: "",
  isActive: true,
};

const PREVIEW_COUNT = 5;

// ─────────────────────────────────────────────────────────────
// Toggle Switch Component
// ─────────────────────────────────────────────────────────────
function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#B6C8AF] focus:ring-offset-2 ${
          checked ? "bg-[#B6C8AF]" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      {label && (
        <span className="text-sm font-medium text-[#333333]">
          {checked ? "Active" : "Inactive"}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal Wrapper
// ─────────────────────────────────────────────────────────────
function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6ECE2]">
          <h2 className="text-lg font-bold text-[#333333]">{title}</h2>
          <button
            onClick={onClose}
            className="text-[#666666] hover:text-[#333333] text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-[#E6ECE2] flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Unit Form (used in both Add & Edit)
// ─────────────────────────────────────────────────────────────
function UnitForm({
  form,
  setForm,
}: {
  form: UnitFormData;
  setForm: (f: UnitFormData) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-semibold text-[#333333] mb-1">
          Unit Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Kilogram"
          className="w-full rounded-lg border border-[#E6ECE2] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#333333] mb-1">
          Symbol <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.symbol}
          onChange={(e) => setForm({ ...form, symbol: e.target.value })}
          placeholder="e.g. kg"
          className="w-full rounded-lg border border-[#E6ECE2] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#333333] mb-1">
          Description
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Optional description for this unit..."
          rows={3}
          className="w-full rounded-lg border border-[#E6ECE2] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B6C8AF] resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#333333] mb-2">
          Status
        </label>
        <ToggleSwitch
          checked={form.isActive}
          onChange={(v) => setForm({ ...form, isActive: v })}
          label={form.isActive ? "Active" : "Inactive"}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function UnitConfigPage() {
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const requestSeq = useRef(0);

  // Modal state
  const [addOpen, setAddOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<UnitDto | null>(null);
  const [detailUnit, setDetailUnit] = useState<UnitDto | null>(null);

  // Pending-operation state
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form state
  const [addForm, setAddForm] = useState<UnitFormData>(emptyForm);
  const [editForm, setEditForm] = useState<UnitFormData>(emptyForm);

  // ── Load units from the API ──
  const reload = useCallback(async (searchTerm: string) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listUnits({
        page: 1,
        limit: 100,
        search: searchTerm.trim() || undefined,
      });
      if (seq !== requestSeq.current) return;
      setUnits(res.data);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setLoadError(
        err instanceof UnitsApiError
          ? err.message
          : "Failed to load units. Please try again.",
      );
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void reload(search), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [reload, search]);

  // Reset to preview view whenever the search query changes
  useEffect(() => {
    setShowAll(false);
  }, [search]);

  const active = units.filter((u) => u.isActive);
  const inactive = units.filter((u) => !u.isActive);

  // Visible rows: preview (first N) or all
  const visibleUnits = showAll ? units : units.slice(0, PREVIEW_COUNT);
  const hasMore = units.length > PREVIEW_COUNT;

  // ── Detail handlers ──
  const openDetail = (u: UnitDto) => {
    setDetailUnit(u);
    getUnit(u.id)
      .then((fresh) =>
        setDetailUnit((cur) => (cur?.id === fresh.id ? fresh : cur)),
      )
      .catch(() => {
        /* keep the row data if the refetch fails */
      });
  };

  // ── Add handlers ──
  const openAdd = () => {
    setAddForm(emptyForm);
    setActionError(null);
    setAddOpen(true);
  };

  const handleAddSubmit = async () => {
    if (!addForm.name.trim() || !addForm.symbol?.trim()) return;
    setCreating(true);
    setActionError(null);
    try {
      await createUnit({
        name: addForm.name,
        symbol: addForm.symbol,
        description: addForm.description.trim() || null,
        isActive: addForm.isActive,
      });
      setAddOpen(false);
      await reload(search);
    } catch (err) {
      setActionError(
        err instanceof UnitsApiError
          ? err.message
          : "Could not create the unit. Please try again.",
      );
    } finally {
      setCreating(false);
    }
  };

  // ── Edit handlers ──
  const openEdit = (u: UnitDto) => {
    setEditForm({
      name: u.name,
      symbol: u.symbol,
      description: u.description ?? "",
      isActive: u.isActive,
    });
    setActionError(null);
    setEditUnit(u);
  };

  const handleEditSubmit = async () => {
    if (!editUnit) return;
    if (!editForm.name?.trim() || !editForm.symbol?.trim()) return;
    //if (!editForm.name.trim() || !editForm.symbol.trim()) return;
    setSaving(true);
    setActionError(null);
    try {
      await updateUnit(editUnit.id, {
        name: editForm.name,
        symbol: editForm.symbol,
        description: editForm.description.trim() || null,
        isActive: editForm.isActive,
      });
      setEditUnit(null);
      await reload(search);
    } catch (err) {
      setActionError(
        err instanceof UnitsApiError
          ? err.message
          : "Could not save the unit. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle status directly from row ──
  const toggleStatus = async (u: UnitDto) => {
    setTogglingId(u.id);
    setLoadError(null);
    try {
      if (u.isActive) {
        await deactivateUnit(u.id);
      } else {
        await updateUnit(u.id, { isActive: true });
      }
      await reload(search);
    } catch (err) {
      setLoadError(
        err instanceof UnitsApiError
          ? err.message
          : "Could not update the unit status. Please try again.",
      );
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Settings / Units"
        title="Units"
        subtitle="Manage reusable inventory units."
        actions={<Button onClick={openAdd}>+ Add Unit</Button>}
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
            <p className="text-xs font-medium text-[#666666] uppercase tracking-wide">
              Total Units
            </p>
            <p className="text-2xl font-bold text-[#333333] mt-1">
              {loading ? "—" : units.length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
            <p className="text-xs font-medium text-[#666666] uppercase tracking-wide">
              Active
            </p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {loading ? "—" : active.length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
            <p className="text-xs font-medium text-[#666666] uppercase tracking-wide">
              Inactive
            </p>
            <p className="text-2xl font-bold text-[#666666] mt-1">
              {loading ? "—" : inactive.length}
            </p>
          </div>
        </div>

        {/* Error banner */}
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{loadError}</p>
            <Button
              variant="secondary"
              onClick={() => void reload(search)}
              className="flex-shrink-0"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Units Table */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
          {/* Toolbar: search + view-all toggle */}
          <div className="px-4 py-3 border-b border-[#E6ECE2] flex flex-wrap items-center justify-between gap-3">
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
                placeholder="Search by name or symbol…"
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

            {/* View All / Show Less toggle */}
            {!loading && units.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#666666]">
                  {showAll
                    ? `Showing all ${units.length} unit${units.length !== 1 ? "s" : ""}`
                    : `Showing ${visibleUnits.length} of ${units.length}`}
                </span>
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="text-xs font-semibold text-[#7A9076] hover:underline flex items-center gap-1"
                  >
                    {showAll ? (
                      <>
                        Show Less
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden
                        >
                          <path
                            fillRule="evenodd"
                            d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </>
                    ) : (
                      <>
                        View All ({units.length})
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-[#E6ECE2]" />
              ))}
            </div>
          ) : units.length === 0 ? (
            <EmptyState
              title={
                search.trim()
                  ? "No units match your search"
                  : "No units configured"
              }
              description={
                search.trim()
                  ? "Try a different name or symbol."
                  : "Add master units to configure product packaging and conversions."
              }
              action={
                search.trim() ? undefined : (
                  <Button onClick={openAdd}>+ Add Unit</Button>
                )
              }
            />
          ) : (
            <>
              <div
                className={`overflow-x-auto ${
                  showAll ? "max-h-[520px] overflow-y-auto" : ""
                }`}
              >
                <table className="w-full text-sm">
                  <thead
                    className={
                      showAll ? "sticky top-0 z-10 bg-[#E6ECE2]" : ""
                    }
                  >
                    <tr className="bg-[#E6ECE2] text-left">
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Unit Name
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Symbol
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Products Using
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Status
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUnits.map((u, i) => (
                      <tr
                        key={u.id}
                        onClick={() => openDetail(u)}
                        className={`cursor-pointer transition-colors hover:bg-[#E6ECE2]/60 ${
                          i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"
                        }`}
                      >
                        <td className="px-4 py-3 font-semibold text-[#333333]">
                          {u.name}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-[#666666]">
                          {u.symbol}
                        </td>
                        <td className="px-4 py-3 text-[#666666]">
                          {u.productCount} product
                          {u.productCount !== 1 ? "s" : ""}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                              u.isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {u.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => openEdit(u)}
                            disabled={togglingId === u.id}
                            className="text-xs font-semibold text-[#7A9076] hover:underline mr-3 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => void toggleStatus(u)}
                            disabled={togglingId === u.id}
                            className="text-xs font-semibold text-[#666666] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {togglingId === u.id
                              ? "Saving…"
                              : u.isActive
                                ? "Deactivate"
                                : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer strip when preview mode has hidden rows */}
              {!showAll && hasMore && (
                <div className="px-4 py-3 border-t border-[#E6ECE2] bg-[#E6ECE2]/20 flex items-center justify-between">
                  <span className="text-xs text-[#666666]">
                    {units.length - visibleUnits.length} more unit
                    {units.length - visibleUnits.length !== 1 ? "s" : ""} not
                    shown
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="text-xs font-semibold text-[#7A9076] hover:underline"
                  >
                    View All →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Info note */}
        <div className="rounded-xl bg-[#E6ECE2] px-5 py-4 flex gap-3 items-start">
          <svg
            className="h-5 w-5 text-[#7A9076] mt-0.5 flex-shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="text-sm font-semibold text-[#333333]">
              Master Units are reusable
            </p>
            <p className="text-xs text-[#666666] mt-0.5">
              These units are shared across all products. Product-specific
              conversions and pricing are configured inside each product.
            </p>
          </div>
        </div>
      </div>

      {/* ─────────── ADD UNIT MODAL ─────────── */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Unit"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setAddOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleAddSubmit()}
              loading={creating}
              disabled={!addForm.name.trim() || !addForm.symbol?.trim()}
            >
              Create Unit
            </Button>
          </>
        }
      >
        {actionError && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </p>
        )}
        <UnitForm form={addForm} setForm={setAddForm} />
      </Modal>

      {/* ─────────── EDIT UNIT MODAL ─────────── */}
      <Modal
        open={!!editUnit}
        onClose={() => setEditUnit(null)}
        title={`Edit Unit — ${editUnit?.name ?? ""}`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEditUnit(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleEditSubmit()}
              loading={saving}
              disabled={!editForm.name?.trim() || !editForm.symbol?.trim()}
             // disabled={!editForm.name.trim() || !editForm.symbol.trim()}
            >
              Save Changes
            </Button>
          </>
        }
      >
        {actionError && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </p>
        )}
        <UnitForm form={editForm} setForm={setEditForm} />
      </Modal>

      {/* ─────────── UNIT DETAIL MODAL ─────────── */}
      <Modal
        open={!!detailUnit}
        onClose={() => setDetailUnit(null)}
        title="Unit Details"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDetailUnit(null)}>
              Close
            </Button>
            {detailUnit && (
              <Button
                onClick={() => {
                  const u = detailUnit;
                  setDetailUnit(null);
                  openEdit(u);
                }}
              >
                Edit Unit
              </Button>
            )}
          </>
        }
      >
        {detailUnit && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-[#E6ECE2] flex items-center justify-center font-mono font-bold text-[#7A9076]">
                {detailUnit.symbol}
              </div>
              <div>
                <p className="text-lg font-bold text-[#333333]">
                  {detailUnit.name}
                </p>
                <span
                  className={`inline-block text-xs font-semibold rounded-full px-2.5 py-1 mt-1 ${
                    detailUnit.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {detailUnit.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">
                  Symbol
                </p>
                <p className="font-mono text-[#333333] mt-1">
                  {detailUnit.symbol}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">
                  Products Using
                </p>
                <p className="text-[#333333] mt-1">
                  {detailUnit.productCount} product
                  {detailUnit.productCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">
                  Description
                </p>
                <p className="text-[#333333] mt-1">
                  {detailUnit.description || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">
                  Created At
                </p>
                <p className="text-[#333333] mt-1">
                  {detailUnit.createdAt
                    ? new Date(detailUnit.createdAt).toLocaleString()
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">
                  Updated At
                </p>
                <p className="text-[#333333] mt-1">
                  {detailUnit.updatedAt
                    ? new Date(detailUnit.updatedAt).toLocaleString()
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}