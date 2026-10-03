// ── Purchasing → Requirements · Generate from Reorder ────────────────────────
// Turns reorder suggestions into purchase requirement lines. The pharmacist
// decides which products to order and how much of each; nothing is preselected.
//
// THE SELECTION RULES THIS MODAL ENFORCES
//   • Every row opens UNCHECKED at quantity 0. The reorder endpoint's own
//     `suggestedQuantity` is displayed as read-only context but never seeds the
//     field — accepting the suggestion is the pharmacist's decision, not a
//     default. (See `INITIAL_QUANTITY`.)
//   • Selection and quantity are independent. Ticking a row does not fill in a
//     quantity, and typing a quantity does not tick the row.
//   • Only TICKED rows are sent. An unticked row's quantity is never read, so
//     it is never validated and never submitted.
//   • A ticked row at 0 blocks submission. It is flagged inline the moment it
//     happens, and pressing Generate names the offending products rather than
//     failing silently at the backend.
//   • Generate is disabled only when nothing is ticked or a request is in
//     flight — never to hide the reason a submission is blocked.
//   • A failed request leaves every checkbox and quantity untouched; the form
//     is only cleared when the modal closes.
//
// API: `POST /purchasing/requirements` via `createRequirement`. The payload is
// built from the ticked rows alone, using the backend's own field names
// (`productId`, `quantityNeeded`). `unitId` is deliberately omitted, which makes
// the backend default the line to the product's base unit.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import Button from "../../components/ui/Button";
import {
  createRequirement,
  RequirementsApiError,
  type RequirementCreateResult,
} from "../../features/purchasing/requirementsApi";
import type { ReorderBaseUnitDto } from "../../features/inventory/reorderApi";
import { quantityWithUnit, unitName } from "../../utils/format";
import { IconX } from "../../components/ui/icons";

interface ReorderSuggestion {
  /**
   * Backend product id. This is the row identity: reorder suggestions can
   * contain several rows with the SAME product name, so the name must never be
   * used as a key or as the submitted identifier.
   */
  productId: string;
  name: string;
  /** Real backend suggestion. Display-only: the pharmacist types the requirement
   *  quantity, so this is shown beside the product as context and is never the
   *  field's starting value and never sent. */
  suggestedQuantity: number;
  status: string;
  /** Echoed into the line note, matching the backend's own reorder path. */
  calculationMethod?: string;
  /**
   * The product's base unit, as sent by GET /inventory/reorder/suggestions.
   * Display-only: the quantity is entered and stored in this unit, and the
   * create request omits `unitId` so the backend defaults to it. `null` means
   * the response carried no unit, and the row then shows none.
   */
  baseUnit?: ReorderBaseUnitDto | null;
}

/** Per-row pharmacist state. Kept separate from the reorder API response and
 *  keyed by the backend product id, because suggestions can repeat a name. */
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

/**
 * Every row starts here, checked or not.
 *
 * The reorder endpoint sends its own `suggestedQuantity`, and that number is
 * deliberately NOT the starting value: the pharmacist types the quantity they
 * want to request. Seeding the field with the suggestion would turn "generate
 * from reorder" into "accept every suggestion unchanged", which is the opposite
 * of selecting products one by one. The suggestion is still shown beside the
 * product as read-only context.
 */
const INITIAL_QUANTITY = "0";

/**
 * The typed value as a usable number.
 *
 * Guards every way a quantity can be absent — an empty field is `""` (`NaN`),
 * a field holding only punctuation is `NaN`, and anything non-finite is
 * rejected — so callers never have to re-check. Never negative: `QTY_CHARS`
 * strips `-` from the input, and this clamps what slips past it.
 */
