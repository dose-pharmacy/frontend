import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import Button from "../../components/ui/Button";
import {
  createRequirement,
  RequirementsApiError,
  type RequirementCreateResult,
} from "../../features/purchasing/requirementsApi";
import { IconX } from "../../components/ui/icons";

interface ReorderSuggestion {
  /**
   * Backend product id. This is the row identity: reorder suggestions can
   * contain several rows with the SAME product name, so the name must never be
   * used as a key or as the submitted identifier.
   */
  productId: string;
  name: string;
  /** Real backend suggestion, used as the initial editable quantity. */
  suggestedQuantity: number;
  status: string;
  /** Echoed into the line note, matching the backend's own reorder path. */
  calculationMethod?: string;
}

/** Per-row pharmacist state. Kept separate from the reorder API response. */
interface RowState {
  selected: boolean;
  /** Held as a string so the field can be cleared/typed freely without rounding. */
  quantity: string;
}

interface GenerateRequirementsModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate?: () => void;
  suggestions?: ReorderSuggestion[];
}

type View = "confirm" | "success";

/** Only digits and a single decimal point; blocks `-` so negatives are impossible. */
const QTY_CHARS = /[^0-9.]/g;

function initialQuantity(suggestedQuantity: number): string {
  return Number.isFinite(suggestedQuantity) && suggestedQuantity > 0
    ? String(suggestedQuantity)
    : "0";
}

