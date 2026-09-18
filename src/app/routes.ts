import { createBrowserRouter, redirect } from "react-router";
import AuthLayout from "../layouts/AuthLayout";
import ProtectedLayout from "../layouts/ProtectedLayout";
import AppLayout from "../layouts/AppLayout";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import DashboardPage from "../pages/DashboardPage";
import InventoryDashboardPage from "../pages/inventory/InventoryDashboardPage";
import ProductsPage from "../pages/inventory/ProductsPage";
import ProductDetailPage from "../pages/inventory/ProductDetailPage";
import ProductGroupsPage from "../pages/inventory/ProductGroupsPage";
import UnitConfigPage from "../pages/inventory/UnitConfigPage";
import BatchManagementPage from "../pages/inventory/BatchManagementPage";
import BatchDetailPage from "../pages/inventory/BatchDetailPage";
import BatchesExpiryPage from "../pages/inventory/BatchesExpiryPage";
import ExpiryDashboardPage from "../pages/inventory/ExpiryDashboardPage";
import StockTransferPage from "../pages/inventory/StockTransferPage";
import StockPage from "../pages/inventory/StockPage";
import LocationsPage from "../pages/inventory/LocationsPage";
import LocationStockPage from "../pages/inventory/LocationStockPage";
import BinCardPage from "../pages/inventory/BinCardPage";
import ReorderManagementPage from "../pages/inventory/ReorderManagementPage";
import ReorderConfigPage from "../pages/inventory/ReorderConfigPage";
import POSPage from "../pages/pos/POSPage";
import SalesPage from "../pages/sales/SalesPage";
import PurchaseRequirementsPage from "../pages/purchasing/PurchaseRequirementsPage";
import CreateRequirementPage from "../pages/purchasing/CreateRequirementPage";
import SupplierAssignmentPage from "../pages/purchasing/SupplierAssignmentPage";
//import SupplierDetailPage from "../pages/purchasing/SupplierDetailPage";
import PurchaseOrdersPage from "../pages/purchasing/PurchaseOrdersPage";
import CreatePurchaseOrderPage from "../pages/purchasing/CreatePurchaseOrderPage";
import DeliveryRegistrationPage from "../pages/purchasing/DeliveryRegistrationPage";
import ReconciliationPage from "../pages/purchasing/ReconciliationPage";
import SupplierPayablesPage from "../pages/purchasing/SupplierPayablesPage";
import PurchaseReturnPage from "../pages/purchasing/PurchaseReturnPage";
import ReportsDashboardPage from "../pages/reports/ReportsDashboardPage";
import ProfitMarginConfigPage from "../pages/reports/ProfitMarginConfigPage";
import ProfitabilityDashboardPage from "../pages/reports/ProfitabilityDashboardPage";
import StockPerformancePage from "../pages/reports/StockPerformancePage";
import SalesReportPage from "../pages/reports/SalesReportPage";
import AuditTrailPage from "../pages/reports/AuditTrailPage";

export const router = createBrowserRouter([
  {
    path: "/",
    loader: () => redirect("/login"),
  },
  {
    Component: AuthLayout,
    children: [
      { path: "/login", Component: LoginPage },
      { path: "/signup", Component: SignupPage },
    ],
  },
  {
    Component: ProtectedLayout,
    children: [
      {
        Component: AppLayout,
        children: [
          { path: "/dashboard", Component: DashboardPage },
          // Inventory
          { path: "/inventory", Component: InventoryDashboardPage },
          { path: "/inventory/products", Component: ProductsPage },
          { path: "/inventory/products/:productId", Component: ProductDetailPage },
          { path: "/inventory/stock", Component: StockPage },
          { path: "/inventory/locations", Component: LocationsPage },
          { path: "/inventory/groups", Component: ProductGroupsPage },
          { path: "/inventory/units", Component: UnitConfigPage },
          { path: "/inventory/batches-expiry", Component: BatchesExpiryPage },
          { path: "/inventory/batches", Component: BatchManagementPage },
          { path: "/inventory/batches/:batchId", Component: BatchDetailPage },
          { path: "/inventory/expiry", Component: ExpiryDashboardPage },
          { path: "/inventory/transfers", Component: StockTransferPage },
          { path: "/inventory/location-stock", Component: LocationStockPage },
          { path: "/inventory/bin-card", Component: BinCardPage },
          { path: "/inventory/bin-card/:productId", Component: BinCardPage },
          { path: "/inventory/reorder", Component: ReorderManagementPage },
          { path: "/inventory/reorder/configuration", Component: ReorderConfigPage },
          // POS
          { path: "/pos", Component: POSPage },
          // Sales
          { path: "/sales", Component: SalesPage },
          // Purchasing
          { path: "/purchasing", Component: PurchaseRequirementsPage },
          { path: "/purchasing/requirements/new", Component: CreateRequirementPage },
          { path: "/purchasing/requirements/:id/assign", Component: SupplierAssignmentPage },
          { path: "/purchasing/orders", Component: PurchaseOrdersPage },
          { path: "/purchasing/orders/new", Component: CreatePurchaseOrderPage },
          { path: "/purchasing/orders/:id", Component: CreatePurchaseOrderPage },
          { path: "/purchasing/deliveries/new", Component: DeliveryRegistrationPage },
          { path: "/purchasing/deliveries/:id/reconcile", Component: ReconciliationPage },
          { path: "/purchasing/payables", Component: SupplierPayablesPage },
         // { path: "/purchasing/suppliers/:supplierId", Component: SupplierDetailPage },
          { path: "/purchasing/returns/new", Component: PurchaseReturnPage },
          // Reports
          { path: "/reports", Component: ReportsDashboardPage },
          { path: "/reports/margins", Component: ProfitMarginConfigPage },
          { path: "/reports/profitability", Component: ProfitabilityDashboardPage },
          { path: "/reports/stock-performance", Component: StockPerformancePage },
          { path: "/reports/sales", Component: SalesReportPage },
          { path: "/reports/audit-trail", Component: AuditTrailPage },
        ],
      },
    ],
  },
  {
    path: "*",
    loader: () => redirect("/login"),
  },
]);
