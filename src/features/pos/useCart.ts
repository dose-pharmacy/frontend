import { useState, useCallback } from "react";
import type { POSProduct, POSUnit } from "./posMock";

export interface CartItem {
  id: string;         // unique per line (product+unit+timestamp)
  product: POSProduct;
  unit: POSUnit;
  quantity: number;
  unitPrice: number;  // always from unit.price (backend sell price)
}

export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

export interface BillDiscount {
  type: DiscountType;
  value: number;
}

export interface CartState {
  items: CartItem[];
  billDiscount: BillDiscount | null;
}

export function lineTotal(item: CartItem): number {
  return item.unitPrice * item.quantity;
}

export function useCart() {
  const [cart, setCart] = useState<CartState>({ items: [], billDiscount: null });

  const addItem = useCallback((product: POSProduct, unit: POSUnit, quantity: number) => {
    setCart((prev) => {
      const existingIdx = prev.items.findIndex(
        (i) => i.product.id === product.id && i.unit.id === unit.id
      );
      if (existingIdx >= 0) {
        return {
          ...prev,
          items: prev.items.map((item, idx) =>
            idx === existingIdx
              ? { ...item, quantity: item.quantity + quantity }
              : item
          ),
        };
      }
      const newItem: CartItem = {
        id: `${product.id}-${unit.id}-${Date.now()}`,
        product,
        unit,
        quantity,
        unitPrice: unit.price,
      };
      return { ...prev, items: [...prev.items, newItem] };
    });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) }));
    } else {
      setCart((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
      }));
    }
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) }));
  }, []);

  const setBillDiscount = useCallback((discount: BillDiscount | null) => {
    setCart((prev) => ({ ...prev, billDiscount: discount }));
  }, []);

  const clearCart = useCallback(() => {
    setCart({ items: [], billDiscount: null });
  }, []);

  // Derived totals — NO TAX (backend Sale schema has no tax field)
  const subtotal = cart.items.reduce((sum, item) => sum + lineTotal(item), 0);

  let discountAmount = 0;
  if (cart.billDiscount && cart.billDiscount.value > 0) {
    if (cart.billDiscount.type === "PERCENTAGE") {
      discountAmount = subtotal * (cart.billDiscount.value / 100);
    } else {
      discountAmount = Math.min(cart.billDiscount.value, subtotal);
    }
  }
  const total = Math.max(0, subtotal - discountAmount);

  return {
    cart,
    addItem,
    updateQuantity,
    removeItem,
    setBillDiscount,
    clearCart,
    subtotal,
    discountAmount,
    total,
    lineTotal,
  };
}
