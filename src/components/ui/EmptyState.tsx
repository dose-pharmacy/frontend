import { Package } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-14 w-14 rounded-full bg-[#E6ECE2] flex items-center justify-center mb-4">
        <Package className="h-7 w-7 text-[#C6D4BF]" strokeWidth={1.5} aria-hidden />
      </div>
      <p className="text-sm font-semibold text-[#333333]">{title}</p>
      {description && <p className="text-xs text-[#666666] mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
