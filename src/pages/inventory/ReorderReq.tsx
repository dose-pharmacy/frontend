import { useState } from "react";
import { useNavigate } from "react-router";
import { X } from "lucide-react";
import Button from "../../components/ui/Button";
import {
  generatePurchaseRequirements,
  ReorderApiError,
  type PurchaseRequirementsResult,
} from "../../features/inventory/reorderApi";

interface ReorderSuggestion {
  id: string;
  name: string;
  suggestedQty: number;
  status: string;
}

interface GenerateRequirementsModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate?: () => void;
  suggestions?: ReorderSuggestion[];
}

type View = "confirm" | "success";

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
  const [result, setResult] = useState<PurchaseRequirementsResult | null>(null);

  if (!open) return null;

  function reset() {
    setView("confirm");
    setError(null);
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const data = await generatePurchaseRequirements();
      setResult(data);
      setView("success");
      onGenerate?.();
    } catch (err) {
      setError(
        err instanceof ReorderApiError
          ? err.message
          : "Failed to generate purchase requirements. Please try again.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function handleGoToPurchasing() {
    reset();
    onClose();
    navigate("/purchasing");
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-xl border border-[#C6D4BF] shadow-lg flex flex-col max-h-[90vh]"
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
            className="text-[#333333]/60 hover:text-[#333333] transition-colors text-lg leading-none"
          >
            <X className="h-5 w-5" />
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
                The system will create purchase requirements from the current reorder
                suggestions.
              </p>
              <p className="text-sm font-semibold text-[#333333]">
                {suggestions.length} product{suggestions.length === 1 ? "" : "s"} need replenishment.
              </p>
              <div className="rounded-lg border border-[#C6D4BF] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#E6ECE2]">
                    <tr>
                      <th className="text-left font-semibold text-[#333333] px-4 py-2.5">Product</th>
                      <th className="text-right font-semibold text-[#333333] px-4 py-2.5">Suggested Qty</th>
                      <th className="text-right font-semibold text-[#333333] px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-[#333333]/60">
                          No reorder suggestions available.
                        </td>
                      </tr>
                    ) : (
                      suggestions.map((item) => (
                        <tr key={item.id} className="border-t border-[#E6ECE2]">
                          <td className="px-4 py-2.5 text-[#333333]">{item.name}</td>
                          <td className="px-4 py-2.5 text-right text-[#333333]">{item.suggestedQty}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="inline-block rounded-full bg-[#E6ECE2] px-2.5 py-0.5 text-xs font-medium text-[#7A9076]">
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            result && (
              <>
                <p className="text-sm text-[#333333]/80">
                  Purchase requirements have been generated successfully.
                </p>
                <p className="text-sm font-semibold text-[#333333]">
                  {result.requirements.length} purchase requirement{result.requirements.length === 1 ? "" : "s"} created.
                </p>
                <div className="rounded-lg border border-[#C6D4BF] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#E6ECE2]">
                        <tr>
                          <th className="text-left font-semibold text-[#333333] px-3 py-2.5">Product</th>
                          <th className="text-left font-semibold text-[#333333] px-3 py-2.5">SKU</th>
                          <th className="text-right font-semibold text-[#333333] px-3 py-2.5">Suggested Qty</th>
                          <th className="text-right font-semibold text-[#333333] px-3 py-2.5">Current Stock</th>
                          <th className="text-right font-semibold text-[#333333] px-3 py-2.5">Reorder Point</th>
                          <th className="text-right font-semibold text-[#333333] px-3 py-2.5">Lead Time</th>
                          <th className="text-left font-semibold text-[#333333] px-3 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.requirements.map((r) => (
                          <tr key={r.productId} className="border-t border-[#E6ECE2]">
                            <td className="px-3 py-2.5 text-[#333333]">{r.productName}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-[#666666]">{r.productSku}</td>
                            <td className="px-3 py-2.5 text-right text-[#333333]">{r.suggestedQuantity}</td>
                            <td className="px-3 py-2.5 text-right text-[#333333]">{r.currentStock}</td>
                            <td className="px-3 py-2.5 text-right text-[#333333]">{r.reorderPoint}</td>
                            <td className="px-3 py-2.5 text-right text-[#333333]">{r.leadTimeDays} days</td>
                            <td className="px-3 py-2.5">
                              <span className="inline-block rounded-full bg-[#E6ECE2] px-2.5 py-0.5 text-xs font-medium text-[#7A9076]">
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-xs text-[#666666]">Generated at: {formatDate(result.generatedAt)}</p>
              </>
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#E6ECE2]">
          {view === "confirm" ? (
            <>
              <Button variant="secondary" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleGenerate} loading={generating}>Generate Requirements</Button>
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