import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  deactivateProduct,
  getProduct,
  updateProduct,
  ProductsApiError,
  type ProductDetailDto,
} from "../../features/inventory/productsApi";
import { listUnits, type UnitDto } from "../../features/inventory/unitsApi";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import NarcoticBadge from "../../components/ui/NarcoticBadge";

// ─────────────────────────────────────────────────────────────
// Edit form types
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
  minimumStock: string;
  reorderPoint: string;
  isActive: boolean;
  isNarcotic: boolean;
  units: UnitRow[];
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
        <span className="text-sm font-medium text-[#333333]">{label}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<ProductDetailDto | null>(null);
  const [masterUnits, setMasterUnits] = useState<UnitDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Delete state ──
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Edit modal state ──
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ─────────────────────────────────────────────────────────
  // Load product (GET /inventory/products/{id})
  // ─────────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [detail, units] = await Promise.all([
        getProduct(productId),
        listUnits({ limit: 100 }).catch(() => ({ data: [] as UnitDto[] })),
      ]);
      setProduct(detail);
      setMasterUnits(units.data);
    } catch (err) {
      setLoadError(
        err instanceof ProductsApiError
          ? err.message
          : "Failed to load the product. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // ─────────────────────────────────────────────────────────
  // Edit handlers
  // ─────────────────────────────────────────────────────────

  function openEdit() {
    if (!product) return;

    const rows: UnitRow[] = product.units.length
      ? product.units.map((u) => ({
          unitId: u.unitId,
          conversionFactor: String(u.conversionFactor ?? 1),
          sellPrice: String(u.sellPrice ?? 0),
          purchasePrice: String(u.purchasePrice ?? 0),
          isBaseUnit: u.isBaseUnit,
        }))
      : [
          {
            unitId: "",
            conversionFactor: "1",
            sellPrice: "",
            purchasePrice: "",
            isBaseUnit: true,
          },
        ];

    // Ensure exactly one base row
    const baseIdx = rows.findIndex((r) => r.isBaseUnit);
    rows.forEach(
      (r, i) => (r.isBaseUnit = i === (baseIdx >= 0 ? baseIdx : 0)),
    );
    if (baseIdx >= 0) rows[baseIdx].conversionFactor = "1";

    setForm({
      name: product.name,
      minimumStock: String(product.minimumStock ?? 0),
      reorderPoint: String(product.reorderPoint ?? 0),
      isActive: product.isActive,
      isNarcotic: product.isNarcotic,
      units: rows,
    });

    setFormError(null);
    setFieldErrors({});
    setEditOpen(true);
  }

  function closeEdit() {
    if (saving) return;
    setEditOpen(false);
  }

  function updateRow(idx: number, patch: Partial<UnitRow>) {
    setForm((f) => {
      if (!f) return f;
      const unitsNext = f.units.map((r, i) =>
        i === idx ? { ...r, ...patch } : r,
      );
      return { ...f, units: unitsNext };
    });
  }

  function setBaseRow(idx: number) {
    setForm((f) => {
      if (!f) return f;
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
      if (!f) return f;
      const used = new Set(f.units.map((r) => r.unitId));
      const available = masterUnits.find((u) => !used.has(u.id));
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
      if (!f) return f;
      const row = f.units[idx];
      if (row.isBaseUnit) return f;
      return { ...f, units: f.units.filter((_, i) => i !== idx) };
    });
  }

  function validate(f: ProductForm): boolean {
    const errs: Record<string, string> = {};

    if (!f.name.trim()) errs.name = "Product name is required.";

    if (
      f.minimumStock === "" ||
      isNaN(Number(f.minimumStock)) ||
      Number(f.minimumStock) < 0
    ) {
      errs.minimumStock = "Minimum stock must be 0 or more.";
    }

    if (
      f.reorderPoint === "" ||
      isNaN(Number(f.reorderPoint)) ||
      Number(f.reorderPoint) < 0
    ) {
      errs.reorderPoint = "Reorder point must be 0 or more.";
    }

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

  const handleSave = async () => {
    if (!product) return;
  
    setSaving(true);
    setError(null, setFormError);
  
    try {
      if (!form) return;

      await updateProduct(product.id, {
        name: form.name.trim(),
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
  
      // IMPORTANT:
      // Don't rely on the PATCH response to update the screen.
      // Fetch the product again from the backend.
      const freshProduct = await getProduct(product.id);
  
      setProduct(freshProduct);
      setEditOpen(false);
    } catch (err) {
      setError(
        err instanceof ProductsApiError
          ? err.message
          : "Failed to update product.",
        setFormError,
      );
    } finally {
      setSaving(false);
    }
  };
  

  // ─────────────────────────────────────────────────────────
  // Delete (soft → deactivate)
  // ─────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!product) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deactivateProduct(product.id);
      setConfirmDeleteOpen(false);
      navigate("/inventory/products");
    } catch (err) {
      setDeleteError(
        err instanceof ProductsApiError
          ? err.message
          : "Could not deactivate the product. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Loading & error
  // ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center px-6 py-3 border-b border-[#C6D4BF] bg-white">
          <button
            type="button"
            onClick={() => navigate("/inventory/products")}
            aria-label="Back to products"
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-[#C6D4BF] bg-white text-lg text-[#4F6B4A] hover:bg-[#E6ECE2] hover:text-[#333333] transition-colors"
          >
            ←
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 animate-pulse space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-[#E6ECE2]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !product) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center px-6 py-3 border-b border-[#C6D4BF] bg-white">
          <button
            type="button"
            onClick={() => navigate("/inventory/products")}
            aria-label="Back to products"
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-[#C6D4BF] bg-white text-lg text-[#4F6B4A] hover:bg-[#E6ECE2] hover:text-[#333333] transition-colors"
          >
            ←
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-red-700">
                {loadError ?? "Product not found."}
              </p>
              <button
                type="button"
                onClick={() => void reload()}
                className="text-sm font-semibold text-red-700 hover:underline"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stockQty = product.stockSummary?.totalQuantity ?? 0;
  const minStock = product.minimumStock ?? 0;
  const reorderPoint = product.reorderPoint ?? 0;
  const derivedStatus =
    stockQty <= 0
      ? "out_of_stock"
      : stockQty <= Math.max(minStock, reorderPoint)
        ? "low_stock"
        : "in_stock";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* ── Arrow back header ── */}
      <div className="flex items-center px-6 py-3 border-b border-[#C6D4BF] bg-white">
        <button
          type="button"
          onClick={() => navigate("/inventory/products")}
          aria-label="Back to products"
          className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-[#C6D4BF] bg-white text-lg text-[#4F6B4A] hover:bg-[#E6ECE2] hover:text-[#333333] transition-colors"
        >
          ←
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-6 flex flex-col gap-6">
          {/* Product Info */}
          <div className="bg-[#E6ECE2] rounded-xl p-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="h-24 w-24 rounded-xl bg-white/60 flex items-center justify-center text-[#7A9076] flex-shrink-0 self-start">
                <svg
                  className="h-12 w-12"
                  viewBox="0 0 48 48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden
                >
                  <rect x="8" y="8" width="32" height="32" rx="6" />
                  <path strokeLinecap="round" d="M24 16v16M16 24h16" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-xl font-bold text-[#333333]">
                      {product.name}
                      {product.isNarcotic && <NarcoticBadge className="ml-2" />}
                    </h2>

                    <p className="text-sm text-[#666666] mt-0.5">
                      {product.genericName ?? "—"}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-3">
                      <Chip label="Brand" value={product.brand ?? "—"} />
                      <Chip label="Group" value={product.productGroup?.name ?? "—"} />
                      <Chip label="SKU" value={product.sku} />
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap justify-end">
                    <Button variant="secondary" onClick={() => navigate(`/inventory/stock?productId=${product.id}`)}>
                      View Stock →
                    </Button>
                    <Button variant="secondary" onClick={() => navigate(`/inventory/bin-card?productId=${product.id}`)}>
                      View Bin Card →
                    </Button>
                    <Button variant="secondary" onClick={openEdit}>
                      Edit
                    </Button>

                    {product.isActive ? (
                      <button
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmDeleteOpen(true);
                        }}
                        className="rounded-lg px-4 py-2.5 text-sm font-semibold text-red-600 border border-red-200 bg-white hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    ) : (
                      <span className="rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-500 border border-gray-200 bg-gray-50">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Stat
                    label="Total Stock"
                    value={`${stockQty.toLocaleString()}${product.baseUnit?.name ? ` ${product.baseUnit.name}` : ""}`}
                  />
                  <Stat label="Min Threshold" value={String(minStock)} />
                  <Stat label="Reorder Point" value={String(reorderPoint)} />

                  <div>
                    <p className="text-xs text-[#666666] font-medium">Status</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusBadge status={derivedStatus} />
                      {!product.isActive && (
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Units & Packaging */}
          {product.units.length > 0 && (
            <section>
              <h3 className="text-base font-bold text-[#333333] mb-3">
                Units & Packaging
              </h3>

              <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#E6ECE2]">
                        {[
                          "Unit",
                          "Conversion",
                          "Sell Price",
                          "Purchase Price",
                          "Type",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left font-semibold text-[#333333]"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {product.units.map((u, i) => (
                        <tr
                          key={u.id}
                          className={
                            i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/30"
                          }
                        >
                          <td className="px-4 py-3 font-medium text-[#333333]">
                            {u.unit?.name ?? u.unitId}
                          </td>

                          <td className="px-4 py-3 text-[#666666]">
                            {u.conversionFactor}
                          </td>

                          <td className="px-4 py-3 text-[#333333]">
                            {Number(u.sellPrice ?? 0).toFixed(2)} ETB
                          </td>

                          <td className="px-4 py-3 text-[#333333]">
                            {Number(u.purchasePrice ?? 0).toFixed(2)} ETB
                          </td>

                          <td className="px-4 py-3">
                            {u.isBaseUnit ? (
                              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-[#E6ECE2] text-[#333333]">
                                Base
                              </span>
                            ) : (
                              <span className="text-xs text-[#666666]">
                                Derived
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* Stock Summary */}
          <section>
            <h3 className="text-base font-bold text-[#333333] mb-3">
              Stock Summary
            </h3>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
                <p className="text-xs font-semibold text-[#7A9076] uppercase tracking-wide">
                  Total Quantity
                </p>
                <p className="text-2xl font-bold text-[#333333] mt-1">
                  {stockQty.toLocaleString()}
                  {product.baseUnit?.name ? ` ${product.baseUnit.name}` : ""}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
                <p className="text-xs font-semibold text-[#7A9076] uppercase tracking-wide">
                  Batches
                </p>
                <p className="text-2xl font-bold text-[#333333] mt-1">
                  {product.batchCount ?? 0}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
                <p className="text-xs font-semibold text-[#7A9076] uppercase tracking-wide">
                  Locations
                </p>
                <p className="text-2xl font-bold text-[#333333] mt-1">
                  {product.locationCount ?? 0}
                </p>
              </div>
            </div>

            {product.stockSummary?.byLocation &&
              product.stockSummary.byLocation.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden mt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#E6ECE2]">
                          {["Location", "Quantity"].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-3 text-left font-semibold text-[#333333]"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {product.stockSummary.byLocation.map((l, i) => (
                          <tr
                            key={l.locationId}
                            className={
                              i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/30"
                            }
                          >
                            <td className="px-4 py-3 text-[#333333]">
                              {l.locationName}
                            </td>
                            <td className="px-4 py-3 font-semibold text-[#333333]">
                              {l.quantity.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          </section>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* EDIT PRODUCT MODAL */}
      {/* ─────────────────────────────────────────────────── */}

      <Modal
        open={editOpen}
        onClose={closeEdit}
        title="Edit Product"
        size="lg"
      >
        {form && (
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

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#333333]">
                  Product Name <span className="text-red-500">*</span>
                </label>

                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) =>
                      f ? { ...f, name: e.target.value } : f,
                    )
                  }
                  className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
                />

                {fieldErrors.name && (
                  <p className="text-xs text-red-600">{fieldErrors.name}</p>
                )}
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
                      setForm((f) =>
                        f ? { ...f, minimumStock: e.target.value } : f,
                      )
                    }
                    className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
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
                      setForm((f) =>
                        f ? { ...f, reorderPoint: e.target.value } : f,
                      )
                    }
                    className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
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
                  Exactly one unit must be marked as the base unit. Saving sends
                  the full unit configuration.
                </p>
              </div>

              <div className="rounded-xl border border-[#E6ECE2] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#E6ECE2]">
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
                              idx % 2 === 0
                                ? "bg-white"
                                : "bg-[#E6ECE2]/20"
                            }
                          >
                            {/* Base radio */}
                            <td className="px-3 py-2.5">
                              <input
                                type="radio"
                                name="editBaseUnit"
                                checked={row.isBaseUnit}
                                onChange={() => setBaseRow(idx)}
                                className="h-4 w-4 accent-[#B6C8AF] cursor-pointer"
                              />
                            </td>

                            {/* Unit dropdown */}
                            <td className="px-3 py-2.5">
                              <select
                                value={row.unitId}
                                onChange={(e) =>
                                  updateRow(idx, {
                                    unitId: e.target.value,
                                  })
                                }
                                className="w-full rounded-lg border border-[#C6D4BF] bg-white px-2 py-1.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
                              >
                                <option value="">— Select —</option>

                                {masterUnits
                                  .concat(
                                    product.units
                                      .filter(
                                        (pu) =>
                                          pu.unitId === row.unitId &&
                                          !masterUnits.some(
                                            (mu) => mu.id === pu.unitId,
                                          ),
                                      )
                                      .map((pu) => ({
                                        id: pu.unitId,
                                        name: pu.unit?.name ?? pu.unitId,
                                        symbol: pu.unit?.symbol ?? "",
                                        description: null,
                                        isActive: true,
                                        productCount: 0,
                                        createdAt: "",
                                        updatedAt: "",
                                      } satisfies UnitDto)),
                                  )
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

                            {/* Conversion */}
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
                                    ? "border-[#E6ECE2] bg-[#FAF9F4] text-[#666666] cursor-not-allowed"
                                    : "border-[#C6D4BF] bg-white focus:border-[#B6C8AF]"
                                }`}
                              />

                              {fieldErrors[`u${idx}.conversionFactor`] && (
                                <p className="text-xs text-red-600 mt-1">
                                  {fieldErrors[`u${idx}.conversionFactor`]}
                                </p>
                              )}
                            </td>

                            {/* Sell price */}
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
                                className="w-24 rounded-lg border border-[#C6D4BF] bg-white px-2 py-1.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
                              />

                              {fieldErrors[`u${idx}.sellPrice`] && (
                                <p className="text-xs text-red-600 mt-1">
                                  {fieldErrors[`u${idx}.sellPrice`]}
                                </p>
                              )}
                            </td>

                            {/* Purchase price */}
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
                                className="w-24 rounded-lg border border-[#C6D4BF] bg-white px-2 py-1.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
                              />

                              {fieldErrors[`u${idx}.purchasePrice`] && (
                                <p className="text-xs text-red-600 mt-1">
                                  {fieldErrors[`u${idx}.purchasePrice`]}
                                </p>
                              )}
                            </td>

                            {/* Delete */}
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
                  disabled={
                    form.units.length >=
                    masterUnits.length + product.units.length
                  }
                >
                  + Add Unit
                </Button>
              </div>
            </section>

            {/* Status */}
            <section className="flex flex-col gap-2">
              <h4 className="text-sm font-bold text-[#333333] uppercase tracking-wide">
                Status
              </h4>

              <ToggleSwitch
                checked={form.isActive}
                onChange={(v) =>
                  setForm((f) => (f ? { ...f, isActive: v } : f))
                }
                label={
                  form.isActive
                    ? "Active — product is available for purchase and sale"
                    : "Inactive — product will be hidden from sales"
                }
              />
            </section>

            {/* Narcotic / Controlled */}
            <section className="rounded-xl border border-red-200 bg-red-50/60 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#333333]">
                  Narcotic / Controlled medicine
                </p>
                <p className="text-xs text-[#666666] mt-0.5">
                  Flag this product as narcotic. Changing this flag is recorded
                  in the audit trail.
                </p>
              </div>
              <ToggleSwitch
                checked={form.isNarcotic}
                onChange={(v) =>
                  setForm((f) => (f ? { ...f, isNarcotic: v } : f))
                }
              />
            </section>

            {/* Footer */}
            <div className="flex gap-3 justify-end pt-2 border-t border-[#E6ECE2]">
              <Button variant="secondary" onClick={closeEdit} disabled={saving}>
                Cancel
              </Button>

              <Button onClick={() => void handleSave()} loading={saving}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─────────────────────────────────────────────────── */}
      {/* DELETE CONFIRM MODAL */}
      {/* ─────────────────────────────────────────────────── */}

      <Modal
        open={confirmDeleteOpen}
        onClose={() => {
          if (!deleting) setConfirmDeleteOpen(false);
        }}
        title="Deactivate Product"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[#333333]">
            Deactivate{" "}
            <span className="font-semibold">{product?.name}</span>? The product
            stays in historical records but will no longer be available for
            new purchases or sales.
          </p>

          {deleteError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {deleteError}
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2 border-t border-[#E6ECE2]">
            <Button
              variant="secondary"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>

            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98]"
            >
              {deleting && (
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
              )}
              Deactivate
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-3 py-1 text-xs">
      <span className="text-[#666666]">{label}:</span>
      <span className="font-medium text-[#333333]">{value}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[#666666] font-medium">{label}</p>
      <p className="text-lg font-bold text-[#333333]">{value}</p>
    </div>
  );
}
function setError(error: string | null, setFormError: (error: string | null) => void) {
  setFormError(error);
}

