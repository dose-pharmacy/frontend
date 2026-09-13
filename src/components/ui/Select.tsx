import type { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export default function Select({ label, error, id, className = "", children, ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-[#333333]">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full rounded-lg border border-[#ABDBE3] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#49B0C1] focus:outline-none focus:ring-2 focus:ring-[#49B0C1]/20 transition-all ${error ? "border-red-400" : ""} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
