import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  getReorderConfig,
  updateReorderConfig,
  ReorderApiError,
  type ReorderConfigDto,
} from "../../features/inventory/reorderApi";
import { fetchProductOptions } from "../../features/inventory/inventoryService";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import FormError from "../../components/ui/FormError";
import Breadcrumb from "../../components/ui/Breadcrumb";

interface Config { minStock: string; reorderPoint: string; leadTime: string; reorderQty: string; useVelocity: boolean; formula: string; buffer: string; }
const empty = (): Config => ({ minStock: "", reorderPoint: "", leadTime: "", reorderQty: "", useVelocity: false, formula: "basic", buffer: "10" });

/** Map a backend reorder-config to the form state (numbers → strings for inputs). */
function fromDto(dto: ReorderConfigDto): Config {
  return {
    minStock: String(dto.minimumStockLevel ?? ""),
    reorderPoint: String(dto.reorderPoint ?? ""),
    leadTime: String(dto.leadTimeDays ?? ""),
    reorderQty: String(dto.reorderQuantity ?? ""),
    useVelocity: dto.useSalesVelocity,
    formula: "basic",
    buffer: String(dto.bufferPercentage ?? 10),
  };
}

function validate(c: Config): Partial<Record<keyof Config, string>> {
  const e: Partial<Record<keyof Config, string>> = {};
  if (!c.minStock || Number(c.minStock) < 0) e.minStock = "Enter a valid minimum stock level.";
  if (!c.reorderPoint || Number(c.reorderPoint) < 0) e.reorderPoint = "Enter a valid reorder point.";
  if (!c.leadTime || Number(c.leadTime) < 1) e.leadTime = "Enter lead time in days (min 1).";
  if (!c.reorderQty || Number(c.reorderQty) < 1) e.reorderQty = "Enter a valid reorder quantity.";
  return e;
}

export default function ReorderConfigPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [config, setConfig] = useState<Config>(empty());
  const [errors, setErrors] = useState<Partial<Record<keyof Config, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProductOptions().then((p) => {
      setProducts(p);
      if (p.length) setSelectedProduct(p[0].id);
    });
  }, []);

  // Load the product's current reorder configuration whenever the selection changes.
  useEffect(() => {
    if (!selectedProduct) return;
    let cancelled = false;
    setLoadingConfig(true);
    setErrors({});
    setFormError(null);
    getReorderConfig(selectedProduct)
      .then((dto) => {
        if (cancelled) return;
        setConfig(fromDto(dto));
        setFormError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setConfig(empty());
        setFormError(
          err instanceof ReorderApiError && err.status === 404
            ? "No reorder configuration saved for this product yet — fill in the fields below and save."
            : err instanceof ReorderApiError
              ? err.message
              : "Failed to load the product's reorder configuration.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingConfig(false);
      });
    return () => { cancelled = true; };
  }, [selectedProduct]);

  function set(field: keyof Config, value: string | boolean) {
    setConfig((c) => ({ ...c, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function handleSave() {
    if (!selectedProduct) { setFormError("Select a product first."); return; }
    setFormError(null);
    const e = validate(config);
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await updateReorderConfig(selectedProduct, {
        minimumStockLevel: Number(config.minStock),
        reorderPoint: Number(config.reorderPoint),
        leadTimeDays: Number(config.leadTime),
        reorderQuantity: Number(config.reorderQty),
        useSalesVelocity: config.useVelocity,
        bufferPercentage: Number(config.buffer) || 0,
      });
      navigate("/inventory/reorder");
    } catch (err: unknown) {
      setFormError(err instanceof ReorderApiError ? err.message : "Failed to save the configuration. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const calcExplanation = config.useVelocity
    ? `Reorder Qty = (Avg Daily Sales × Lead Time) + (Buffer ${config.buffer}%)`
    : `Reorder Qty = Fixed quantity of ${config.reorderQty || "—"} units`;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <PageHeader title="Reorder Threshold Configuration" subtitle="Set restocking parameters per product" />
      <Breadcrumb items={[{ label: "Reorder Management", to: "/inventory/reorder" }, { label: "Configuration" }]} />

      <div className="p-6 max-w-2xl flex flex-col gap-6">
        <FormError message={formError} />

        <Select label="Product" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>

        {/* Current settings */}
        <div className="bg-[#DBEFF3] rounded-xl p-5 flex flex-col gap-4">
          <p className="text-sm font-bold text-[#333333]">Current Settings</p>
          {loadingConfig ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-12 bg-white/60 rounded-xl" />
              <div className="h-12 bg-white/60 rounded-xl" />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Minimum Stock Level" type="number" min={0} value={config.minStock} onChange={(e) => set("minStock", e.target.value)} error={errors.minStock} placeholder="e.g. 20" />
              <Input label="Reorder Point" type="number" min={0} value={config.reorderPoint} onChange={(e) => set("reorderPoint", e.target.value)} error={errors.reorderPoint} placeholder="e.g. 50" />
              <Input label="Lead Time (days)" type="number" min={1} value={config.leadTime} onChange={(e) => set("leadTime", e.target.value)} error={errors.leadTime} placeholder="e.g. 3" />
              <Input label="Reorder Quantity" type="number" min={1} value={config.reorderQty} onChange={(e) => set("reorderQty", e.target.value)} error={errors.reorderQty} placeholder="e.g. 100" />
            </div>
          )}
        </div>

        {/* Advanced settings */}
        <div className="bg-white rounded-xl border border-[#ABDBE3] p-5 flex flex-col gap-4">
          <p className="text-sm font-bold text-[#333333]">Advanced Settings</p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.useVelocity}
              onChange={(e) => set("useVelocity", e.target.checked)}
              className="h-4 w-4 rounded accent-[#49B0C1]"
            />
            <span className="text-sm font-medium text-[#333333]">Use sales velocity for reorder calculation</span>
          </label>

          {config.useVelocity && (
            <div className="grid sm:grid-cols-2 gap-4 pl-7">
              <Select label="Reorder Formula" value={config.formula} onChange={(e) => set("formula", e.target.value)}>
                <option value="basic">Basic (Avg × Lead Time)</option>
                <option value="safety">Safety Stock Formula</option>
                <option value="eoq">Economic Order Quantity</option>
              </Select>
              <Input label="Buffer (%)" type="number" min={0} max={100} value={config.buffer} onChange={(e) => set("buffer", e.target.value)} placeholder="10" />
            </div>
          )}

          <div className="rounded-lg bg-[#DBEFF3] px-4 py-3">
            <p className="text-xs font-semibold text-[#49B0C1] uppercase tracking-wide mb-1">Calculation</p>
            <p className="text-sm text-[#333333]">{calcExplanation}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate("/inventory/reorder")}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </div>
    </div>
  );
}
