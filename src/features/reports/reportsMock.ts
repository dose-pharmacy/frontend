// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductGroup {
  id: string;
  name: string;
  productCount: number;
  avgMargin: number;
  defaultMargin: number;
  minMargin: number;
  maxMargin: number;
  calcMethod: "auto" | "reference";
}

export interface MarginProduct {
  id: string;
  name: string;
  brand: string;
  costPrice: number;
  currentSellPrice: number;
  currentMargin: number;
  groupId: string;
}

export interface BrandPerf {
  brand: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  trend: number;
}

export interface GroupPerf {
  group: string;
  sales: number;
  profit: number;
  margin: number;
  performance: "top" | "growing" | "stable" | "review";
}

export interface DailySale {
  period: string;
  transactions: number;
  totalSales: number;
  tax: number;
  netSales: number;
  avgTransaction: number;
  growth: number;
}

export interface SlowProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  stockQty: number;
  stockUnit: string;
  daysInStock: number;
  unitsSold: number;
  turnoverRate: number;
  status: "slow" | "dead" | "moderate";
  stockValue: number;
}

export interface RecentReport {
  name: string;
  type: string;
  generatedBy: string;
  date: string;
}

// ─── Product Groups ────────────────────────────────────────────────────────────

export const MOCK_PRODUCT_GROUPS: ProductGroup[] = [
  { id: "g1", name: "Painkillers", productCount: 245, avgMargin: 15.2, defaultMargin: 15, minMargin: 10, maxMargin: 25, calcMethod: "auto" },
  { id: "g2", name: "Antibiotics", productCount: 180, avgMargin: 18.5, defaultMargin: 18, minMargin: 12, maxMargin: 28, calcMethod: "auto" },
  { id: "g3", name: "Vitamins", productCount: 120, avgMargin: 22.0, defaultMargin: 22, minMargin: 15, maxMargin: 35, calcMethod: "auto" },
  { id: "g4", name: "Supplements", productCount: 95, avgMargin: 12.5, defaultMargin: 12, minMargin: 8, maxMargin: 20, calcMethod: "reference" },
  { id: "g5", name: "Medical Devices", productCount: 60, avgMargin: 30.0, defaultMargin: 30, minMargin: 20, maxMargin: 45, calcMethod: "auto" },
];

export const MOCK_MARGIN_PRODUCTS: MarginProduct[] = [
  { id: "mp1", name: "Panadol 500mg", brand: "Panadol", costPrice: 200, currentSellPrice: 250, currentMargin: 20, groupId: "g1" },
  { id: "mp2", name: "Advil 200mg", brand: "Advil", costPrice: 180, currentSellPrice: 210, currentMargin: 14.3, groupId: "g1" },
  { id: "mp3", name: "Aspirin 100mg", brand: "Bayer", costPrice: 90, currentSellPrice: 105, currentMargin: 14.3, groupId: "g1" },
  { id: "mp4", name: "Ibuprofen 400mg", brand: "Brufen", costPrice: 150, currentSellPrice: 180, currentMargin: 16.7, groupId: "g1" },
  { id: "mp5", name: "Diclofenac 50mg", brand: "Voltaren", costPrice: 220, currentSellPrice: 260, currentMargin: 15.4, groupId: "g1" },
];

// ─── Profitability Data ────────────────────────────────────────────────────────

export const MOCK_BRAND_PERF: BrandPerf[] = [
  { brand: "Panadol", revenue: 245500, cost: 175200, profit: 70300, margin: 28.6, trend: 5.2 },
  { brand: "Advil", revenue: 189200, cost: 145600, profit: 43600, margin: 23.0, trend: 2.1 },
  { brand: "Cecon", revenue: 167800, cost: 128400, profit: 39400, margin: 23.5, trend: -1.2 },
  { brand: "Amoxil", revenue: 143500, cost: 112600, profit: 30900, margin: 21.5, trend: 3.8 },
  { brand: "Centrum", revenue: 108700, cost: 87300, profit: 21400, margin: 19.7, trend: -0.5 },
];

