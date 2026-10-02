import { useNavigate } from "react-router";
import PageHeader from "../../components/ui/PageHeader";
import ScanReceiptWorkflow from "./ScanReceiptWorkflow";

/**
 * Dedicated full page for the existing Scan / Upload Receipt flow.
 *
 * This is presentation only. `ScanReceiptWorkflow` is rendered exactly as it
 * was on the Register Receipt page — same component, same props shape, same
 * upload / OCR / preview / submit logic and API calls. The only change is that
 * it now owns a route instead of being an inline branch on
 * `/purchasing/deliveries/new`.
 */
export default function ScanReceiptPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Scan / Upload Receipt"
        subtitle="Purchasing → Goods Receipts → New → Scan / Upload"
      />
      <ScanReceiptWorkflow
        onBackToMethods={() => navigate("/purchasing/deliveries/new")}
      />
    </div>
  );
}