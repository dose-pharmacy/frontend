import { useState, useCallback } from "react";
import type { POSProduct, POSUnit } from "./posMock";
import { TAX_RATE } from "./posMock";

export interface CartItem {
  id: string; // unique per line
  product: POSProduct;
  unit: POSUnit;
  quantity: number;
  unitPrice: number;
  discount: number; // 0–100 percentage
}

export interface CartState {
  items: CartItem[];
  billDiscount: number; // 0–100 percentage applied to whole bill
}

function lineTotal(item: CartItem): number {
  const subtotal = item.unitPrice * item.quantity;
  return subtotal * (1 - item.discount / 100);
}

export function useCart() {
  const [cart, setCart] = useState<CartState>({ items: [], billDiscount: 0 });

  const addItem = useCallback((product: POSProduct, unit: POSUnit, quantity: number) => {
    setCart((prev) => {
      const existing = prev.items.findIndex(
        (i) => i.product.id === product.id && i.unit.id === unit.id
      );
      if (existing >= 0) {
        return {
          ...prev,
          items: prev.items.map((item, idx) =>
            idx === existing
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
        discount: 0,
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

  const applyItemDiscount = useCallback((id: string, discount: number) => {
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === id ? { ...i, discount } : i)),
    }));
  }, []);

  const applyBillDiscount = useCallback((pct: number) => {
    setCart((prev) => ({ ...prev, billDiscount: pct }));
  }, []);

  const clearCart = useCallback(() => {
    setCart({ items: [], billDiscount: 0 });
  }, []);

  // Derived totals
  const subtotal = cart.items.reduce((sum, item) => sum + lineTotal(item), 0);
  const discountAmount = subtotal * (cart.billDiscount / 100);
  const afterDiscount = subtotal - discountAmount;
  const tax = afterDiscount * TAX_RATE;
  const total = afterDiscount + tax;

  return {
    cart,
    addItem,
    updateQuantity,
    removeItem,
    applyItemDiscount,
    applyBillDiscount,
    clearCart,
    subtotal,
    discountAmount,
    tax,
    total,
    lineTotal,
  };
}
