export type POSStockStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface POSUnit {
  id: string;
  name: string;
  price: number;
  quantityInParent: number | null;
  parentId: string | null;
  stock: number;
}

export interface POSProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  status: POSStockStatus;
  units: POSUnit[];
  icon: "pill" | "box" | "drop" | "shield" | "heart";
}

export const CATEGORIES = [
  { id: "all", label: "All Products", icon: "grid" },
  { id: "painkillers", label: "Painkillers", icon: "pill" },
  { id: "antibiotics", label: "Antibiotics", icon: "flask" },
  { id: "vitamins", label: "Vitamins", icon: "drop" },
  { id: "supplements", label: "Supplements", icon: "shield" },
  { id: "devices", label: "Devices", icon: "heart" },
] as const;

export const MOCK_POS_PRODUCTS: POSProduct[] = [
  {
    id: "pp1", name: "Panadol 500mg", brand: "GSK", category: "painkillers", status: "in_stock", icon: "pill",
    units: [
      { id: "u1a", name: "Box", price: 250.00, quantityInParent: null, parentId: null, stock: 48 },
      { id: "u1b", name: "Strip", price: 25.00, quantityInParent: 10, parentId: "u1a", stock: 480 },
      { id: "u1c", name: "Tablet", price: 2.50, quantityInParent: 10, parentId: "u1b", stock: 4800 },
    ],
  },
  {
    id: "pp2", name: "Amoxicillin 500mg", brand: "Pharma Plus", category: "antibiotics", status: "in_stock", icon: "pill",
    units: [
      { id: "u2a", name: "Box", price: 120.00, quantityInParent: null, parentId: null, stock: 32 },
      { id: "u2b", name: "Strip", price: 12.00, quantityInParent: 10, parentId: "u2a", stock: 320 },
      { id: "u2c", name: "Capsule", price: 1.20, quantityInParent: 10, parentId: "u2b", stock: 3200 },
    ],
  },
  {
    id: "pp3", name: "Vitamin C 500mg", brand: "NaturePlus", category: "vitamins", status: "in_stock", icon: "drop",
    units: [
      { id: "u3a", name: "Bottle (60 tabs)", price: 180.00, quantityInParent: null, parentId: null, stock: 25 },
      { id: "u3b", name: "Tablet", price: 3.00, quantityInParent: 60, parentId: "u3a", stock: 1500 },
    ],
  },
  {
    id: "pp4", name: "Omeprazole 20mg", brand: "GastroShield", category: "painkillers", status: "low_stock", icon: "pill",
    units: [
      { id: "u4a", name: "Box", price: 85.00, quantityInParent: null, parentId: null, stock: 3 },
      { id: "u4b", name: "Capsule", price: 8.50, quantityInParent: 10, parentId: "u4a", stock: 30 },
    ],
  },
  {
    id: "pp5", name: "Ibuprofen 400mg", brand: "PainAway", category: "painkillers", status: "in_stock", icon: "pill",
    units: [
      { id: "u5a", name: "Box", price: 65.00, quantityInParent: null, parentId: null, stock: 55 },
      { id: "u5b", name: "Strip", price: 6.50, quantityInParent: 10, parentId: "u5a", stock: 550 },
      { id: "u5c", name: "Tablet", price: 0.65, quantityInParent: 10, parentId: "u5b", stock: 5500 },
    ],
  },
  {
    id: "pp6", name: "Atorvastatin 20mg", brand: "CardioLife", category: "supplements", status: "in_stock", icon: "shield",
    units: [
      { id: "u6a", name: "Box", price: 320.00, quantityInParent: null, parentId: null, stock: 18 },
      { id: "u6b", name: "Tablet", price: 32.00, quantityInParent: 10, parentId: "u6a", stock: 180 },
    ],
  },
  {
    id: "pp7", name: "Cetirizine 10mg", brand: "AllerFree", category: "painkillers", status: "in_stock", icon: "pill",
    units: [
      { id: "u7a", name: "Box", price: 45.00, quantityInParent: null, parentId: null, stock: 40 },
      { id: "u7b", name: "Tablet", price: 4.50, quantityInParent: 10, parentId: "u7a", stock: 400 },
    ],
  },
  {
    id: "pp8", name: "Losartan 50mg", brand: "PressureX", category: "supplements", status: "low_stock", icon: "heart",
    units: [
      { id: "u8a", name: "Box", price: 380.00, quantityInParent: null, parentId: null, stock: 2 },
      { id: "u8b", name: "Tablet", price: 38.00, quantityInParent: 10, parentId: "u8a", stock: 20 },
    ],
  },
  {
    id: "pp9", name: "Metformin 850mg", brand: "GlucoMed", category: "supplements", status: "out_of_stock", icon: "pill",
    units: [
      { id: "u9a", name: "Box", price: 95.00, quantityInParent: null, parentId: null, stock: 0 },
    ],
  },
  {
    id: "pp10", name: "Blood Pressure Monitor", brand: "HealthTech", category: "devices", status: "in_stock", icon: "heart",
    units: [
      { id: "u10a", name: "Unit", price: 1200.00, quantityInParent: null, parentId: null, stock: 5 },
    ],
  },
  {
    id: "pp11", name: "Omega-3 Fish Oil", brand: "OceanHealth", category: "supplements", status: "in_stock", icon: "drop",
    units: [
      { id: "u11a", name: "Bottle (90 caps)", price: 450.00, quantityInParent: null, parentId: null, stock: 12 },
      { id: "u11b", name: "Capsule", price: 5.00, quantityInParent: 90, parentId: "u11a", stock: 1080 },
    ],
  },
  {
    id: "pp12", name: "Multivitamin Complete", brand: "VitaMax", category: "vitamins", status: "in_stock", icon: "drop",
    units: [
      { id: "u12a", name: "Bottle (30 tabs)", price: 320.00, quantityInParent: null, parentId: null, stock: 20 },
      { id: "u12b", name: "Tablet", price: 10.67, quantityInParent: 30, parentId: "u12a", stock: 600 },
    ],
  },
];

export const TAX_RATE = 0.15;
export const MAX_DISCOUNT_PCT = 15;
export const CURRENCY = "ETB";
