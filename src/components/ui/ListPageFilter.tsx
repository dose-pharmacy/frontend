import React, { useState } from "react"
import SearchInput from "./SearchInput"

export interface FilterTab<T extends string = string> {
  key: T
  label: string
  count?: number | null
}

export interface SecondaryFilterChip {
  id: string
  label: string
  value: string
  onRemove: () => void
}

export interface ListPageFilterProps<T extends string = string> {
  // Search
  search?: string
  onSearchChange?: (val: string) => void
  searchPlaceholder?: string

  // Status Tabs
  tabs?: FilterTab<T>[]
  activeTab?: T
  onTabChange?: (key: T) => void
  tabsAriaLabel?: string

  // Expandable panel state (controlled or uncontrolled)
  isOpen?: boolean
  onToggleOpen?: () => void
  activeFilterCount?: number
  onClearSecondary?: () => void

  // Active filter chips
  secondaryChips?: SecondaryFilterChip[]

  // Secondary filter controls (rendered inside the expandable panel)
  children?: React.ReactNode

  // Extra toolbar actions on the right of search/filters
  extraToolbarActions?: React.ReactNode

  // Results count / summary
  resultsCount?: number | null
  resultsLabel?: string

  // Additional styling
  className?: string
}

function FilterSlidersIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 5a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm3 5a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
    </svg>
  )
}

function ChevronDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CloseIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default function ListPageFilter<T extends string = string>({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  tabs,
  activeTab,
  onTabChange,
  tabsAriaLabel = "Workflow status filter",
  isOpen,
  onToggleOpen,
  activeFilterCount = 0,
  onClearSecondary,
  secondaryChips = [],
  children,
  extraToolbarActions,
  resultsCount,
  resultsLabel = "results",
  className = "",
}: ListPageFilterProps<T>) {
  // Support both controlled and uncontrolled open state
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = isOpen !== undefined
  const open = isControlled ? isOpen : internalOpen

  function handleToggle() {
    if (isControlled) {
      onToggleOpen?.()
    } else {
      setInternalOpen((prev) => !prev)
    }
  }

  const hasSecondary = Boolean(children)

  return (
    <div
      className={`bg-white rounded-xl border border-[#E6ECE2] p-4 flex flex-col gap-3.5 shadow-xs ${className}`}
    >
      {/* ── Main Toolbar: Search + Filter Toggle + Actions ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center min-w-0">
          {onSearchChange !== undefined && (
            <div className="flex-1 min-w-[200px] max-w-xl">
              <SearchInput
                value={search ?? ""}
                onChange={onSearchChange}
                placeholder={searchPlaceholder}
              />
            </div>
          )}

          {hasSecondary && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleToggle}
                aria-expanded={open}
                aria-label={`Filter options, ${activeFilterCount} active filters`}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/40 ${
                  open
                    ? "bg-[#E6ECE2] border-[#B6C8AF] text-[#333333]"
                    : activeFilterCount > 0
                      ? "bg-[#F4F7F2] border-[#C6D4BF] text-[#333333] hover:bg-[#E6ECE2]"
                      : "bg-white border-[#C6D4BF] text-[#4A4A4A] hover:bg-[#F9FAF8] hover:border-[#B6C8AF]"
                }`}
              >
                <FilterSlidersIcon className="w-4 h-4 text-[#7A9076] shrink-0" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span
                    className="inline-flex items-center justify-center rounded-full bg-[#7A9076] text-white px-1.5 py-0.5 text-xs font-bold min-w-5 h-5 leading-none shrink-0"
                    title={`${activeFilterCount} active secondary filters`}
                  >
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDownIcon
                  className={`w-3.5 h-3.5 text-[#666666] transition-transform duration-200 shrink-0 ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>

              {activeFilterCount > 0 && onClearSecondary && !open && (
                <button
                  type="button"
                  onClick={onClearSecondary}
                  className="text-xs font-semibold text-[#7A9076] hover:text-[#4F6B4A] hover:underline whitespace-nowrap px-1 py-1"
                >
                  Clear secondary
                </button>
              )}
            </div>
          )}
        </div>

        {/* Extra Toolbar Actions or Result Summary */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
          {extraToolbarActions}
          {resultsCount !== undefined && resultsCount !== null && (
            <span className="text-xs font-medium text-[#666666] whitespace-nowrap hidden md:inline">
              {resultsCount.toLocaleString()}{" "}
              {resultsLabel}
            </span>
          )}
        </div>
      </div>

      {/* ── Expandable Secondary-Filter Panel ── */}
      {/* Expands downward naturally in document flow, pushing subsequent elements down */}
      {hasSecondary && open && (
        <div
          className="pt-3.5 border-t border-[#E6ECE2] flex flex-col gap-3.5"
          role="region"
          aria-label="Secondary filters"
        >
          {/* Header row in panel */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#666666] uppercase tracking-wider">
              Secondary Filters
            </span>
            {activeFilterCount > 0 && onClearSecondary && (
              <button
                type="button"
                onClick={onClearSecondary}
                className="text-xs font-semibold text-[#7A9076] hover:text-[#4F6B4A] hover:underline"
              >
                Clear all secondary filters
              </button>
            )}
          </div>

          {/* Controls grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 items-end">
            {children}
          </div>

          {/* Active chips if any */}
          {secondaryChips.length > 0 && (
            <div className="pt-2.5 border-t border-[#F0F4EC] flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#999999] shrink-0">Active:</span>
              {secondaryChips.map((chip) => (
                <span
                  key={chip.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#E6ECE2] px-2.5 py-1 text-xs text-[#333333] border border-[#C6D4BF] max-w-[280px]"
                  title={`${chip.label}: ${chip.value}`}
                >
                  <span className="text-[#666666] font-medium shrink-0">
                    {chip.label}:
                  </span>
                  <span className="font-semibold truncate min-w-0">
                    {chip.value}
                  </span>
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    className="text-[#666666] hover:text-red-600 rounded p-0.5 ml-0.5 shrink-0 transition-colors"
                    aria-label={`Remove filter ${chip.label}: ${chip.value}`}
                  >
                    <CloseIcon className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Primary Workflow Status Tabs ── */}
      {tabs && tabs.length > 0 && (
        <div className="pt-2 border-t border-[#E6ECE2]">
          <nav
            className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none"
            aria-label={tabsAriaLabel}
          >
            {tabs.map(({ key, label, count }) => {
              const isActive = key === activeTab
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onTabChange?.(key)}
                  aria-current={isActive ? "page" : undefined}
                  className={`px-3.5 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors flex items-center gap-1.5 shrink-0 focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/40 ${
                    isActive
                      ? "bg-[#E6ECE2] text-[#4F6B4A] font-semibold border border-[#C6D4BF]"
                      : "text-[#666666] hover:text-[#333333] hover:bg-[#F5F7F3]"
                  }`}
                >
                  <span>{label}</span>
                  {count !== undefined && count !== null && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? "bg-white text-[#4F6B4A]"
                          : "bg-[#E6ECE2] text-[#666666]"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      )}
    </div>
  )
}
