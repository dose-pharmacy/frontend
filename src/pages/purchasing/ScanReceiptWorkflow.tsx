import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import SearchableSelect from "../../components/ui/SearchableSelect";
import DatePicker from "../../components/ui/DatePicker";
import { useSearchableResource } from "../../hooks/useSearchableResource";
import {
  IconWarningTriangle,
  IconCheckCircle,
  IconDocumentText,
} from "../../components/ui/icons";
import {
  listPurchaseOrders,
  getPurchaseOrder,
  type PurchaseOrderDto,
} from "../../features/purchasing/purchaseOrdersApi";
import { listLocations, type LocationDto } from "../../features/inventory/locationsApi";
import {
  previewInvoiceUpload,
  confirmInvoiceUpload,
  extractInvoiceReceipt,
  listMatchCandidates,
  InvoiceUploadReceivingError,
  type InvoiceUploadPreviewDto,
  type InvoiceUploadPreviewItemDto,
  type InvoiceUploadConfirmDto,
  type InvoiceUploadReceivingInput,
  type InvoiceUploadDiscrepancyDto,
} from "../../features/purchasing/invoiceUploadReceivingApi";
import {
  emptyExtractedReceipt,
  extractReceiptDocument,
  extractedInvoiceToReceipt,
  calculateGrandTotal,
  toDateInput,
  toInvoiceUploadInput,
  type ExtractedReceipt,
  type ExtractedReceiptLine,
} from "../../features/purchasing/receiptExtractor";
import { listSuppliers, type SupplierDto } from "../../features/purchasing/suppliersApi";
import type { PaymentMethod } from "../../features/purchasing/supplierInvoicesApi";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return `${(Number(n) || 0).toLocaleString("en-ET")} ETB`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Backend extract endpoint accepts PDF / JPEG / PNG / WEBP, up to 10 MB. */
const ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES_LABEL = "PDF, JPG, JPEG, PNG or WEBP";

const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "BANK_TRANSFER",
  "CHECK",
  "CREDIT_CARD",
  "OTHER",
];

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHECK: "Cheque",
  CREDIT_CARD: "Credit Card",
  OTHER: "Other",
};

