// ── POS API client ───────────────────────────────────────────────────────────
// Talks to the pharmacy backend's point-of-sale product endpoint:
//   GET /api/v1/pos/products   (active, sellable products with their units)
//
// All requests require the authenticated session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";
import type { POSProduct, POSUnit } from "./posMock";

// ─── Types (mirror the backend response) ─────────────────────────────────────

export interface PosUnitDto {
  /** Master Unit id — this is the `unitId` the sale endpoint expects. */
  id: string;
  /** Master unit id (Unit table). */
  unitId: string;
  unitName: string;
  unitSymbol: string;
  conversionFactor: number;
  /** Selling price for this unit — backend-configured, never derived. */
  sellPrice: number;
  isBaseUnit: boolean;
}

export interface PosProductDto {
  id: string;
  name: string;
  genericName?: string | null;
  brand?: string | null;
  sku?: string | null;
  productGroup?: { id: string; name: string } | null;
  baseUnit: { id: string; name: string; symbol?: string } | null;
  units: PosUnitDto[];
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | (string & {});
  isActive: boolean;
}

export interface PosProductsMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PosProductsQuery {
  page?: number;
  limit?: number;
  search?: string;
  brand?: string;
  productGroupId?: string;
  locationId?: string;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class PosApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "PosApiError";
    this.status = status;
  }
}

function friendlyStatusMessage(status: number): string {
  switch (status) {
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to use the point of sale.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const POS_PRODUCTS_URL = `${API_BASE_URL}/api/v1/pos/products`;

/** GET /pos/products — paginated, filterable sellable products for the POS. */
export async function getPosProducts(
  query: PosProductsQuery = {},
): Promise<{ data: PosProductDto[]; meta: PosProductsMeta }> {
  let res: Response;
  try {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({
      page: query.page,
      limit: query.limit,
      search: query.search,
      brand: query.brand,
      productGroupId: query.productGroupId,
      locationId: query.locationId,
    })) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    res = await fetch(`${POS_PRODUCTS_URL}${qs ? `?${qs}` : ""}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new PosApiError(
      "Cannot reach the server. Please check your connection and try again.",
    );
  }

  if (!res.ok) {
    let message = friendlyStatusMessage(res.status);
    try {
      const body = (await res.json()) as { error?: { message?: string }; message?: string } | null;
      if (body?.error?.message) message = body.error.message;
      else if (body?.message) message = body.message;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new PosApiError(message, res.status);
  }

  try {
    const body = (await res.json()) as {
      success: boolean;
      data: PosProductDto[];
      meta: PosProductsMeta;
    } | null;
    return {
      data: body?.data ?? [],
      meta: body?.meta ?? { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    };
  } catch {
    throw new PosApiError("Unexpected response from the server.");
  }
}

// ─── UI adapters ─────────────────────────────────────────────────────────────

function toUiStatus(
  status: PosProductDto["stockStatus"],
  availableStock: number,
): "in_stock" | "low_stock" | "out_of_stock" {
  if (status === "OUT_OF_STOCK" || availableStock <= 0) return "out_of_stock";
  if (status === "LOW_STOCK") return "low_stock";
  return "in_stock";
}

/**
 * Adapt a backend POS product DTO to the UI's `POSProduct` shape.
 *
 * IMPORTANT — unit ID mapping:
 *   The backend's `saleItemSchema` expects `unitId` = the master Unit id
 *   (dto.units[n].unitId), NOT the ProductUnit row id (dto.units[n].id).
 *   We store that as `POSUnit.id` so the cart and sale submission always
 *   send the right identifier.
 */
export function adaptPosProduct(dto: PosProductDto): POSProduct {
  return {
    id: dto.id,
    name: dto.name,
    genericName: dto.genericName ?? undefined,
    brand: dto.brand || "—",
    sku: dto.sku ?? undefined,
    productGroup: dto.productGroup ?? null,
    category: dto.productGroup?.id ?? "",
    status: toUiStatus(dto.stockStatus, dto.availableStock),
    availableStock: dto.availableStock,
    units: dto.units.map((u): POSUnit => ({
      id: u.unitId,           // master Unit id — used as unitId in sale
      unitId: u.unitId,       // master Unit id
      name: u.unitName,
      price: u.sellPrice,
      conversionFactor: u.conversionFactor,
      isBaseUnit: u.isBaseUnit,
      // Stock is in base units; non-base units get a derived figure.
      stock: u.isBaseUnit
        ? dto.availableStock
        : Math.floor(dto.availableStock / u.conversionFactor),
    })),
    icon: "pill",
  };
}