function parseQuantity(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
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
  const [result, setResult] = useState<RequirementCreateResult | null>(null);
  // Only what the pharmacist actually changed is stored. Anything untouched is
  // unselected at 0, so opening the modal never selects or submits anything.
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const masterRef = useRef<HTMLInputElement>(null);

  /** Untouched rows are unselected at 0; only edits are stored. */
  const rowFor = (productId: string): RowState =>
    rows[productId] ?? { selected: false, quantity: INITIAL_QUANTITY };

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
  // Runs on CLOSE, not on open, so a failed submission keeps the pharmacist's
  // checkboxes and quantities exactly as they were.
  useEffect(() => {
    if (open) return;
    setView("confirm");
    setError(null);
    setValidation(null);
    setResult(null);
    setRows({});
  }, [open]);

  if (!open) return null;

  function patchRow(productId: string, patch: Partial<RowState>) {
    setRows((prev) => {
      const current = prev[productId] ?? { selected: false, quantity: INITIAL_QUANTITY };
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

  /** Select All / Deselect All never touches quantities — every row still starts
   *  at 0, so the pharmacist must enter each quantity. */
  function toggleAll(checked: boolean) {
    setRows((prev) => {
      const next: Record<string, RowState> = { ...prev };
      for (const s of suggestions) {
        const current = next[s.productId] ?? { selected: false, quantity: INITIAL_QUANTITY };
        next[s.productId] = { ...current, selected: checked };
      }
      return next;
    });
    setValidation(null);
  }

  function handleClose() {
    onClose();
  }

  /** Selected rows whose quantity is not a usable positive number. A checked
   *  product still sitting at 0 blocks submission — the checkbox says "include
   *  this", so the quantity has to be filled in. */
  const invalidSelected = selectedRows.filter(({ row }) => parseQuantity(row.quantity) <= 0);

  /**
   * The button is disabled ONLY when nothing is selected (or a request is in
   * flight). It deliberately stays enabled while a selected row is invalid:
   * disabling it there would leave the pharmacist with a dead button and no
   * explanation of why. Enabled, pressing it runs `validateSelection`, which
   * shows the message and highlights the offending fields.
   */
  const canGenerate = selectedCount > 0 && !generating;

  const totalUnits = selectedRows.reduce((sum, { row }) => sum + parseQuantity(row.quantity), 0);

  function validateSelection(): string | null {
    if (selectedCount === 0) {
      return "Select at least one product to generate a purchase requirement.";
    }
    if (invalidSelected.length === selectedCount) {
      return "Enter a quantity greater than 0 for at least one selected product.";
    }
    if (invalidSelected.length > 0) {
      const names = invalidSelected
        .slice(0, 3)
        .map(({ suggestion }) => suggestion.name)
        .join(", ");
      const rest = invalidSelected.length > 3 ? ` and ${invalidSelected.length - 3} more` : "";
      return `Enter a quantity greater than 0 for every selected product: ${names}${rest}.`;
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
                Tick the products to include and enter the quantity to request for each.
                Unticked products are not sent.
              </p>

              {/* Live selection counter — recomputed on every checkbox change. */}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-[#333333]">
                  {selectedCount} of {suggestions.length} product
                  {suggestions.length === 1 ? "" : "s"} selected
                </p>
                {selectedCount > 0 && (
                  <p className="text-sm text-[#666666]">
                    {totalUnits} total unit{totalUnits === 1 ? "" : "s"} requested
                  </p>
                )}
              </div>

              {validation && (
                <p
                  role="alert"
                  className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                >
                  {validation}
                </p>
              )}

              {/* The list scrolls on its own so a long reorder list never pushes
                  the counter or the footer out of reach. */}
              <div className="rounded-lg border border-[#C6D4BF] overflow-hidden">
                <div className="max-h-[45vh] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-[#E6ECE2]">
                      <tr>
                        <th
                          scope="col"
                          className="w-32 text-left font-semibold text-[#333333] px-4 py-2.5"
                        >
                          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                            <input
                              ref={masterRef}
                              type="checkbox"
                              checked={allSelected}
                              onChange={(e) => toggleAll(e.target.checked)}
                              disabled={suggestions.length === 0}
                              className="h-4 w-4 rounded accent-[#B6C8AF] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <span className="whitespace-nowrap">Select all</span>
                          </label>
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
                          // A ticked row at 0 is the only invalid state: an
                          // unticked row is never sent, so its quantity is
                          // irrelevant and must not be flagged.
                          const rowInvalid = row.selected && qty <= 0;
                          const rowErrorId = `qty-error-${suggestion.productId}`;
                          return (
                            <tr key={suggestion.productId} className="border-t border-[#E6ECE2]">
                              <td className="px-4 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={row.selected}
                                  onChange={(e) => toggleRow(suggestion.productId, e.target.checked)}
                                  aria-label={`Select ${suggestion.name}`}
                                  aria-describedby={rowInvalid ? rowErrorId : undefined}
                                  className="h-4 w-4 rounded accent-[#B6C8AF] cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="text-[#333333]">{suggestion.name}</div>
                                {/* The reorder suggestion is shown as read-only
                                    context only — it is never the starting value
                                    of the field and never sent. */}
                                {Number.isFinite(suggestion.suggestedQuantity) &&
                                  suggestion.suggestedQuantity > 0 && (
                                    <div className="text-[11px] text-[#999999]">
                                      Suggested reorder: {suggestion.suggestedQuantity}
                                      {unitName(suggestion.baseUnit)
                                        ? ` ${unitName(suggestion.baseUnit)}`
                                        : ""}
                                    </div>
                                  )}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                {/* Unit shown beside the input — the same
                                    placement CreateSupplierInvoicePage and the
                                    delivery registration form use. Informational
                                    only: it is never a selectable field and it
                                    is never sent. */}
                                <div className="flex items-center justify-end gap-1.5">
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    step="any"
                                    value={row.quantity}
                                    onChange={(e) => setQuantity(suggestion.productId, e.target.value)}
                                    aria-label={`Requirement quantity for ${suggestion.name}`}
                                    aria-invalid={rowInvalid || undefined}
                                    aria-describedby={rowInvalid ? rowErrorId : undefined}
                                    className={`w-24 text-right rounded-lg border px-2.5 py-1.5 text-sm text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/50 ${
                                      rowInvalid
                                        ? "border-red-300 bg-red-50"
                                        : "border-[#C6D4BF] bg-white"
                                    }`}
                                  />
                                  {unitName(suggestion.baseUnit) && (
                                    <span className="text-xs text-[#999999] whitespace-nowrap">
                                      {unitName(suggestion.baseUnit)}
                                    </span>
                                  )}
                                </div>
                                {/* Shown as soon as the row is ticked at 0 —
                                    waiting for a submit attempt would hide the
                                    reason behind the blocked action. */}
                                {rowInvalid && (
                                  <p id={rowErrorId} className="mt-1 text-[11px] text-red-600">
                                    Enter a quantity greater than 0
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
                            {/* The unit the BACKEND recorded on the created line
                                (`RequirementLine.unit`), not the product default. */}
                            <td className="px-3 py-2.5 text-right text-[#333333] whitespace-nowrap">
                              {quantityWithUnit(l.quantityNeeded, l.unit)}
                            </td>
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

        {/* Footer — pinned so a long list never hides the actions. */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#E6ECE2] flex-shrink-0">
          {view === "confirm" ? (
            <>
              {/* Says out loud why the button is unavailable, rather than
                  leaving a greyed-out control with no explanation. */}
              <p className="text-xs text-[#666666]">
                {generating
                  ? "Generating…"
                  : selectedCount === 0
                    ? "Tick at least one product to enable Generate."
                    : `${totalUnits} unit${totalUnits === 1 ? "" : "s"} across ${selectedCount} product${selectedCount === 1 ? "" : "s"} will be requested.`}
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleGenerate} loading={generating} disabled={!canGenerate}>
                  {selectedCount > 0
                    ? `Generate ${selectedCount} Requirement${selectedCount === 1 ? "" : "s"}`
                    : "Generate Requirements"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <span />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleClose}>Close</Button>
                <Button onClick={handleGoToPurchasing}>Go to Purchasing</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}