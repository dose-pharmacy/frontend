import {
  MOCK_SUPPLIERS,
  MOCK_REQUIREMENTS,
  MOCK_PURCHASE_ORDERS,
  MOCK_DELIVERIES,
  MOCK_INVOICES,
  MOCK_RETURNS,
  REORDER_ALERT_PRODUCTS,
  type Supplier,
  type PurchaseRequirement,
  type PurchaseOrder,
  type Delivery,
  type Invoice,
  type PurchaseReturn,
} from "./purchasingMock";

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export async function getSuppliers(): Promise<Supplier[]> {
  await delay();
  return [...MOCK_SUPPLIERS];
}

export async function getSupplier(id: string): Promise<Supplier | undefined> {
  await delay(200);
  return MOCK_SUPPLIERS.find((s) => s.id === id);
}

export async function getRequirements(filters?: {
  status?: string;
  priority?: string;
  search?: string;
}): Promise<PurchaseRequirement[]> {
  await delay();
  let result = [...MOCK_REQUIREMENTS];
  if (filters?.status && filters.status !== "all") {
    result = result.filter((r) => r.status === filters.status);
  }
  if (filters?.priority && filters.priority !== "all") {
    result = result.filter((r) => r.priority === filters.priority);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((r) => r.reference.toLowerCase().includes(q) || r.notes.toLowerCase().includes(q));
  }
  return result;
}

export async function getRequirement(id: string): Promise<PurchaseRequirement | undefined> {
  await delay(200);
  return MOCK_REQUIREMENTS.find((r) => r.id === id);
}

export async function getPurchaseOrders(filters?: {
  supplierId?: string;
  status?: string;
  search?: string;
}): Promise<PurchaseOrder[]> {
  await delay();
  let result = [...MOCK_PURCHASE_ORDERS];
  if (filters?.supplierId && filters.supplierId !== "all") {
    result = result.filter((o) => o.supplierId === filters.supplierId);
  }
  if (filters?.status && filters.status !== "all") {
    result = result.filter((o) => o.status === filters.status);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((o) => o.reference.toLowerCase().includes(q) || o.supplierName.toLowerCase().includes(q));
  }
  return result;
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined> {
  await delay(200);
  return MOCK_PURCHASE_ORDERS.find((o) => o.id === id);
}

export async function getDeliveries(): Promise<Delivery[]> {
  await delay();
  return [...MOCK_DELIVERIES];
}

export async function getDelivery(id: string): Promise<Delivery | undefined> {
  await delay(200);
  return MOCK_DELIVERIES.find((d) => d.id === id);
}

export async function getInvoices(filters?: {
  supplierId?: string;
  status?: string;
  search?: string;
}): Promise<Invoice[]> {
  await delay();
  let result = [...MOCK_INVOICES];
  if (filters?.supplierId && filters.supplierId !== "all") {
    result = result.filter((i) => i.supplierId === filters.supplierId);
  }
  if (filters?.status && filters.status !== "all") {
    result = result.filter((i) => i.status === filters.status);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((i) => i.reference.toLowerCase().includes(q) || i.supplierName.toLowerCase().includes(q));
  }
  return result;
}

export async function getReturns(): Promise<PurchaseReturn[]> {
  await delay();
  return [...MOCK_RETURNS];
}

export async function getReorderAlerts() {
  await delay(200);
  return REORDER_ALERT_PRODUCTS;
}

export function fmtMoney(amount: number): string {
  return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

export function fmtDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function nextRef(prefix: string): string {
  const year = new Date().getFullYear();
  const num = String(Math.floor(Math.random() * 900) + 100);
  return `${prefix}-${year}-${num}`;
}