export const MOCK_GROUP_PERF: GroupPerf[] = [
  { group: "Painkillers", sales: 425500, profit: 98250, margin: 23.1, performance: "top" },
  { group: "Antibiotics", sales: 312800, profit: 68200, margin: 21.8, performance: "growing" },
  { group: "Vitamins", sales: 289400, profit: 55100, margin: 19.0, performance: "stable" },
  { group: "Supplements", sales: 218050, profit: 32860, margin: 15.1, performance: "review" },
  { group: "Medical Devices", sales: 85000, profit: 26200, margin: 30.8, performance: "top" },
];

export const MARGIN_TREND_DATA = [
  { month: "Sep", overall: 25.2, painkillers: 26.1, antibiotics: 22.3, vitamins: 20.5 },
  { month: "Oct", overall: 26.0, painkillers: 27.0, antibiotics: 23.0, vitamins: 21.0 },
  { month: "Nov", overall: 25.8, painkillers: 26.5, antibiotics: 22.8, vitamins: 20.8 },
  { month: "Dec", overall: 27.2, painkillers: 28.0, antibiotics: 24.0, vitamins: 21.5 },
  { month: "Jan", overall: 27.5, painkillers: 28.3, antibiotics: 23.5, vitamins: 22.0 },
  { month: "Feb", overall: 28.4, painkillers: 29.0, antibiotics: 24.2, vitamins: 22.5 },
];

export const REVENUE_BY_GROUP = [
  { name: "Painkillers", value: 425500, pct: 35 },
  { name: "Antibiotics", value: 312800, pct: 25 },
  { name: "Vitamins", value: 289400, pct: 20 },
  { name: "Supplements", value: 218050, pct: 15 },
  { name: "Medical Devices", value: 85000, pct: 5 },
];

// ─── Sales Data ────────────────────────────────────────────────────────────────

export const MOCK_DAILY_SALES: DailySale[] = [
  { period: "Feb 28, 2026", transactions: 127, totalSales: 45750, tax: 5962.5, netSales: 39787.5, avgTransaction: 360.24, growth: 12.5 },
  { period: "Feb 27, 2026", transactions: 118, totalSales: 42300, tax: 5508.7, netSales: 36791.3, avgTransaction: 358.47, growth: -3.2 },
  { period: "Feb 26, 2026", transactions: 132, totalSales: 48950, tax: 6378.26, netSales: 42571.74, avgTransaction: 370.83, growth: 8.1 },
  { period: "Feb 25, 2026", transactions: 109, totalSales: 39200, tax: 5104.35, netSales: 34095.65, avgTransaction: 359.63, growth: -5.1 },
  { period: "Feb 24, 2026", transactions: 141, totalSales: 51800, tax: 6747.83, netSales: 45052.17, avgTransaction: 367.38, growth: 15.2 },
  { period: "Feb 23, 2026", transactions: 98, totalSales: 35600, tax: 4634.78, netSales: 30965.22, avgTransaction: 363.27, growth: 2.3 },
  { period: "Feb 22, 2026", transactions: 115, totalSales: 41500, tax: 5402.17, netSales: 36097.83, avgTransaction: 360.87, growth: 6.4 },
];

export const SALES_TREND_DATA = [
  { date: "Feb 1", sales: 38200 },
  { date: "Feb 5", sales: 42100 },
  { date: "Feb 8", sales: 39500 },
  { date: "Feb 12", sales: 48900 },
  { date: "Feb 15", sales: 44300 },
  { date: "Feb 18", sales: 51200 },
  { date: "Feb 20", sales: 43600 },
  { date: "Feb 22", sales: 41500 },
  { date: "Feb 24", sales: 51800 },
  { date: "Feb 26", sales: 48950 },
  { date: "Feb 28", sales: 45750 },
];

export const SALES_BY_CATEGORY = [
  { name: "Painkillers", value: 35, sales: 16012, color: "#49B0C1" },
  { name: "Antibiotics", value: 25, sales: 11437, color: "#28A745" },
  { name: "Vitamins", value: 20, sales: 9150, color: "#FFC107" },
  { name: "Supplements", value: 12, sales: 5490, color: "#6F42C1" },
  { name: "Medical Devices", value: 8, sales: 3660, color: "#DC3545" },
];

