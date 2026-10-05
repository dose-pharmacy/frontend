// ── Finance · Reports ───────────────────────────────────────────────────────
// `GET /finance-reporting/report` — ONE request drives the whole page.
//
// REQUEST DISCIPLINE
// The toolbar edits a DRAFT. The request is built only from the APPLIED filters,
// so typing a date, typing in the location search box or paging through the
// product-group list fires no request at all — pressing Apply is the single
// refetch trigger, and the fetch hook's dependency list is the applied tuple.
// Rapid Apply presses abort the in-flight request, so a slow earlier response
// cannot overwrite a newer one and orphaned payloads are not left downloading.
//
// The report already embeds `data.trends`, so `/finance-reporting/trends` is
// deliberately NOT called: issuing it would be a second request for data already
// in hand, and it would be able to disagree with the report's own trends.
//
// DISPLAYED RANGE
// The range shown under the toolbar is `period.fromDate` → `period.toDate` from
// the RESPONSE, never the form fields. With the dates left empty nothing is sent
// and the backend applies its own default window — only the response knows what
// that was. `period.fromDate`/`toDate` are calendar days, so no timezone
// conversion can shift them into a neighbouring day.

import { useState } from "react";
import DatePicker from "../../components/ui/DatePicker";
import SearchableSelect from "../../components/ui/SearchableSelect";
import type { SearchableOption } from "../../components/ui/SearchableSelect";
import { searchLocations, searchProductGroups } from "../../features/inventory/searchSelectors";
import {
  getFinanceReport,
  type FinanceReport,
  type FinanceGranularity,
} from "../../features/finance/financeReportingApi";
import { useSearchableResource } from "../../hooks/useSearchableResource";
import {
  ErrorBanner,
  FilterChip,
  SectionSkeleton,
  SegmentedControl,
  StatCardSkeleton,
} from "./components/primitives";
import { GRID } from "./components/tokens";
import {
  ReportCollectionsPanel,
  ReportInventoryPanel,
  ReportKpiStrip,
  ReportProfitabilityPanel,
  ReportPurchasingPanel,
  ReportSalesPanel,
  ReportScopePanel,
  ReportTrendsPanel,
} from "./FinanceReportSections";
import {
  DEFAULT_REPORT_FILTERS,
  GRANULARITY_OPTIONS,
  buildReportQuery,
  effectiveRange,
  validateReportFilters,
  type FinanceReportFilters,
} from "./financeReportsView";
import { useFinanceFetch } from "./financeView";
import FinanceSectionHeading from "./FinanceSectionHeading";

const GRANULARITY_SEGMENTS = GRANULARITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

/** Keeps a selected option visible even if it falls outside the latest results. */
function withSelected(options: SearchableOption[], value: string): SearchableOption[] {
  if (!value) return options;
  const selected = options.find((o) => o.value === value);
  if (!selected) return options;
  return [selected, ...options.filter((o) => o.value !== value)];
}

