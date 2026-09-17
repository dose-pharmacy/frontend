import { useState } from "react";
import Button from "../../components/ui/Button";

interface ReorderSuggestion {
  id: string;
  name: string;
  suggestedQty: number;
  status: string;
}

const mockSuggestions: ReorderSuggestion[] = [
  { id: "1", name: "Paracetamol 500mg", suggestedQty: 200, status: "Draft" },
  { id: "2", name: "Omeprazole 20mg", suggestedQty: 100, status: "Draft" },
  { id: "3", name: "Losartan 50mg", suggestedQty: 60, status: "Draft" },
  { id: "4", name: "Metformin 850mg", suggestedQty: 120, status: "Draft" },
];

interface GenerateRequirementsModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate?: (items: ReorderSuggestion[]) => void;
  suggestions?: ReorderSuggestion[];
}

export default function GenerateRequirementsModal({
  open,
  onClose,
  onGenerate,
  suggestions = mockSuggestions,
}: GenerateRequirementsModalProps) {
  const [generating, setGenerating] = useState(false);

  if (!open) return null;

  async function handleGenerate() {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 800));
    setGenerating(false);
    onGenerate?.(suggestions);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-xl border border-[#ABDBE3] shadow-lg flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[#DBEFF3]">
          <h2 className="text-base font-bold text-[#333333]">
            Generate Purchase Requirements
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[#333333]/60 hover:text-[#333333] transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
          <p className="text-sm text-[#333333]/80">
            The system will create purchase requirements from the current reorder
            suggestions.
          </p>

          <p className="text-sm font-semibold text-[#333333]">
            {suggestions.length} product{suggestions.length === 1 ? "" : "s"} need replenishment.
          </p>

          {/* Table */}
          <div className="rounded-lg border border-[#ABDBE3] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#DBEFF3]">
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
                    <tr key={item.id} className="border-t border-[#DBEFF3]">
                      <td className="px-4 py-2.5 text-[#333333]">{item.name}</td>
                      <td className="px-4 py-2.5 text-right text-[#333333]">{item.suggestedQty}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-block rounded-full bg-[#DBEFF3] px-2.5 py-0.5 text-xs font-medium text-[#49B0C1]">
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#DBEFF3]">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} loading={generating}>
            Generate Requirements
          </Button>
        </div>
      </div>
    </div>
  );
}