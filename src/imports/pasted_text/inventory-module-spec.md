We are continuing development of an existing Pharmacy Management System frontend.

The Authentication and initial frontend foundation have already been implemented.

IMPORTANT:
Do NOT rebuild the project from scratch.
Do NOT replace the existing architecture unnecessarily.
Do NOT redesign or break existing Authentication functionality.

First inspect and understand the existing frontend implementation, including:

- Project structure
- Existing routing
- Authentication flow and protected routes
- Existing layouts
- Shared UI components
- Styling/design system
- API/service layer
- State management approach
- Existing documentation

Then continue development using the existing architecture and patterns.

==================================================
PROJECT CONTEXT
==================================================

This Pharmacy Management System is being built feature by feature.

The complete system will eventually include modules such as:

- Authentication
- Dashboard
- Inventory & Expiry Control
- POS / Sales
- Purchasing
- Reports
- Settings
- Other pharmacy management features

The task in this phase is ONLY:

# PART 1 — INVENTORY & EXPIRY CONTROL

This is only one module of the larger Pharmacy Management System.

Therefore:

- Do not build the entire application around Inventory only.
- Do not make Inventory-specific architecture decisions that will make future modules difficult.
- Keep navigation, layouts, components, routing, API layers, and state scalable for future modules.
- Reuse shared components whenever appropriate.
- Build Inventory as a module within the larger Pharmacy application.

==================================================
DESIGN CONSISTENCY
==================================================

Continue using the existing Pharmacy UI design system established in the project.

Do not introduce a new design language.

Use the existing:

- Colors
- Typography
- Spacing
- Buttons
- Inputs
- Cards
- Tables
- Navigation
- Responsive behavior

Primary color:
#49B0C1

Secondary / Mid-tone:
#ABDBE3

Light blue:
#DBEFF3

Primary text:
#333333

Secondary text:
#666666

The new Inventory & Expiry pages must feel like a natural continuation of the Authentication UI and the overall Pharmacy application.

==================================================
APPLICATION NAVIGATION
==================================================

Continue using the existing authenticated application structure.

The application should support navigation between major modules such as:

- Dashboard
- Inventory
- POS
- Purchasing
- Reports
- Settings

For this phase:

Implement the Inventory-related navigation and routes.

Do not fully implement other modules yet.

For future modules that are not implemented:

- Do not build their functionality.
- If navigation placeholders already exist, keep them consistent with the existing architecture.
- Avoid broken navigation.

==================================================
MODULE STRUCTURE
==================================================

Organize this feature cleanly.

The Inventory & Expiry Control module should have a structure that can grow independently while still integrating into the overall application.

For example, conceptually:

Inventory Module
    ├── Inventory Dashboard
    ├── Product Management
    ├── Product Groups
    ├── Unit Configuration
    ├── Batch Management
    ├── Expiry Management
    ├── Stock Transfer
    ├── Location Stock
    ├── Bin Cards
    └── Reorder Management

Do not blindly use this exact folder structure if the existing project architecture already has a better established pattern.

Follow and extend the existing architecture consistently.

==================================================
PART 1.1 — PRODUCT INVENTORY MANAGEMENT
==================================================

Implement:

# Inventory Dashboard Page

Purpose:

Provide an overview of inventory items with key metrics, search, filtering, and access to product details.

Include:

## Metrics Section

Four metric cards displayed responsively.

Each card should include:

