import { useEffect, useRef, useState } from "react";

export interface SearchableOption {
  value: string;
  label: string;
  sub?: string;
  hint?: string;
}

interface SearchableSelectProps {
  value: string | null;
  onChange: (value: string) => void;
  /** Currently available options (already filtered for client mode, or the
   *  server-search results). Include the selected option if it is not part of
   *  the current result set so a selection always renders a label. */
  options: SearchableOption[];
  /** Fired when the user types in the search box (for server-side search). */
  onSearch?: (term: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  noResultsMessage?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  disabled?: boolean;
  allowClear?: boolean;
  label?: string;
  errorText?: string;
  /** Show this hint at the bottom of an open list. */
  footerHint?: string;
  onOpen?: () => void;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  onSearch,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No options available",
  noResultsMessage = "No matches found",
  loading = false,
  error = null,
  onRetry,
  disabled = false,
  allowClear = false,
  label,
  errorText,
  footerHint,
  onOpen,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setHighlight(-1);
      onOpen?.();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const choose = (option: SearchableOption) => {
    onChange(option.value);
    setOpen(false);
    setTerm("");
  };

  const onSearchChange = (next: string) => {
    setTerm(next);
    setHighlight(-1);
    onSearch?.(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % Math.max(options.length, 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + options.length) % Math.max(options.length, 1));
      return;
    }
    if (e.key === "Enter") {
      if (highlight >= 0 && options[highlight]) {
        e.preventDefault();
        choose(options[highlight]);
      } else if (options.length === 1) {
        choose(options[0]);
      }
    }
  };

  const id = label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[#333333]">
          {label}
        </label>
      )}
      <div ref={rootRef} className="relative">
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={toggle}
          className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-left text-sm transition-all flex items-center justify-between gap-2 ${
            disabled
              ? "bg-[#F5F4EE] text-[#999] cursor-not-allowed"
              : errorText
                ? "border-red-400"
                : "border-[#C6D4BF]"
          } ${!disabled ? "hover:border-[#B6C8AF] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20" : ""}`}
        >
          <span className="flex flex-col min-w-0">
            {selected ? (
              <>
                <span className="text-[#333333] truncate">{selected.label}</span>
                {selected.sub && <span className="text-xs text-[#999] truncate">{selected.sub}</span>}
              </>
            ) : (
              <span className="text-[#999] truncate">{placeholder}</span>
            )}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            {allowClear && value && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                  setTerm(" ");
                  setTerm("");
                }}
                className="text-[#999] hover:text-red-400 text-base leading-none px-1"
                aria-label="Clear selection"
              >
                ×
              </span>
            )}
            <svg
              className={`h-4 w-4 text-[#999] transition-transform ${open ? "rotate-180" : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </span>
        </button>

        {open && (
          <div className="absolute z-40 mt-1 w-full rounded-lg border border-[#C6D4BF] bg-white shadow-lg overflow-hidden">
            <div className="p-2 border-b border-[#E6ECE2]">
              <input
                ref={inputRef}
                type="text"
                value={term}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-[#C6D4BF] px-3 py-2 text-sm text-[#333333] placeholder:text-[#999] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
              />
            </div>

            <div className="max-h-56 overflow-y-auto py-1">
              {loading ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-[#666666]">
                  <svg className="h-4 w-4 animate-spin text-[#7A9076]" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Searching...
                </div>
              ) : error ? (
                <div className="px-4 py-3">
                  <p className="text-sm text-red-500">{error}</p>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="mt-1 text-xs font-semibold text-[#7A9076] hover:underline"
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : options.length === 0 ? (
                <p className="px-4 py-3 text-sm text-[#999]">
                  {term ? noResultsMessage : emptyMessage}
                </p>
              ) : (
                options.map((option, index) => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => choose(option)}
                    onMouseEnter={() => setHighlight(index)}
                    className={`w-full text-left px-4 py-2 flex items-center justify-between gap-3 ${
                      index === highlight ? "bg-[#E6ECE2]" : "hover:bg-[#E6ECE2]/60"
                    }`}
                  >
                    <span className="flex flex-col min-w-0">
                      <span className="text-sm text-[#333333] truncate">{option.label}</span>
                      {option.sub && <span className="text-xs text-[#999] truncate">{option.sub}</span>}
                    </span>
                    {option.hint && (
                      <span className="text-xs font-medium text-[#666666] whitespace-nowrap">{option.hint}</span>
                    )}
                  </button>
                ))
              )}
            </div>

            {footerHint && (
              <div className="px-4 py-2 text-xs text-[#999] border-t border-[#E6ECE2]">{footerHint}</div>
            )}
          </div>
        )}
      </div>
      {errorText && <p className="text-xs text-red-500">{errorText}</p>}
    </div>
  );
}

export function toOption(value: string, label: string, sub?: string, hint?: string): SearchableOption {
  return { value, label, sub, hint };
}