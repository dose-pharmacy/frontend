Update the EXISTING pharmacy management system UI, but ONLY the Inventory module.

IMPORTANT:
- This is an existing full pharmacy system. Do NOT redesign, remove, rename, restructure, or modify any other module such as POS/Sales, Customers, Suppliers, Purchases, Prescriptions, Users, Reports, Settings, etc.
- First inspect the existing implementation and understand its current Inventory screens, components, routing, navigation, state, mock data, and design system.
- Reuse existing components, layouts, typography, spacing, colors, cards, tables, dialogs, buttons, filters, navigation patterns, and responsive behavior wherever possible.
- If a required screen or behavior is already implemented correctly, KEEP IT and do not rebuild it.
- Only change what is missing, incorrect, duplicated, or inconsistent with the Inventory specification below.
- Do not create unnecessary duplicate pages/components.
- Do not expose database entities directly as navigation items. The UI should represent pharmacy workflows, not database tables.
- Keep the current visual identity of the application. Improve consistency and usability rather than introducing a completely new design.
- Do not implement backend changes. This task is UI/UX only.
- Use realistic mock data where API data is not yet connected.
- Keep the UI structured so it can later integrate cleanly with REST APIs.

==================================================
INVENTORY INFORMATION ARCHITECTURE
==================================================

The Inventory module should be organized around these primary workflows:

1. Dashboard
2. Products
3. Stock
4. Transfers
5. Expiry
6. Reorder

Inventory management/configuration:

7. Product Groups
8. Locations
9. Units

IMPORTANT:
Do NOT expose "Product Units" as a separate top-level navigation item.

"ProductUnit" is a product-specific relationship/configuration between Product and Unit. It should be managed inside Product creation/editing and Product Detail, not as an independent user-facing inventory module.

Batches are also primarily accessed through Products, Product Detail, and Expiry. If the existing application already has a useful global Batches page, preserve it and improve it rather than unnecessarily removing it.

==================================================
1. INVENTORY DASHBOARD
==================================================

Create/update the Inventory Dashboard as the landing page for Inventory.

Purpose:
Answer:
"What is happening with my inventory right now?"

Show high-level metrics such as:

- Total Products
- Total Stock
- Low Stock
- Out of Stock
- Expiring Soon
- optionally Active Locations

Show useful sections:

A. Stock overview
- In Stock
- Low Stock
- Out of Stock

B. Expiring Soon
Show products/batches approaching expiry with:
- Product
- Batch
- Expiry date
- Remaining stock
- Days remaining
- action/view button

C. Low Stock
Show:
- Product
- Current stock
- Reorder point
- Suggested/reorder information where appropriate

D. Recent Stock Activity
Show recent:
- Purchase/Receiving
- Opening stock
- Transfer
- Adjustment
- Sale if inventory movement data supports it

The dashboard is a summary and navigation point. Do not turn it into a giant inventory management table.

==================================================
2. PRODUCTS
==================================================

Products should be the main inventory product-management page.

Show:

- Search
- Product Group filter
- Stock Status filter
- Expiry filter where useful
- Active/Inactive filter if the existing implementation supports it
- Add Product button

Main table/card list should show information useful to pharmacy staff:

- Product
- SKU
- Generic name/brand where useful
- Product Group
- Current Stock
- Base Unit
- Nearest Expiry
- Stock Status

Stock statuses should be visually clear:

- IN STOCK
- LOW STOCK
- OUT OF STOCK

Example:

Paracetamol 500mg
SKU: PCM-500
Stock: 1,250 Tablets
Nearest expiry: Aug 31, 2027
Status: In Stock

Clicking a product opens Product Detail.

==================================================
3. CREATE PRODUCT
==================================================

Update the product creation flow if necessary.

Product creation should configure the product and its units together.

The user should NOT have to:
Create Product
→ leave the page
→ separately create ProductUnit

Instead:

Create Product
→ configure basic product information
→ select reusable master Units
→ configure product-specific conversion/pricing
→ create product

Basic information:

- Name
- Generic Name
- Brand
- SKU
- Product Group
- Description
- Image if the existing design supports it