export function FinanceReportsSection({ reloadTick = 0 }: { reloadTick?: number }) {
  // Draft — what the toolbar is currently showing.
  const [draft, setDraft] = useState<FinanceReportFilters>(DEFAULT_REPORT_FILTERS);
  // Applied — what the request was built from.
  const [applied, setApplied] = useState<FinanceReportFilters>(DEFAULT_REPORT_FILTERS);
  // Set by a rejected Apply. Cleared as soon as the draft changes again, so the
  // message always describes the fields currently on screen.
  const [validationError, setValidationError] = useState<string | null>(null);

  // Options come from the app's own APIs — ids are never invented, and both are
  // server-searched because either list can run to hundreds of rows.
  const locationSearch = useSearchableResource(searchLocations, true);
  const groupSearch = useSearchableResource(searchProductGroups, true);
  const locationOptions = withSelected(locationSearch.options, draft.locationId);
  const groupOptions = withSelected(groupSearch.options, draft.productGroupId);

  function edit(patch: Partial<FinanceReportFilters>) {
    setDraft((f) => ({ ...f, ...patch }));
    setValidationError(null);
  }

  function handleApply() {
    const problem = validateReportFilters(draft);
    if (problem) {
      // Rejected before the request goes out — an obviously invalid range never
      // reaches the API.
      setValidationError(problem);
      return;
    }
    setValidationError(null);
    setApplied(draft);
  }

  function handleReset() {
    setValidationError(null);
    setDraft(DEFAULT_REPORT_FILTERS);
    setApplied(DEFAULT_REPORT_FILTERS);
  }

  const report = useFinanceFetch<FinanceReport>(
    (signal) => getFinanceReport(buildReportQuery(applied), signal),
    // `reloadTick` is the page header's Refresh. It re-runs the request with
    // whatever filters are currently APPLIED — it never silently reverts the
    // pharmacist's selection to the defaults.
    [
      applied.from,
      applied.to,
      applied.locationId,
      applied.productGroupId,
      applied.granularity,
      reloadTick,
    ],
    "Could not load the finance report.",
  );

  const data = report.data;
  const loading = report.loading;
  const range = data ? effectiveRange(data) : null;

  const selectedLocation = locationOptions.find((o) => o.value === applied.locationId);
  const selectedGroup = groupOptions.find((o) => o.value === applied.productGroupId);
  const hasFilters = Boolean(applied.from || applied.to || applied.locationId || applied.productGroupId);

  return (
    <section id="finance-reports" aria-labelledby="finance-reports-heading">
      <FinanceSectionHeading
        id="finance-reports-heading"
        title="Reports"
        subtitle="Filter the period, then analyze sales, purchasing, profitability, collections and inventory value."
      />

      {/* ── Filter bar: one compact sticky row ── */}
      <div className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur-sm shadow-xs">
        <div className="flex flex-wrap items-end gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-1.5 w-[150px]">
            <span className="text-sm font-medium text-text-primary">From</span>
            {/* aria-label (not htmlFor): the trigger shows the picked date, never
                the word "From", and exposes no id to point a label at. */}
            <DatePicker
              value={draft.from}
              ariaLabel="From date"
              onChange={(v) => edit({ from: v })}
              placeholder="From date"
            />
          </div>

          <div className="flex flex-col gap-1.5 w-[150px]">
            <span className="text-sm font-medium text-text-primary">To</span>
            <DatePicker value={draft.to} ariaLabel="To date" onChange={(v) => edit({ to: v })} placeholder="To date" />
          </div>

          <div className="w-[190px]">
            <SearchableSelect
              label="Location"
              value={draft.locationId || null}
              // "" is All Locations, which is sent as no parameter at all.
              onChange={(v) => edit({ locationId: v })}
              options={locationOptions}
              onSearch={locationSearch.setTerm}
              loading={locationSearch.loading}
              error={locationSearch.error}
              onRetry={locationSearch.retry}
              allowClear
              placeholder="All Locations"
              searchPlaceholder="Search locations..."
              emptyMessage="No locations found"
              noResultsMessage="No locations matching your search"
            />
          </div>

          <div className="w-[190px]">
            {/* Server-side type-ahead: the product-group list runs to hundreds of
                entries, so listing them all in a native select is unusable. */}
            <SearchableSelect
              label="Product group"
              value={draft.productGroupId || null}
              onChange={(v) => edit({ productGroupId: v })}
              options={groupOptions}
              onSearch={groupSearch.setTerm}
              loading={groupSearch.loading}
              error={groupSearch.error}
              onRetry={groupSearch.retry}
              allowClear
              placeholder="All Product Groups"
              searchPlaceholder="Search product groups..."
              emptyMessage="No product groups found"
              noResultsMessage="No product groups matching your search"
            />
          </div>

          <SegmentedControl
            label="Granularity"
            value={draft.granularity}
            options={GRANULARITY_SEGMENTS}
            onChange={(v) => edit({ granularity: v as FinanceGranularity })}
          />

          <div className="flex items-center gap-2 ml-auto">
            <FilterHelp />
            <button
              type="button"
              onClick={handleApply}
              disabled={loading}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-mid"
            >
              {loading ? "Loading…" : "Apply"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={!hasFilters && !loading}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-text-secondary hover:border-gray-300 hover:text-text-primary disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-mid"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Active filters + the range the backend actually used. */}
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-2 sm:px-6">
          {hasFilters ? (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Active
              </span>
              {applied.from && <FilterChip label={`From ${applied.from}`} />}
              {applied.to && <FilterChip label={`To ${applied.to}`} />}
              {selectedLocation && <FilterChip label={`Location: ${selectedLocation.label}`} />}
              {selectedGroup && <FilterChip label={`Group: ${selectedGroup.label}`} />}
              <FilterChip label={`Granularity: ${GRANULARITY_SEGMENTS.find((g) => g.value === applied.granularity)?.label ?? applied.granularity}`} />
            </>
          ) : (
            <span className="text-[11px] text-text-muted">
              No filters applied — the server's default window is in use.
            </span>
          )}

          {range && (
            <span className="ml-auto text-[11px] font-medium text-text-secondary whitespace-nowrap">
              {range.label}
            </span>
          )}
        </div>

        {validationError && (
          <p role="alert" className="mx-4 mb-3 sm:mx-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {validationError}
          </p>
        )}
      </div>

      {/* ── Results ── */}
      <div className="p-4 sm:p-6 flex flex-col gap-6">
        {report.error ? (
          // Never fall back to the previous window's numbers on failure — the
          // error IS the state, and Retry re-runs the same applied filters.
          <ErrorBanner message={report.error} onRetry={report.reload} />
        ) : loading ? (
          <ReportsSkeleton />
        ) : !data ? (
          <ReportsSkeleton />
        ) : (
          <>
            <ReportKpiStrip data={data} />
            <ReportTrendsPanel data={data} />
            <ReportSalesPanel data={data} />
            <ReportProfitabilityPanel data={data} />
            <ReportPurchasingPanel data={data} />
            <ReportCollectionsPanel data={data} />
            <ReportInventoryPanel data={data} />
            <ReportScopePanel data={data} />
          </>
        )}
      </div>
    </section>
  );
}

/** The helper sentence, collapsed behind a keyboard-focusable disclosure. */
function FilterHelp() {
  return (
    <details className="relative">
      <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-semibold text-text-secondary hover:border-gray-300 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-mid">
        <span aria-hidden>i</span>
        <span className="sr-only">How filters work</span>
      </summary>
      <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-3 text-xs text-text-secondary shadow-lg">
        <p className="mb-1.5 font-semibold text-text-primary">How filters work</p>
        <ul className="flex flex-col gap-1 list-disc pl-4">
          <li>Leave the dates empty to use the server&apos;s default of the last 30 days through today.</li>
          <li>All Locations and All Product Groups send no filter at all.</li>
          <li>Changes apply only when you press Apply.</li>
          <li>Some sections ignore these filters — see the scope badge on each section.</li>
        </ul>
      </div>
    </details>
  );
}

/** Loading state shaped like the finished page — cards and chart blocks, not a spinner. */
function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className={GRID}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="lg:col-span-2">
            <StatCardSkeleton />
          </div>
        ))}
      </div>
      <SectionSkeleton chart />
      <SectionSkeleton rows={5} />
      <SectionSkeleton rows={3} />
      <SectionSkeleton rows={4} />
      <SectionSkeleton rows={2} />
      <SectionSkeleton chart />
      <p className="sr-only" role="status">
        Loading finance report
      </p>
    </div>
  );
}