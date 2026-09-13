Update my **existing PharmaCare Pharmacy Management System UI**. Do NOT redesign the whole application or create a new visual style. Keep the existing branding, colors, typography, components, spacing, sidebar style, header style, and overall visual language.

### MAIN CHANGE: REMOVE DUPLICATE INVENTORY NAVIGATION

Currently, when I open an Inventory page such as **Overview**, **Products**, **Stock**, **Transfers**, etc., there is another horizontal navigation/tab bar at the top containing:

* Overview
* Products
* Stock
* Transfers
* Batches & Expiry
* Reorder
* etc.

**Remove this horizontal Inventory navigation completely.**

The Inventory pages should NOT repeat the Inventory sidebar navigation.

The **left sidebar is the ONLY primary navigation for Inventory.**

For example:

When I click:

**Inventory → Overview**

the page should open directly as the Overview page. There should NOT be another horizontal row saying:

`Overview | Products | Stock | Transfers | ...`

When I click:

**Inventory → Products**

the Products page should open directly. There should NOT be another horizontal Inventory navigation.

Do the same for:

* Overview
* Products
* Stock
* Batches & Expiry
* Transfers
* Reorder
* Product Groups
* Units
* Locations

### SIDEBAR STRUCTURE

Make the Inventory navigation in the left sidebar follow this structure:

```text
Dashboard

POS

Inventory
    Overview
    Products
    Stock
    Batches & Expiry
    Transfers
    Reorder

Sales

Settings
    Product Groups
    Units
    Locations
```

Keep the sidebar visually clean and compact.

**Inventory should be a collapsible sidebar section.**

When Inventory is expanded, its child pages should appear underneath it.

Highlight only the currently active page.

For example, if the user is on Overview:

```text
Inventory
    ● Overview
      Products
      Stock
      Batches & Expiry
      Transfers
      Reorder
```

If the user is on Products:

```text
Inventory
      Overview
    ● Products
      Stock
      Batches & Expiry
      Transfers
      Reorder
```

Do not create a second navigation system inside the page.

---

# PAGE STRUCTURE

Every Inventory page should instead have a simple page header:

```text
Inventory / Overview

Inventory Overview
Monitor your pharmacy inventory and identify items that need attention.
```

or, for Products:

```text
Inventory / Products

Products
Manage medicines and inventory items.
```

Use breadcrumbs only if they improve orientation.

**Do NOT turn the breadcrumbs into navigation tabs.**

---

# INVENTORY OVERVIEW

The Overview page should be the **Inventory command center**.

Use the existing PharmaCare design system and create:

```text
Inventory / Overview

Inventory Overview                         [Location ▾]

[ Total Products ]
[ Total Stock ]
[ Low Stock ]
[ Out of Stock ]
[ Near Expiry ]
[ Expired Batches ]
```

Then:

```text
Attention Required

🔴 Out of stock
🟠 Low stock
🟡 Expiring soon
🔴 Expired batches
```

Then:

```text
Recent Inventory Activity
```

with a clean table.

The page should feel like a dashboard, not like another navigation page.

---

# PRODUCTS PAGE

When the user clicks **Inventory → Products**, show:

```text
Inventory / Products

Products                                      [+ Add Product]

Manage medicines and inventory items.

[ Search products... ] [Product Group ▾] [Brand ▾] [Status ▾]
```

Then a professional pharmacy inventory table:

```text
Product
SKU
Product Group
Unit
Stock
Status
Actions
```

Use table rows rather than large product cards.

---

# STOCK PAGE

When the user clicks **Inventory → Stock**, show:

```text
Inventory / Stock

Stock                                      [Location ▾]

View current stock across pharmacy locations.

[ Search product or SKU... ]
[Location ▾] [Stock Status ▾] [Product Group ▾]
```

Then:

```text
Product
Batch
Location
Quantity
Available
Status
Actions
```

Do not add horizontal tabs such as:

`Overview | Products | Stock | Transfers`

---

# BATCHES & EXPIRY PAGE

When the user clicks **Inventory → Batches & Expiry**, show:

```text
Inventory / Batches & Expiry

Batches & Expiry                            [Add Batch]

Monitor product batches, expiration dates, and stock.

[ Search batch/product... ]
[Location ▾]
[Expiry Status ▾]
```

Use sections/cards within the page for:

* All Batches
* Expiring Soon
* Expired

These are **content sections or filters**, NOT global navigation tabs.

Make expiry urgency visually clear.

---

# TRANSFERS PAGE

When the user clicks **Inventory → Transfers**, show:

```text
Inventory / Transfers

Transfers                                  [+ New Transfer]

Manage stock movements between pharmacy locations.

[Search...] [Status ▾] [From ▾] [To ▾]
```

Table:

```text
Transfer #
From
To
Items
Status
Date
Actions
```

A transfer detail page should open when a transfer is selected.

---

# REORDER PAGE

When the user clicks **Inventory → Reorder**, show:

```text
Inventory / Reorder

Reorder

Review low-stock products and suggested reorder quantities.

[Search...] [Urgency ▾] [Product Group ▾]
```

Show reorder suggestions in a work-queue style table:

```text
Product
Current Stock
Reorder Point
Suggested Quantity
Urgency
Action
```

---

# SETTINGS

Product Groups, Units, and Locations should be accessible through the sidebar under Settings.

Do NOT add a horizontal navigation bar containing:

`Product Groups | Units | Locations`

when one of these pages opens.

For example, when clicking:

**Settings → Units**

open directly:

```text
Settings / Units

Units                                      [+ Add Unit]

Manage reusable inventory units.

[Search units...]

Unit
Symbol
Status
Actions
```

The same principle applies to:

* Product Groups
* Locations

---

# IMPORTANT NAVIGATION RULE

Follow this rule throughout the entire application:

**Sidebar = primary navigation.**

**Page content = page-specific information and actions.**

Do NOT duplicate the sidebar navigation as horizontal navigation inside the page.

Avoid layouts like:

```text
Sidebar
   ↓
Inventory

          Overview | Products | Stock | Transfers | Reorder
          -------------------------------------------------
          Page content
```

Instead use:

```text
Sidebar
   ↓
Inventory
   ├── Overview
   ├── Products
   ├── Stock
   ├── Batches & Expiry
   ├── Transfers
   └── Reorder

          Page content only
          -----------------
          Inventory Overview
          Metrics
          Alerts
          Activity
```

---

# PRODUCT DETAIL EXCEPTION

Inside an individual Product Detail page, you MAY use contextual tabs because they belong specifically to that product.

For example:

```text
← Products

Paracetamol 500mg
PCM-500

Overview | Stock | Batches | Reorder | Transactions
```

These tabs are acceptable because they are **subsections of one specific product**, not duplicate Inventory navigation.

Similarly, contextual tabs can be used inside a specific transfer or batch detail page when appropriate.

---

# DESIGN GOAL

The final UI should feel like a professional pharmacy management application:

* Clean
* Modern
* Organized
* Spacious but not oversized
* Easy to scan
* Desktop-friendly
* Responsive
* Professional healthcare/pharmacy aesthetic

Most importantly, **remove the redundant horizontal Inventory navigation from all top-level Inventory pages.**

Do not change unrelated pages or functionality.

Do not create a completely new dashboard.

Modify the existing design so the sidebar becomes the single source of primary navigation and each selected page focuses only on its own content.
