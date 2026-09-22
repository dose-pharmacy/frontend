import { useCallback, useEffect, useState } from "react";
import { getProduct, type ProductDetailDto, type ProductUnitDto, type UnitRefDto } from "./productsApi";
import { productUnitOptions } from "./unitOptions";
import type { SearchableOption as SO } from "../../components/ui/SearchableSelect";

export interface ProductUnitsState {
  product: ProductDetailDto | null;
  units: ProductUnitDto[];
  baseUnit: UnitRefDto | null;
  /** Picker options (base unit first) for the selected product. */
  options: SO[];
  loading: boolean;
  error: string | null;
  /** Re-fetch the product's unit configuration. */
  refresh: () => void;
}

/**
 * Load the unit configuration for a product (cached by `getProduct` and
 * invalidated on product/stock mutations). Re-resets when `productId` changes
 * and clears when it becomes null.
 */
export function useProductUnits(productId: string | null | undefined): ProductUnitsState {
  const [product, setProduct] = useState<ProductDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setProduct(null);
    setError(null);
    if (!productId) return;

    setLoading(true);
    getProduct(productId)
      .then((p) => {
        if (!cancelled) setProduct(p);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load product units.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId, version]);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  return {
    product,
    units: product?.units ?? [],
    baseUnit: product?.baseUnit ?? null,
    options: product ? productUnitOptions(product) : [],
    loading,
    error,
    refresh,
  };
}