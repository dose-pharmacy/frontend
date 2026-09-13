import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  rightElement?: React.ReactNode;
}

export default function Input({ label, error, rightElement, className = "", id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[#333333]">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          className={`w-full rounded-lg border border-[#ABDBE3] bg-white px-3.5 py-2.5 text-sm text-[#333333] placeholder:text-[#999] transition-all
            focus:border-[#49B0C1] focus:outline-none focus:ring-2 focus:ring-[#49B0C1]/20
            ${error ? "border-red-400 focus:border-red-400 focus:ring-red-100" : ""}
            ${rightElement ? "pr-11" : ""}
            ${className}`}
          {...props}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {rightElement}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
