// ─── Types ────────────────────────────────────────────────────────────────────

export type PRStatus = "draft" | "pending" | "ordered" | "received";
export type POStatus = "draft" | "sent" | "delivered" | "received" | "completed";
export type Priority = "high" | "medium" | "low";
export type InvoiceStatus = "pending" | "partial" | "paid" | "overdue";
export type ReturnReason = "expired" | "damaged" | "incorrect_delivery" | "quality_issue";
export type ReturnStatus = "pending" | "approved" | "processed";
export type DeliveryItemStatus = "received" | "partial" | "missing";

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  rating: number;
  previousOrders: number;
}

export interface PRProduct {
  id: string;
  productId: string;
  productName: string;
  brand: string;
  quantity: number;
  unit: string;
  suggestedPrice: number;
  supplierId?: string;
}

export interface PurchaseRequirement {
  id: string;
  reference: string;
  date: string;
  priority: Priority;
  status: PRStatus;
  notes: string;
  createdBy: string;
  products: PRProduct[];
  totalCost: number;
}

export interface POItem {
  id: string;
  productId: string;
  productName: string;
  brand: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  reference: string;
  supplierId: string;
  supplierName: string;
  date: string;
  expectedDelivery: string;
  status: POStatus;
  items: POItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentTerms: string;
  notes: string;
  requirementRef?: string;
}

export interface DeliveryItem {
  id: string;
  productId: string;
  productName: string;
  orderedQty: number;
  orderedUnit: string;
  deliveredQty: number;
  batch: string;
  expiry: string;
  status: DeliveryItemStatus;
}

export interface Delivery {
  id: string;
  poId: string;
  poReference: string;
  supplierName: string;
  deliveryNote: string;
  deliveryDate: string;
  notes: string;
  items: DeliveryItem[];
}

export interface ReconciliationItem {
  id: string;
  productName: string;
  brand: string;
  poQty: number;
  deliveryQty: number;
  physicalCount: number;
  unit: string;
}

export interface Invoice {
  id: string;
  reference: string;
  supplierId: string;
  supplierName: string;
  date: string;
  dueDate: string;
  amount: number;
  paid: number;
  status: InvoiceStatus;
  poReference: string;
}

export interface ReturnItem {
  id: string;
  productName: string;
  brand: string;
  originalQty: number;
  returnQty: number;
  unit: string;
  batch: string;
  reason: ReturnReason;
  status: ReturnStatus;
}

export interface PurchaseReturn {
  id: string;
  reference: string;
  date: string;
  poId: string;
  poReference: string;
  supplierId: string;
  supplierName: string;
  reason: ReturnReason;
  items: ReturnItem[];
  generateDebitNote: boolean;
  totalValue: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const CURRENCY = "ETB";

export const UNITS = ["Box", "Strip", "Tablet", "Bottle", "Tube", "Vial", "Sachet"];

export const RETURN_REASONS: { value: ReturnReason; label: string }[] = [
  { value: "expired", label: "Expired" },
  { value: "damaged", label: "Damaged" },
  { value: "incorrect_delivery", label: "Incorrect Delivery" },
  { value: "quality_issue", label: "Quality Issue" },
];

// ─── Mock Suppliers ────────────────────────────────────────────────────────────

export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: "sup-1",
    name: "PharmaCo Ltd",
    contact: "Ahmed Mohammed",
    phone: "+251 911 123 456",
    email: "info@pharmaco.com",
    address: "Addis Ababa, Ethiopia",
    rating: 4.2,
    previousOrders: 12,
  },
  {
    id: "sup-2",
    name: "MediPharma",
    contact: "Sara Tadesse",
    phone: "+251 912 234 567",
    email: "orders@medipharma.et",
    address: "Adama, Ethiopia",
    rating: 3.8,
    previousOrders: 7,
  },
  {
    id: "sup-3",
    name: "GlobalMed Supply",
    contact: "Daniel Bekele",
    phone: "+251 913 345 678",
    email: "supply@globalmed.com",
    address: "Hawassa, Ethiopia",
    rating: 4.5,
    previousOrders: 20,
  },
  {
    id: "sup-4",
    name: "EthioHealth",
    contact: "Meron Alemu",
    phone: "+251 914 456 789",
    email: "contact@ethiohealth.et",
    address: "Bahir Dar, Ethiopia",
    rating: 3.5,
    previousOrders: 4,
  },
];

