import { useEffect, useState } from "react";
import {
  createProduct,
  ProductsApiError,
  type ProductDetailDto,
} from "../../features/inventory/productsApi";
import { searchProductGroups } from "../../features/inventory/searchSelectors";
import { useSearchableResource } from "../../hooks/useSearchableResource";
import { listUnits, type UnitDto } from "../../features/inventory/unitsApi";
import type { ProductGroupDto } from "../../features/inventory/productGroupsApi";
import SearchableSelect from "./SearchableSelect";
import type { SearchableOption } from "./SearchableSelect";
import Button from "./Button";
import Modal from "./Modal";
import ProductGroupFormModal from "./ProductGroupFormModal";
import UnitFormModal from "./UnitFormModal";
import { IconLightBulb, IconTrash } from "./icons";

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
// Reusable Add Product modal.
// Used by Inventory > Products and the Add Stock form.
// ─────────────────────────────────────────────────────────────
interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful create with the saved product. */
  onSaved?: (product: ProductDetailDto) => void | Promise<void>;
}

export default function ProductFormModal({
  open,
  onClose,
  onSaved,
}: ProductFormModalProps) {
  // ── Create modal state ──
  const [form, setForm] = useState<ProductForm>(emptyProductForm());
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [units, setUnits] = useState<UnitDto[]>([]);

  // ── Quick "Add Product Group" (reuses the Settings modal) ──
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [createdGroup, setCreatedGroup] = useState<ProductGroupDto | null>(null);

  // ── Quick "Add New Unit" (reuses the Settings modal) ──
  const [unitModalOpen, setUnitModalOpen] = useState(false);

  const createGroupSearch = useSearchableResource(searchProductGroups, open);
  // Keep the freshly created group selectable even before the refreshed
  // server-side search results arrive.
  const createdGroupOption =
    createdGroup && createdGroup.id === form.productGroupId
      ? { value: createdGroup.id, label: createdGroup.name }
      : null;
  const selectedCreateGroup =
    createdGroupOption ??
    createGroupSearch.options.find((o) => o.value === form.productGroupId) ??
    null;
  const createGroupOptions: SearchableOption[] = selectedCreateGroup
    ? [
        selectedCreateGroup,
        ...createGroupSearch.options.filter(
          (o) => o.value !== form.productGroupId,
        ),
      ]
    : createGroupSearch.options;

  // ── Load reference data once ──
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

  // Reset the form whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setForm(emptyProductForm());
    setFieldErrors({});
    setFormError(null);
    setCreating(false);
    setGroupModalOpen(false);
    setUnitModalOpen(false);
  }, [open]);

  function close() {
    if (creating) return;
    onClose();
  }

  // Called when the quick "Add Product Group" modal saves a group.
  // Refreshes the group options and auto-selects the new group.
  function handleGroupSaved(group: ProductGroupDto) {
    setCreatedGroup(group);
    setForm((f) => ({ ...f, productGroupId: group.id }));
    setFieldErrors((e) => {
      const next = { ...e };
      delete next.productGroupId;
      return next;
    });
    createGroupSearch.refresh();
    setGroupModalOpen(false);
  }

  // Called when the quick "Add New Unit" modal saves a unit.
  // Makes the unit immediately selectable and auto-selects it into an
  // empty row (or appends a new row), then syncs the unit list.
  function handleUnitSaved(unit: UnitDto) {
    setUnits((prev) =>
      prev.some((u) => u.id === unit.id) ? prev : [unit, ...prev],
    );
    setForm((f) => {
      const emptyIdx = f.units.findIndex((r) => !r.unitId);
      if (emptyIdx >= 0) {
        return {
          ...f,
          units: f.units.map((r, i) =>
            i === emptyIdx ? { ...r, unitId: unit.id } : r,
          ),
        };
      }
      return {
        ...f,
        units: [
          ...f.units,
          {
            unitId: unit.id,
            conversionFactor: "1",
            sellPrice: "",
            purchasePrice: "",
            isBaseUnit: false,
          },
        ],
      };
    });
    void listUnits({ limit: 100 })
      .then((res) => setUnits(res.data))
      .catch(() => {
        /* keep the current unit list on refetch failure */
      });
    setUnitModalOpen(false);
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

    if (f.units.length === 0) errs.units = "At least one unit is required."

    if (f.units.filter((u) => u.isBaseUnit).length !== 1)
      errs.units = "Exactly one unit must be marked as base."

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
      const saved = await createProduct({
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

      await onSaved?.(saved);
      onClose();
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
    <>
      <Modal open={open} onClose={close} title="Create Product" size="lg">
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
                className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
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
                className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
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
                className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
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
                className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm font-mono text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
              />
              {fieldErrors.sku && (
                <p className="text-xs text-red-600">{fieldErrors.sku}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-[#333333]">
                Product Group <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setGroupModalOpen(true)}
                className="text-xs font-semibold text-[#7A9076] hover:underline"
              >
                + Add Product Group
              </button>
            </div>
            <SearchableSelect
              value={form.productGroupId || null}
              onChange={(v) => setForm((f) => ({ ...f, productGroupId: v }))}
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
              className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20 resize-none"
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
                  setForm((f) => ({ ...f, reorderPoint: e.target.value }))
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-[#333333] uppercase tracking-wide">
                Units & Pricing
              </h4>
              <p className="text-xs text-[#666666] mt-1">
                Define how this product is sold, purchased, and counted.
                Exactly one unit must be marked as the base unit.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUnitModalOpen(true)}
              className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap mt-0.5"
            >
              + Add New Unit
            </button>
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
                    const usedIds = new Set(form.units.map((r) => r.unitId))

                    return (
                      <tr
                        key={idx}
                        className={
                          idx % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"
                        }
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="radio"
                            name="createBaseUnit"
                            checked={row.isBaseUnit}
                            onChange={() => setBaseRow(idx)}
                            className="h-4 w-4 accent-[#B6C8AF] cursor-pointer"
                          />
                        </td>

                        <td className="px-3 py-2.5">
                          <SearchableSelect
                            value={row.unitId || null}
                            onChange={(v) => updateRow(idx, { unitId: v })}
                            options={[
                              { value: "", label: "— Select —" },
                              ...units
                                .filter(
                                  (u) =>
                                    u.id === row.unitId || !usedIds.has(u.id),
                                )
                                .map((u) => ({
                                  value: u.id,
                                  label: u.name,
                                })),
                            ]}
                            placeholder="— Select —"
                            searchPlaceholder="Search units..."
                            emptyMessage="No units available"
                            noResultsMessage="No matching units"
                          />
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

                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.sellPrice}
                            onChange={(e) =>
                              updateRow(idx, { sellPrice: e.target.value })
                            }
                            className="w-24 rounded-lg border border-[#C6D4BF] bg-white px-2 py-1.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
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
                            className="w-24 rounded-lg border border-[#C6D4BF] bg-white px-2 py-1.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
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
                            <span className="inline-flex items-center gap-1">
                              <IconTrash className="h-3.5 w-3.5" />
                              Remove
                            </span>
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
            <div className="rounded-xl bg-[#E6ECE2] px-4 py-3 flex gap-2 items-start">
              <IconLightBulb className="h-4 w-4 text-[#7A9076] mt-0.5 flex-shrink-0" />
              <p className="text-xs text-[#333333]">
                <span className="font-semibold">Base: {baseUnit?.name}</span> —{" "}
                {pricingSummary}
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
        <div className="flex gap-3 justify-end pt-2 border-t border-[#E6ECE2]">
          <Button variant="secondary" onClick={close} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={() => void handleCreate()} loading={creating}>
            Save Product
          </Button>
        </div>
      </div>
    </Modal>

    {/* Quick create a product group from the Add Product form */}
    <ProductGroupFormModal
      open={groupModalOpen}
      onClose={() => setGroupModalOpen(false)}
      onSaved={handleGroupSaved}
    />

    {/* Quick create a unit from the Add Product form */}
    <UnitFormModal
      open={unitModalOpen}
      onClose={() => setUnitModalOpen(false)}
      onSaved={handleUnitSaved}
    />
  </>
  );
}