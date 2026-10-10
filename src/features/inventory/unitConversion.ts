// ── Pure unit-conversion helpers ─────────────────────────────────────────────
// Small, testable functions for converting between a product's order units and
// its base unit during purchasing. Money values are always rounded to 2
// decimal places so floating-point drift never leaks into line totals.

/** Round a money value to 2 decimal places (safe against FP drift). */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Base-unit equivalent of `quantity` expressed in a unit whose
 * `conversionFactor` is given (base units per one of that unit — the base
 * unit itself has factor 1, so it is a no-op for base-unit orders).
 */
export function toBaseQuantity(quantity: number, conversionFactor: number): number {
  return quantity * conversionFactor;
}

/** Commercial line total = quantity × unit price, rounded to cents. */
export function lineTotal(quantity: number, unitPrice: number): number {
  return roundMoney(quantity * unitPrice);
}