// ─── Mock Purchase Requirements ────────────────────────────────────────────────

export const MOCK_REQUIREMENTS: PurchaseRequirement[] = [
  {
    id: "pr-1",
    reference: "PR-2026-001",
    date: "2026-02-15",
    priority: "high",
    status: "pending",
    notes: "Monthly restock order — urgent antibiotics needed",
    createdBy: "John (Pharmacist)",
    totalCost: 45500,
    products: [
      { id: "prp-1", productId: "p1", productName: "Panadol 500mg", brand: "Panadol", quantity: 50, unit: "Box", suggestedPrice: 250, supplierId: "sup-1" },
      { id: "prp-2", productId: "p2", productName: "Amoxicillin 500mg", brand: "Amoxicillin", quantity: 40, unit: "Box", suggestedPrice: 320, supplierId: "sup-1" },
      { id: "prp-3", productId: "p3", productName: "Vitamin C 1000mg", brand: "VitaCare", quantity: 60, unit: "Bottle", suggestedPrice: 180 },
      { id: "prp-4", productId: "p4", productName: "Metformin 500mg", brand: "Glucophage", quantity: 30, unit: "Strip", suggestedPrice: 95 },
      { id: "prp-5", productId: "p5", productName: "Omeprazole 20mg", brand: "Prilosec", quantity: 25, unit: "Box", suggestedPrice: 210, supplierId: "sup-2" },
    ],
  },
  {
    id: "pr-2",
    reference: "PR-2026-002",
    date: "2026-02-20",
    priority: "medium",
    status: "ordered",
    notes: "Routine restocking of analgesics and antipyretics",
    createdBy: "Sara (Manager)",
    totalCost: 28750,
    products: [
      { id: "prp-6", productId: "p6", productName: "Ibuprofen 400mg", brand: "Brufen", quantity: 60, unit: "Strip", suggestedPrice: 120, supplierId: "sup-3" },
      { id: "prp-7", productId: "p7", productName: "Aspirin 100mg", brand: "Disprin", quantity: 80, unit: "Strip", suggestedPrice: 85, supplierId: "sup-3" },
    ],
  },
  {
    id: "pr-3",
    reference: "PR-2026-003",
    date: "2026-01-10",
    priority: "low",
    status: "received",
    notes: "Vitamins and supplements quarterly order",
    createdBy: "John (Pharmacist)",
    totalCost: 15200,
    products: [
      { id: "prp-8", productId: "p8", productName: "Vitamin D3 1000IU", brand: "D-Care", quantity: 40, unit: "Bottle", suggestedPrice: 220, supplierId: "sup-2" },
    ],
  },
  {
    id: "pr-4",
    reference: "PR-2026-004",
    date: "2026-03-01",
    priority: "high",
    status: "draft",
    notes: "Emergency insulin restock",
    createdBy: "Dr. Alemayehu",
    totalCost: 62000,
    products: [
      { id: "prp-9", productId: "p9", productName: "Insulin Glargine", brand: "Lantus", quantity: 20, unit: "Vial", suggestedPrice: 850, supplierId: "sup-1" },
    ],
  },
  {
    id: "pr-5",
    reference: "PR-2026-005",
    date: "2026-03-05",
    priority: "medium",
    status: "pending",
    notes: "Cardiac medications reorder",
    createdBy: "Sara (Manager)",
    totalCost: 38400,
    products: [
      { id: "prp-10", productId: "p10", productName: "Amlodipine 5mg", brand: "Norvasc", quantity: 45, unit: "Strip", suggestedPrice: 145 },
    ],
  },
];

// ─── Mock Purchase Orders ───────────────────────────────────────────────────────