Units & Packaging:

The user selects existing reusable master units.

Example:

Base Unit:
[ Tablet ]

Additional Units:
[ Strip ] Conversion: 10
[ Box ] Conversion: 100

For each selected unit allow relevant product-specific pricing:

- Sell Price
- Default Purchase Price

Clearly distinguish:

"Default Purchase Price"

from actual historical inventory/batch cost.

Do NOT create a new master Unit while creating every product.

Master Units are reusable, such as:
- Tablet
- Strip
- Box
- Bottle
- Vial
- ml
- mg

A product configures how those units apply to that specific product.

Exactly one base unit must be selected.

Base unit conversion:
1

Non-base units:
conversion > 0

After creating a product, do NOT assume it has stock.

A newly created product may correctly have:

Stock: 0
Batches: 0
Transactions: 0

Show an appropriate empty state and provide:

[Add Stock]

==================================================
4. PRODUCT DETAIL
==================================================

Create/update a dedicated Product Detail page.

This page is NOT another generic product table.

Header:

Inventory / Products / Product Name

Product name
SKU
status

Actions:

[Edit Product]
[Add Stock]

Show summary cards:

- Current Stock
- Available Stock if supported
- Batches
- Locations
- Stock Movements/Transactions

Show:

[Overview] [Batches] [Stock History]

-------------------------
OVERVIEW
-------------------------

Product Information:
- Name
- Generic name
- Brand
- SKU
- Product Group
- Description

Units & Packaging:

Example:

Tablet     ×1     Sell: 2 ETB
Strip      ×10    Sell: 18 ETB
Box        ×100   Sell: 150 ETB

The ProductUnit relationship belongs here.

-------------------------
BATCHES
-------------------------

Show all batches belonging to this product.

Table:

- Batch Number
- Expiry Date
- Location
- Current Stock
- Status

Example:

PCM001 | Aug 31 2027 | Main Store | 1,000 Tablets | Good

Provide:
[View Batch]

If there are no batches:

"No batches yet"

Explain:
"Stock has not been received for this product yet."

Provide:
[Add Stock]

-------------------------
STOCK HISTORY
-------------------------

Show the product's inventory transaction history.

Columns:

- Date
- Transaction Type
- Batch
- Location
- Quantity In
- Quantity Out
- Balance
- Reference where useful

Examples:
- Opening Stock
- Purchase/Receiving
- Sale
- Transfer
- Adjustment
- Return
- Disposal

Quantities should display the product's base unit.

Example:

+2,000 Tablets

Do not show ambiguous quantities like:
"2,000"

without the unit.

Provide filters:
- Date
- Batch
- Location
- Transaction Type

Support pagination if the existing app uses pagination.

==================================================
5. ADD / RECEIVE STOCK
==================================================

This is an important workflow.

Product creation does NOT create stock.

Stock enters inventory through an Add Stock / Receive Stock workflow.

The UI should support:

[Add Stock]

Form:

Product
Batch
Expiry Date
Supplier if applicable
Location
Quantity
Unit
Purchase Price
Notes

Example:

Product:
Paracetamol 500mg

Batch:
PCM001

Expiry:
31 Aug 2027

Location:
Main Store

Quantity:
20

Unit:
Box

Purchase Price:
110 ETB

Show conversion preview:

20 Boxes
=
2,000 Tablets

The user should understand the conversion before confirming.

On confirmation, conceptually this creates:
- Batch
- Current stock
- Stock movement/history

Do not implement fake stock history in the UI just because a product was created.

Support an existing batch when appropriate and a new batch when needed.

Use clear validation and empty/loading/error states.

==================================================
6. STOCK
==================================================

Stock should be a separate top-level Inventory page.

Purpose:

"Where is my physical inventory right now?"

Provide:

[Current Stock] [Movements]

Current Stock view:

Filters:
- Product
- Location
- Batch
- Stock Status
- Expiry

Table:

- Product
- Batch
- Location
- Current Quantity
- Reserved Quantity if supported
- Available Quantity if supported
- Expiry
- Status

