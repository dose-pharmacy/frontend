import { useState, useEffect, useCallback } from "react";
import ReportsSubNav from "./ReportsSubNav";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import ConfirmationDialog from "../../components/ui/ConfirmationDialog";
import { fmtMoney, fmtNumber, fmtDate, fmtDateTime } from "./reportHelpers";
import { listProductGroups } from "../../features/inventory/productGroupsApi";
import { listProducts, type ProductDto } from "../../features/inventory/productsApi";
import {
  getSlowMovingReport,
  getSlowMovingConfigs,
  createSlowMovingConfig,
  updateSlowMovingConfig,
  deleteSlowMovingConfig,
  evaluateSlowMoving,
  ReportsApiError,
  type SlowMovingDto,
  type SlowMovingConfigDto,
  type SlowMovingDefinitionType,
  type SlowMovingEvaluateResult,
} from "../../features/reports/reportsApi";

const PAGE_SIZE = 15;

const DEFINITION_OPTIONS: { value: SlowMovingDefinitionType; label: string }[] = [
  { value: "DAYS_30", label: "30 Days" },
  { value: "DAYS_60", label: "60 Days" },
  { value: "DAYS_90", label: "90 Days" },
  { value: "DAYS_180", label: "180 Days" },
  { value: "CUSTOM", label: "Custom" },
];

function definitionLabel(def: SlowMovingConfigDto | SlowMovingDto): string {
  if (def.definitionType === "CUSTOM" && typeof def.customDays === "number") {
    return `Custom (${def.customDays} days)`;
  }
  return DEFINITION_OPTIONS.find((o) => o.value === def.definitionType)?.label ?? def.definitionType;
}

function StatusBadge({ flagged }: { flagged: boolean }) {
  return flagged ? (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold bg-red-100 text-red-700">Flagged</span>
  ) : (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold bg-green-100 text-green-700">Not Flagged</span>
  );
}

