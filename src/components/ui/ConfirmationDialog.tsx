import Button from "./Button";
import { Loader2 } from "lucide-react";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  danger?: boolean;
}

export default function ConfirmationDialog({
  open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel",
  onConfirm, onCancel, loading = false, danger = false,
}: ConfirmationDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal aria-labelledby="dialog-title">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 id="dialog-title" className="text-base font-bold text-[#333333]">{title}</h2>
        <p className="mt-2 text-sm text-[#666666]">{message}</p>
        <div className="mt-6 flex gap-3 justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-[#333333] transition-all disabled:opacity-60 ${danger ? "bg-red-500 hover:bg-red-600" : "bg-[#B6C8AF] hover:bg-[#A0B59C]"}`}
          >
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
