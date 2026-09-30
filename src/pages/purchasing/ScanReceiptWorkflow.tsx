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
  type MatchCandidateDto,
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

const ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

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
    listLocations({ isActive: true, limit: 100 })
      .then((r) => {
        setLocations(r.data);
        if (r.data.length > 0) setLocationId(r.data[0].id);
      })
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
      setFlowError("Unsupported file type. Please upload a PDF, JPG, JPEG or PNG receipt.");
      return;
    }
    setFlowError("");
    setExtractWarnings([]);
    setDocFile(file);
    setExtracting(true);
    // 1) Try the backend OCR endpoint. Every extracted field stays editable;
    //    nothing is trusted as-is. If it is unavailable (not deployed yet) or
    //    fails, fall back to the honest manual/JSON path below.
    extractInvoiceReceipt(file)
      .then((extracted) => {
        setReceipt(extractedInvoiceToReceipt(extracted));
        setExtractWarnings(extracted.warnings ?? []);
      })
      .catch(() => {
        return extractReceiptDocument(file).then((extracted) => {
          if (
            extracted.items.some((it) => it.productCode || it.productName) ||
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
      const found = new Map<string, PurchaseOrderDto>();
      const serverCounts: Record<string, number> = {};
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
            await Promise.all(
              candidates.slice(0, 6).map(async (c: MatchCandidateDto) => {
                try {
                  const detail = await getPurchaseOrder(c.purchaseOrder.id);
                  found.set(detail.id, detail);
                  serverCounts[detail.id] = c.matchCount;
                } catch {
                  // Skip candidates that can no longer be loaded.
                }
              }),
            );
          }
        } catch {
          // Endpoint not deployed yet — fall through to the legacy lookup.
        }
      }

      if (!usedServerRanking) {
        // 2) PO number embedded in the invoice reference (receipts often carry
        //    the PO number — but do NOT assume they always do).
        const poRef = (receipt.invoiceNumber.match(/PO-\d+/i) ?? [])[0];
        if (poRef) {
          const r = await listPurchaseOrders({ search: poRef, limit: 10 });
          r.data.forEach((o) => found.set(o.id, o));
        }

        // 3) The selected supplier (authoritative) → list their open POs.
        if (supplierId) {
          const r = await listPurchaseOrders({ supplierId, limit: 50 });
          r.data.forEach((o) => found.set(o.id, o));
        }
      }

      const list = [...found.values()].slice(0, 6);
      setPoCandidates(list);

      // Fetch details so match counts are accurate (list rows omit items).
      const counts: Record<string, number> = {};
      await Promise.all(
        list.map(async (o) => {
          try {
            const detail = await getPurchaseOrder(o.id);
            counts[o.id] =
              serverCounts[o.id] ?? countMatchedProducts(detail, receipt.items);
          } catch {
            counts[o.id] = 0;
          }
        }),
      );
      setMatchCounts(counts);

      if (list.length === 0) {
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
      ...(paymentMethod
        ? { paymentMethod, paymentDate: paymentDate || receipt.receivedDate }
        : {}),
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

    const input = toInvoiceUploadInput(receipt, locationId, {
      supplierName: selectedPo?.supplier?.name ?? undefined,
      ...(paymentMethod
        ? { paymentMethod, paymentDate: paymentDate || receipt.receivedDate }
        : {}),
    });

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
      if (fresh.requiresDiscrepancyNote && !note.trim()) {
        setPreviewError(
          "A discrepancy note is required before confirmation. Enter it below, then confirm.",
        );
        return;
      }

      const result = await confirmInvoiceUpload(selectedPo.id, buildReviewInput());
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
                  "Accepted Quantity",
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

          {/* Receipt information */}
          <div className="rounded-xl border border-[#E6ECE2] bg-white p-5">
            <h2 className="text-base font-bold text-[#333333]">
              Review Extracted Receipt
            </h2>
            <p className="text-xs text-[#999] mt-0.5 mb-4">
              The system matched the receipt against the selected Purchase
              Order. Correct any extracted values below, then re-run the
              preview.
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
                      "Invoice Qty",
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
                </div>
              )}
            </div>
          )}
        </div>

        {/* Review footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[#E6ECE2] bg-white px-4 sm:px-6 py-3">
          <Button variant="secondary" onClick={() => setStep(1)}>
            ← Back to Upload
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
              disabled={!preview.canConfirm}
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
            Upload the supplier receipt (PDF, JPG, JPEG, PNG) or capture it
            with the camera. Supported: {ACCEPTED_EXTENSIONS.join(", ")}.
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

        {/* Extraction */}
        <div className="rounded-xl border border-[#E6ECE2] bg-white p-5">
          <h2 className="text-base font-bold text-[#333333]">
            Extracted Receipt Information
          </h2>
          <p className="text-xs text-[#999] mt-0.5 mb-4">
            The receipt is read automatically when you upload or scan it — any
            value it could not read reliably is left blank for you to fill in,
            and everything below stays editable. The system extracts/matches
            the values against the selected Purchase Order, so nothing needs to
            be typed twice later.
          </p>
          {extracting && (
            <p className="mb-4 text-xs font-semibold text-[#7A9076] flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-[#B6C8AF] border-t-transparent animate-spin" />
              Reading the receipt…
            </p>
          )}
          {extractWarnings.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <p className="font-semibold">Check these before continuing</p>
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                {extractWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <div>
              <label className="block text-sm text-[#666666] mb-1">
                Supplier <span className="text-red-500">*</span>
              </label>
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
              <p className="text-[10px] text-[#999] mt-1">
                The PO's supplier stays authoritative — this is used to find
                the right Purchase Order.
              </p>
            </div>
            <div>
              <label className="block text-sm text-[#666666] mb-1">
                Invoice Number
              </label>
              <input
                value={receipt.invoiceNumber}
                onChange={(e) =>
                  setReceipt((r) => ({ ...r, invoiceNumber: e.target.value }))
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
                onChange={(v) => setReceipt((r) => ({ ...r, invoiceDate: v }))}
              />
            </div>
            <div>
              <label className="block text-sm text-[#666666] mb-1">
                Received Date
              </label>
              <DatePicker
                value={receipt.receivedDate}
                onChange={(v) => setReceipt((r) => ({ ...r, receivedDate: v }))}
              />
            </div>
            <div>
              <label className="block text-sm text-[#666666] mb-1">
                Grand Total (ETB)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={receipt.grandTotal || ""}
                  onChange={(e) =>
                    setReceipt((r) => ({
                      ...r,
                      grandTotal: Number(e.target.value),
                    }))
                  }
                  className={SC}
                />
              </div>
              <button
                onClick={() => {
                  setReceipt((r) => ({
                    ...r,
                    grandTotal: calculateGrandTotal(r.items),
                  }));
                }}
                className="mt-1 text-xs font-semibold text-[#7A9076] hover:underline"
              >
                Auto-calculate from items
              </button>
              {receipt.grandTotal > 0 &&
                Math.abs(receipt.grandTotal - calculateGrandTotal(receipt.items)) >
                  0.01 && (
                  <p className="mt-1 text-[10px] text-amber-600">
                    Differs from the sum of line totals by{" "}
                    {fmtMoney(
                      Math.abs(
                        receipt.grandTotal - calculateGrandTotal(receipt.items),
                      ),
                    )}{" "}
                    — verify or auto-calculate.
                  </p>
                )}
            </div>
            <div>
              <label className="block text-sm text-[#666666] mb-1">
                Payment Method{" "}
                <span className="text-[#999]">(optional)</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod | "")
                }
                className={SC}
              >
                <option value="">— Unpaid / credit —</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_LABELS[m] ?? m}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[#999] mt-1">
                Leave empty to record the invoice as OPEN.
              </p>
            </div>
            <div>
              <label className="block text-sm text-[#666666] mb-1">
                Payment Date
              </label>
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

          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-[#333333]">Receipt Items</h3>
            <button
              onClick={addReceiptItem}
              className="text-xs font-semibold text-[#7A9076] hover:underline"
            >
              + Add Item
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1250px]">
              <thead>
                <tr className="bg-[#E6ECE2]">
                  {[
                    "#",
                    "Product Name",
                    "PO Item",
                    "UOM",
                    "Quantity",
                    "Accepted",
                    "Batch #",
                    "Mfg Date",
                    "Expiry Date",
                    "Unit Price",
                    "Line Total",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-2.5 py-2 text-left font-semibold text-[#333333] whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
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
                  const unit =
                    matchedPoItem?.unit?.symbol || matchedPoItem?.unit?.name || "";
                  const lineTotal =
                    (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                  const cellCls = `rounded border bg-white px-2 py-1.5 text-sm focus:outline-none ${
                    lowConf ? "border-amber-300" : "border-[#C6D4BF]"
                  }`;
                  return (
                    <tr
                      key={i}
                      className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/10"}
                    >
                      <td className="px-2.5 py-2 text-[#666666]">{i + 1}</td>
                      <td className="px-2.5 py-2">
                        <input
                          value={item.productName}
                          onChange={(e) =>
                            updateReceiptItem(i, { productName: e.target.value })
                          }
                          placeholder="Item description"
                          className="w-56 rounded border border-[#C6D4BF] bg-white px-2 py-1.5 text-sm focus:outline-none"
                        />
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
                              productCode:
                                poi?.product?.sku ?? item.productCode ?? "",
                              unitSymbol:
                                poi?.unit
                                  ? poi.unit.symbol || poi.unit.name
                                  : item.unitSymbol,
                              ...(item.productName === "" && poi?.product?.name
                                ? { productName: poi.product.name }
                                : {}),
                            });
                          }}
                          className={SC}
                        >
                          <option value="">— select PO item —</option>
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
                              ? matchedPoItem.unit?.name || "— select UOM —"
                              : "— select UOM —"}
                          </option>
                          {unit && (
                            <option value={unit}>
                              {matchedPoItem?.unit?.name && matchedPoItem.unit.symbol
                                ? `${matchedPoItem.unit.name} (${matchedPoItem.unit.symbol})`
                                : unit}
                            </option>
                          )}
                        </select>
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
                          className={`w-16 ${cellCls}`}
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
                          className={`w-16 ${cellCls}`}
                        />
                      </td>
                      <td className="px-2.5 py-2">
                        <input
                          value={item.batchNumber}
                          onChange={(e) =>
                            updateReceiptItem(i, { batchNumber: e.target.value })
                          }
                          placeholder="Batch number"
                          className={`w-28 ${cellCls}`}
                        />
                      </td>
                      <td className="px-2.5 py-2">
                        <DatePicker
                          value={item.manufacturingDate}
                          onChange={(v) =>
                            updateReceiptItem(i, { manufacturingDate: v })
                          }
                          placeholder="Mfg date (optional)"
                        />
                      </td>
                      <td className="px-2.5 py-2">
                        <DatePicker
                          value={item.expiryDate}
                          onChange={(v) =>
                            updateReceiptItem(i, { expiryDate: v })
                          }
                          placeholder="Expiry date"
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
                          className={`w-20 ${cellCls}`}
                        />
                      </td>
                      <td className="px-2.5 py-2 text-[#666666] whitespace-nowrap">
                        {fmtMoney(lineTotal)}
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
          {receipt.items.some((it) => it.confidence === "low") && (
            <p className="mt-2 text-xs text-amber-600 flex items-center gap-1.5">
              <IconWarningTriangle className="h-3.5 w-3.5 text-amber-500" />
              Some cells were read with low confidence and are highlighted amber
              — please verify them against the receipt.
            </p>
          )}
        </div>

        {/* Purchase order identification */}
        <div className="rounded-xl border border-[#E6ECE2] bg-white p-5">
          <h2 className="text-base font-bold text-[#333333]">
            Purchase Order
          </h2>
          <p className="text-xs text-[#999] mt-0.5 mb-4">
            The receipt may not always carry a PO number — use the selected
            supplier and the extracted product names to find the matching
            Purchase Order. PO selection is mandatory and never automatic; the
            PO remains the source of truth.
          </p>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Button
              variant="secondary"
              onClick={findPOCandidates}
              loading={findingPO}
            >
              Find matching purchase orders
            </Button>
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

          {poCandidates.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-sm font-semibold text-[#333333]">
                Possible Purchase Orders
              </p>
              {poCandidates.map((o) => {
                const isSelected = selectedPo?.id === o.id;
                return (
                  <div
                    key={o.id}
                    className={`rounded-xl border p-4 ${
                      isSelected
                        ? "border-[#7A9076] bg-[#E6ECE2]/50"
                        : "border-[#E6ECE2] bg-white"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1">
                        <p className="font-semibold text-[#333333]">
                          {o.poNumber}
                        </p>
                        <p className="text-sm text-[#666666]">
                          {o.supplier?.name ??
                            o.supplierId ??
                            "Unknown supplier"}
                        </p>
                        <p className="text-xs text-[#999] mt-0.5">
                          {matchCounts[o.id] ?? 0}/{receipt.items.length}{" "}
                          products matched
                          {o.expectedDeliveryDate && (
                            <>
                              {" · "}Expected delivery:{" "}
                              {fmtDate(o.expectedDeliveryDate)}
                            </>
                          )}
                          {o.status ? ` · ${o.status}` : ""}
                        </p>
                      </div>
                      {isSelected ? (
                        <span className="text-xs font-bold text-[#7A9076]">
                          ✓ Selected
                        </span>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => setSelectedPo(o)}
                          className="whitespace-nowrap"
                        >
                          Use This Purchase Order
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedPo && (
            <div className="mt-4 rounded-xl border border-[#7A9076] bg-[#E6ECE2]/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#333333]">
                    Selected: {selectedPo.poNumber}
                  </p>
                  <p className="text-sm text-[#666666]">
                    {selectedPo.supplier?.name ?? "Unknown supplier"} ·{" "}
                    {selectedPo.items?.length ?? 0} items ·{" "}
                    {countMatchedProducts(selectedPo, receipt.items)}/
                    {receipt.items.length} receipt lines matched
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPo(null)}
                  className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
                >
                  Change
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Receiving location */}
        <div className="rounded-xl border border-[#E6ECE2] bg-white p-5">
          <h2 className="text-base font-bold text-[#333333]">
            Receiving Location
          </h2>
          <p className="text-xs text-[#999] mt-0.5 mb-3">
            Select the storage location where the goods will be received.
          </p>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className={SC}
          >
            <option value="">— Select a location —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
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
          Continue →
        </Button>
      </div>
    </div>
  );
}