export const TOP_PRODUCTS = [
  { product: "Panadol", sales: 4500 },
  { product: "Advil", sales: 3200 },
  { product: "Amoxicillin", sales: 2800 },
  { product: "Vitamin C", sales: 2100 },
  { product: "Ibuprofen", sales: 1900 },
];

export const HOURLY_SALES = [
  { hour: "8 AM", txn: 8 },
  { hour: "9 AM", txn: 14 },
  { hour: "10 AM", txn: 22 },
  { hour: "11 AM", txn: 28 },
  { hour: "12 PM", txn: 25 },
  { hour: "1 PM", txn: 18 },
  { hour: "2 PM", txn: 15 },
  { hour: "3 PM", txn: 12 },
  { hour: "4 PM", txn: 16 },
  { hour: "5 PM", txn: 20 },
  { hour: "6 PM", txn: 19 },
  { hour: "7 PM", txn: 14 },
  { hour: "8 PM", txn: 9 },
];

// ─── Stock Performance ─────────────────────────────────────────────────────────

export const MOCK_SLOW_PRODUCTS: SlowProduct[] = [
  { id: "sp1", name: "Vitamin C 1000mg", brand: "Cecon", category: "Vitamins", stockQty: 150, stockUnit: "Box", daysInStock: 85, unitsSold: 12, turnoverRate: 0.14, status: "slow", stockValue: 37500 },
  { id: "sp2", name: "Amoxicillin 250mg", brand: "Amoxil", category: "Antibiotics", stockQty: 200, stockUnit: "Box", daysInStock: 195, unitsSold: 3, turnoverRate: 0.015, status: "dead", stockValue: 42000 },
  { id: "sp3", name: "Multivitamin Tablets", brand: "Centrum", category: "Supplements", stockQty: 45, stockUnit: "Bottle", daysInStock: 42, unitsSold: 18, turnoverRate: 0.43, status: "moderate", stockValue: 9900 },
  { id: "sp4", name: "Zinc Supplement 50mg", brand: "ZinCare", category: "Supplements", stockQty: 80, stockUnit: "Bottle", daysInStock: 130, unitsSold: 5, turnoverRate: 0.063, status: "dead", stockValue: 8400 },
  { id: "sp5", name: "Cough Syrup 200ml", brand: "Tussin", category: "Cough & Cold", stockQty: 60, stockUnit: "Bottle", daysInStock: 72, unitsSold: 8, turnoverRate: 0.11, status: "slow", stockValue: 10200 },
  { id: "sp6", name: "Eye Drops 10ml", brand: "Visine", category: "Ophthalmic", stockQty: 35, stockUnit: "Bottle", daysInStock: 50, unitsSold: 15, turnoverRate: 0.30, status: "moderate", stockValue: 5250 },
];

export const TURNOVER_BY_CATEGORY = [
  { category: "Painkillers", rate: 8.2 },
  { category: "Antibiotics", rate: 6.5 },
  { category: "Vitamins", rate: 4.3 },
  { category: "Supplements", rate: 3.1 },
  { category: "Medical Devices", rate: 1.8 },
];

export const DEAD_STOCK_TREND = [
  { month: "Sep", value: 28000 },
  { month: "Oct", value: 35000 },
  { month: "Nov", value: 41000 },
  { month: "Dec", value: 52000 },
  { month: "Jan", value: 60000 },
  { month: "Feb", value: 67450 },
];

// ─── Recent Reports ────────────────────────────────────────────────────────────

export const RECENT_REPORTS: RecentReport[] = [
  { name: "February Sales Report", type: "Sales", generatedBy: "John", date: "Feb 28, 2026" },
  { name: "Slow-Moving Inventory", type: "Inventory", generatedBy: "Sarah", date: "Feb 27, 2026" },
  { name: "Profit Margin Analysis", type: "Financial", generatedBy: "John", date: "Feb 26, 2026" },
  { name: "Supplier Performance", type: "Purchasing", generatedBy: "Sara", date: "Feb 25, 2026" },
  { name: "Monthly Expense Report", type: "Financial", generatedBy: "Admin", date: "Feb 24, 2026" },
];
