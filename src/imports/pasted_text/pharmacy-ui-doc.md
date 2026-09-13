Pharmacy Management System - UI Documentation
Design System
Color Palette
Primary Color (Darkest Blue): #49B0C1 - Used for headers, primary buttons, navigation bars, and important UI elements
Mid-tone Blue: #ABDBE3 - Used for accents, transition elements, backgrounds for hero sections, hover states, and secondary elements
Light Blue: #DBEFF3 - Used for cards, containers, section backgrounds, and subtle highlights
Background: White (#FFFFFF) - Main background color for pages
Text: Dark (#333333) for primary text, Medium (#666666) for secondary text
Rounded edges
Typography
Headings: Bold, size 24-32px
Subheadings: Semi-bold, size 18-20px
Body Text: Regular, size 14-16px
Small Text: Regular, size 12px
Component Styles
Buttons: Primary buttons use #49B0C1 with white text, secondary buttons use #ABDBE3 with dark text
Cards:  light blue (#DBEFF3) background
Inputs: White background with #ABDBE3 borders
Tables: Alternating rows with white and #DBEFF3 backgrounds
1. INVENTORY & EXPIRY CONTROL
1.1 Product Inventory Management
Inventory Dashboard Page
Page Purpose: Provides a comprehensive overview of all inventory items with quick access to key metrics and search functionality.
Header Section:
System logo and name on the left
User profile and logout button on the right
Navigation tabs: Dashboard, Inventory, POS, Purchasing, Reports, Settings
Background: #49B0C1 (primary color)
Metrics Cards Section:
Four metric cards displayed in a row, each with:
Light blue (#DBEFF3) background
Card title in dark text
Large numerical value
Icon representing the metric
Border radius: 8px
Padding: 20px
Search and Filter Section:
Search bar with icon, placeholder text "Search products..."
Advanced filters dropdown: All Categories, All Locations, All Brands
"Add Product" button in primary color (#49B0C1)
Background: White
Products Table Section:
Column headers: Product, Brand, Stock, Location, Expiry, Status
Each row displays product information with alternating row colors (white and #DBEFF3)
Status indicators: Green checkmark for in-stock, Yellow warning for low stock, Red X for out of stock
Pagination controls at the bottom
"View" button on each row to navigate to product detail
Sidebar (Optional):
Quick links to inventory categories
Recent activity feed
Background: #ABDBE3
Product Detail Page
Page Purpose: Displays comprehensive information about a single product including batches, units, and transaction history.
Breadcrumb Navigation:
"Inventory" → "Product Details"
Background: White with #ABDBE3 bottom border
Product Information Card:
Light blue (#DBEFF3) background card
Product image/placeholder
Product name as heading
Generic name, brand, category labels
Total stock quantity with status indicator
Minimum threshold and reorder point information
Edit and Delete buttons in primary color (#49B0C1)
Batch Information Section:
Section header with "Batches" title
Table showing: Batch Number, Quantity, Expiry Date, Received Date, Status
Each row with alternating white and #DBEFF3 backgrounds
Status badges: Available (green), Low Stock (yellow), Expired (red)
Unit Configuration Section:
Section header with "Units & Packaging" title
Table showing: Unit Type, Quantity Per Pack, Sell Price, Stock
Unit hierarchy visualization showing parent-child relationships
Quick conversion calculator with input fields and convert button
Transaction History Section (Optional):
List of recent transactions involving this product
Date, Transaction Type, Quantity, Reference Number columns
Expandable rows for more detail
1.2 Product Grouping Management
Product Groups Page
Page Purpose: Allows management of product categories and their associated profit margins.
Header Section:
"Product Groups" title
"Add New Group" button in primary color (#49B0C1)
Background: #49B0C1
Groups Table:
Columns: Group Name, Number of Items, Default Margin, Actions
Each row with alternating white and #DBEFF3 backgrounds
Action buttons: Edit (✏️), Delete (🗑️)
Hover state background: #ABDBE3
Profit margins displayed with percentage formatting
Group Statistics (Optional):
Summary cards showing total groups, average margin, etc.
Light blue (#DBEFF3) background cards
Edit Group Dialog/Page
Page Purpose: Allows editing of product group details and managing products within the group.
Form Fields:
Group Name (text input)
Description (text area)
Profit Margin (number input with %)
Background: White
Products in Group Section:
List of products currently in the group
Each product displayed in a row with remove button
"Add Products" button to search and add products
Light blue (#DBEFF3) background for this section
Action Buttons:
Cancel button (gray)
Save Changes button (primary color #49B0C1)
1.3 Multi-Unit / Loose Sale Interface
Unit Configuration Page
Page Purpose: Defines and manages unit hierarchies for products that can be sold in multiple units.
Header Section:
Product selector dropdown
"Unit Configuration" title
Background: #49B0C1
Unit Hierarchy Visualization:
Visual tree diagram showing unit relationships
Each unit displayed in a card with light blue (#DBEFF3) background
Arrows showing parent-child relationships
Conversion factors displayed between units
Unit Management Section:
List of all units for the selected product
Each unit shows: Unit name, Quantity in parent unit, Price, Stock
Add/Edit/Delete unit buttons
Input fields for conversion factors
Background: White with #DBEFF3 borders
Quick Conversion Tool:
Input: "From" quantity and unit
Output: "To" quantity and unit
Convert button in primary color (#49B0C1)
Light blue (#DBEFF3) card background
1.4 Batch Management Interface
Batch Management Page
Page Purpose: Track and manage product batches with comprehensive search and filtering.
Header and Search Section:
"Batch Management" title
Product selector dropdown
Batch number search field
Search button in primary color (#49B0C1)
Background: #49B0C1
Batches Table:
Columns: Batch Number, Quantity, Expiry Date, Location, Status, Actions
Alternating row colors (white and #DBEFF3)
Status indicators: Available (green), Low Stock (yellow), Depleted (gray), Expired (red)
View button for each row leading to batch detail
Hover state: #ABDBE3
Summary Statistics:
Cards showing: Total Batches, Near Expiry, Depleted
Light blue (#DBEFF3) card backgrounds
Batch Detail View Page
Page Purpose: Shows comprehensive information about a specific batch including transaction history.
Batch Information Card:
Light blue (#DBEFF3) background
Batch number as heading
Product name, quantity, received date, expiry date
Supplier information
Days remaining indicator with color coding
Transaction History Table:
Columns: Date, Transaction Type, Quantity, Reference
Each row with alternating backgrounds
Transaction types: Received, Transfer, Sale, Adjustment
Expandable rows for more detail
Action Buttons:
Recall This Batch (red)
Transfer (primary color #49B0C1)
Adjust (secondary color)
Located at the bottom of the page
1.5 Expiry Control Interface
Expiry Dashboard Page
Page Purpose: Monitor and manage products approaching their expiry dates.
Header Section:
"Expiry Monitor" title
Threshold configuration buttons
Background: #49B0C1
Threshold Settings Section:
Input fields for 30, 60, 90 day thresholds
Slider or number inputs
Light blue (#DBEFF3) card background
"Apply" button
Expiring Soon Sections:
Section 1: Red header "EXPIRING SOON (Within 30 days)"
Table showing: Product, Batch, Quantity, Days Left, Action
Red warning indicators
Return and Clearance buttons
Section 2: Yellow header "EXPIRING SOON (31-60 days)"
Similar table structure with yellow indicators
Background: White, cards with #DBEFF3 background
Action Buttons:
Export Expiry Report (primary color #49B0C1)
Bulk Actions dropdown
Expiry Action Dialog
Page Purpose: Provides options for handling products approaching expiry.
Product Information Section:
Product name, batch, quantity, expiry date
Days remaining with color indicator
Light blue (#DBEFF3) background
Action Selection:
Radio buttons for three options:
Return to Supplier
Supplier dropdown
Return quantity input
Clearance Sale
Discount percentage input
Notes text area
Dispose
Reason text input
Action Buttons:
Cancel (gray)
Confirm Action (primary color #49B0C1)
1.6 Store & Dispensing Management
Stock Transfer Interface
Page Purpose: Manage transfers of stock between different pharmacy locations.
Header Section:
"Stock Transfer" title
Date picker
Background: #49B0C1
Transfer Details:
"From Location" dropdown
"To Location" dropdown
Transfer date field
Light blue (#DBEFF3) card background
Products Transfer Table:
Columns: Product, Batch, Available Quantity, Quantity to Transfer
Each product in a row with quantity input field
Alternating row colors (white and #DBEFF3)
Quantity input with up/down arrows
Reason for Transfer:
Text area for transfer reason
Light blue (#DBEFF3) background
Action Buttons:
Cancel (gray)
Transfer (primary color #49B0C1)
Location Stock View Page
Page Purpose: View stock levels across different locations.
Header and Filter Section:
"Stock by Location" title
Location selector dropdown
Product search bar
Background: #49B0C1
Stock Table:
Columns: Product, Main Store, Dispensing Area, Total
Each row shows stock levels for each location
Alternating row colors (white and #DBEFF3)
Total column with bold formatting
Hover state: #ABDBE3
Stock Summary Cards:
Cards showing total items in each location
Light blue (#DBEFF3) backgrounds
Located above the table
1.7 Bin Card Management
Bin Card View Page
Page Purpose: Display complete stock movement history for a product.
Header Section:
"Bin Card - [Product Name]" title
Location selector dropdown
Batch selector (All Batches or specific)
Date range picker
Background: #49B0C1
Bin Card Table:
Columns: Date, Reference, In, Out, Balance, User
Chronological order with opening and closing balances
Alternating row colors (white and #DBEFF3)
Running balance column with cumulative total
In and Out columns with + and - indicators
Export Options:
Export CSV button (primary color #49B0C1)
Print button (secondary color)
View by Batch toggle
Summary Information (Optional):
Opening balance, total received, total issued, closing balance
Light blue (#DBEFF3) card background
Bin Card by Batch View
Page Purpose: Filtered view of stock movement for a specific batch.
Header Section:
"Bin Card - Batch [Batch Number]" title
Product name and batch number
Location and expiry date
Background: #49B0C1
Batch Bin Card Table:
Same structure as main Bin Card but filtered
Columns: Date, Reference, In, Out, Balance
Alternating row colors (white and #DBEFF3)
Running balance column
Close Button:
Primary color (#49B0C1) at bottom of page
1.8 Dynamic Reorder Points
Reorder Management Dashboard
Page Purpose: Monitor low stock items and generate reorder suggestions.
Header Section:
"Reorder Management" title
Generate Purchase Requirements button
Configure Thresholds button
Background: #49B0C1
Low Stock Alerts Section:
"LOW STOCK ALERTS" header with item count
Table showing: Product, Current Stock, Threshold, Velocity (units/day), Suggested Reorder Quantity
Each row with alternating white and #DBEFF3 backgrounds
Color indicators for urgency (red for critical, yellow for warning)
Light blue (#ABDBE3) header background
Suggested Reorder Quantities Section:
"SUGGESTED REORDER QUANTITIES" header
Table showing: Product, Average Daily Sales, Lead Time (days), Suggested Quantity, Action
Order button for each product (primary color #49B0C1)
Alternating row colors (white and #DBEFF3)
Statistics Summary:
Cards showing: Items Below Threshold, Average Daily Sales, Pending Orders
Light blue (#DBEFF3) backgrounds
Threshold Configuration Page
Page Purpose: Configure reorder parameters for products.
Header Section:
"Reorder Threshold Configuration" title
Product selector dropdown
Background: #49B0C1
Current Settings Form:
Minimum Stock Level (number input)
Reorder Point (number input)
Lead Time (number input with days label)
Reorder Quantity (number input)
Light blue (#DBEFF3) card background
Advanced Settings:
Toggle: "Use sales velocity for reorder calculation"
Reorder Formula dropdown
Buffer percentage input
Explanation of calculation
White background with #ABDBE3 border
Action Buttons:
Cancel (gray)
Save (primary color #49B0C1)
