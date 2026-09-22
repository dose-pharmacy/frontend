export type POSStockStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface POSUnit {
  id: string;      // master Unit ID used as `unitId` when creating a sale
  unitId: string;  // master Unit ID
  name: string;
  price: number;
  conversionFactor: number;
  isBaseUnit: boolean;
  stock: number;   // availableStock in base units
}

export interface POSProduct {
  id: string;
  name: string;
  genericName?: string;
  brand: string;
  sku?: string;
  productGroup?: { id: string; name: string } | null;
  category: string;
  status: POSStockStatus;
  availableStock: number; // base-unit stock
  units: POSUnit[];
  icon: "pill" | "box" | "drop" | "shield" | "heart";
  /** Narcotic/controlled product flag — backend-authoritative, never inferred. */
  isNarcotic: boolean;
}

// TAX_RATE is intentionally 0 — the backend sale schema has no tax field.
// Total = subtotal − billDiscount. Do NOT add tax on the frontend.
export const TAX_RATE = 0;
export const MAX_DISCOUNT_PCT = 100;
export const CURRENCY = "ETB";
