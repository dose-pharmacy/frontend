import PageHeader from "../../components/ui/PageHeader";
import { SalesAnalyticsSection } from "../DashboardPage";
import ReportsSubNav from "./ReportsSubNav";

/**
 * Reports / Overview — restores the report summary dashboard at /reports.
 * Reuses the SAME SalesAnalyticsSection that /dashboard renders so the two
 * screens never drift apart (filters, financial overview, trend, top products).
 */
export default function ReportsDashboardPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Reports / Overview"
        title="Reports Overview"
        subtitle="Sales summary, trends and top products for the selected period."
      />
      <ReportsSubNav />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-5">
          <SalesAnalyticsSection />
        </div>
      </div>
    </div>
  );
}