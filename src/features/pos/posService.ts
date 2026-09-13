import { MOCK_POS_PRODUCTS, type POSProduct } from "./posMock";

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export async function searchProducts(query: string, category: string): Promise<POSProduct[]> {
  await delay();
  let list = [...MOCK_POS_PRODUCTS];
  if (category && category !== "all") {
    list = list.filter((p) => p.category === category);
  }
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
    );
  }
  return list;
}

export function fmt(amount: number, currency = "ETB"): string {
  return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}
