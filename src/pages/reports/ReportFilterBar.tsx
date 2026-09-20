import type { LocationDto } from "../../features/inventory/locationsApi";

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

const inputClass =
  "flex-1 min-w-[150px] rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm bg-white focus:border-[#49B0C1] focus:outline-none transition-all";

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
  return (
    <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
          <label className="text-sm font-medium text-[#333333]">From</label>
          <input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
          <label className="text-sm font-medium text-[#333333]">To</label>
          <input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} className={inputClass} />
        </div>
        {showLocation && (
          <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
            <label className="text-sm font-medium text-[#333333]">Location</label>
            <select
              value={locationId ?? ""}
              onChange={(e) => onLocationChange?.(e.target.value)}
              className={inputClass}
              disabled={locationsLoading}
            >
              <option value="">All Locations</option>
              {locations?.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
        )}
        {extra}
      </div>
    </div>
  );
}