Example:

Paracetamol | PCM001 | Main Store | 1,000 Tablets | 100 reserved | 900 available

IMPORTANT:
Every stock quantity must clearly show its base unit.

Do not display:
"1,000"

Display:
"1,000 Tablets"

Movements view:

- Date
- Product
- Batch
- Location
- Type
- Quantity In
- Quantity Out
- Balance
- Reference

This acts as the operational stock ledger/bin-card view.

==================================================
7. BATCH DETAIL
==================================================

If the existing application has a Batch Detail page, update it rather than creating a duplicate.

Show:

- Product
- Batch Number
- Received Date
- Expiry Date
- Supplier
- Purchase Price
- Current Stock
- Stock by Location

Example:

Batch PCM001
Paracetamol 500mg

Expiry:
31 Aug 2027

Received:
10 Sep 2026

Supplier:
ABC Pharma

Purchase Price:
110 ETB / Box

Current Stock:
1,500 Tablets

Stock by Location:
Main Store: 1,200 Tablets
Branch 1: 300 Tablets

Show batch transaction history.

For expiry-related batches provide relevant actions:
- Return to Supplier
- Clearance Sale
- Dispose

Only show actions when appropriate.

==================================================
8. TRANSFERS
==================================================

Transfers are a separate operational workflow.

Page:

Transfers
[+ New Transfer]

Show:

- Transfer Number
- From Location
- To Location
- Date
- Number of Items
- Status

Statuses:

- Draft
- Pending if supported
- Completed
- Cancelled

Transfer Detail:

From:
Main Store

To:
Branch 1

Status:
Draft

Items:

Product
Batch
Quantity
Unit
Equivalent Base Quantity

Example:

Paracetamol
PCM001
5
Boxes
500 Tablets

IMPORTANT:
The UI should preserve the user-entered quantity and unit while also showing the normalized base quantity where useful.

Transfer creation/editing should support:

- Add item
- Edit item
- Remove item

Draft transfers can be edited.

Completed/cancelled transfers cannot be edited.

Use dedicated actions for:
[Complete Transfer]
[Cancel Transfer]

Do not expose a generic "change status" control.

==================================================
9. EXPIRY
==================================================

Expiry should be a management workflow.

Page:

Expiry

Summary:

- Expired
- Expiring within 30 days
- Expiring within 60 days
- Expiring within 90 days

Allow configurable threshold if existing design supports it.

Show:

Product
Batch
Expiry Date
Days Remaining
Current Stock
Location
Status

Sections:

Expired
Expiring Soon
Upcoming

For a selected batch show:

Product
Batch
Expiry
Stock
Location

Actions:

[Return to Supplier]
[Clearance Sale]
[Dispose]

Use confirmation dialogs with:
- quantity
- reason
- relevant supplier/discount fields when applicable

Do not make expiry a duplicate of the general Batches page.

==================================================
10. REORDER
==================================================

Reorder should help pharmacy staff identify what needs replenishment.

Show:

- Low Stock Products
- Current Stock
- Minimum Stock
- Reorder Point
- Suggested Quantity
- Lead Time where useful

Example:

Ibuprofen 400mg
Current: 8 Tablets
Reorder Point: 20
Suggested Order: 100

Provide a product-specific reorder configuration UI where appropriate:

- Minimum Stock
- Reorder Point
- Lead Time
- Reorder Quantity
- Use Sales Velocity
- Buffer Percentage

Keep this focused on inventory replenishment, not full purchasing functionality.

==================================================
11. LOCATIONS
==================================================

Keep Locations as a management/configuration page.

Show:

- Location Name
- Description
- Active/Inactive
- Number of products/stock where useful

Example:

Main Store
Branch 1
Branch 2

Clicking a location can show its current stock.

Do not duplicate the entire Stock module here.

==================================================
12. PRODUCT GROUPS
==================================================

Keep Product Groups as a management/configuration page.

Show:

- Group Name
- Description
- Number of Products
- Active/Inactive
- Default Margin if supported

Clicking a group shows products belonging to that group.

Keep this simple.