- Title
- Large numerical value
- Relevant icon
- Light blue background (#DBEFF3)
- Rounded corners
- Proper spacing

Metrics should be implemented using reusable metric/stat card components where appropriate.

Use mock/placeholder data if backend APIs are not yet available.

## Search and Filters

Include:

- Search input
- Search icon
- Placeholder:
  "Search products..."

Filters:

- All Categories
- All Locations
- All Brands

Include:

- Add Product button

The search/filter UI should be structured so it can later connect to real backend APIs.

Do not hardcode filtering logic directly inside unrelated UI components.

## Products Table

Columns:

- Product
- Brand
- Stock
- Location
- Expiry
- Status
- Actions

Requirements:

- Responsive behavior
- Alternating row backgrounds where appropriate
- Clear status indicators

Statuses:

- In Stock
- Low Stock
- Out of Stock

Each product should have:

- View action

Clicking View should navigate to the Product Detail page.

Include:

- Pagination UI
- Empty state
- Loading state

If no backend exists yet, use isolated mock data.

Do not scatter mock data throughout components.

==================================================
PRODUCT DETAIL PAGE
==================================================

Create a Product Detail page.

Include:

## Breadcrumb

Inventory
    →
Product Details

The breadcrumb should work with the application's routing structure.

## Product Information

Display:

- Product image or placeholder
- Product name
- Generic name
- Brand
- Category
- Total stock
- Stock status
- Minimum threshold
- Reorder point

Actions:

- Edit Product
- Delete Product

For now, Edit/Delete behavior may use placeholders or mock actions if backend functionality does not exist.

However, structure the UI so real API integration can be added later.

## Batch Information

Create a Batches section.

Columns:

- Batch Number
- Quantity
- Expiry Date
- Received Date
- Status

Statuses:

- Available
- Low Stock
- Expired

Each row should support navigation to Batch Detail where appropriate.

## Units & Packaging

Display:

- Unit Type
- Quantity Per Pack
- Sell Price
- Stock

Include:

- Unit hierarchy visualization
- Parent/child unit relationship
- Conversion factor information

Include a Quick Conversion Tool:

Input:

- Quantity
- From Unit

Output:

- Converted Quantity
- To Unit

Button:

- Convert

The conversion logic can initially use mock/local data.

Keep calculation logic separate from presentation components.

## Transaction History

Implement this section as optional/future-ready.

If included:

Columns:

- Date
- Transaction Type
- Quantity
- Reference Number

Transaction types:

- Received
- Transfer
- Sale
- Adjustment

==================================================
PART 1.2 — PRODUCT GROUPING MANAGEMENT
==================================================

Implement:

# Product Groups Page

Include:

- Product Groups title
- Add New Group button

Groups table:

Columns:

- Group Name
- Number of Items
- Default Margin
- Actions

Actions:

- Edit
- Delete

Requirements:

- Percentage formatting for margins
- Hover states
- Empty state
- Loading state
- Pagination if appropriate

Optional statistics:

- Total Groups
- Average Margin

Use reusable metric cards if already available.

==================================================
EDIT GROUP
==================================================

Create either:

- Dialog/Modal
OR
- Dedicated page

Choose the approach that best fits the existing project architecture and user experience.

Fields:

- Group Name
- Description
- Profit Margin

Products in Group section:

- List products
- Remove product action
- Add Products action
- Product search capability

Actions:

- Cancel
- Save Changes

Ensure:

- Form validation
- Clear errors
- Loading/saving state

==================================================
PART 1.3 — MULTI-UNIT / LOOSE SALE INTERFACE
==================================================

Implement:

# Unit Configuration Page

Purpose:

Manage products that can be sold in multiple units.

Example concept:

Box
    ↓
Strip
    ↓
Tablet

Include:

## Product Selector

Allow selection of a product.

## Unit Hierarchy Visualization

Create a clear visual representation of unit relationships.

Each unit should display:

- Unit name
- Quantity relationship
- Conversion factor

Example:

1 Box
    =
10 Strips

1 Strip
    =
10 Tablets

Use reusable components and avoid hardcoding a single hierarchy.

## Unit Management

List:

- Unit Name
- Quantity in Parent Unit
- Price
- Stock

Actions:

- Add Unit
- Edit Unit
- Delete Unit

Include conversion factor inputs.

## Quick Conversion Tool

Inputs:

- From Quantity
- From Unit
- To Unit

Output:

- Converted Quantity

Button:

- Convert

==================================================
PART 1.4 — BATCH MANAGEMENT
==================================================

Implement:

# Batch Management Page

Include:

- Batch Management title
- Product selector
- Batch number search
- Search functionality

Batch table:

Columns:

- Batch Number
- Product
- Quantity
- Expiry Date
- Location
- Status
- Actions

Statuses:

- Available
- Low Stock
- Depleted
- Expired

Actions:

- View

View should navigate to Batch Detail.

Include:

- Search state
- Empty state
- Loading state
- Pagination if appropriate

## Summary Statistics

Display:

- Total Batches
- Near Expiry
- Depleted

Reuse shared metric/stat card components.

==================================================
BATCH DETAIL PAGE
==================================================

Display:

- Batch Number
- Product
- Quantity
- Received Date
- Expiry Date
- Supplier
- Days Remaining

Days remaining should have clear status color coding.

## Transaction History

Columns:

- Date
- Transaction Type
- Quantity
- Reference

Transaction types:

- Received
- Transfer
- Sale
- Adjustment

Actions:

- Recall This Batch
- Transfer
- Adjust

For dangerous/destructive actions:

- Require confirmation UI
- Do not execute real destructive actions without backend integration

==================================================
PART 1.5 — EXPIRY CONTROL
==================================================

Implement:

# Expiry Dashboard

Purpose:

Monitor products and batches approaching expiry.

Include:

- Expiry Monitor title
- Threshold configuration

Default threshold concepts:

- Within 30 Days
- 31–60 Days
- 61–90 Days

Do not permanently hardcode these values in components.

Create configurable state/settings.

## Threshold Settings

Inputs:

- 30 days
- 60 days
- 90 days

Include:

- Number inputs or sliders
- Apply button

Structure this so backend persistence can be added later.

==================================================
EXPIRING SOON SECTIONS
==================================================

Create grouped expiry sections.

Example:

## EXPIRING SOON — Within 30 Days

Display:

- Product
- Batch
- Quantity
- Days Left
- Action

Actions:

- Return
- Clearance

Use strong warning styling.

## EXPIRING SOON — 31–60 Days

Use a less urgent warning state.

The UI should clearly communicate urgency without relying only on color.

==================================================
EXPIRY ACTION DIALOG
==================================================

When an expiry action is selected, open a dialog.

Display:

- Product
- Batch
- Quantity
- Expiry Date
- Days Remaining

Action options:

1. Return to Supplier

Fields:

- Supplier
- Return Quantity

2. Clearance Sale

Fields:

- Discount Percentage
- Notes

3. Dispose

Fields:

- Reason

Actions:

- Cancel
- Confirm Action

Ensure:

- Validation
- Confirmation where necessary
- Loading state
- Clear success/error handling architecture

==================================================
PART 1.6 — STORE & DISPENSING MANAGEMENT
==================================================

Implement:

# Stock Transfer Interface

Fields:

- From Location
- To Location
- Transfer Date

Products Transfer Table:

Columns:

- Product
- Batch
- Available Quantity
- Quantity to Transfer

Include:

- Quantity validation
- Quantity input controls

Add:

- Reason for Transfer

Actions:

- Cancel
- Transfer

For frontend-only/mock implementation:

- Validate transfer quantities
- Do not allow negative quantities
- Do not allow transfer quantities above available quantities
- Prevent selecting the same From and To location

Keep business logic separate from presentation.

==================================================
LOCATION STOCK VIEW
==================================================

Implement:

# Stock by Location Page

Include:

- Location selector
- Product search

Stock table:

- Product
- Main Store
- Dispensing Area
- Total

Include:

- Bold Total values
- Search/filter behavior
- Loading state
- Empty state

Summary cards:

- Total Items in Main Store
- Total Items in Dispensing Area

==================================================
PART 1.7 — BIN CARD MANAGEMENT
==================================================

Implement:

# Bin Card View

Purpose:

Show stock movement history.

Filters:

- Location
- Batch
- Date Range

Table:

- Date
- Reference
- In
- Out
- Balance
- User

Requirements:

- Running balance
- Chronological ordering
- Clear In/Out indicators

Include summary information:

- Opening Balance
- Total Received
- Total Issued
- Closing Balance

Actions:

- Export CSV
- Print
- View by Batch toggle

For now:

- Export may use mock/local frontend data
- Print can use browser print functionality if appropriate

==================================================
BIN CARD BY BATCH
==================================================

Create a filtered Batch Bin Card view.

Display:

- Product
- Batch Number
- Location
- Expiry Date

Table:

- Date
- Reference
- In
- Out
- Balance

Include:

- Close / Back action

==================================================
PART 1.8 — DYNAMIC REORDER POINTS
==================================================

Implement:

# Reorder Management Dashboard

Purpose:

Monitor low stock and provide reorder suggestions.

## Low Stock Alerts

Display:

- Product
- Current Stock
- Threshold
- Velocity (units/day)
- Suggested Reorder Quantity

Clearly show:

- Critical
- Warning

Do not rely only on color to indicate urgency.

==================================================
SUGGESTED REORDER QUANTITIES
==================================================

Display:

- Product
- Average Daily Sales
- Lead Time
- Suggested Quantity
- Action

Include:

- Order button

For now, the Order button can be future-ready and connect later to Purchasing.

Do not implement the Purchasing module in this phase.

==================================================
STATISTICS
==================================================

Include:

- Items Below Threshold
- Average Daily Sales
- Pending Orders

Reuse existing shared metric cards.

==================================================
THRESHOLD CONFIGURATION
==================================================

Implement:

# Reorder Threshold Configuration Page

Fields:

- Product
- Minimum Stock Level
- Reorder Point
- Lead Time
- Reorder Quantity

Advanced settings:

- Use sales velocity toggle
- Reorder Formula selector
- Buffer Percentage
- Calculation explanation

Actions:

- Cancel
- Save

Ensure validation and clean state handling.

==================================================
DATA AND API ARCHITECTURE
==================================================

The real backend may not yet be connected.

Therefore:

Do NOT tightly couple UI components to mock data.

Use a structure similar to:

UI Components
        ↓
Feature/Page Logic
        ↓
Service Layer
        ↓
API Layer
        ↓
Backend

If backend APIs are not available:

- Use isolated mock repositories/services
- Keep mock data in dedicated files
- Use realistic pharmacy inventory data
- Make replacement with real APIs easy

Avoid:

- Large arrays of mock data inside page components
- API URLs hardcoded throughout components
- Business logic mixed directly into UI components

==================================================
STATE MANAGEMENT
==================================================

Follow the existing state management architecture.

Do not introduce a new state management library unless truly necessary.

Manage states properly:

- Loading
- Success
- Error
- Empty data
- Filters
- Search
- Pagination
- Selected product
- Selected batch

==================================================
ROUTING
==================================================

Extend the existing routing system cleanly.

Routes should support concepts such as:

/inventory

/inventory/products/:productId

/inventory/groups

/inventory/units

/inventory/batches

/inventory/batches/:batchId

/inventory/expiry

/inventory/transfers

/inventory/location-stock

/inventory/bin-card

/inventory/bin-card/:productId

/inventory/reorder

/inventory/reorder/configuration

Use the existing routing conventions if they differ.

Do not break existing Authentication routes.

==================================================
REUSABLE COMPONENTS
==================================================

Before creating duplicate UI code, inspect existing shared components.

Create reusable components where appropriate.

Possible reusable components:

- MetricCard
- DataTable
- StatusBadge
- SearchInput
- FilterDropdown
- Pagination
- PageHeader
- Breadcrumb
- EmptyState
- LoadingState
- ErrorState
- ConfirmationDialog
- FormField

Do not create components unnecessarily.

Prefer reusable components only when they represent genuine repeated UI patterns.

==================================================
RESPONSIVE DESIGN
==================================================

All Inventory pages must be responsive.

Test:

Desktop
Tablet
Mobile

For tables:

Do not simply allow broken horizontal layouts.

Use an appropriate responsive strategy based on the existing design, such as:

- Horizontal scroll where appropriate
- Responsive table layout
- Condensed mobile views

Maintain usability.

==================================================
ACCESSIBILITY
==================================================

Ensure:

- Proper labels for form inputs
- Keyboard accessibility
- Visible focus states
- Buttons have meaningful labels
- Status is not communicated by color alone
- Sufficient text contrast
- Dialogs are accessible
- Error messages are understandable

==================================================
ERROR HANDLING
==================================================

Implement appropriate frontend error states.

Handle:

- Failed data loading
- Empty inventory
- Invalid form data
- Invalid quantities
- Failed actions
- Missing product
- Missing batch

Do not expose raw technical errors directly to users.

==================================================
TESTING REQUIREMENTS
==================================================

Test the module thoroughly.

At minimum test:

# Navigation

- Inventory navigation works
- Product navigation works
- Batch navigation works
- Back navigation works
- Existing authentication routes still work
- Protected routes still behave correctly

# Product Inventory

- Search
- Filters
- Pagination
- Product detail navigation
- Empty state
- Loading state

# Product Groups

- Add group
- Edit group
- Validation
- Cancel behavior

# Units

- Unit selection
- Conversion calculation
- Invalid conversion inputs
- Unit hierarchy rendering

# Batches

- Search
- Product filter
- Batch detail navigation
- Status display

# Expiry

- Threshold configuration
- Expiry grouping
- Expiry action dialogs
- Validation

# Stock Transfer

- Same location validation
- Negative quantity validation
- Quantity greater than available validation
- Empty required fields

# Bin Card

- Filters
- Running balance calculation
- Date filtering
- Batch filtering

# Reorder

- Low stock display
- Suggested quantity calculation display
- Threshold validation

# UI

- Responsive desktop
- Responsive tablet
- Responsive mobile
- No broken layouts
- No unnecessary overflow
- No browser console errors
- No broken routes

==================================================
IMPORTANT BUSINESS LOGIC RULE
==================================================

This task is primarily frontend implementation.

Do not invent complex pharmacy backend/business rules beyond what is necessary for frontend behavior.

If using mock calculations:

- Keep them simple
- Clearly isolate them
- Make them easy to replace with backend calculations later

The backend will eventually be responsible for authoritative:

- Stock quantities
- Batch availability
- Expiry calculations
- Stock movement
- Reorder calculations
- Permissions
- Transactions

Do not create frontend logic that will be difficult to replace later.

==================================================
SCOPE CONTROL
==================================================

Implement ONLY:

# PART 1 — INVENTORY & EXPIRY CONTROL

Do NOT start implementing:

- POS functionality
- Purchasing workflows
- Reports functionality
- Settings functionality
- Other future modules

The UI/navigation may contain placeholders for future modules, but do not implement their features.

==================================================
CONTINUE, DO NOT REBUILD
==================================================

This is extremely important:

- Continue from the already implemented Authentication/frontend foundation.
- Reuse the existing project structure.
- Reuse existing shared components.
- Preserve existing authentication behavior.
- Do not rewrite working code unnecessarily.
- Do not replace the existing architecture without a strong technical reason.

First inspect what already exists.

Then:

Understand
↓
Plan
↓
Implement incrementally
↓
Test
↓
Fix
↓
Review

==================================================
FINAL REVIEW
==================================================

Before finishing:

1. Review all files changed.
2. Check that existing Authentication functionality still works.
3. Check all Inventory routes.
4. Check responsive behavior.
5. Check console errors.
6. Check for duplicated components.
7. Check that mock/API architecture is clean.
8. Check that Inventory remains modular and does not block future modules.
9. Fix all discovered issues.

==================================================
DOCUMENTATION
==================================================

Update the project documentation.

Document:

1. Inventory module architecture
2. Routes created
3. Pages implemented
4. Shared components added
5. Mock data architecture
6. Service/API architecture
7. State handling
8. Inventory module structure
9. Key design decisions
10. How the real backend can connect later
11. What is implemented vs placeholder/future-ready

Also document the relationship:

Pharmacy Application
        │
        ├── Authentication
        │
        ├── Inventory & Expiry Control
        │       ├── Products
        │       ├── Product Groups
        │       ├── Units
        │       ├── Batches
        │       ├── Expiry
        │       ├── Stock Transfer
        │       ├── Location Stock
        │       ├── Bin Cards
        │       └── Reorder Management
        │
        ├── POS (Future)
        ├── Purchasing (Future)
        ├── Reports (Future)
        └── Settings (Future)

==================================================
FINAL OUTPUT
==================================================

After completing the work, provide:

1. Summary of what was implemented
2. Pages created
3. Routes created
4. Components created/reused
5. Files created
6. Files modified
7. Architecture decisions
8. Mock functionality implemented
9. Tests performed
10. Known limitations
11. What is ready for backend integration
12. Confirmation that existing Authentication functionality still works

Do not claim something was implemented or tested unless it was actually implemented and tested.