function normalizeName(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function countMatchedProducts(
  po: PurchaseOrderDto | null,
  items: ExtractedReceiptLine[],
): number {
  if (!po) return 0;
  const skus = new Set(
    (po.items ?? [])
      .map((it) => (it.product?.sku ?? "").trim().toLowerCase())
      .filter(Boolean),
  );
  const names = new Set(
    (po.items ?? [])
      .map((it) => normalizeName(it.product?.name ?? ""))
      .filter(Boolean),
  );
  return items.filter((it) => {
    if (skus.has((it.productCode ?? "").trim().toLowerCase())) return true;
    if (it.poItemId && (po.items ?? []).some((poi) => poi.id === it.poItemId))
      return true;
    return names.has(normalizeName(it.productName));
  }).length;
}

// ─── Review draft line ──────────────────────────────────────────────────────

interface PoSummary {
  ordered: number;
  received: number;
  remaining: number;
  itemCount: number;
  /** True when the backend omitted `receivingSummary` and we derived it. */
  derived: boolean;
}

/**
 * Ordered / received / remaining for the selected PO.
 *
 * `receivingSummary` is the backend's own figure and is preferred. List rows
 * and some detail responses omit it, in which case the totals are summed from
 * the PO items the backend returned — never invented, and flagged as derived.
 * A PO with no items reports 0 items because the response really had none.
 */
function poSummary(po: PurchaseOrderDto | null): PoSummary {
  const items = po?.items ?? [];
  const s = po?.receivingSummary;
  if (s) {
    return {
      ordered: s.orderedQuantity ?? 0,
      received: s.receivedQuantity ?? 0,
      remaining: s.remainingQuantity ?? 0,
      itemCount: items.length || (po?._count?.items ?? 0),
      derived: false,
    };
  }
  return {
    ordered: items.reduce((n, it) => n + (it.quantityOrdered ?? 0), 0),
    received: items.reduce((n, it) => n + (it.quantityReceived ?? 0), 0),
    remaining: items.reduce(
      (n, it) =>
        n +
        Math.max(
          0,
          (it.quantityOrdered ?? 0) -
            (it.quantityReceived ?? 0) -
            (it.quantityShort ?? 0),
        ),
      0,
    ),
    itemCount: items.length || (po?._count?.items ?? 0),
    derived: true,
  };
}

interface DraftLine {
  key: string;
  matched: boolean;
  purchaseOrderItemId: string | null;
  /** Product code (SKU) sent back to the API — editable to fix the match. */
  sku: string;
  productName: string;
  invoiceQuantity: number;
  acceptedQuantity: number;
  unit: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  unitPrice: number;
  poUnitCost: number;
  poOrdered: number;
  poReceived: number;
  poRemaining: number;
  remainingAfterReceipt: number;
  /** Suggested PO items for an unmatched line (Part 2 backend). */
  suggestions?: { purchaseOrderItemId: string; productName: string; score: number }[];
  discrepancyCodes: string[];
}

function toDraftLines(items: InvoiceUploadPreviewItemDto[]): DraftLine[] {
  return items.map((it, i) => {
    const lineIndex = it.lineIndex ?? i;
    return {
      key: `line-${lineIndex}`,
      matched: it.matched,
      purchaseOrderItemId: it.purchaseOrderItemId,
      sku: it.product?.sku ?? "",
      productName: it.product?.name ?? "",
      invoiceQuantity: it.invoiceQuantity,
      acceptedQuantity: it.acceptedQuantity,
      unit: it.unit?.symbol ?? "",
      batchNumber: it.batchNumber ?? "",
      manufacturingDate: toDateInput(it.manufacturingDate),
      expiryDate: toDateInput(it.expiryDate),
      unitPrice: it.unitPrice,
      poUnitCost: it.poUnitCost,
      poOrdered: it.poOrdered,
      poReceived: it.poReceived,
      poRemaining: it.poRemaining,
      remainingAfterReceipt: it.remainingAfterReceipt,
      suggestions: it.suggestions,
      discrepancyCodes: [],
    };
  });
}

const BLOCKING_CODES = new Set([
  "UNMATCHED_INVOICE_ITEM",
  "INVOICE_QUANTITY_EXCEEDS_PO_REMAINING",
  "INVOICE_UNIT_MISMATCH",
  "MISSING_BATCH",
  "MISSING_EXPIRY",
  "DUPLICATE_INVOICE_NUMBER",
  "PHYSICAL_DISCREPANCY",
]);

const DISCREPANCY_LABELS: Record<string, string> = {
  UNMATCHED_INVOICE_ITEM: "Unmatched invoice item",
  INVOICE_QUANTITY_EXCEEDS_PO_REMAINING: "Quantity exceeds PO remaining",
  INVOICE_UNIT_MISMATCH: "Unit mismatch",
  MISSING_BATCH: "Missing batch",
  MISSING_EXPIRY: "Missing expiry",
  DUPLICATE_INVOICE_NUMBER: "Duplicate invoice number",
  PHYSICAL_DISCREPANCY: "Physical discrepancy",
  PRICE_DIFFERENCE: "Price difference",
};

function lineStatus(d: DraftLine): { text: string; tone: string } {
  if (d.discrepancyCodes.includes("UNMATCHED_INVOICE_ITEM"))
    return { text: "Unmatched", tone: "text-red-600" };
  if (d.discrepancyCodes.includes("INVOICE_QUANTITY_EXCEEDS_PO_REMAINING"))
    return { text: "Qty exceeds", tone: "text-red-600" };
  if (d.discrepancyCodes.includes("INVOICE_UNIT_MISMATCH"))
    return { text: "Unit mismatch", tone: "text-yellow-600" };
  if (d.discrepancyCodes.includes("MISSING_BATCH"))
    return { text: "Batch required", tone: "text-yellow-600" };
  if (d.discrepancyCodes.includes("MISSING_EXPIRY"))
    return { text: "Expiry required", tone: "text-yellow-600" };
  if (d.discrepancyCodes.includes("PRICE_DIFFERENCE"))
    return { text: "Price diff", tone: "text-blue-600" };
  return { text: "Matched", tone: "text-green-600" };
}

const SC =
  "w-full rounded-lg border border-[#C6D4BF] bg-white px-2.5 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none";

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Small "where did this value come from" label. Lets the pharmacist see at a
 * glance which values OCR filled in and which ones they own.
 */
function SourceTag({
  kind,
  children,
}: {
  kind: "extracted" | "select" | "required" | "system";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    extracted: "bg-[#E6ECE2] text-[#4A6B46]",
    select: "bg-[#EDF3EA] text-[#7A9076]",
    required: "bg-red-50 text-red-500",
    system: "bg-[#F4F4F4] text-[#999]",
  };
  return (
    <span
      className={`inline-block rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${tones[kind]}`}
    >
      {children}
    </span>
  );
}

/** Field label with an optional required marker and source label. */
function FieldLabel({
  children,
  required,
  source,
}: {
  children: React.ReactNode;
  required?: boolean;
  source?: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-[#666666] mb-1">
      <span>
        {children}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {source}
    </label>
  );
}

/** The selected PO's real totals, straight from the loaded PO detail. */
function PoSummaryCard({
  po,
  onChange,
}: {
  po: PurchaseOrderDto;
  onChange: (po: PurchaseOrderDto | null) => void;
}) {
  const s = poSummary(po);
  return (
    <div className="mt-4 rounded-xl border border-[#7A9076] bg-[#E6ECE2]/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#333333]">
            Purchase Order {po.poNumber}
          </p>
          <p className="text-xs text-[#666666]">
            {po.supplier?.name ?? "Unknown supplier"}
            {po.expectedDeliveryDate
              ? ` · expected ${fmtDate(po.expectedDeliveryDate)}`
              : ""}
            {po.status ? ` · ${po.status}` : ""}
          </p>
        </div>
        <button
          onClick={() => onChange(null)}
          className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
        >
          Change
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-4 gap-3 text-center">
        {[
          ["Items", s.itemCount],
          ["Ordered", s.ordered],
          ["Previously Received", s.received],
          ["Remaining", s.remaining],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-lg bg-white/70 py-2 px-1">
            <dt className="text-[10px] text-[#666666] whitespace-nowrap">
              {k}
            </dt>
            <dd className="text-sm font-bold text-[#333333]">{v}</dd>
          </div>
        ))}
      </dl>
      {s.derived && (
        <p className="mt-2 text-[10px] text-[#999]">
          Summarised from this purchase order&apos;s items.
        </p>
      )}
    </div>
  );
}

type ScanStep = 1 | 2 | 3;

interface ScanReceiptWorkflowProps {
  onBackToMethods: () => void;
}

export default function ScanReceiptWorkflow({
  onBackToMethods,
}: ScanReceiptWorkflowProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<ScanStep>(1);

  // Document upload
  const [docFile, setDocFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera capture
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Extracted / normalized receipt
  const [receipt, setReceipt] = useState<ExtractedReceipt>(
    emptyExtractedReceipt,
  );

  // OCR extraction status (backend /invoice-upload/extract)
  const [extracting, setExtracting] = useState(false);
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  /** What the extractor actually returned — drives the "we read it" banner. */
  const [extractResult, setExtractResult] = useState<{
    lineCount: number;
    textExtracted: boolean;
  } | null>(null);

  // Supplier — required dropdown of active suppliers (never free-text).
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [supplierId, setSupplierId] = useState("");

  // Payment (optional — absent means the invoice stays OPEN)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [paymentDate, setPaymentDate] = useState("");

  // Locations
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [locationId, setLocationId] = useState("");

  // Purchase order identification
  const [poCandidates, setPoCandidates] = useState<PurchaseOrderDto[]>([]);
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});
  const [findingPO, setFindingPO] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrderDto | null>(null);
  const poSearch = useSearchableResource(async (term: string, page: number) => {
    const r = await listPurchaseOrders({
      search: term || undefined,
      page,
      limit: 20,
    });
    return {
      items: r.data.map((o) => ({
        value: o.id,
        label: o.poNumber,
        sub: o.supplier?.name ?? o.supplierId,
        hint: o.status,
      })),
      hasMore: r.meta.page < r.meta.totalPages,
    };
  });

  // Flow state
  const [flowError, setFlowError] = useState("");
  const [previewing, setPreviewing] = useState(false);

  // Review state
  const [preview, setPreview] = useState<InvoiceUploadPreviewDto | null>(null);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [reviewDirty, setReviewDirty] = useState(false);
  const [note, setNote] = useState("");
  const [previewError, setPreviewError] = useState("");

  // Confirm state
  const [confirming, setConfirming] = useState(false);
  const [confirmResult, setConfirmResult] =
    useState<InvoiceUploadConfirmDto | null>(null);

  useEffect(() => {
    // Locations are never auto-selected — the pharmacist picks the storage
    // location the goods physically arrive at.
    listLocations({ isActive: true, limit: 100 })
      .then((r) => setLocations(r.data))
      .catch(() => {});
    listSuppliers({ limit: 100, isActive: true })
      .then((r) => setSuppliers(r.data))
      .catch(() => {});
    return () => {
      // Stop any camera stream left running.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // ── Document handling ────────────────────────────────────────────────────

  function handleFile(file: File | undefined | null) {
    if (!file) return;
    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setFlowError(
        `Unsupported file type. Please upload a ${ACCEPTED_TYPES_LABEL} receipt.`,
      );
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFlowError(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 10 MB. Please upload a smaller receipt.`,
      );
      return;
    }
    setFlowError("");
    setExtractWarnings([]);
    setExtractResult(null);
    setDocFile(file);
    setExtracting(true);
    // 1) Backend OCR. Every extracted field stays editable and is treated as a
    //    proposal only. If the endpoint is unavailable (not deployed yet) fall
    //    back to manual entry silently; any other failure is shown to the user.
    extractInvoiceReceipt(file)
      .then((extracted) => {
        const next = extractedInvoiceToReceipt(extracted);
        setReceipt(next);
        setExtractWarnings(extracted.warnings ?? []);
        // Only treat the document as "read" when it really produced text —
        // an image with no machine-readable text must not claim success.
        const textExtracted = extracted.document?.textExtracted !== false;
        setExtractResult({ lineCount: next.items.length, textExtracted });
        if (textExtracted && next.items.length === 0) {
          // Log the raw payload once so the real response shape can be checked
          // without guessing — no fabricated lines are ever created.
          console.warn(
            "[invoice-upload/extract] returned no line items",
            extracted,
          );
        }
      })
      .catch((err: unknown) => {
        if (err instanceof InvoiceUploadReceivingError && err.code === "OCR_UNAVAILABLE") {
          // Endpoint not deployed — the blank/manual template is the honest path.
          return;
        }
        // Surface the mapped reason (413 too large / 415 wrong type / 422
        // unreadable) before falling back so the user knows the file was not read.
        const reason =
          err instanceof InvoiceUploadReceivingError
            ? err.message
            : "The receipt could not be read.";
        setFlowError(
          reason ||
            "The receipt could not be read automatically. You can still enter the values manually below.",
        );
        return extractReceiptDocument(file).then((extracted) => {
          if (
            extracted.items.some((it) => it.ocrProductCode || it.productName) ||
            extracted.invoiceNumber
          ) {
            setReceipt(extracted);
          }
        });
      })
      .catch(() => {})
      .finally(() => setExtracting(false));
  }

  async function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function handleScan() {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      // No camera API on this device — clean fallback to the file picker.
      setFlowError(
        "Camera capture is not supported on this device — use Upload Receipt instead.",
      );
      fileInputRef.current?.click();
      return;
    }
    setCameraError("");
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError(
        "Camera unavailable. You can close this and use Upload Receipt instead.",
      );
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      handleFile(
        new File([blob], `receipt-scan-${Date.now()}.jpg`, {
          type: "image/jpeg",
        }),
      );
      setCameraOpen(false);
      stopCamera();
    }, "image/jpeg", 0.9);
  }

  // ── Extraction form ──────────────────────────────────────────────────────

  function updateReceiptItem(index: number, patch: Partial<ExtractedReceiptLine>) {
    setReceipt((r) => ({
      ...r,
      items: r.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    }));
  }

  function updateReceiptInfo(patch: Partial<ExtractedReceipt>) {
    setReceipt((r) => ({ ...r, ...patch }));
    setReviewDirty(true);
  }

  function addReceiptItem() {
    setReceipt((r) => ({
      ...r,
      items: [
        ...r.items,
        {
          productCode: "",
          productName: "",
          unit: "",
          quantity: 0,
          acceptedQuantity: 0,
          unitPrice: 0,
          batchNumber: "",
          manufacturingDate: "",
          expiryDate: "",
        },
      ],
    }));
  }

  function removeReceiptItem(index: number) {
    setReceipt((r) => ({
      ...r,
      items: r.items.filter((_, i) => i !== index),
    }));
  }

  // ── Purchase order identification ────────────────────────────────────────

  async function findPOCandidates() {
    setFindingPO(true);
    setFlowError("");
    try {
      const found = new Map<string, number>();
      let usedServerRanking = false;

      // 1) Server-ranked suggestions: open POs for the selected supplier whose
      //    items match the extracted product names. The server's order is
      //    authoritative (match count → remaining quantity).
      const names = receipt.items
        .map((it) => it.productName.trim())
        .filter(Boolean);
      if (supplierId && names.length > 0) {
        try {
          const candidates = await listMatchCandidates(supplierId, names);
          if (candidates.length > 0) {
            usedServerRanking = true;
            for (const c of candidates.slice(0, 6)) {
              found.set(c.purchaseOrder.id, c.matchCount);
            }
          }
        } catch {
          // Endpoint unavailable — fall through to the local lookup.
        }
      }

      if (!usedServerRanking) {
        // 2) PO number embedded in the invoice reference (receipts often carry
        //    the PO number — but do NOT assume they always do).
        const poRef = (receipt.invoiceNumber.match(/PO-\d+/i) ?? [])[0];
        if (poRef) {
          const r = await listPurchaseOrders({ search: poRef, limit: 10 });
          r.data.forEach((o) => found.set(o.id, 0));
        }

        // 3) The selected supplier (authoritative) → their receivable POs.
        if (supplierId) {
          const r = await listPurchaseOrders({
            supplierId,
            limit: 50,
            receivable: true,
          });
          r.data.forEach((o) => found.set(o.id, 0));
        }
      }

      const list = await Promise.all(
        [...found.entries()].slice(0, 6).map(async ([id, serverCount]) => {
          try {
            // ALWAYS load the PO detail. List rows carry only `_count.items` —
            // they have no `items` array, so selecting one would leave the
            // receiving table with "0 items" and an empty PO Item dropdown.
            const detail = await getPurchaseOrder(id);
            return {
              detail,
              count: serverCount ?? countMatchedProducts(detail, receipt.items),
            };
          } catch {
            // Skip candidates that can no longer be loaded.
            return null;
          }
        }),
      );

      const hydrated = list.filter((r): r is NonNullable<typeof r> => r !== null);
      const counts: Record<string, number> = {};
      for (const r of hydrated) counts[r.detail.id] = r.count;
      setPoCandidates(hydrated.map((r) => r.detail));
      setMatchCounts(counts);

      if (hydrated.length === 0) {
        setFlowError(
          "No automatic match found. Use “Search Purchase Order Manually” below.",
        );
      }
    } catch {
      setFlowError("Could not look up purchase orders. Try searching manually.");
    } finally {
      setFindingPO(false);
    }
  }

  /**
   * Select a candidate PO and make sure its real items are loaded. The detail is
   * refetched on selection so the ordered/received/remaining figures the
   * pharmacist sees are the backend's current state, not a cached list row.
   */
  async function selectPo(po: PurchaseOrderDto) {
    setSelectedPo(po);
    setReviewDirty(true);
    try {
      const detail = await getPurchaseOrder(po.id);
      setSelectedPo(detail);
      setPoCandidates((prev) => prev.map((c) => (c.id === detail.id ? detail : c)));
    } catch {
      // Keep the row we already have; the preview call remains authoritative.
    }
  }

  async function addManualCandidate(poId: string) {
    if (!poId || poCandidates.some((c) => c.id === poId)) return;
    setFlowError("");
    try {
      const detail = await getPurchaseOrder(poId);
      setPoCandidates((prev) => [...prev, detail].slice(0, 6));
      setMatchCounts((prev) => ({
        ...prev,
        [poId]: countMatchedProducts(detail, receipt.items),
      }));
    } catch {
      setFlowError("Could not load purchase order details.");
    }
  }

  // ── Preview / review ─────────────────────────────────────────────────────

  function reviewReceiptFromLines(lines: DraftLine[]): ExtractedReceipt {
    return {
      ...receipt,
      items: lines.map((d) => ({
        productCode: d.sku,
        productName: d.productName,
        unit: d.unit,
        quantity: d.invoiceQuantity,
        acceptedQuantity: d.acceptedQuantity,
        unitPrice: d.unitPrice,
        batchNumber: d.batchNumber,
        manufacturingDate: d.manufacturingDate,
        expiryDate: d.expiryDate,
        poItemId: d.purchaseOrderItemId ?? undefined,
        unitSymbol: d.unit,
      })),
    };
  }

  function buildReviewInputFromLines(lines: DraftLine[]): InvoiceUploadReceivingInput {
    return toInvoiceUploadInput(reviewReceiptFromLines(lines), locationId, {
      supplierName: selectedPo?.supplier?.name ?? undefined,
      ...(note.trim() ? { discrepancyNote: note.trim() } : {}),
      ...(paymentMethod ? { paymentMethod, paymentDate } : {}),
    });
  }

  function buildReviewInput(): InvoiceUploadReceivingInput {
    return buildReviewInputFromLines(draftLines);
  }

  /** Replace the review screen with a fresh preview result + its line statuses. */
  function applyPreviewResult(result: InvoiceUploadPreviewDto) {
    const lines = toDraftLines(result.items);
    const byIndex = new Map<number, string[]>();
    for (const d of result.discrepancies ?? []) {
      if (d.lineIndex == null) continue;
      const arr = byIndex.get(d.lineIndex) ?? [];
      arr.push(d.code);
      byIndex.set(d.lineIndex, arr);
    }
    const codeHits = (result.discrepancies ?? [])
      .filter((d) => d.lineIndex == null)
      .map((d) => d.code);
    for (const line of lines) {
      const idx = Number(line.key.replace("line-", ""));
      line.discrepancyCodes = [
        ...new Set([...(byIndex.get(idx) ?? []), ...codeHits]),
      ];
    }
    setDraftLines(lines);
    setPreview(result);
    setReviewDirty(false);
  }

  async function runPreview(input: InvoiceUploadReceivingInput) {
    if (!selectedPo) return null;
    return previewInvoiceUpload(selectedPo.id, input);
  }

  async function handleContinue() {
    setFlowError("");
    if (!docFile) {
      setFlowError("Please scan or upload the supplier receipt first.");
      return;
    }
    if (!supplierId) {
      setFlowError("Please choose the supplier shown on the receipt.");
      return;
    }
    if (!receipt.invoiceNumber.trim()) {
      setFlowError("Please enter the invoice number.");
      return;
    }
    if (!selectedPo) {
      setFlowError("Please choose a Purchase Order before continuing.");
      return;
    }
    if (!locationId) {
      setFlowError("Please select a receiving location.");
      return;
    }
    const validItems = receipt.items.filter(
      (it) => it.productName.trim() && (Number(it.quantity) || 0) > 0,
    );
    if (validItems.length === 0) {
      setFlowError(
        "Enter at least one receipt line with a product name and quantity.",
      );
      return;
    }

    // Basic frontend checks only — the backend remains authoritative and
    // re-validates every line against the current PO state.
    for (const [i, it] of validItems.entries()) {
      const row = i + 1;
      if (!it.poItemId) {
        setFlowError(
          `Receipt line ${row} (“${it.productName.trim()}”) must be mapped to a Purchase Order item in the "PO Item" column.`,
        );
        return;
      }
      const poItem = (selectedPo?.items ?? []).find(
        (p) => p.id === it.poItemId,
      );
      const poItemUnit = poItem?.unit?.symbol || poItem?.unit?.name || "";
      if (!it.unitSymbol && !poItemUnit) {
        setFlowError(
          `Receipt line ${row} needs a unit. Select the unit from the matched Purchase Order item.`,
        );
        return;
      }
      if ((Number(it.acceptedQuantity) || 0) > 0) {
        if (!it.batchNumber.trim()) {
          setFlowError(
            `Receipt line ${row} has an accepted quantity, so a batch number is required.`,
          );
          return;
        }
        if (!it.expiryDate.trim()) {
          setFlowError(
            `Receipt line ${row} has an accepted quantity, so an expiry date is required.`,
          );
          return;
        }
      }
    }

    const input = toInvoiceUploadInput(
      { ...receipt, items: validItems },
      locationId,
      {
        supplierName: selectedPo?.supplier?.name ?? undefined,
        ...(paymentMethod ? { paymentMethod, paymentDate } : {}),
      },
    );

    setPreviewing(true);
    setPreviewError("");
    try {
      const result = await runPreview(input);
      if (!result) throw new InvoiceUploadReceivingError("No purchase order selected.");
      applyPreviewResult(result);
      setNote("");
      setStep(2);
    } catch (e) {
      setPreviewError(
        e instanceof InvoiceUploadReceivingError
          ? e.message
          : "Unable to validate the receipt against the purchase order.",
      );
    } finally {
      setPreviewing(false);
    }
  }

  function updateDraftLine(key: string, patch: Partial<DraftLine>) {
    setDraftLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
    setReviewDirty(true);
  }

  async function handleRePreview() {
    if (!selectedPo || !preview) return;
    setPreviewing(true);
    setPreviewError("");
    try {
      const result = await runPreview(buildReviewInput());
      if (!result) return;
      applyPreviewResult(result);
    } catch (e) {
      setPreviewError(
        e instanceof InvoiceUploadReceivingError
          ? e.message
          : "Unable to validate the corrected receipt against the purchase order.",
      );
    } finally {
      setPreviewing(false);
    }
  }

  async function handleConfirm() {
    if (!selectedPo || !preview) return;
    // Exactly one confirm per confirmation — never retry automatically.
    if (confirming || confirmResult) return;
    setConfirming(true);
    setPreviewError("");
    try {
      // Never trust local edits — re-validate with the backend first.
      let fresh: InvoiceUploadPreviewDto | null = preview;
      if (reviewDirty) {
        fresh = await runPreview(buildReviewInput());
        if (!fresh) return;
        applyPreviewResult(fresh);
      }
      if (!fresh.canConfirm) {
        const blocking = (fresh.discrepancies ?? []).filter(
          (d) => BLOCKING_CODES.has(d.code) && d.blocking !== false,
        );
        setPreviewError(
          blocking.length > 0
            ? `This receipt cannot be confirmed yet: ${blocking
                .map((d) => DISCREPANCY_LABELS[d.code] ?? d.code)
                .join(", ")}. Correct the values and re-run the preview.`
            : "This receipt cannot be confirmed yet. Review the issues below, correct the values and re-run the preview.",
        );
        return;
      }
      // Built after the optional re-preview so the confirmed body always
      // carries the reviewed discrepancy note.
      const input = buildReviewInput();
      if (fresh.requiresDiscrepancyNote && !input.discrepancyNote?.trim()) {
        setPreviewError(
          "A discrepancy note is required before confirmation. Enter it below, then confirm.",
        );
        return;
      }

      const result = await confirmInvoiceUpload(selectedPo.id, input);
      setConfirmResult(result);
      setStep(3);
    } catch (e) {
      setPreviewError(
        e instanceof InvoiceUploadReceivingError
          ? e.message
          : "Unable to confirm the goods receipt. Please try again.",
      );
    } finally {
      setConfirming(false);
    }
  }

  // ── Derived review data ───────────────────────────────────────────────────

  const docPreviewUrl = useMemo(() => {
    if (!docFile) return null;
    return docFile.type.startsWith("image/")
      ? URL.createObjectURL(docFile)
      : null;
  }, [docFile]);

  useEffect(() => {
    if (!docPreviewUrl) return;
    return () => URL.revokeObjectURL(docPreviewUrl);
  }, [docPreviewUrl]);

  const poItemSkuOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const it of selectedPo?.items ?? []) {
      const sku = it.product?.sku ?? "";
      if (!sku || seen.has(sku)) continue;
      seen.add(sku);
      opts.push({
        value: sku,
        label: `${sku} — ${it.product?.name ?? it.productId.slice(0, 8)}`,
      });
    }
    return opts;
  }, [selectedPo]);

  const blockingDiscrepancies = (preview?.discrepancies ?? []).filter(
    (d: InvoiceUploadDiscrepancyDto) =>
      BLOCKING_CODES.has(d.code) && d.blocking !== false,
  );
  const infoDiscrepancies = (preview?.discrepancies ?? []).filter(
    (d: InvoiceUploadDiscrepancyDto) => !blockingDiscrepancies.includes(d),
  );

  const steps = ["Upload", "Review", "Confirm"] as const;
  const currentIdx = step - 1;

  // ─── Render: step indicator ───────────────────────────────────────────────

  const stepIndicator = (
    <div className="flex items-center justify-center pt-2">
      {steps.map((label, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center min-w-[80px]">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  done
                    ? "border-[#B6C8AF] bg-[#B6C8AF] text-[#333333]"
                    : active
                      ? "border-[#B6C8AF] bg-white text-[#7A9076]"
                      : "border-[#C6D4BF] bg-white text-[#C6D4BF]"
                }`}
              >
                {done ? (
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <p
                className={`mt-1 text-[11px] font-medium ${
                  active || done ? "text-[#7A9076]" : "text-[#C6D4BF]"
                }`}
              >
                {label}
              </p>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`h-0.5 w-10 -mt-5 mx-1 ${
                  idx < currentIdx ? "bg-[#B6C8AF]" : "bg-[#E6ECE2]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // ─── Render: success (step 3) ─────────────────────────────────────────────

  if (step === 3 && confirmResult) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-6 flex items-start justify-center">
          <div className="max-w-md w-full rounded-2xl border border-[#E6ECE2] bg-white p-8 text-center shadow-sm">
            <IconCheckCircle className="h-14 w-14 text-[#7A9076] mx-auto" />
            <h2 className="mt-4 text-xl font-bold text-[#333333]">
              Goods Receipt Registered
            </h2>
            <p className="mt-1 text-sm text-[#666666]">
              The goods receipt, supplier invoice and stock movements were
              created successfully.
            </p>
            <dl className="mt-6 space-y-2.5 text-left text-sm">
              {[
                ["Goods Receipt", confirmResult.goodsReceipt.receiptNumber],
                ["Purchase Order", confirmResult.purchaseOrder.poNumber],
                ["Supplier", selectedPo?.supplier?.name ?? "—"],
                [
                  "Items Received",
                  String(confirmResult.receiving?.lineCount ?? "—"),
                ],
                [
                  "Total Documented",
                  String(confirmResult.receiving?.totalDocumented ?? "—"),
                ],
                [
                  "Total Accepted",
                  String(confirmResult.receiving?.totalAccepted ?? "—"),
                ],
                ["Supplier Invoice", confirmResult.supplierInvoice.invoiceNumber],
                [
                  "Payment",
                  paymentMethod
                    ? `${PAYMENT_LABELS[paymentMethod] ?? paymentMethod}${paymentDate ? ` · ${fmtDate(paymentDate)}` : ""}`
                    : "Invoice left OPEN",
                ],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between border-b border-[#E6ECE2] pb-2 last:border-0"
                >
                  <dt className="text-[#666666]">{k}</dt>
                  <dd className="font-semibold text-[#333333]">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-[#7A9076] bg-[#E6ECE2]/50 rounded-lg px-3 py-2">
              Stock has been updated successfully.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <Button
                onClick={() =>
                  navigate(
                    `/purchasing/deliveries/${confirmResult.goodsReceipt.id}/reconcile`,
                  )
                }
              >
                View Goods Receipt
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  navigate(`/purchasing/invoices/${confirmResult.supplierInvoice.id}`)
                }
              >
                View Supplier Invoice
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate("/purchasing/deliveries")}
              >
                Back to Goods Receipts
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: review (step 2) ──────────────────────────────────────────────

  if (step === 2 && preview) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        {stepIndicator}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {previewError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {previewError}
            </div>
          )}

          {/* Receiving preview header */}
          <div className="rounded-xl border border-[#7A9076] bg-[#E6ECE2]/40 p-5">
            <h2 className="text-base font-bold text-[#333333]">
              Receiving Preview
            </h2>
            <p className="text-xs text-[#666666] mt-0.5">
              Validated against the current Purchase Order state. Nothing has
              been saved yet — confirming is what creates the goods receipt.
            </p>
            <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                ["Purchase Order", preview.purchaseOrder?.poNumber ?? selectedPo?.poNumber ?? "—"],
                ["Receipt", preview.invoice?.invoiceNumber || "—"],
                ["Lines", preview.items?.length ?? 0],
                ["Can confirm", preview.canConfirm ? "Yes" : "No"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-white py-2 px-1">
                  <dt className="text-[10px] text-[#666666]">{k}</dt>
                  <dd className="text-sm font-bold text-[#333333] truncate">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Receipt information */}
          <div className="rounded-xl border border-[#E6ECE2] bg-white p-5">
            <h2 className="text-base font-bold text-[#333333]">
              Receipt Information
            </h2>
            <p className="text-xs text-[#999] mt-0.5 mb-4">
              Correct any value below, then re-run the preview.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-[#666666] mb-1">
                  Supplier
                </label>
                <input
                  readOnly
                  value={selectedPo?.supplier?.name ?? "—"}
                  className="w-full rounded-lg border border-[#C6D4BF] bg-[#E6ECE2] px-3 py-2 text-sm"
                />
                <p className="text-[10px] text-[#999] mt-1">
                  Taken from the Purchase Order — always authoritative.
                </p>
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">
                  Purchase Order
                </label>
                <input
                  readOnly
                  value={selectedPo?.poNumber ?? "—"}
                  className="w-full rounded-lg border border-[#C6D4BF] bg-[#E6ECE2] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">
                  Document
                </label>
                <div className="flex items-center gap-2">
                  {docPreviewUrl && (
                    <img
                      src={docPreviewUrl}
                      alt="Receipt preview"
                      className="h-16 w-24 rounded-lg border border-[#C6D4BF] object-cover bg-[#E6ECE2]"
                    />
                  )}
                  <span className="flex-1 truncate rounded-lg border border-[#C6D4BF] bg-[#E6ECE2] px-3 py-2 text-sm">
                    {docFile?.name ?? "—"}
                  </span>
                  <button
                    onClick={() => setStep(1)}
                    className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
                  >
                    Replace
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">
                  Invoice Number
                </label>
                <input
                  value={receipt.invoiceNumber}
                  onChange={(e) =>
                    updateReceiptInfo({ invoiceNumber: e.target.value })
                  }
                  placeholder="e.g. CR-00004212"
                  className={SC}
                />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">
                  Invoice Date
                </label>
                <DatePicker
                  value={receipt.invoiceDate}
                  onChange={(v) => updateReceiptInfo({ invoiceDate: v })}
                />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">
                  Received Date
                </label>
                <DatePicker
                  value={receipt.receivedDate}
                  onChange={(v) => updateReceiptInfo({ receivedDate: v })}
                />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">
                  Grand Total (ETB)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={receipt.grandTotal || ""}
                  onChange={(e) =>
                    updateReceiptInfo({ grandTotal: Number(e.target.value) })
                  }
                  className={SC}
                />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">
                  Receiving Location
                </label>
                <select
                  value={locationId}
                  onChange={(e) => {
                    setLocationId(e.target.value);
                    setReviewDirty(true);
                  }}
                  className={SC}
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Receiving items */}
          <div className="rounded-xl border border-[#E6ECE2] bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E6ECE2]">
              <h2 className="text-base font-bold text-[#333333]">
                Receiving Items
              </h2>
              <p className="text-xs text-[#999] mt-0.5">
                Invoice Quantity is the quantity written on the supplier
                document. Accepted Quantity is the quantity physically accepted
                — edit it in the table below. The backend re-validates every
                change.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1300px]">
                <thead>
                  <tr className="bg-[#E6ECE2]">
                    {[
                      "Product",
                      "SKU",
                      "PO Ordered",
                      "Previously Received",
                      "Remaining",
                      "This Receipt",
                      "Accepted Qty",
                      "Unit",
                      "Batch",
                      "Expiry",
                      "Mfg Date",
                      "PO Unit Cost",
                      "Invoice Unit Price",
                      "Status",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left font-semibold text-[#333333] whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {draftLines.map((l, i) => {
                    const status = lineStatus(l);
                    const skuOptions =
                      l.sku &&
                      !poItemSkuOptions.some((o) => o.value === l.sku)
                        ? [
                            {
                              value: l.sku,
                              label: `${l.sku} — ${l.productName || "product"}`,
                            },
                            ...poItemSkuOptions,
                          ]
                        : poItemSkuOptions;
                    return (
                      <tr
                        key={l.key}
                        className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}
                      >
                        <td className="px-3 py-2.5 min-w-[200px] text-[#333333]">
                          {l.productName || "—"}
                          {l.matched === false &&
                            l.suggestions &&
                            l.suggestions.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                <span className="text-[10px] text-[#999] w-full">
                                  Suggested matches:
                                </span>
                                {l.suggestions.map((s) => (
                                  <button
                                    key={s.purchaseOrderItemId}
                                    onClick={() => {
                                      const next = draftLines.map((dl) =>
                                        dl.key === l.key
                                          ? {
                                              ...dl,
                                              purchaseOrderItemId:
                                                s.purchaseOrderItemId,
                                              sku:
                                                (selectedPo?.items ?? []).find(
                                                  (it) =>
                                                    it.id ===
                                                    s.purchaseOrderItemId,
                                                )?.product?.sku ?? dl.sku,
                                              productName: s.productName,
                                            }
                                          : dl,
                                      );
                                      setDraftLines(next);
                                      setReviewDirty(true);
                                      void (async () => {
                                        if (!selectedPo) return;
                                        setPreviewing(true);
                                        setPreviewError("");
                                        try {
                                          const result = await runPreview(
                                            buildReviewInputFromLines(next),
                                          );
                                          if (result) applyPreviewResult(result);
                                        } catch (e) {
                                          setPreviewError(
                                            e instanceof
                                              InvoiceUploadReceivingError
                                              ? e.message
                                              : "Unable to validate the suggested match against the purchase order.",
                                          );
                                        } finally {
                                          setPreviewing(false);
                                        }
                                      })();
                                    }}
                                    className="text-[11px] rounded-md border border-[#B6C8AF] bg-[#E6ECE2]/40 px-2 py-0.5 text-[#4A6B46] hover:bg-[#E6ECE2] font-medium"
                                  >
                                    {s.productName}
                                  </button>
                                ))}
                              </div>
                            )}
                        </td>
                        <td className="px-3 py-2.5 min-w-[180px]">
                          <select
                            value={l.sku}
                            onChange={(e) => {
                              const sku = e.target.value;
                              const item = (selectedPo?.items ?? []).find(
                                (it) => (it.product?.sku ?? "") === sku,
                              );
                              updateDraftLine(l.key, {
                                sku,
                                productName:
                                  item?.product?.name ?? l.productName,
                              });
                            }}
                            className={SC}
                          >
                            <option value="">
                              {l.sku ? l.sku : "— select product —"}
                            </option>
                            {skuOptions.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-[#333333] whitespace-nowrap">
                          {l.poOrdered}
                        </td>
                        <td className="px-3 py-2.5 text-[#666666] whitespace-nowrap">
                          {l.poReceived}
                        </td>
                        <td className="px-3 py-2.5 text-[#333333] whitespace-nowrap">
                          {l.poRemaining}
                          <p className="text-[10px] text-[#999]">
                            after receipt: {l.remainingAfterReceipt}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-[#333333] whitespace-nowrap">
                          {l.invoiceQuantity}
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min={0}
                            value={l.acceptedQuantity}
                            onChange={(e) =>
                              updateDraftLine(l.key, {
                                acceptedQuantity: Number(e.target.value),
                              })
                            }
                            className="w-20 rounded border border-[#C6D4BF] bg-white px-2 py-1.5 text-sm focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            value={l.unit}
                            onChange={(e) =>
                              updateDraftLine(l.key, { unit: e.target.value })
                            }
                            placeholder="UOM"
                            className="w-24 rounded border border-[#C6D4BF] bg-white px-2 py-1.5 text-sm focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            value={l.batchNumber}
                            onChange={(e) =>
                              updateDraftLine(l.key, {
                                batchNumber: e.target.value,
                              })
                            }
                            placeholder="BATCH-001"
                            className="w-28 rounded border border-[#C6D4BF] bg-white px-2 py-1.5 text-sm focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <DatePicker
                            value={l.expiryDate}
                            onChange={(v) =>
                              updateDraftLine(l.key, { expiryDate: v })
                            }
                            placeholder="Expiry"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <DatePicker
                            value={l.manufacturingDate}
                            onChange={(v) =>
                              updateDraftLine(l.key, {
                                manufacturingDate: v,
                              })
                            }
                            placeholder="Mfg"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-[#666666] whitespace-nowrap">
                          {fmtMoney(l.poUnitCost)}
                        </td>
                        <td className="px-3 py-2.5 text-[#666666] whitespace-nowrap">
                          {fmtMoney(l.unitPrice)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`text-xs font-bold whitespace-nowrap ${status.tone}`}
                          >
                            {status.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Discrepancies */}
          {(blockingDiscrepancies.length > 0 || infoDiscrepancies.length > 0) && (
            <div className="rounded-xl border border-[#E6ECE2] bg-white p-5 space-y-3">
              <h2 className="text-base font-bold text-[#333333]">
                Discrepancies
              </h2>
              {blockingDiscrepancies.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                    <IconWarningTriangle className="h-4 w-4 text-red-600" />
                    Blocking issues — resolve before confirmation
                  </p>
                  <ul className="mt-2 space-y-1.5 list-disc list-inside">
                    {blockingDiscrepancies.map((d, i) => (
                      <li key={`b-${i}`} className="text-sm text-red-700">
                        <span className="font-semibold">
                          {DISCREPANCY_LABELS[d.code] ?? d.code}
                        </span>
                        {" — "}
                        {d.message}
                        {d.code === "PHYSICAL_DISCREPANCY" &&
                          (d.documentedQty != null || d.acceptedQty != null) && (
                            <p className="text-xs text-red-600 ml-4 mt-0.5">
                              Documented quantity: {d.documentedQty ?? "—"} ·
                              Accepted quantity: {d.acceptedQty ?? "—"}
                            </p>
                          )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {infoDiscrepancies.length > 0 && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-sm font-semibold text-blue-700">
                    Informational
                  </p>
                  <ul className="mt-1.5 space-y-1 list-disc list-inside">
                    {infoDiscrepancies.map((d, i) => (
                      <li key={`i-${i}`} className="text-sm text-blue-700">
                        <span className="font-semibold">
                          {DISCREPANCY_LABELS[d.code] ?? d.code}
                        </span>
                        {" — "}
                        {d.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.requiresDiscrepancyNote && (
                <div>
                  <label className="block text-sm text-[#666666] mb-1">
                    Discrepancy Note{" "}
                    <span className="text-red-500">(required)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value);
                      setReviewDirty(true);
                    }}
                    placeholder="Explain the physical discrepancy — e.g. quantities verified against delivered goods…"
                    className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none resize-none"
                  />
                  {!note.trim() && (
                    <p className="mt-1 text-[10px] text-red-500">
                      Required before this receipt can be confirmed.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Review footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[#E6ECE2] bg-white px-4 sm:px-6 py-3">
          <Button variant="secondary" onClick={() => setStep(1)}>
            ← Back to Edit
          </Button>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={handleRePreview}
              loading={previewing}
              disabled={!reviewDirty}
            >
              Re-run Preview
            </Button>
            <Button
              onClick={handleConfirm}
              loading={confirming}
              disabled={
                !preview.canConfirm ||
                previewing ||
                (preview.requiresDiscrepancyNote && !note.trim())
              }
            >
              Confirm Receiving
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: upload & extraction (step 1) ────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {stepIndicator}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {flowError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {flowError}
          </div>
        )}

        {/* Document upload */}
        <div className="rounded-xl border border-[#E6ECE2] bg-white p-5">
          <h2 className="text-base font-bold text-[#333333]">
            Scan / Upload Supplier Receipt
          </h2>
          <p className="text-xs text-[#999] mt-0.5 mb-4">
            Upload the supplier receipt ({ACCEPTED_TYPES_LABEL}) or capture
            it with the camera. Maximum 10 MB.
          </p>
          <div className="flex flex-wrap gap-3 mb-4">
            <Button onClick={handleScan}>Scan Receipt</Button>
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Receipt
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(",")}
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
              dragOver
                ? "border-[#7A9076] bg-[#E6ECE2]/60"
                : "border-[#C6D4BF] bg-[#E6ECE2]/20"
            }`}
          >
            <IconDocumentText className="h-10 w-10 text-[#7A9076] mx-auto" />
            <p className="mt-2 text-sm text-[#666666]">
              Drag and drop your receipt here, or use the buttons above.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 text-sm font-semibold text-[#7A9076] hover:underline"
            >
              Browse files
            </button>
          </div>

          {docFile && (
            <div className="mt-4 rounded-xl border border-[#C6D4BF] bg-[#E6ECE2]/40 px-4 py-3 flex items-center gap-3">
              <IconDocumentText className="h-8 w-8 text-[#7A9076]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#333333]">
                  Receipt document
                </p>
                <p className="text-xs text-[#666666] truncate">
                  {docFile.name} · {(docFile.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
              >
                Replace
              </button>
            </div>
          )}
        </div>

        {/* Camera capture */}
        <Modal
          open={cameraOpen}
          title="Scan Receipt"
          onClose={() => {
            setCameraOpen(false);
            stopCamera();
          }}
          size="md"
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-xl bg-black"
            style={{ maxHeight: "55vh", objectFit: "contain" }}
          />
          {cameraError && (
            <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {cameraError}
            </p>
          )}
          <div className="flex gap-3 justify-end mt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setCameraOpen(false);
                stopCamera();
              }}
            >
              Cancel
            </Button>
            <Button onClick={captureFrame}>Capture</Button>
          </div>
        </Modal>

{/* ── Extraction outcome ── */}
        {extractResult && (
          <div className="rounded-xl border border-[#B6C8AF] bg-[#E6ECE2]/50 px-4 py-3">
            <p className="text-sm font-semibold text-[#4A6B46] flex items-center gap-2">
              <IconCheckCircle className="h-4 w-4" />
              Receipt scanned successfully.
            </p>
            <p className="text-xs text-[#666666] mt-1">
              We extracted{" "}
              {extractResult.lineCount === 0
                ? "no line items"
                : `${extractResult.lineCount} receipt line${
                    extractResult.lineCount === 1 ? "" : "s"
                  }`}{" "}
              from the document. Review the information below, then complete
              the fields marked <span className="font-semibold">Required</span>.
            </p>
          </div>
        )}

        {/* ── OCR review notes ── */}
        {extractWarnings.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-700 flex items-center gap-2">
              <IconWarningTriangle className="h-4 w-4 text-amber-600" />
              OCR Review
            </p>
            <ul className="mt-1.5 list-disc list-inside space-y-0.5 text-xs text-amber-700">
              {extractWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Card 1 — Receipt Information ── */}
        <div className="rounded-xl border border-[#E6ECE2] bg-white p-5">
          <h2 className="text-base font-bold text-[#333333]">
            Receipt Information
          </h2>
          <p className="text-xs text-[#999] mt-0.5 mb-4">
            Read from the receipt. Correct anything the reader got wrong.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <FieldLabel
                source={
                  <SourceTag kind="extracted">Extracted · Editable</SourceTag>
                }
              >
                Invoice Number
              </FieldLabel>
              <input
                value={receipt.invoiceNumber}
                onChange={(e) =>
                  updateReceiptInfo({ invoiceNumber: e.target.value })
                }
                placeholder="e.g. CR-00004212"
                className={SC}
              />
              {receipt.fsNumber && (
                <p className="text-[10px] text-[#999] mt-1">
                  FS No. on receipt: {receipt.fsNumber}
                </p>
              )}
            </div>
            <div>
              <FieldLabel
                source={
                  <SourceTag kind="extracted">Extracted · Editable</SourceTag>
                }
              >
                Invoice Date
              </FieldLabel>
              <DatePicker
                value={receipt.invoiceDate}
                onChange={(v) => updateReceiptInfo({ invoiceDate: v })}
              />
            </div>
            <div>
              <FieldLabel
                source={
                  <SourceTag kind="extracted">Extracted · Editable</SourceTag>
                }
              >
                Grand Total (ETB)
              </FieldLabel>
              <input
                type="number"
                min={0}
                step="0.01"
                value={receipt.grandTotal || ""}
                onChange={(e) =>
                  updateReceiptInfo({ grandTotal: Number(e.target.value) })
                }
                className={SC}
              />
              <p className="text-[10px] text-[#999] mt-1">
                The supplier document's total. Calculated from items:{" "}
                {fmtMoney(calculateGrandTotal(receipt.items))}
              </p>
              {receipt.grandTotal > 0 &&
                Math.abs(
                  receipt.grandTotal - calculateGrandTotal(receipt.items),
                ) > 0.01 && (
                  <p className="text-[10px] text-amber-600 mt-0.5">
                    Document total differs from calculated item total by{" "}
                    {fmtMoney(
                      Math.abs(
                        receipt.grandTotal -
                          calculateGrandTotal(receipt.items),
                      ),
                    )}
                    .
                  </p>
                )}
            </div>
            <div>
              <FieldLabel
                source={<SourceTag kind="extracted">Extracted · Review</SourceTag>}
              >
                Payment Terms
              </FieldLabel>
              <input
                value={receipt.paymentTerms ?? ""}
                onChange={(e) =>
                  updateReceiptInfo({
                    paymentTerms: e.target.value || undefined,
                  })
                }
                placeholder="e.g. CREDIT"
                className={SC}
              />
              <p className="text-[10px] text-[#999] mt-1">
                Invoice terms only — a credit term is not a payment.
              </p>
            </div>
          </div>
        </div>

        {/* ── Card 2 — Match to Pharmacy Records ── */}
        <div className="rounded-xl border border-[#E6ECE2] bg-white p-5">
          <h2 className="text-base font-bold text-[#333333]">
            Match to Pharmacy Records
          </h2>
          <p className="text-xs text-[#999] mt-0.5 mb-4">
            Select the Supplier from your pharmacy records, then select the
            Purchase Order. The selected Purchase Order is the source of truth
            for receiving.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <FieldLabel
                required
                source={<SourceTag kind="select">Select</SourceTag>}
              >
                Supplier
              </FieldLabel>
              <select
                value={supplierId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSupplierId(id);
                  const s = suppliers.find((x) => x.id === id);
                  setReceipt((r) => ({
                    ...r,
                    supplierName: s?.name ?? "",
                  }));
                }}
                className={SC}
              >
                <option value="">— Select supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {receipt.ocrSupplierName && (
                <p className="text-[10px] text-[#999] mt-1">
                  Receipt supplier: {receipt.ocrSupplierName}
                  {receipt.ocrSupplierTin
                    ? ` · TIN ${receipt.ocrSupplierTin}`
                    : ""}{" "}
                  — select the matching pharmacy record above.
                </p>
              )}
            </div>
            <div>
              <FieldLabel
                required
                source={<SourceTag kind="select">Select</SourceTag>}
              >
                Purchase Order
              </FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={findPOCandidates}
                  loading={findingPO}
                  disabled={!supplierId}
                  className="!px-3 !py-2 text-xs"
                >
                  Find purchase orders
                </Button>
                <div className="flex-1 min-w-[180px]">
                  <SearchableSelect
                    value={null}
                    onChange={(v) => addManualCandidate(v)}
                    options={poSearch.options}
                    onSearch={poSearch.setTerm}
                    loading={poSearch.loading}
                    error={poSearch.error}
                    onRetry={poSearch.retry}
                    placeholder="Search Purchase Order Manually..."
                    searchPlaceholder="Search by PO number or supplier..."
                    emptyMessage="No purchase orders found"
                    noResultsMessage="No purchase orders matching your search"
                  />
                </div>
              </div>
              {!supplierId && (
                <p className="text-[10px] text-[#999] mt-1">
                  Select a supplier first to find their purchase orders.
                </p>
              )}
            </div>
          </div>

          {poCandidates.length > 0 && (
            <div className="mt-4 space-y-2">
              {poCandidates.map((o) => {
                const isSelected = selectedPo?.id === o.id;
                const itemCount = o.items?.length ?? o._count?.items ?? 0;
                return (
                  <div
                    key={o.id}
                    className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${
                      isSelected
                        ? "border-[#7A9076] bg-[#E6ECE2]/50"
                        : "border-[#E6ECE2] bg-white"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#333333] text-sm">
                        {o.poNumber}
                      </p>
                      <p className="text-xs text-[#666666]">
                        {o.supplier?.name ?? o.supplierId ?? "Unknown supplier"}
                        {" · "}
                        {itemCount} item{itemCount === 1 ? "" : "s"}
                        {o.status ? ` · ${o.status}` : ""}
                      </p>
                      <p className="text-[10px] text-[#999] mt-0.5">
                        {matchCounts[o.id] ?? 0}/{receipt.items.length} receipt
                        lines match this order
                      </p>
                    </div>
                    {isSelected ? (
                      <span className="text-xs font-bold text-[#7A9076]">
                        ✓ Selected
                      </span>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => void selectPo(o)}
                        className="!px-3 !py-2 text-xs whitespace-nowrap"
                      >
                        Use This PO
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {selectedPo && <PoSummaryCard po={selectedPo} onChange={setSelectedPo} />}
        </div>

        {/* ── Card 3 — Receiving ── */}
        <div className="rounded-xl border border-[#E6ECE2] bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6ECE2]">
            <h2 className="text-base font-bold text-[#333333]">Receiving</h2>
            <p className="text-xs text-[#999] mt-0.5">
              Map each receipt line to a Purchase Order item, confirm the unit,
              then enter the quantity you actually accepted. Only the accepted
              quantity enters stock.
            </p>
          </div>

          <div className="px-5 pt-4 pb-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel
                required
                source={<SourceTag kind="system">Enter</SourceTag>}
              >
                Received Date
              </FieldLabel>
              <DatePicker
                value={receipt.receivedDate}
                onChange={(v) => updateReceiptInfo({ receivedDate: v })}
              />
              <p className="text-[10px] text-[#999] mt-1">
                When the goods arrived — not the invoice date.
              </p>
            </div>
            <div>
              <FieldLabel
                required
                source={<SourceTag kind="select">Select</SourceTag>}
              >
                Receiving Location
              </FieldLabel>
              <select
                value={locationId}
                onChange={(e) => {
                  setLocationId(e.target.value);
                  setReviewDirty(true);
                }}
                className={SC}
              >
                <option value="">— Select location —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="px-5 pt-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-[#333333]">
                  Receipt Items
                </h3>
                <p className="text-[9px] text-[#999] mt-0.5">
                  Documented Qty is what the receipt says. Accepted Qty is what
                  physically arrived — a shortfall is a physical discrepancy,
                  not an automatic shortage.
                </p>
              </div>
              <button
                onClick={addReceiptItem}
                className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
              >
                + Add Item
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1150px]">
                <thead>
                  <tr className="bg-[#E6ECE2]">
                    {[
                      { h: "Receipt Product", s: "Extracted" },
                      { h: "PO Item", s: "Select · Required" },
                      { h: "Unit", s: "Select from PO" },
                      { h: "Documented Qty", s: "Extracted" },
                      { h: "Accepted Qty", s: "Enter" },
                      { h: "Batch #", s: "Extracted" },
                      { h: "Mfg Date", s: "Extracted" },
                      { h: "Expiry Date", s: "Extracted" },
                      { h: "Unit Price", s: "Extracted" },
                    ].map((c) => (
                      <th
                        key={c.h}
                        className="px-2.5 py-2 text-left font-semibold text-[#333333]"
                      >
                        <span className="block whitespace-nowrap">{c.h}</span>
                        <SourceTag kind="extracted">{c.s}</SourceTag>
                      </th>
                    ))}
                    <th className="px-2.5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((item, i) => {
                    const lowConf = item.confidence === "low";
                    const matchedPoItem = item.poItemId
                      ? (selectedPo?.items ?? []).find(
                          (poi) => poi.id === item.poItemId,
                        ) ?? null
                      : null;
                    const poItemOptions = (selectedPo?.items ?? []).map((poi) => ({
                      value: poi.id,
                      label: `${poi.product?.sku ? `${poi.product.sku} — ` : ""}${
                        poi.product?.name ?? poi.productId.slice(0, 8)
                      }`,
                    }));
                    const poUnitName =
                      matchedPoItem?.unit?.name || matchedPoItem?.unit?.symbol || "";
                    const cellCls = `rounded border bg-white px-2 py-1.5 text-sm focus:outline-none ${
                      lowConf ? "border-amber-300" : "border-[#C6D4BF]"
                    }`;
                    return (
                      <tr
                        key={i}
                        className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/10"}
                      >
                        <td className="px-2.5 py-2">
                          <input
                            value={item.productName}
                            onChange={(e) =>
                              updateReceiptItem(i, { productName: e.target.value })
                            }
                            placeholder="Item description"
                            className={`w-52 ${cellCls}`}
                          />
                          {item.ocrProductCode && (
                            <p
                              className="text-[9px] text-[#999] mt-0.5"
                              title="Printed on the supplier receipt — not the pharmacy product code"
                            >
                              Receipt Code (OCR): {item.ocrProductCode}
                            </p>
                          )}
                        </td>
                        <td className="px-2.5 py-2">
                          <select
                            value={item.poItemId ?? ""}
                            onChange={(e) => {
                              const poItemId = e.target.value;
                              const poi = (selectedPo?.items ?? []).find(
                                (x) => x.id === poItemId,
                              );
                              updateReceiptItem(i, {
                                poItemId: poItemId || undefined,
                                productCode: poi?.product?.sku ?? "",
                                unitSymbol: poi?.unit
                                  ? poi.unit.symbol || poi.unit.name
                                  : undefined,
                                ...(item.productName === "" && poi?.product?.name
                                  ? { productName: poi.product.name }
                                  : {}),
                              });
                            }}
                            disabled={!selectedPo}
                            className={SC}
                          >
                            <option value="">
                              {selectedPo
                                ? "— Select PO item —"
                                : "— select a PO first —"}
                            </option>
                            {poItemOptions.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2.5 py-2">
                          <select
                            value={item.unitSymbol ?? ""}
                            onChange={(e) =>
                              updateReceiptItem(i, {
                                unitSymbol: e.target.value || undefined,
                              })
                            }
                            disabled={!matchedPoItem}
                            className={SC}
                          >
                            <option value="">
                              {matchedPoItem
                                ? poUnitName || "— Select UOM —"
                                : "— Select UOM —"}
                            </option>
                            {poUnitName && (
                              <option value={poUnitName}>
                                {matchedPoItem?.unit?.name &&
                                matchedPoItem.unit.symbol
                                  ? `${matchedPoItem.unit.name} (${matchedPoItem.unit.symbol})`
                                  : poUnitName}
                              </option>
                            )}
                          </select>
                          {item.ocrUnit && (
                            <p
                              className="text-[9px] text-[#999] mt-0.5"
                              title="UOM printed on the receipt — pick the Purchase Order unit, units are never converted"
                            >
                              Receipt: {item.ocrUnit}
                            </p>
                          )}
                        </td>
                        <td className="px-2.5 py-2">
                          <input
                            type="number"
                            min={0}
                            value={item.quantity || ""}
                            onChange={(e) =>
                              updateReceiptItem(i, {
                                quantity: Number(e.target.value),
                              })
                            }
                            placeholder="0"
                            className={`w-20 ${cellCls}`}
                          />
                          {lowConf && (
                            <p className="text-[9px] text-amber-600">verify</p>
                          )}
                        </td>
                        <td className="px-2.5 py-2">
                          <input
                            type="number"
                            min={0}
                            value={item.acceptedQuantity || ""}
                            onChange={(e) =>
                              updateReceiptItem(i, {
                                acceptedQuantity: Number(e.target.value),
                              })
                            }
                            placeholder="0"
                            className={`w-20 ${cellCls} font-semibold`}
                          />
                          {item.quantity !== item.acceptedQuantity && (
                            <p className="text-[9px] text-amber-600">
                              discrepancy{" "}
                              {Math.abs(
                                (item.quantity || 0) - (item.acceptedQuantity || 0),
                              )}
                            </p>
                          )}
                        </td>
                        <td className="px-2.5 py-2">
                          <input
                            value={item.batchNumber}
                            onChange={(e) =>
                              updateReceiptItem(i, { batchNumber: e.target.value })
                            }
                            placeholder="Batch"
                            className={`w-28 ${cellCls}`}
                          />
                        </td>
                        <td className="px-2.5 py-2">
                          <DatePicker
                            value={item.manufacturingDate}
                            onChange={(v) =>
                              updateReceiptItem(i, { manufacturingDate: v })
                            }
                            placeholder="Mfg"
                          />
                        </td>
                        <td className="px-2.5 py-2">
                          <DatePicker
                            value={item.expiryDate}
                            onChange={(v) =>
                              updateReceiptItem(i, { expiryDate: v })
                            }
                            placeholder="Expiry"
                          />
                        </td>
                        <td className="px-2.5 py-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unitPrice || ""}
                            onChange={(e) =>
                              updateReceiptItem(i, {
                                unitPrice: Number(e.target.value),
                              })
                            }
                            placeholder="0.00"
                            className={`w-24 ${cellCls}`}
                          />
                        </td>
                        <td className="px-2.5 py-2">
                          {receipt.items.length > 1 ? (
                            <button
                              onClick={() => removeReceiptItem(i)}
                              className="text-xs text-red-500 hover:underline whitespace-nowrap"
                            >
                              Remove
                            </button>
                          ) : (
                            <span className="text-xs text-[#C8C8C8]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {docFile &&
              receipt.items.every(
                (it) => !it.productName.trim() && !it.ocrProductCode,
              ) && (
                <p className="mt-3 mb-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  No line items were recognized in this document. Use{" "}
                  <span className="font-semibold">+ Add Item</span> to enter them
                  from the receipt.
                </p>
              )}
            {receipt.items.some((it) => it.confidence === "low") && (
              <p className="mt-2 mb-1 text-xs text-amber-600 flex items-center gap-1.5">
                <IconWarningTriangle className="h-3.5 w-3.5 text-amber-500" />
                Some values were read with low confidence and are highlighted
                amber — please verify them against the receipt.
              </p>
            )}
          </div>
        </div>

        {/* ── Card 4 — Payment ── */}
        <div className="rounded-xl border border-[#E6ECE2] bg-white p-5">
          <h2 className="text-base font-bold text-[#333333]">Payment</h2>
          <p className="text-xs text-[#999] mt-0.5 mb-4">
            Separate from the receipt. Only record a payment if one was actually
            made.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel
                source={
                  <SourceTag kind="select">
                    Select · Optional
                  </SourceTag>
                }
              >
                Payment Method
              </FieldLabel>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value as PaymentMethod | "");
                  if (!e.target.value) setPaymentDate("");
                }}
                className={SC}
              >
                <option value="">— Select payment method —</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_LABELS[m] ?? m}
                  </option>
                ))}
              </select>
              {!paymentMethod && (
                <p className="text-[10px] text-[#999] mt-1">
                  No payment recorded — the supplier invoice will remain OPEN.
                </p>
              )}
            </div>
            <div>
              <FieldLabel
                source={<SourceTag kind="system">Enter</SourceTag>}
              >
                Payment Date
              </FieldLabel>
              <DatePicker
                value={paymentDate}
                onChange={(v) => setPaymentDate(v)}
                disabled={!paymentMethod}
                placeholder={
                  paymentMethod ? "Select payment date" : "Pick a method first"
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Upload footer */}
      <div className="flex items-center justify-between gap-3 border-t border-[#E6ECE2] bg-white px-4 sm:px-6 py-3">
        <Button variant="secondary" onClick={onBackToMethods}>
          ← Back
        </Button>
        <Button
          onClick={handleContinue}
          loading={previewing}
          disabled={!!previewing}
        >
          Review &amp; Preview →
        </Button>
      </div>
    </div>
  );
}