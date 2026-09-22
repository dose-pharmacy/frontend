import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  createProduct,
  listInventoryProducts,
  ProductsApiError,
  type InventoryProductDto,
  type ListMeta,
} from "../../features/inventory/productsApi";
import { searchProductGroups } from "../../features/inventory/searchSelectors";
import { useSearchableResource } from "../../hooks/useSearchableResource";
import { listUnits, type UnitDto } from "../../features/inventory/unitsApi";
import SearchInput from "../../components/ui/SearchInput";
import SearchableSelect from "../../components/ui/SearchableSelect";
import type { SearchableOption } from "../../components/ui/SearchableSelect";
import Select from "../../components/ui/Select";
import StatusBadge from "../../components/ui/StatusBadge";
import Pagination from "../../components/ui/Pagination";
import EmptyState from "../../components/ui/EmptyState";
import Button from "../../components/ui/Button";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import NarcoticBadge from "../../components/ui/NarcoticBadge";

const PAGE_SIZE = 20;

// ─────────────────────────────────────────────────────────────
// Create form types
// ─────────────────────────────────────────────────────────────
interface UnitRow {
  unitId: string;
  conversionFactor: string;
  sellPrice: string;
  purchasePrice: string;
  isBaseUnit: boolean;
}

interface ProductForm {
  name: string;
  genericName: string;
  brand: string;
  sku: string;
  productGroupId: string;
  description: string;
  minimumStock: string;
  reorderPoint: string;
  isActive: boolean;
  isNarcotic: boolean;
  units: UnitRow[];
}

function emptyProductForm(): ProductForm {
  return {
    name: "",
    genericName: "",
    brand: "",
    sku: "",
    productGroupId: "",
    description: "",
    minimumStock: "",
    reorderPoint: "",
    isActive: true,
    isNarcotic: false,
    units: [
      {
        unitId: "",
        conversionFactor: "1",
        sellPrice: "",
        purchasePrice: "",
        isBaseUnit: true,
      },
    ],
  };
}

function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ProductsApiError ? err.message : fallback;
}



