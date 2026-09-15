export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
export type BatchStatus = "available" | "low_stock" | "depleted" | "expired";
export type TransactionType = "received" | "transfer" | "sale" | "adjustment" | "opening" | "disposal" | "return";

export interface Product {
  id: string;
  name: string;
  genericName: string;
  brand: string;
  sku: string;
  category: string;
  location: string;
  totalStock: number;
  baseUnit: string;          // e.g. "Tablet", "Capsule", "ml"
  minThreshold: number;
  reorderPoint: number;
  status: StockStatus;
  nearestExpiry: string;     // ISO date
  groupId: string;
  description?: string;
  isActive?: boolean;
}

export interface Batch {
  id: string;
  productId: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  receivedDate: string;
  supplier: string;
  location: string;
  //purchasePrice?: number;
  status: BatchStatus;
 purchaseCost?: number;
  supplierReference?: string;
}

export interface MasterUnit {
  id: string;
  name: string;
  symbol: string;
  description?: string; // Added description property
  productsUsing: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Unit {
  id: string;
  productId: string;
  name: string;
  quantityInParent: number | null;
  parentId: string | null;
  sellPrice: number;
  purchasePrice?: number;
  stock: number;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  productCount: number;
  createdAt: string
  updatedAt: string
}

export interface ProductGroup {
  id: string;
  name: string;
  description: string;
  margin: number;
  productIds: string[];
}

export interface Transaction {
  id: string;
  productId: string;
  batchId: string | null;
  date: string;
  type: TransactionType;
  quantity: number;
  unit: string;
  location: string;
  reference: string;
  user: string;
  balanceAfter: number;
}

export interface BinCardEntry {
  id: string;
  productId: string;
  batchId: string | null;
  date: string;
  reference: string;
  in: number;
  out: number;
  balance: number;
  user: string;
  location: string;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

export const MOCK_PRODUCTS: Product[] = [
  { id: "p1", name: "Amoxicillin 500mg", genericName: "Amoxicillin", brand: "Pharma Plus", sku: "AMX-500", category: "Antibiotics", location: "Main Store", totalStock: 320, baseUnit: "Capsule", minThreshold: 50, reorderPoint: 100, status: "in_stock", nearestExpiry: "2025-08-15", groupId: "g1", description: "Broad-spectrum penicillin antibiotic for bacterial infections.", isActive: true },
  { id: "p2", name: "Paracetamol 500mg", genericName: "Paracetamol", brand: "MediCore", sku: "PCM-500", category: "Analgesics", location: "Dispensing Area", totalStock: 45, baseUnit: "Tablet", minThreshold: 50, reorderPoint: 100, status: "low_stock", nearestExpiry: "2025-06-20", groupId: "g2", description: "Analgesic and antipyretic for pain and fever.", isActive: true },
  { id: "p3", name: "Metformin 850mg", genericName: "Metformin HCl", brand: "GlucoMed", sku: "MET-850", category: "Antidiabetics", location: "Main Store", totalStock: 0, baseUnit: "Tablet", minThreshold: 30, reorderPoint: 60, status: "out_of_stock", nearestExpiry: "2025-12-01", groupId: "g2", description: "First-line medication for type 2 diabetes.", isActive: true },
  { id: "p4", name: "Atorvastatin 20mg", genericName: "Atorvastatin", brand: "CardioLife", sku: "ATV-020", category: "Statins", location: "Main Store", totalStock: 210, baseUnit: "Tablet", minThreshold: 40, reorderPoint: 80, status: "in_stock", nearestExpiry: "2026-03-10", groupId: "g1", description: "Statin medication for lowering cholesterol.", isActive: true },
  { id: "p5", name: "Omeprazole 20mg", genericName: "Omeprazole", brand: "GastroShield", sku: "OMP-020", category: "Antacids", location: "Dispensing Area", totalStock: 18, baseUnit: "Capsule", minThreshold: 30, reorderPoint: 60, status: "low_stock", nearestExpiry: "2025-04-05", groupId: "g3", description: "Proton pump inhibitor for acid reflux and ulcers.", isActive: true },
  { id: "p6", name: "Cetirizine 10mg", genericName: "Cetirizine HCl", brand: "AllerFree", sku: "CTZ-010", category: "Antihistamines", location: "Main Store", totalStock: 500, baseUnit: "Tablet", minThreshold: 60, reorderPoint: 120, status: "in_stock", nearestExpiry: "2026-07-22", groupId: "g3", description: "Second-generation antihistamine for allergy relief.", isActive: true },
  { id: "p7", name: "Ibuprofen 400mg", genericName: "Ibuprofen", brand: "PainAway", sku: "IBU-400", category: "NSAIDs", location: "Main Store", totalStock: 180, baseUnit: "Tablet", minThreshold: 50, reorderPoint: 100, status: "in_stock", nearestExpiry: "2025-09-30", groupId: "g2", description: "Non-steroidal anti-inflammatory for pain and inflammation.", isActive: true },
  { id: "p8", name: "Losartan 50mg", genericName: "Losartan Potassium", brand: "PressureX", sku: "LOS-050", category: "Antihypertensives", location: "Dispensing Area", totalStock: 12, baseUnit: "Tablet", minThreshold: 20, reorderPoint: 50, status: "low_stock", nearestExpiry: "2025-05-18", groupId: "g1", description: "Angiotensin II receptor blocker for hypertension.", isActive: true },
];

export const MOCK_BATCHES: Batch[] = [
  { id: "b1", productId: "p1", batchNumber: "AMX-2024-001", quantity: 200, expiryDate: "2025-08-15", receivedDate: "2024-02-10", supplier: "PharmaCo Ltd", location: "Main Store", purchaseCost: 85.00, status: "available" },
  { id: "b2", productId: "p1", batchNumber: "AMX-2024-002", quantity: 120, expiryDate: "2026-01-20", receivedDate: "2024-06-01", supplier: "PharmaCo Ltd", location: "Main Store", purchaseCost: 87.50, status: "available" },
  { id: "b3", productId: "p2", batchNumber: "PCT-2024-001", quantity: 45, expiryDate: "2025-06-20", receivedDate: "2024-01-15", supplier: "MediSupply", location: "Dispensing Area", purchaseCost: 20.00, status: "low_stock" },
  { id: "b4", productId: "p3", batchNumber: "MET-2023-003", quantity: 0, expiryDate: "2024-11-30", receivedDate: "2023-11-01", supplier: "GlucoMed Inc", location: "Main Store", purchaseCost: 35.00, status: "depleted" },
  { id: "b5", productId: "p4", batchNumber: "ATV-2024-001", quantity: 210, expiryDate: "2026-03-10", receivedDate: "2024-03-05", supplier: "CardioLife", location: "Main Store", purchaseCost: 110.00, status: "available" },
  { id: "b6", productId: "p5", batchNumber: "OMP-2024-001", quantity: 18, expiryDate: "2025-04-05", receivedDate: "2024-01-20", supplier: "GastroSupply", location: "Dispensing Area", purchaseCost: 45.00, status: "low_stock" },
  { id: "b7", productId: "p5", batchNumber: "OMP-2023-002", quantity: 0, expiryDate: "2024-03-01", receivedDate: "2023-03-01", supplier: "GastroSupply", location: "Main Store", purchaseCost: 42.00, status: "expired" },
  { id: "b8", productId: "p8", batchNumber: "LOS-2024-001", quantity: 12, expiryDate: "2025-05-18", receivedDate: "2024-01-08", supplier: "PressureX Ltd", location: "Dispensing Area", purchaseCost: 60.00, status: "low_stock" },
  { id: "b9", productId: "p6", batchNumber: "CTZ-2024-001", quantity: 500, expiryDate: "2026-07-22", receivedDate: "2024-04-10", supplier: "AllerMed Co", location: "Main Store", purchaseCost: 15.00, status: "available" },
  { id: "b10", productId: "p7", batchNumber: "IBU-2024-001", quantity: 180, expiryDate: "2025-09-30", receivedDate: "2024-02-20", supplier: "PainAway Pharma", location: "Main Store", purchaseCost: 28.00, status: "available" },
];

export const MASTER_UNITS: MasterUnit[] = [
  { id: "mu1", name: "Tablet", symbol: "tab", productsUsing: 5, isActive: true },
  { id: "mu2", name: "Capsule", symbol: "cap", productsUsing: 2, isActive: true },
  { id: "mu3", name: "Strip", symbol: "strip", productsUsing: 4, isActive: true },
  { id: "mu4", name: "Box", symbol: "box", productsUsing: 6, isActive: true },
  { id: "mu5", name: "Bottle", symbol: "btl", productsUsing: 1, isActive: true },
  { id: "mu6", name: "Vial", symbol: "vial", productsUsing: 0, isActive: true },
  { id: "mu7", name: "ml", symbol: "ml", productsUsing: 1, isActive: true },
  { id: "mu8", name: "mg", symbol: "mg", productsUsing: 0, isActive: false },
];

export const MOCK_UNITS: Unit[] = [
  // Amoxicillin
  { id: "u1", productId: "p1", name: "Box", quantityInParent: null, parentId: null, sellPrice: 120.00, purchasePrice: 85.00, stock: 32 },
  { id: "u2", productId: "p1", name: "Strip", quantityInParent: 10, parentId: "u1", sellPrice: 12.00, stock: 320 },
  { id: "u3", productId: "p1", name: "Capsule", quantityInParent: 10, parentId: "u2", sellPrice: 1.20, stock: 3200 },
  // Paracetamol
  { id: "u4", productId: "p2", name: "Box", quantityInParent: null, parentId: null, sellPrice: 25.00, purchasePrice: 20.00, stock: 4 },
  { id: "u5", productId: "p2", name: "Strip", quantityInParent: 10, parentId: "u4", sellPrice: 2.50, stock: 45 },
  { id: "u6", productId: "p2", name: "Tablet", quantityInParent: 10, parentId: "u5", sellPrice: 0.25, stock: 450 },
  // Ibuprofen
  { id: "u7", productId: "p7", name: "Box", quantityInParent: null, parentId: null, sellPrice: 35.00, purchasePrice: 28.00, stock: 18 },
  { id: "u8", productId: "p7", name: "Strip", quantityInParent: 10, parentId: "u7", sellPrice: 3.50, stock: 180 },
  // Atorvastatin
  { id: "u9", productId: "p4", name: "Box", quantityInParent: null, parentId: null, sellPrice: 145.00, purchasePrice: 110.00, stock: 21 },
  { id: "u10", productId: "p4", name: "Strip", quantityInParent: 10, parentId: "u9", sellPrice: 14.50, stock: 210 },
  // Cetirizine
  { id: "u11", productId: "p6", name: "Box", quantityInParent: null, parentId: null, sellPrice: 20.00, purchasePrice: 15.00, stock: 50 },
  { id: "u12", productId: "p6", name: "Tablet", quantityInParent: 10, parentId: "u11", sellPrice: 2.00, stock: 500 },
];

export const MOCK_LOCATIONS: Location[] = [
  { id: "loc1", name: "Main Store", description: "Primary storage for bulk inventory", isActive: true, productCount: 6, createdAt: "2023-01-01T00:00:00Z", updatedAt: "2023-01-01T00:00:00Z" },
  { id: "loc2", name: "Dispensing Area", description: "Front-counter dispensing counter stock", isActive: true, productCount: 4, createdAt: "2023-01-01T00:00:00Z", updatedAt: "2023-01-01T00:00:00Z" },
  { id: "loc3", name: "Cold Storage", description: "Refrigerated storage for temperature-sensitive medicines", isActive: true, productCount: 0, createdAt: "2023-01-01T00:00:00Z", updatedAt: "2023-01-01T00:00:00Z" },
  { id: "loc4", name: "Branch 1", description: "Satellite pharmacy branch", isActive: false, productCount: 0, createdAt: "2023-01-01T00:00:00Z", updatedAt: "2023-01-01T00:00:00Z" },
];

export const MOCK_GROUPS: ProductGroup[] = [
  { id: "g1", name: "Prescription Medicines", description: "Medicines requiring a valid prescription", margin: 15, productIds: ["p1", "p4", "p8"] },
  { id: "g2", name: "OTC Medicines", description: "Over-the-counter medicines available without prescription", margin: 20, productIds: ["p2", "p3", "p7"] },
  { id: "g3", name: "Specialty Drugs", description: "Specialized therapeutic medicines", margin: 18, productIds: ["p5", "p6"] },
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  { id: "t1", productId: "p1", batchId: "b1", date: "2024-09-01", type: "received", quantity: 200, unit: "Capsule", location: "Main Store", reference: "PO-2024-001", user: "Admin", balanceAfter: 200 },
  { id: "t2", productId: "p1", batchId: "b1", date: "2024-09-05", type: "sale", quantity: 10, unit: "Capsule", location: "Main Store", reference: "INV-2024-101", user: "Cashier", balanceAfter: 190 },
  { id: "t3", productId: "p1", batchId: "b1", date: "2024-09-10", type: "transfer", quantity: 20, unit: "Capsule", location: "Main Store", reference: "TRF-2024-001", user: "Admin", balanceAfter: 170 },
  { id: "t4", productId: "p1", batchId: "b2", date: "2024-09-15", type: "received", quantity: 120, unit: "Capsule", location: "Main Store", reference: "PO-2024-005", user: "Admin", balanceAfter: 290 },
  { id: "t5", productId: "p1", batchId: "b2", date: "2024-09-20", type: "sale", quantity: 5, unit: "Capsule", location: "Main Store", reference: "INV-2024-200", user: "Cashier", balanceAfter: 285 },
  { id: "t6", productId: "p2", batchId: "b3", date: "2024-09-01", type: "opening", quantity: 100, unit: "Tablet", location: "Dispensing Area", reference: "OPEN-2024-001", user: "Admin", balanceAfter: 100 },
  { id: "t7", productId: "p2", batchId: "b3", date: "2024-09-12", type: "sale", quantity: 55, unit: "Tablet", location: "Dispensing Area", reference: "INV-2024-150", user: "Cashier", balanceAfter: 45 },
  { id: "t8", productId: "p4", batchId: "b5", date: "2024-09-03", type: "received", quantity: 210, unit: "Tablet", location: "Main Store", reference: "PO-2024-003", user: "Admin", balanceAfter: 210 },
  { id: "t9", productId: "p5", batchId: "b6", date: "2024-09-02", type: "received", quantity: 18, unit: "Capsule", location: "Dispensing Area", reference: "PO-2024-004", user: "Admin", balanceAfter: 18 },
  { id: "t10", productId: "p7", batchId: "b10", date: "2024-09-04", type: "received", quantity: 200, unit: "Tablet", location: "Main Store", reference: "PO-2024-006", user: "Admin", balanceAfter: 200 },
  { id: "t11", productId: "p7", batchId: "b10", date: "2024-09-18", type: "sale", quantity: 20, unit: "Tablet", location: "Main Store", reference: "INV-2024-210", user: "Cashier", balanceAfter: 180 },
  { id: "t12", productId: "p8", batchId: "b8", date: "2024-09-08", type: "received", quantity: 12, unit: "Tablet", location: "Dispensing Area", reference: "PO-2024-007", user: "Admin", balanceAfter: 12 },
];

export const MOCK_BIN_CARD: BinCardEntry[] = [
  { id: "bc1", productId: "p1", batchId: null, date: "2024-08-01", reference: "Opening Balance", in: 0, out: 0, balance: 0, user: "System", location: "Main Store" },
  { id: "bc2", productId: "p1", batchId: "b1", date: "2024-09-01", reference: "PO-2024-001", in: 200, out: 0, balance: 200, user: "Admin", location: "Main Store" },
  { id: "bc3", productId: "p1", batchId: "b1", date: "2024-09-05", reference: "INV-2024-101", in: 0, out: 10, balance: 190, user: "Cashier", location: "Main Store" },
  { id: "bc4", productId: "p1", batchId: "b1", date: "2024-09-10", reference: "TRF-2024-001", in: 0, out: 20, balance: 170, user: "Admin", location: "Main Store" },
  { id: "bc5", productId: "p1", batchId: "b2", date: "2024-09-15", reference: "PO-2024-005", in: 120, out: 0, balance: 290, user: "Admin", location: "Main Store" },
  { id: "bc6", productId: "p1", batchId: "b2", date: "2024-09-20", reference: "INV-2024-200", in: 0, out: 5, balance: 285, user: "Cashier", location: "Main Store" },
];

export const LOCATION_STOCK = [
  { productId: "p1", productName: "Amoxicillin 500mg", mainStore: 220, dispensingArea: 100 },
  { productId: "p2", productName: "Paracetamol 500mg", mainStore: 0, dispensingArea: 45 },
  { productId: "p4", productName: "Atorvastatin 20mg", mainStore: 210, dispensingArea: 0 },
  { productId: "p5", productName: "Omeprazole 20mg", mainStore: 0, dispensingArea: 18 },
  { productId: "p6", productName: "Cetirizine 10mg", mainStore: 500, dispensingArea: 0 },
  { productId: "p7", productName: "Ibuprofen 400mg", mainStore: 180, dispensingArea: 0 },
  { productId: "p8", productName: "Losartan 50mg", mainStore: 0, dispensingArea: 12 },
];

export const REORDER_DATA = [
  { productId: "p2", productName: "Paracetamol 500mg", currentStock: 45, threshold: 50, velocity: 8.5, suggestedQty: 200, avgDailySales: 8.5, leadTime: 3, urgency: "critical" as const },
  { productId: "p5", productName: "Omeprazole 20mg", currentStock: 18, threshold: 30, velocity: 3.2, suggestedQty: 100, avgDailySales: 3.2, leadTime: 5, urgency: "critical" as const },
  { productId: "p8", productName: "Losartan 50mg", currentStock: 12, threshold: 20, velocity: 2.1, suggestedQty: 60, avgDailySales: 2.1, leadTime: 4, urgency: "critical" as const },
  { productId: "p3", productName: "Metformin 850mg", currentStock: 0, threshold: 30, velocity: 4.0, suggestedQty: 120, avgDailySales: 4.0, leadTime: 3, urgency: "critical" as const },
];
