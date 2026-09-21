import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  loading?: boolean;
  fullWidth?: boolean;
}

export default function Button({
  variant = "primary",
  loading = false,
  fullWidth = false,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-[#B6C8AF] text-[#333333] hover:bg-[#A0B59C] focus-visible:ring-[#B6C8AF] active:scale-[0.98]",
    secondary:
      "bg-[#C6D4BF] text-[#333333] hover:bg-[#B5C8AE] focus-visible:ring-[#C6D4BF] active:scale-[0.98]",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      )}
      {children}
    </button>
  );
}