export const MOCK_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "po-1",
    reference: "PO-2026-001",
    supplierId: "sup-1",
    supplierName: "PharmaCo Ltd",
    date: "2026-02-16",
    expectedDelivery: "2026-02-23",
    status: "delivered",
    subtotal: 45500,
    tax: 6825,
    total: 52325,
    paymentTerms: "Net 30",
    notes: "Please ensure all items have valid expiry dates",
    requirementRef: "PR-2026-001",
    items: [
      { id: "poi-1", productId: "p1", productName: "Panadol 500mg", brand: "Panadol", quantity: 50, unit: "Box", price: 250, total: 12500 },
      { id: "poi-2", productId: "p2", productName: "Amoxicillin 500mg", brand: "Amoxicillin", quantity: 40, unit: "Box", price: 320, total: 12800 },
      { id: "poi-3", productId: "p5", productName: "Omeprazole 20mg", brand: "Prilosec", quantity: 25, unit: "Box", price: 210, total: 5250 },
    ],
  },
  {
    id: "po-2",
    reference: "PO-2026-002",
    supplierId: "sup-3",
    supplierName: "GlobalMed Supply",
    date: "2026-02-21",
    expectedDelivery: "2026-02-28",
    status: "completed",
    subtotal: 28750,
    tax: 4313,
    total: 33063,
    paymentTerms: "Cash on Delivery",
    notes: "",
    requirementRef: "PR-2026-002",
    items: [
      { id: "poi-4", productId: "p6", productName: "Ibuprofen 400mg", brand: "Brufen", quantity: 60, unit: "Strip", price: 120, total: 7200 },
      { id: "poi-5", productId: "p7", productName: "Aspirin 100mg", brand: "Disprin", quantity: 80, unit: "Strip", price: 85, total: 6800 },
    ],
  },
  {
    id: "po-3",
    reference: "PO-2026-003",
    supplierId: "sup-2",
    supplierName: "MediPharma",
    date: "2026-03-01",
    expectedDelivery: "2026-03-10",
    status: "sent",
    subtotal: 15200,
    tax: 2280,
    total: 17480,
    paymentTerms: "Net 60",
    notes: "Handle with care — cold chain required",
    items: [
      { id: "poi-6", productId: "p8", productName: "Vitamin D3 1000IU", brand: "D-Care", quantity: 40, unit: "Bottle", price: 220, total: 8800 },
    ],
  },
  {
    id: "po-4",
    reference: "PO-2026-004",
    supplierId: "sup-1",
    supplierName: "PharmaCo Ltd",
    date: "2026-03-02",
    expectedDelivery: "2026-03-09",
    status: "draft",
    subtotal: 62000,
    tax: 9300,
    total: 71300,
    paymentTerms: "Net 30",
    notes: "",
    items: [
      { id: "poi-7", productId: "p9", productName: "Insulin Glargine", brand: "Lantus", quantity: 20, unit: "Vial", price: 850, total: 17000 },
    ],
  },
  {
    id: "po-5",
    reference: "PO-2026-005",
    supplierId: "sup-4",
    supplierName: "EthioHealth",
    date: "2026-03-05",
    expectedDelivery: "2026-03-15",
    status: "received",
    subtotal: 38400,
    tax: 5760,
    total: 44160,
    paymentTerms: "Net 30",
    notes: "",
    items: [
      { id: "poi-8", productId: "p10", productName: "Amlodipine 5mg", brand: "Norvasc", quantity: 45, unit: "Strip", price: 145, total: 6525 },
    ],
  },
];

// ─── Mock Deliveries ───────────────────────────────────────────────────────────