==================================================
13. UNITS
==================================================

Keep Units as a management/configuration page.

These are reusable MASTER units.

Example:

Tablet
Strip
Box
Bottle
Vial
ml
mg

Table:

- Unit
- Symbol
- Products Using It
- Active/Inactive

Example:

Box
Products using: 80
Active

A Unit is reusable across products.

Do NOT create product-specific conversion or pricing here.

Those belong to ProductUnit configuration inside Product creation/editing.

Do NOT create a top-level "Product Units" page.

==================================================
14. EMPTY STATES
==================================================

Handle the difference between:

Product exists but has no stock.

Product exists but has no batches.

Product exists but has no transactions.

Example:

Current Stock:
0 Tablets

Batches:
No batches yet.
Receive stock to create inventory for this product.

Stock History:
No stock movements yet.

Provide appropriate action buttons.

Do not make empty inventory look like an error.

==================================================
15. IMPORTANT DOMAIN RULES FOR UI
==================================================

Follow these rules consistently:

1. Product != Stock.
2. Product != Batch.
3. Product creation does not imply stock.
4. Product creation does not create fake batches.
5. ProductUnit is product-specific configuration.
6. Unit is a reusable master entity.
7. Stock is always represented internally in the product's base unit.
8. UI should always show the unit with a quantity.
9. Transfer input preserves entered quantity + selected unit.
10. Transfer can also display normalized base quantity.
11. Batch is the physical inventory supply with expiry/receiving information.
12. Stock is current state.
13. Stock transactions are history/ledger.
14. Bin Card is a presentation of stock transaction history, not another data-management concept.
15. Expiry operates primarily on batches and their current stock.
16. Reorder operates primarily on product stock levels and configuration.

==================================================
16. NAVIGATION
==================================================

Update ONLY the Inventory navigation.

Preferred structure:

Inventory
├── Dashboard
├── Products
├── Stock
├── Transfers
├── Expiry
├── Reorder
│
└── Management
    ├── Product Groups
    ├── Locations
    └── Units

Do NOT add:
Product Units

Do not unnecessarily add:
Stock Transactions
Transfer Items
Reorder Configuration

These are implementation/domain concepts represented inside workflow screens.

If the current navigation already has a good structure, preserve it where it matches this model and only make necessary changes.

==================================================
17. RESPONSIVE / UX REQUIREMENTS
==================================================

Maintain the existing application's responsive behavior.

Desktop:
- tables and multi-column layouts where appropriate

Tablet/mobile:
- responsive tables/cards
- usable filters
- accessible dialogs/forms
- no horizontal overflow unless unavoidable

All Inventory screens should have:

- loading state
- empty state
- error state
- success feedback
- form validation
- confirmation for destructive actions
- accessible buttons/inputs
- consistent pagination
- consistent search/filter behavior

Reuse existing shared components.

==================================================
18. IMPLEMENTATION PROCESS
==================================================

Before making changes:

1. Inspect the existing Inventory implementation.
2. Identify which screens already match this specification.
3. Identify partially implemented screens.
4. Identify duplicated or database-oriented screens.
5. Reuse existing components and data structures wherever possible.
6. Only modify what is needed.

Then implement the Inventory UI updates.

Do NOT modify other pharmacy modules.

Do NOT redesign the entire application.

Do NOT create backend APIs.

Do NOT create a separate Product Units navigation/page.

Do NOT invent additional inventory features outside this scope.

At the end, verify that:

- Existing non-Inventory modules are unchanged.
- Inventory navigation is coherent.
- Product creation configures units.
- Product can exist with zero stock.
- Add Stock is the bridge from product definition to actual inventory.
- Product Detail connects Overview → Batches → Stock History.
- Stock is separate from Products.
- Transfers preserve entered unit/quantity and base quantity.
- Expiry works from batches.
- Reorder works from stock levels.
- Units are reusable master units.
- No unnecessary duplicate pages were created.
- Existing design language remains consistent.

Finally, provide a short summary of:
- what already existed and was preserved
- what was changed
- what new screens/components were added
- any Inventory UI areas still needing backend integration