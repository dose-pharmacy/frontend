import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

export default function Modal({ open, title, onClose, children, size = "md" }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal aria-labelledby="modal-title">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-xl w-full ${sizes[size]} flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6ECE2]">
          <h2 id="modal-title" className="text-base font-bold text-[#333333]">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#666666] hover:bg-[#E6ECE2] transition-colors" aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