export default function SlowMovingPage() {
  const [productGroups, setProductGroups] = useState<{ id: string; name: string }[]>([]);

  // ── Report filters + data ───────────────────────────────────────────────────
  const [productGroupId, setProductGroupId] = useState("");
  const [isFlagged, setIsFlagged] = useState("");
  const [definitionType, setDefinitionType] = useState("");

  const [reportRows, setReportRows] = useState<SlowMovingDto[]>([]);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportPage, setReportPage] = useState(1);
  const [reportTotalPages, setReportTotalPages] = useState(1);
  const [reportTotalCount, setReportTotalCount] = useState(0);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await getSlowMovingReport({
        page: reportPage,
        limit: PAGE_SIZE,
        productGroupId: productGroupId || undefined,
        isFlagged: isFlagged === "true" ? true : isFlagged === "false" ? false : undefined,
        definitionType: (definitionType as SlowMovingDefinitionType) || undefined,
      });
      setReportRows(res.data);
      setReportTotalPages(res.meta.totalPages);
      setReportTotalCount(res.meta.total);
    } catch (e) {
      setReportError(e instanceof ReportsApiError ? e.message : "Failed to load slow-moving report.");
    } finally {
      setReportLoading(false);
    }
  }, [reportPage, productGroupId, isFlagged, definitionType]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // ── Configuration list ──────────────────────────────────────────────────────
  const [configs, setConfigs] = useState<SlowMovingConfigDto[]>([]);
  const [configsLoading, setConfigsLoading] = useState(true);
  const [configsError, setConfigsError] = useState<string | null>(null);
  const [configPage, setConfigPage] = useState(1);
  const [configTotalPages, setConfigTotalPages] = useState(1);
  const [configTotalCount, setConfigTotalCount] = useState(0);

  const loadConfigs = useCallback(async () => {
    setConfigsLoading(true);
    setConfigsError(null);
    try {
      const res = await getSlowMovingConfigs({ page: configPage, limit: PAGE_SIZE });
      setConfigs(res.data);
      setConfigTotalPages(res.meta.totalPages);
      setConfigTotalCount(res.meta.total);
    } catch (e) {
      setConfigsError(e instanceof ReportsApiError ? e.message : "Failed to load configurations.");
    } finally {
      setConfigsLoading(false);
    }
  }, [configPage]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  useEffect(() => {
    listProductGroups({ limit: 100, isActive: true })
      .then((r) => setProductGroups(r.data))
      .catch(() => setProductGroups([]));
  }, []);

  // ── Run Analysis ────────────────────────────────────────────────────────────
  const [evaluating, setEvaluating] = useState(false);
  const [evaluateResult, setEvaluateResult] = useState<SlowMovingEvaluateResult | null>(null);
  const [evaluateError, setEvaluateError] = useState<string | null>(null);

  async function handleEvaluate() {
    setEvaluating(true);
    setEvaluateError(null);
    setEvaluateResult(null);
    try {
      const res = await evaluateSlowMoving();
      setEvaluateResult(res);
      loadReport();
      loadConfigs();
    } catch (e) {
      setEvaluateError(e instanceof ReportsApiError ? e.message : "Evaluation failed.");
    } finally {
      setEvaluating(false);
    }
  }

  // ── Create / edit config ────────────────────────────────────────────────────
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SlowMovingConfigDto | null>(null);
  const [formProductId, setFormProductId] = useState("");
  const [formDefinition, setFormDefinition] = useState<SlowMovingDefinitionType>("DAYS_30");
  const [formCustomDays, setFormCustomDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    if (configModalOpen) {
      listProducts({ limit: 100, isActive: true })
        .then((r) => setProducts(r.data))
        .catch(() => setProducts([]));
      setProductSearch("");
    }
  }, [configModalOpen]);

  function openCreate() {
    setFormProductId("");
    setFormDefinition("DAYS_30");
    setFormCustomDays("");
    setFormError("");
    setEditingConfig(null);
    setConfigModalOpen(true);
  }

  function openEdit(cfg: SlowMovingConfigDto) {
    setFormProductId(cfg.productId);
    setFormDefinition(cfg.definitionType);
    setFormCustomDays(cfg.customDays != null ? String(cfg.customDays) : "");
    setFormError("");
    setEditingConfig(cfg);
    setConfigModalOpen(true);
  }

  function closeConfigModal() {
    if (saving) return;
    setConfigModalOpen(false);
    setEditingConfig(null);
    setFormError("");
  }

  async function handleSaveConfig() {
    const customDays = formDefinition === "CUSTOM" ? Number(formCustomDays) : null;
    if (formDefinition === "CUSTOM" && (customDays == null || isNaN(customDays) || customDays < 1 || customDays > 365)) {
      setFormError("Custom days must be a number between 1 and 365.");
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      const payload = { definitionType: formDefinition, customDays };
      if (editingConfig) {
        await updateSlowMovingConfig(editingConfig.id, payload);
      } else {
        if (!formProductId) {
          setFormError("Please select a product.");
          return;
        }
        await createSlowMovingConfig({ productId: formProductId, ...payload });
      }
      setConfigModalOpen(false);
      setEditingConfig(null);
      setFormError("");
      loadConfigs();
      loadReport();
    } catch (e) {
      setFormError(e instanceof ReportsApiError ? e.message : "Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete config ───────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<SlowMovingConfigDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSlowMovingConfig(deleteTarget.id);
      setDeleteTarget(null);
      loadConfigs();
      loadReport();
    } catch (e) {
      setFormError(e instanceof ReportsApiError ? e.message : "Failed to delete configuration.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const selectClass =
    "flex-1 min-w-[160px] rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm bg-white focus:border-[#B6C8AF] focus:outline-none transition-all";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Reports / Inventory / Slow Moving"
        title="Slow Moving"
        subtitle="Products below the configured sales velocity thresholds."
        actions={
          <Button onClick={handleEvaluate} loading={evaluating}>
            Run Analysis
          </Button>
        }
      />
      <ReportsSubNav />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* Evaluate banner */}
        {evaluateError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-yellow-800">Evaluation not completed</p>
            <p className="text-xs text-yellow-700 mt-0.5">{evaluateError}</p>
          </div>
        )}
        {evaluateResult && (
          <div className="bg-[#E6ECE2] border border-[#C6D4BF] rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-[#333333]">Evaluation complete</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-xs text-[#666666]">
              <span>Evaluated: <span className="font-bold text-[#333333]">{fmtNumber(evaluateResult.evaluated)}</span></span>
              <span>Flagged: <span className="font-bold text-red-600">{fmtNumber(evaluateResult.flagged)}</span></span>
              <span>Unflagged: <span className="font-bold text-green-600">{fmtNumber(evaluateResult.unflagged)}</span></span>
              <span>Skipped: <span className="font-bold text-[#333333]">{fmtNumber(evaluateResult.skipped)}</span></span>
              <span>Ran at {fmtDateTime(evaluateResult.evaluatedAt)}</span>
              <span>Took {fmtNumber(evaluateResult.durationMs)} ms</span>
            </div>
          </div>
        )}

        {/* Report filters */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
              <label className="text-sm font-medium text-[#333333]">Product Group</label>
              <select value={productGroupId} onChange={(e) => { setProductGroupId(e.target.value); setReportPage(1); }} className={selectClass}>
                <option value="">All Product Groups</option>
                {productGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
              <label className="text-sm font-medium text-[#333333]">Status</label>
              <select value={isFlagged} onChange={(e) => { setIsFlagged(e.target.value); setReportPage(1); }} className={selectClass}>
                <option value="">All Statuses</option>
                <option value="true">Flagged</option>
                <option value="false">Not Flagged</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
              <label className="text-sm font-medium text-[#333333]">Definition</label>
              <select value={definitionType} onChange={(e) => { setDefinitionType(e.target.value); setReportPage(1); }} className={selectClass}>
                <option value="">All Definitions</option>
                {DEFINITION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {(productGroupId || isFlagged || definitionType) && (
              <button onClick={() => { setProductGroupId(""); setIsFlagged(""); setDefinitionType(""); setReportPage(1); }} className="text-xs font-semibold text-[#7A9076] hover:underline">
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Report table */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
          <div className="px-5 py-4 border-b border-[#E6ECE2]">
            <h2 className="text-base font-bold text-[#333333]">Slow-Moving Products</h2>
            <p className="text-xs text-[#666666] mt-0.5">Products that have not sold within their configured threshold.</p>
          </div>
          {reportLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#B6C8AF] animate-spin" />
              <p className="text-sm text-[#666666]">Loading report...</p>
            </div>
          ) : reportError ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 px-6">
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">{reportError}</p>
              <Button onClick={loadReport}>Retry</Button>
            </div>
          ) : reportRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="font-semibold text-[#333333]">No slow-moving products found</p>
              <p className="text-sm text-[#666666] max-w-sm text-center">
                Run the analysis to evaluate products against the configured thresholds.
              </p>
              <Button onClick={handleEvaluate} loading={evaluating}>Run Analysis</Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#E6ECE2] text-left">
                      {["Product", "Definition", "Threshold", "Last Sale", "Days Since", "Status", "Stock", "Stock Value"].map((h) => (
                        <th key={h} className="px-4 py-3 font-semibold text-[#333333]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((row, i) => (
                      <tr key={`${row.product?.id ?? i}-${i}`} className={`${i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/15"} hover:bg-[#E6ECE2]/30 transition-colors`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#333333]">{row.product?.name ?? "—"}</p>
                          {row.product?.sku && <p className="text-xs text-[#666666]">{row.product.sku}</p>}
                        </td>
                        <td className="px-4 py-3 text-[#666666]">{definitionLabel(row)}</td>
                        <td className="px-4 py-3 text-[#666666]">{fmtNumber(row.thresholdDays)} days</td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{fmtDate(row.lastSaleAt)}</td>
                        <td className="px-4 py-3 text-[#666666]">{row.daysSinceLastSale != null ? fmtNumber(row.daysSinceLastSale) : "—"}</td>
                        <td className="px-4 py-3"><StatusBadge flagged={row.isFlagged} /></td>
                        <td className="px-4 py-3 text-right text-[#666666]">{row.stockQuantity != null ? fmtNumber(row.stockQuantity) : "—"}</td>
                        <td className="px-4 py-3 text-right text-[#666666]">{row.stockValue != null ? fmtMoney(row.stockValue) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-[#E6ECE2] flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-[#666666]">
                  Showing {reportTotalCount === 0 ? 0 : Math.min((reportPage - 1) * PAGE_SIZE + 1, reportTotalCount)}–{Math.min(reportPage * PAGE_SIZE, reportTotalCount)} of {fmtNumber(reportTotalCount)} products
                </p>
                <div className="flex items-center justify-end gap-1">
                  <button disabled={reportPage === 1} onClick={() => setReportPage((p) => p - 1)} className="rounded-lg px-3 py-1.5 text-xs border border-[#C6D4BF] text-[#666666] hover:bg-[#E6ECE2] disabled:opacity-40 transition-colors">←</button>
                  <button disabled={reportPage >= reportTotalPages} onClick={() => setReportPage((p) => p + 1)} className="rounded-lg px-3 py-1.5 text-xs border border-[#C6D4BF] text-[#666666] hover:bg-[#E6ECE2] disabled:opacity-40 transition-colors">→</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Configuration */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
          <div className="px-5 py-4 border-b border-[#E6ECE2] flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-[#333333]">Configuration</h2>
              <p className="text-xs text-[#666666] mt-0.5">Per-product slow-moving thresholds.</p>
            </div>
            <Button onClick={openCreate}>+ Add Configuration</Button>
          </div>
          {formError && !configModalOpen && (
            <div className="px-5 pt-3">
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
            </div>
          )}
          {configsLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#B6C8AF] animate-spin" />
              <p className="text-sm text-[#666666]">Loading configurations...</p>
            </div>
          ) : configsError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4 px-6">
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">{configsError}</p>
              <Button onClick={loadConfigs}>Retry</Button>
            </div>
          ) : configs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="font-semibold text-[#333333]">No configurations yet</p>
              <p className="text-sm text-[#666666]">Add a configuration to set slow-moving thresholds per product.</p>
              <Button onClick={openCreate}>+ Add Configuration</Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#E6ECE2] text-left">
                      {["Product", "Definition", "Status", "Updated", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 font-semibold text-[#333333]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {configs.map((cfg, i) => (
                      <tr key={cfg.id} className={`${i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/15"} hover:bg-[#E6ECE2]/30 transition-colors`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#333333]">{cfg.product?.name ?? "—"}</p>
                          {cfg.product?.sku && <p className="text-xs text-[#666666]">{cfg.product.sku}</p>}
                        </td>
                        <td className="px-4 py-3 text-[#666666]">{definitionLabel(cfg)}</td>
                        <td className="px-4 py-3"><StatusBadge flagged={cfg.isFlagged ?? false} /></td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{fmtDate(cfg.updatedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button onClick={() => openEdit(cfg)} className="text-xs font-semibold text-[#7A9076] hover:underline">Edit</button>
                            <button onClick={() => setDeleteTarget(cfg)} className="text-xs text-red-500 hover:underline">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-[#E6ECE2] flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-[#666666]">Showing {fmtNumber(configs.length)} of {fmtNumber(configTotalCount)} configurations</p>
                <div className="flex items-center justify-end gap-1">
                  <button disabled={configPage === 1} onClick={() => setConfigPage((p) => p - 1)} className="rounded-lg px-3 py-1.5 text-xs border border-[#C6D4BF] text-[#666666] hover:bg-[#E6ECE2] disabled:opacity-40 transition-colors">←</button>
                  <button disabled={configPage >= configTotalPages} onClick={() => setConfigPage((p) => p + 1)} className="rounded-lg px-3 py-1.5 text-xs border border-[#C6D4BF] text-[#666666] hover:bg-[#E6ECE2] disabled:opacity-40 transition-colors">→</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Config create/edit modal */}
      <Modal
        open={configModalOpen}
        title={editingConfig ? "Edit Configuration" : "Add Configuration"}
        onClose={closeConfigModal}
        size="md"
      >
        {formError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{formError}</p>}
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-[#666666] mb-1">Product</label>
            {editingConfig ? (
              <div className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm bg-[#E6ECE2]/30 text-[#333333]">
                {editingConfig.product?.name ?? "—"}
              </div>
            ) : (
              <>
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm mb-2 focus:border-[#B6C8AF] focus:outline-none"
                />
                <select
                  value={formProductId}
                  onChange={(e) => setFormProductId(e.target.value)}
                  className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm bg-white focus:border-[#B6C8AF] focus:outline-none"
                >
                  <option value="">Select a product</option>
                  {productSearch
                    ? products
                        .filter((p) => `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(productSearch.toLowerCase()))
                        .map((p) => (
                          <option key={p.id} value={p.id}>{p.name}{p.sku ? ` — ${p.sku}` : ""}</option>
                        ))
                    : products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}{p.sku ? ` — ${p.sku}` : ""}</option>
                      ))}
                </select>
              </>
            )}
          </div>
          <div>
            <label className="block text-sm text-[#666666] mb-1">Slow-Moving Definition</label>
            <select
              value={formDefinition}
              onChange={(e) => setFormDefinition(e.target.value as SlowMovingDefinitionType)}
              className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm bg-white focus:border-[#B6C8AF] focus:outline-none"
            >
              {DEFINITION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {formDefinition === "CUSTOM" && (
            <div>
              <label className="block text-sm text-[#666666] mb-1">Custom Days (1–365)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={formCustomDays}
                onChange={(e) => setFormCustomDays(e.target.value)}
                className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
              />
            </div>
          )}
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="secondary" onClick={closeConfigModal} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveConfig} loading={saving}>
              {editingConfig ? "Save Changes" : "Create Configuration"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete configuration?"
        message={`Remove the slow-moving configuration for "${deleteTarget?.product?.name ?? "this product"}"? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
        danger
      />
    </div>
  );
}