export const MOCK_DELIVERIES: Delivery[] = [
  {
    id: "del-1",
    poId: "po-1",
    poReference: "PO-2026-001",
    supplierName: "PharmaCo Ltd",
    deliveryNote: "DN-2026-015",
    deliveryDate: "2026-02-22",
    notes: "All products received in good condition",
    items: [
      { id: "di-1", productId: "p1", productName: "Panadol 500mg", orderedQty: 50, orderedUnit: "Box", deliveredQty: 48, batch: "PAN-2026-001", expiry: "2028-06", status: "partial" },
      { id: "di-2", productId: "p2", productName: "Amoxicillin 500mg", orderedQty: 40, orderedUnit: "Box", deliveredQty: 40, batch: "AMX-2026-001", expiry: "2027-12", status: "received" },
      { id: "di-3", productId: "p5", productName: "Omeprazole 20mg", orderedQty: 25, orderedUnit: "Box", deliveredQty: 25, batch: "OMP-2026-001", expiry: "2027-09", status: "received" },
    ],
  },
  {
    id: "del-2",
    poId: "po-2",
    poReference: "PO-2026-002",
    supplierName: "GlobalMed Supply",
    deliveryNote: "DN-2026-018",
    deliveryDate: "2026-02-27",
    notes: "",
    items: [
      { id: "di-4", productId: "p6", productName: "Ibuprofen 400mg", orderedQty: 60, orderedUnit: "Strip", deliveredQty: 60, batch: "IBU-2026-001", expiry: "2028-03", status: "received" },
      { id: "di-5", productId: "p7", productName: "Aspirin 100mg", orderedQty: 80, orderedUnit: "Strip", deliveredQty: 75, batch: "ASP-2026-001", expiry: "2027-08", status: "partial" },
    ],
  },
];

// ─── Mock Invoices ─────────────────────────────────────────────────────────────

export const MOCK_INVOICES: Invoice[] = [
  { id: "inv-1", reference: "INV-2026-015", supplierId: "sup-1", supplierName: "PharmaCo Ltd", date: "2026-01-15", dueDate: "2026-02-14", amount: 45500, paid: 0, status: "overdue", poReference: "PO-2025-015" },
  { id: "inv-2", reference: "INV-2026-018", supplierId: "sup-2", supplierName: "MediPharma", date: "2026-02-01", dueDate: "2026-03-01", amount: 32450, paid: 0, status: "pending", poReference: "PO-2026-003" },
  { id: "inv-3", reference: "INV-2026-020", supplierId: "sup-3", supplierName: "GlobalMed Supply", date: "2026-02-10", dueDate: "2026-03-10", amount: 33063, paid: 33063, status: "paid", poReference: "PO-2026-002" },
  { id: "inv-4", reference: "INV-2026-022", supplierId: "sup-1", supplierName: "PharmaCo Ltd", date: "2026-02-20", dueDate: "2026-03-20", amount: 52325, paid: 20000, status: "partial", poReference: "PO-2026-001" },
  { id: "inv-5", reference: "INV-2026-025", supplierId: "sup-4", supplierName: "EthioHealth", date: "2026-03-05", dueDate: "2026-04-04", amount: 44160, paid: 0, status: "pending", poReference: "PO-2026-005" },
  { id: "inv-6", reference: "INV-2026-028", supplierId: "sup-2", supplierName: "MediPharma", date: "2026-01-05", dueDate: "2026-02-04", amount: 18750, paid: 0, status: "overdue", poReference: "PO-2025-020" },
];

// ─── Mock Reorder Alert Products ───────────────────────────────────────────────

export const REORDER_ALERT_PRODUCTS = [
  { id: "p1", name: "Panadol 500mg", currentStock: 15, threshold: 30, suggestedQty: 50, status: "critical" as const },
  { id: "p11", name: "Amoxicillin 500mg", currentStock: 25, threshold: 25, suggestedQty: 40, status: "low" as const },
  { id: "p12", name: "Vitamin C 1000mg", currentStock: 8, threshold: 20, suggestedQty: 60, status: "critical" as const },
];

// ─── Mock Returns ─────────────────────────────────────────────────────────────

export const MOCK_RETURNS: PurchaseReturn[] = [
  {
    id: "ret-1",
    reference: "RET-2026-001",
    date: "2026-03-01",
    poId: "po-1",
    poReference: "PO-2026-001",
    supplierId: "sup-1",
    supplierName: "PharmaCo Ltd",
    reason: "expired",
    generateDebitNote: true,
    totalValue: 2500,
    items: [
      { id: "ri-1", productName: "Panadol 500mg", brand: "Panadol", originalQty: 50, returnQty: 10, unit: "Box", batch: "PAN-2026-001", reason: "expired", status: "pending" },
    ],
  },
];