// ─────────────────────────────────────────────────────────────
// Toggle Switch
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
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#49B0C1] focus:ring-offset-2 ${
          checked ? "bg-[#49B0C1]" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      {label && (
        <span className="text-sm font-medium text-[#333333]">{label}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const navigate = useNavigate();

  // ── Product list ──
  const [products, setProducts] = useState<InventoryProductDto[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Reference data ──
  const [units, setUnits] = useState<UnitDto[]>([]);

  const groupFilterSearch = useSearchableResource(searchProductGroups);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [page, setPage] = useState(1);
  const requestSeq = useRef(0);

  // ── Create modal state ──
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyProductForm());
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const selectedFilterGroup = groupFilterSearch.options.find((o) => o.value === groupFilter) ?? null;
  const groupFilterOptions: SearchableOption[] = selectedFilterGroup
    ? [selectedFilterGroup, ...groupFilterSearch.options.filter((o) => o.value !== groupFilter)]
    : groupFilterSearch.options;
  const createGroupSearch = useSearchableResource(searchProductGroups, createOpen);
  const selectedCreateGroup = createGroupSearch.options.find((o) => o.value === form.productGroupId) ?? null;
  const createGroupOptions: SearchableOption[] = selectedCreateGroup
    ? [selectedCreateGroup, ...createGroupSearch.options.filter((o) => o.value !== form.productGroupId)]
    : createGroupSearch.options;

  // ── Load reference data ──
  useEffect(() => {
    let cancelled = false;
    listUnits({ limit: 100 })
      .catch(() => ({ data: [] as UnitDto[] }))
      .then((u) => {
        if (cancelled) return;
        setUnits(u.data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Load products ──
  const reload = useCallback(
    async (
      searchTerm: string,
      status: string,
      groupId: string,
      pageNum: number,
    ) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setLoadError(null);
      try {
        const res = await listInventoryProducts({
          page: pageNum,
          limit: PAGE_SIZE,
          search: searchTerm.trim() || undefined,
          productGroupId: groupId || undefined,
          stockStatus: status || undefined,
        });
        if (seq !== requestSeq.current) return;
        setProducts(res.data);
        setMeta(res.meta);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setLoadError(
          apiErrorMessage(err, "Failed to load products. Please try again."),
        );
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const t = setTimeout(
      () => void reload(search, statusFilter, groupFilter, page),
      search ? 300 : 0,
    );
    return () => clearTimeout(t);
  }, [reload, search, statusFilter, groupFilter, page]);

  const filtered = products;
  const totalPages = meta?.totalPages ?? 1;

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  function formatExpiry(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // ─────────────────────────────────────────────────────────
  // Create handlers
  // ─────────────────────────────────────────────────────────
  function openCreate() {
    setForm(emptyProductForm());
    setFieldErrors({});
    setFormError(null);
    setCreateOpen(true);
  }

  function closeCreate() {
    if (creating) return;
    setCreateOpen(false);
  }

  function updateRow(idx: number, patch: Partial<UnitRow>) {
    setForm((f) => {
      const unitsNext = f.units.map((r, i) =>
        i === idx ? { ...r, ...patch } : r,
      );
      return { ...f, units: unitsNext };
    });
  }

  function setBaseRow(idx: number) {
    setForm((f) => {
      const unitsNext = f.units.map((r, i) => ({
        ...r,
        isBaseUnit: i === idx,
        conversionFactor: i === idx ? "1" : r.conversionFactor,
      }));
      return { ...f, units: unitsNext };
    });
  }

  function addRow() {
    setForm((f) => {
      const used = new Set(f.units.map((r) => r.unitId));
      const available = units.find((u) => !used.has(u.id));
      return {
        ...f,
        units: [
          ...f.units,
          {
            unitId: available?.id ?? "",
            conversionFactor: "1",
            sellPrice: "",
            purchasePrice: "",
            isBaseUnit: false,
          },
        ],
      };
    });
  }

  function removeRow(idx: number) {
    setForm((f) => {
      const row = f.units[idx];
      if (row.isBaseUnit) return f;
      return { ...f, units: f.units.filter((_, i) => i !== idx) };
    });
  }

  function validateForm(f: ProductForm): boolean {
    const errs: Record<string, string> = {};

    if (!f.name.trim()) errs.name = "Product name is required.";
    if (!f.sku.trim()) errs.sku = "SKU is required.";
    if (!f.productGroupId) errs.productGroupId = "Select a product group.";

    if (
      f.minimumStock === "" ||
      isNaN(Number(f.minimumStock)) ||
      Number(f.minimumStock) < 0
    )
      errs.minimumStock = "Minimum stock must be 0 or more.";

    if (
      f.reorderPoint === "" ||
      isNaN(Number(f.reorderPoint)) ||
      Number(f.reorderPoint) < 0
    )
      errs.reorderPoint = "Reorder point must be 0 or more.";

    if (f.units.length === 0)
      errs.units = "At least one unit is required.";

    if (f.units.filter((u) => u.isBaseUnit).length !== 1)
      errs.units = "Exactly one unit must be marked as base.";

    f.units.forEach((u, i) => {
      if (!u.unitId) errs[`u${i}.unitId`] = "Select a unit.";
      const cf = Number(u.conversionFactor);
      if (isNaN(cf) || cf < 1)
        errs[`u${i}.conversionFactor`] = "Conversion factor must be ≥ 1.";
      if (
        u.sellPrice === "" ||
        isNaN(Number(u.sellPrice)) ||
        Number(u.sellPrice) < 0
      )
        errs[`u${i}.sellPrice`] = "Enter a valid sell price.";
      if (
        u.purchasePrice === "" ||
        isNaN(Number(u.purchasePrice)) ||
        Number(u.purchasePrice) < 0
      )
        errs[`u${i}.purchasePrice`] = "Enter a valid purchase price.";
    });

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleCreate() {
    if (!validateForm(form)) return;

    setCreating(true);
    setFormError(null);

    try {
      await createProduct({
        name: form.name.trim(),
        genericName: form.genericName.trim() || null,
        brand: form.brand.trim() || null,
        sku: form.sku.trim(),
        productGroupId: form.productGroupId,
        description: form.description.trim() || null,
        minimumStock: Number(form.minimumStock),
        reorderPoint: Number(form.reorderPoint),
        isActive: form.isActive,
        isNarcotic: form.isNarcotic,
        units: form.units.map((u) => ({
          unitId: u.unitId,
          conversionFactor: Number(u.conversionFactor),
          sellPrice: Number(u.sellPrice),
          purchasePrice: Number(u.purchasePrice),
          isBaseUnit: u.isBaseUnit,
        })),
      });

      setCreateOpen(false);
      await reload(search, statusFilter, groupFilter, 1);
      setPage(1);
    } catch (err) {
      setFormError(
        apiErrorMessage(
          err,
          "Could not create the product. Please check your input and try again.",
        ),
      );
    } finally {
      setCreating(false);
    }
  }

  // Base unit for pricing summary
  const baseRow = form.units.find((u) => u.isBaseUnit);
  const baseUnit = units.find((u) => u.id === baseRow?.unitId);
  const baseSell = Number(baseRow?.sellPrice || 0);
  const pricingSummary = baseUnit
    ? form.units
        .filter((u) => u.unitId && !u.isBaseUnit)
        .map((u) => {
          const unit = units.find((x) => x.id === u.unitId);
          const cf = Number(u.conversionFactor || 1);
          const perBase = cf > 0 ? baseSell / cf : 0;
          return `1 ${unit?.name ?? "?"} = ${perBase.toFixed(2)} ETB/${baseUnit.name}`;
        })
        .join(" · ")
    : "";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Inventory / Products"
        title="Products"
        subtitle="Manage medicines and inventory items."
        actions={<Button onClick={openCreate}>+ Add Product</Button>}
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{loadError}</p>
            <button
              type="button"
              onClick={() =>
                void reload(search, statusFilter, groupFilter, page)
              }
              className="text-sm font-semibold text-red-700 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <SearchInput
                value={search}
                onChange={handleSearch}
                placeholder="Search by name, SKU, generic name, brand..."
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="sm:w-44"
            >
              <option value="">All Statuses</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </Select>
            <div className="sm:w-48">
              <SearchableSelect
                value={groupFilter || null}
                onChange={(v) => {
                  setGroupFilter(v);
                  setPage(1);
                }}
                options={groupFilterOptions}
                onSearch={groupFilterSearch.setTerm}
                loading={groupFilterSearch.loading}
                error={groupFilterSearch.error}
                onRetry={groupFilterSearch.retry}
                allowClear
                placeholder="All Groups"
                searchPlaceholder="Search groups..."
                emptyMessage="No groups found"
                noResultsMessage="No groups matching your search"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          {loading ? (
            <LoadingSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No products found"
              description="Try adjusting your search or filters."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#DBEFF3] text-left">
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Product
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        SKU
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden sm:table-cell">
                        Group
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Stock
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden md:table-cell">
                        Base Unit
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden lg:table-cell">
                        Nearest Expiry
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
                    {filtered.map((product, i) => (
                      <tr
                        key={product.id}
                        className={
                          i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"
                        }
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-[#333333]">
                              {product.name}
                              {product.isNarcotic && <NarcoticBadge />}
                            </p>
                            <p className="text-xs text-[#666666]">
                              {product.genericName ?? "—"} ·{" "}
                              {product.brand ?? "—"}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666]">
                          {product.sku}
                        </td>
                        <td className="px-4 py-3 text-[#666666] hidden sm:table-cell">
                          {product.productGroup?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#333333]">
                          {product.totalStock.toLocaleString()}
                          {product.baseUnit?.name
                            ? ` ${product.baseUnit.name}`
                            : ""}
                        </td>
                        <td className="px-4 py-3 text-[#666666] hidden md:table-cell">
                          {product.baseUnit?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#666666] hidden lg:table-cell">
                          {product.nearestExpiry
                            ? formatExpiry(product.nearestExpiry.expiryDate)
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={mapStockStatus(product.stockStatus)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              navigate(`/inventory/products/${product.id}`)
                            }
                            className="text-xs font-semibold text-[#49B0C1] hover:underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-3 border-t border-[#DBEFF3] flex items-center justify-between">
                <p className="text-xs text-[#666666]">
                  Showing {filtered.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}
                  –
                  {Math.min(page * PAGE_SIZE, meta?.total ?? 0)} of{" "}
                  {meta?.total ?? 0} products
                </p>
                {totalPages > 1 && (
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─────────── ADD PRODUCT MODAL ─────────── */}
      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Create Product"
        size="lg"
      >
        <div className="flex flex-col gap-6">
          {formError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          {/* Basic Information */}
          <section className="flex flex-col gap-4">
            <h4 className="text-sm font-bold text-[#333333] uppercase tracking-wide">
              Basic Information
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#333333]">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Amoxicillin 500mg"
                  className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#49B0C1] focus:outline-none focus:ring-2 focus:ring-[#49B0C1]/20"
                />
                {fieldErrors.name && (
                  <p className="text-xs text-red-600">{fieldErrors.name}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#333333]">
                  Generic Name
                </label>
                <input
                  type="text"
                  value={form.genericName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, genericName: e.target.value }))
                  }
                  placeholder="e.g. Amoxicillin"
                  className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#49B0C1] focus:outline-none focus:ring-2 focus:ring-[#49B0C1]/20"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#333333]">
                  Brand
                </label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, brand: e.target.value }))
                  }
                  placeholder="e.g. Example"
                  className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#49B0C1] focus:outline-none focus:ring-2 focus:ring-[#49B0C1]/20"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#333333]">
                  SKU <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.sku}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sku: e.target.value }))
                  }
                  placeholder="e.g. AMOX-500-002"
                  className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3.5 py-2.5 text-sm font-mono text-[#333333] focus:border-[#49B0C1] focus:outline-none focus:ring-2 focus:ring-[#49B0C1]/20"
                />
                {fieldErrors.sku && (
                  <p className="text-xs text-red-600">{fieldErrors.sku}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#333333]">
                Product Group <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={form.productGroupId || null}
                onChange={(v) =>
                  setForm((f) => ({ ...f, productGroupId: v }))
                }
                options={createGroupOptions}
                onSearch={createGroupSearch.setTerm}
                loading={createGroupSearch.loading}
                error={createGroupSearch.error}
                onRetry={createGroupSearch.retry}
                placeholder="— Select a group —"
                searchPlaceholder="Search groups..."
                emptyMessage="No groups found"
                noResultsMessage="No groups matching your search"
              />
              {fieldErrors.productGroupId && (
                <p className="text-xs text-red-600">
                  {fieldErrors.productGroupId}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#333333]">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
                placeholder="Amoxicillin 500mg capsules"
                className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#49B0C1] focus:outline-none focus:ring-2 focus:ring-[#49B0C1]/20 resize-none"
              />
            </div>
          </section>

          {/* Stock Thresholds */}
          <section className="flex flex-col gap-4">
            <h4 className="text-sm font-bold text-[#333333] uppercase tracking-wide">
              Stock Thresholds
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#333333]">
                  Minimum Stock <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.minimumStock}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, minimumStock: e.target.value }))
                  }
                  className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#49B0C1] focus:outline-none focus:ring-2 focus:ring-[#49B0C1]/20"
                />
                {fieldErrors.minimumStock && (
                  <p className="text-xs text-red-600">
                    {fieldErrors.minimumStock}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#333333]">
                  Reorder Point <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.reorderPoint}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reorderPoint: e.target.value }))
                  }
                  className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#49B0C1] focus:outline-none focus:ring-2 focus:ring-[#49B0C1]/20"
                />
                {fieldErrors.reorderPoint && (
                  <p className="text-xs text-red-600">
                    {fieldErrors.reorderPoint}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Units & Pricing */}
          <section className="flex flex-col gap-4">
            <div>
              <h4 className="text-sm font-bold text-[#333333] uppercase tracking-wide">
                Units & Pricing
              </h4>
              <p className="text-xs text-[#666666] mt-1">
                Define how this product is sold, purchased, and counted.
                Exactly one unit must be marked as the base unit.
              </p>
            </div>

            <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#DBEFF3]">
                      {[
                        "Base",
                        "Unit",
                        "Conversion",
                        "Sell Price",
                        "Purchase Price",
                        "",
                      ].map((h, i) => (
                        <th
                          key={i}
                          className="px-3 py-2.5 text-left font-semibold text-[#333333] text-xs"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {form.units.map((row, idx) => {
                      const usedIds = new Set(
                        form.units.map((r) => r.unitId),
                      );

                      return (
                        <tr
                          key={idx}
                          className={
                            idx % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"
                          }
                        >
                          <td className="px-3 py-2.5">
                            <input
                              type="radio"
                              name="createBaseUnit"
                              checked={row.isBaseUnit}
                              onChange={() => setBaseRow(idx)}
                              className="h-4 w-4 accent-[#49B0C1] cursor-pointer"
                            />
                          </td>

                          <td className="px-3 py-2.5">
                            <select
                              value={row.unitId}
                              onChange={(e) =>
                                updateRow(idx, { unitId: e.target.value })
                              }
                              className="w-full rounded-lg border border-[#ABDBE3] bg-white px-2 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none"
                            >
                              <option value="">— Select —</option>
                              {units
                                .filter(
                                  (u) =>
                                    u.id === row.unitId ||
                                    !usedIds.has(u.id),
                                )
                                .map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                            </select>
                            {fieldErrors[`u${idx}.unitId`] && (
                              <p className="text-xs text-red-600 mt-1">
                                {fieldErrors[`u${idx}.unitId`]}
                              </p>
                            )}
                          </td>

                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min={1}
                              disabled={row.isBaseUnit}
                              value={row.conversionFactor}
                              onChange={(e) =>
                                updateRow(idx, {
                                  conversionFactor: e.target.value,
                                })
                              }
                              className={`w-24 rounded-lg border px-2 py-1.5 text-sm focus:outline-none ${
                                row.isBaseUnit
                                  ? "border-[#DBEFF3] bg-[#F5F9FA] text-[#666666] cursor-not-allowed"
                                  : "border-[#ABDBE3] bg-white focus:border-[#49B0C1]"
                              }`}
                            />
                            {fieldErrors[`u${idx}.conversionFactor`] && (
                              <p className="text-xs text-red-600 mt-1">
                                {fieldErrors[`u${idx}.conversionFactor`]}
                              </p>
                            )}
                          </td>

                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={row.sellPrice}
                              onChange={(e) =>
                                updateRow(idx, {
                                  sellPrice: e.target.value,
                                })
                              }
                              className="w-24 rounded-lg border border-[#ABDBE3] bg-white px-2 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none"
                            />
                            {fieldErrors[`u${idx}.sellPrice`] && (
                              <p className="text-xs text-red-600 mt-1">
                                {fieldErrors[`u${idx}.sellPrice`]}
                              </p>
                            )}
                          </td>

                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={row.purchasePrice}
                              onChange={(e) =>
                                updateRow(idx, {
                                  purchasePrice: e.target.value,
                                })
                              }
                              className="w-24 rounded-lg border border-[#ABDBE3] bg-white px-2 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none"
                            />
                            {fieldErrors[`u${idx}.purchasePrice`] && (
                              <p className="text-xs text-red-600 mt-1">
                                {fieldErrors[`u${idx}.purchasePrice`]}
                              </p>
                            )}
                          </td>

                          <td className="px-3 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => removeRow(idx)}
                              disabled={row.isBaseUnit}
                              title={
                                row.isBaseUnit
                                  ? "Move the base to another unit first"
                                  : "Remove unit"
                              }
                              className="text-xs font-semibold text-red-500 hover:underline disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              🗑 Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {fieldErrors.units && (
              <p className="text-xs text-red-600">{fieldErrors.units}</p>
            )}

            <div>
              <Button
                type="button"
                variant="secondary"
                onClick={addRow}
                disabled={form.units.length >= units.length}
              >
                + Add Unit
              </Button>
            </div>

            {pricingSummary && (
              <div className="rounded-xl bg-[#DBEFF3] px-4 py-3 flex gap-2 items-start">
                <span className="text-base leading-none">💡</span>
                <p className="text-xs text-[#333333]">
                  <span className="font-semibold">
                    Base: {baseUnit?.name}
                  </span>{" "}
                  — {pricingSummary}
                </p>
              </div>
            )}
          </section>

          {/* Status */}
          <section className="flex flex-col gap-2">
            <h4 className="text-sm font-bold text-[#333333] uppercase tracking-wide">
              Status
            </h4>
            <ToggleSwitch
              checked={form.isActive}
              onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              label={
                form.isActive
                  ? "Active — product will be available for purchase and sale immediately"
                  : "Inactive — product will be saved but hidden from sales"
              }
            />
          </section>

          {/* Narcotic / Controlled */}
          <section className="rounded-xl border border-red-200 bg-red-50/60 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#333333]">
                  Narcotic / Controlled medicine
                </p>
                <p className="text-xs text-[#666666] mt-0.5">
                  Flag this product as narcotic. Narcotic items are labeled at
                  the point of sale and reported separately in the narcotics
                  report. This flag comes from the backend — never inferred.
                </p>
              </div>
              <ToggleSwitch
                checked={form.isNarcotic}
                onChange={(v) => setForm((f) => ({ ...f, isNarcotic: v }))}
              />
            </div>
          </section>

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-2 border-t border-[#DBEFF3]">
            <Button
              variant="secondary"
              onClick={closeCreate}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} loading={creating}>
              Save Product
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function mapStockStatus(
  status: InventoryProductDto["stockStatus"],
): "in_stock" | "low_stock" | "out_of_stock" {
  switch (status) {
    case "LOW_STOCK":
      return "low_stock";
    case "OUT_OF_STOCK":
      return "out_of_stock";
    default:
      return "in_stock";
  }
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-[#DBEFF3]" />
      ))}
    </div>
  );
}

function BoxIcon() {
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
        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
      />
    </svg>
  );
}
function CheckIcon() {
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
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
function WarnIcon() {
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
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
}
function AlertIcon() {
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
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}