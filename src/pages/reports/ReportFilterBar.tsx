import type { LocationDto } from "../../features/inventory/locationsApi";
import { searchLocations } from "../../features/inventory/searchSelectors";
import { useSearchableResource } from "../../hooks/useSearchableResource";
import SearchableSelect from "../../components/ui/SearchableSelect";
import type { SearchableOption } from "../../components/ui/SearchableSelect";
import DatePicker from "../../components/ui/DatePicker";

interface ReportFilterBarProps {
  dateFrom: string;
  dateTo: string;
  locationId?: string;
  locations?: { id: string; name: string }[];
  locationsLoading?: boolean;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onLocationChange?: (v: string) => void;
  /** Hide the location selector (e.g. profitability has no location filter). */
  showLocation?: boolean;
  /** Extra filter controls rendered alongside the date range and location. */
  extra?: React.ReactNode;
}

export default function ReportFilterBar({
  dateFrom,
  dateTo,
  locationId,
  locations,
  locationsLoading,
  onDateFromChange,
  onDateToChange,
  onLocationChange,
  showLocation = true,
  extra,
}: ReportFilterBarProps) {
  const locationSearch = useSearchableResource(searchLocations, true);
  const selectedLocation = locationSearch.options.find((o) => o.value === locationId) ?? null;
  const locationOptions: SearchableOption[] = [
    ...(selectedLocation ? [selectedLocation] : []),
    ...locationSearch.options,
    ...(locations ?? []).map((loc) => ({ value: loc.id, label: loc.name })),
  ].filter((o, i, arr) => arr.findIndex((x) => x.value === o.value) === i);

  return (
    <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
          <label className="text-sm font-medium text-[#333333]">From</label>
          <DatePicker value={dateFrom} onChange={onDateFromChange} placeholder="From date" />
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
          <label className="text-sm font-medium text-[#333333]">To</label>
          <DatePicker value={dateTo} onChange={onDateToChange} placeholder="To date" />
        </div>
        {showLocation && (
          <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
            <label className="text-sm font-medium text-[#333333]">Location</label>
            <SearchableSelect
              value={locationId || null}
              onChange={(v) => onLocationChange?.(v)}
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
        )}
        {extra}
      </div>
    </div>
  );
}