function parseQuantity(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export default function GenerateRequirementsModal({
  open,
  onClose,
  onGenerate,
  suggestions = [],
}: GenerateRequirementsModalProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("confirm");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [showRowErrors, setShowRowErrors] = useState(false);
  const [result, setResult] = useState<RequirementCreateResult | null>(null);
  // Only what the pharmacist actually changed is stored; anything else falls back
  // to the backend's suggested quantity, and no row starts selected.
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const masterRef = useRef<HTMLInputElement>(null);

  /** Backend suggestion per product id, used as the seed quantity for any row. */
  const suggestedById = useMemo(
    () => new Map(suggestions.map((s) => [s.productId, s.suggestedQuantity])),
    [suggestions],
  );

  const suggestedQuantityOf = (productId: string): number => suggestedById.get(productId) ?? 0;

  const rowFor = (productId: string): RowState =>
    rows[productId] ??
    { selected: false, quantity: initialQuantity(suggestedQuantityOf(productId)) };

  const orderedRows = useMemo(
    () => suggestions.map((s) => ({ suggestion: s, row: rowFor(s.productId) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestions, rows],
  );

  const selectedRows = orderedRows.filter(({ row }) => row.selected);
  const selectedCount = selectedRows.length;
  const allSelected = orderedRows.length > 0 && selectedCount === orderedRows.length;
  const someSelected = selectedCount > 0 && !allSelected;

  // §20: the master checkbox reflects none / some / all selected.
  useEffect(() => {
    if (masterRef.current) masterRef.current.indeterminate = someSelected;
  }, [someSelected]);

  // Reset for the next time the modal opens so a previous run never leaks.
  useEffect(() => {
    if (open) return;
    setView("confirm");
    setError(null);
    setValidation(null);
    setShowRowErrors(false);
    setResult(null);
    setRows({});
  }, [open]);

  if (!open) return null;

  function patchRow(productId: string, patch: Partial<RowState>) {
    setRows((prev) => {
      // Fall back to the backend's own suggestion, never to a hard-coded 0, so
      // merely checking a row cannot wipe the quantity it was seeded with (§4).
      const current =
        prev[productId] ??
        { selected: false, quantity: initialQuantity(suggestedQuantityOf(productId)) };
      return { ...prev, [productId]: { ...current, ...patch } };
    });
  }

  /** Selection and quantity are independent: neither one implies the other. */
  function toggleRow(productId: string, checked: boolean) {
    patchRow(productId, { selected: checked });
    setValidation(null);
  }

  function setQuantity(productId: string, raw: string) {
    const cleaned = raw.replace(QTY_CHARS, "");
    patchRow(productId, { quantity: cleaned });
    setValidation(null);
  }

  /** Select All / Deselect All never touches quantities (§3). */
  function toggleAll(checked: boolean) {
    setRows((prev) => {
      const next: Record<string, RowState> = { ...prev };
      for (const s of suggestions) {
        const current =
          next[s.productId] ??
          { selected: false, quantity: initialQuantity(suggestedQuantityOf(s.productId)) };
        next[s.productId] = { ...current, selected: checked };
      }
      return next;
    });
    setValidation(null);
  }

  function handleClose() {
    onClose();
  }

  /** Selected rows whose quantity is not a usable positive number (§7). */
  const invalidSelected = selectedRows.filter(({ row }) => parseQuantity(row.quantity) <= 0);
  const canGenerate = selectedCount > 0 && invalidSelected.length === 0;
  const totalUnits = selectedRows.reduce(
    (sum, { row }) => sum + Math.max(parseQuantity(row.quantity), 0),
    0,
  );

  function validateSelection(): string | null {
    if (selectedCount === 0) {
      return "Select at least one product to generate a purchase requirement.";
    }
    if (invalidSelected.length === selectedCount) {
      return "Enter a quantity greater than 0 for at least one selected product.";
    }
    if (invalidSelected.length > 0) {
      return "Quantity must be greater than 0 for every selected product.";
    }
    // The backend rejects the same product twice in one requirement (422
    // DUPLICATE_PRODUCT_IN_REQUIREMENT). Report it here rather than letting the
    // request fail opaquely.
    const seen = new Set<string>();
    for (const { suggestion } of selectedRows) {
      if (seen.has(suggestion.productId)) {
        return `${suggestion.name} is selected more than once. Increase its quantity instead of selecting it twice.`;
      }
      seen.add(suggestion.productId);
    }
    return null;
  }

  async function handleGenerate() {
    const problem = validateSelection();
    if (problem) {
      setValidation(problem);
      // Inline row errors appear only once the pharmacist has tried to submit,
      // so a freshly opened modal is not covered in red (§7).
      setShowRowErrors(true);
      return;
    }

    setGenerating(true);
    setError(null);
    setValidation(null);
    try {
      // Only pharmacist-selected rows with a valid quantity are sent (§11).
      // `unitId` is deliberately omitted, not null: the backend unit schema is
      // `uuid().optional()`, which rejects null and defaults to the base unit.
      const lines = selectedRows.map(({ suggestion, row }) => ({
        productId: suggestion.productId,
        quantityNeeded: parseQuantity(row.quantity),
        reasonCode: "REORDER_ALERT" as const,
        ...(suggestion.calculationMethod
          ? { notes: `Suggested by reorder (${suggestion.calculationMethod})` }
          : {}),
      }));

      const data = await createRequirement({ lines });
      setResult(data);
      setView("success");
      onGenerate?.();
    } catch (err) {
      // Selections and quantities are deliberately left untouched so the
      // pharmacist does not lose their work (§15).
      setError(
        err instanceof RequirementsApiError
          ? err.message
          : "Failed to generate purchase requirements. Please try again.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function handleGoToPurchasing() {
    onClose();
    navigate("/purchasing");
  }

  const created = result?.createdRequirement ?? null;
  const createdLines = created?.lines ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-xl border border-[#C6D4BF] shadow-lg flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[#E6ECE2]">
          <h2 className="text-base font-bold text-[#333333]">
            {view === "confirm" ? "Generate Purchase Requirements" : "Purchase Requirements Generated"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="text-[#333333]/60 hover:text-[#333333] transition-colors flex items-center"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {view === "confirm" ? (
            <>
              <p className="text-sm text-[#333333]/80">
                Choose the products to generate purchase requirements for and set the quantity to
                request for each. Unchecked products are not sent.
              </p>

              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-[#333333]">
                  {suggestions.length} product{suggestions.length === 1 ? "" : "s"} need replenishment.
                </p>
                <p className="text-sm text-[#666666]">
                  {selectedCount} selected
                  {selectedCount > 0 ? ` • ${totalUnits} total units requested` : ""}
                </p>
              </div>

              {validation && (
                <p
                  role="alert"
                  className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                >
                  {validation}
                </p>
              )}

              <div className="rounded-lg border border-[#C6D4BF] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#E6ECE2]">
                      <tr>
                        <th scope="col" className="w-10 text-center font-semibold text-[#333333] px-4 py-2.5">
                          <input
                            ref={masterRef}
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => toggleAll(e.target.checked)}
                            disabled={suggestions.length === 0}
                            aria-label="Select All"
                            className="h-4 w-4 rounded accent-[#B6C8AF] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </th>
                        <th scope="col" className="text-left font-semibold text-[#333333] px-4 py-2.5">
                          Product
                        </th>
                        <th scope="col" className="text-right font-semibold text-[#333333] px-4 py-2.5 w-44">
                          Requirement Qty
                        </th>
                        <th scope="col" className="text-right font-semibold text-[#333333] px-4 py-2.5">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderedRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-[#333333]/60">
                            No reorder suggestions available.
                          </td>
                        </tr>
                      ) : (
                        orderedRows.map(({ suggestion, row }) => {
                          const qty = parseQuantity(row.quantity);
                          const rowInvalid = row.selected && qty <= 0;
                          return (
                            <tr key={suggestion.productId} className="border-t border-[#E6ECE2]">
                              <td className="px-4 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={row.selected}
                                  onChange={(e) => toggleRow(suggestion.productId, e.target.checked)}
                                  aria-label={`Select ${suggestion.name}`}
                                  className="h-4 w-4 rounded accent-[#B6C8AF] cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-2.5 text-[#333333]">{suggestion.name}</td>
                              <td className="px-4 py-2.5 text-right">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  step="any"
                                  value={row.quantity}
                                  onChange={(e) => setQuantity(suggestion.productId, e.target.value)}
                                  aria-label={`Requirement quantity for ${suggestion.name}`}
                                  aria-invalid={rowInvalid || undefined}
                                  className={`w-24 text-right rounded-lg border px-2.5 py-1.5 text-sm text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/50 ${
                                    rowInvalid && showRowErrors
                                      ? "border-red-300 bg-red-50"
                                      : "border-[#C6D4BF] bg-white"
                                  }`}
                                />
                                {rowInvalid && showRowErrors && (
                                  <p className="mt-1 text-[11px] text-red-600">
                                    Quantity must be greater than 0
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <span className="inline-block rounded-full bg-[#E6ECE2] px-2.5 py-0.5 text-xs font-medium text-[#7A9076]">
                                  {suggestion.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            created && (
              <>
                <p className="text-sm text-[#333333]/80">
                  Purchase requirement{createdLines.length === 1 ? "" : "s"} created successfully.
                </p>
                <p className="text-sm font-semibold text-[#333333]">
                  {created.reference ? `${created.reference} — ` : ""}
                  {createdLines.length} line{createdLines.length === 1 ? "" : "s"} created.
                </p>
                <div className="rounded-lg border border-[#C6D4BF] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#E6ECE2]">
                        <tr>
                          <th scope="col" className="text-left font-semibold text-[#333333] px-3 py-2.5">Product</th>
                          <th scope="col" className="text-right font-semibold text-[#333333] px-3 py-2.5">Requirement Qty</th>
                          <th scope="col" className="text-left font-semibold text-[#333333] px-3 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {createdLines.map((l) => (
                          <tr key={l.id ?? l.productId} className="border-t border-[#E6ECE2]">
                            <td className="px-3 py-2.5 text-[#333333]">{l.product?.name ?? l.productId}</td>
                            <td className="px-3 py-2.5 text-right text-[#333333]">{l.quantityNeeded}</td>
                            <td className="px-3 py-2.5">
                              <span className="inline-block rounded-full bg-[#E6ECE2] px-2.5 py-0.5 text-xs font-medium text-[#7A9076]">
                                {l.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )
          )}
        </div>

        {/* Footer — pinned so a long list never hides the actions (§18) */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#E6ECE2] flex-shrink-0">
          {view === "confirm" ? (
            <>
              <Button variant="secondary" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleGenerate} loading={generating} disabled={!canGenerate}>
                {selectedCount > 0
                  ? `Generate ${selectedCount} Requirement${selectedCount === 1 ? "" : "s"}`
                  : "Generate Requirements"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={handleClose}>Close</Button>
              <Button onClick={handleGoToPurchasing}>Go to Purchasing</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}