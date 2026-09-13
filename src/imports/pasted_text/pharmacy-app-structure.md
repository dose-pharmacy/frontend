I’d structure the pharmacy application like this.

# 1. Inventory sidebar

I would **not** put 12–15 items directly in the sidebar. It will feel cluttered.

### Inventory

```
```

```
Inventory
│
├── Overview
│
├── Products
│
├── Stock
│
├── Batches & Expiry
│
├── Transfers
│
├── Reorder
│
└── Settings
     ├── Product Groups
     ├── Units
     └── Locations
```

And separately:

```
```

```
POS
Sales
```

So the main sidebar could be:

```
```

```
Dashboard

POS

Inventory
   Overview
   Products
   Stock
   Batches & Expiry
   Transfers
   Reorder
   Settings

Sales
```

This is much cleaner.

---

# 2. Inventory → Overview

This should be the **inventory command center**, not another product list.

The backend already provides exactly the right high-level metrics:

*  Total products 
*  Total stock 
*  Low stock 
*  Out of stock 
*  Near expiry 
*  Expired batches 
*  Critical expiry  

### Layout

```
```

```
Inventory
Overview                                      [Location ▾]

┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Total Products │ │ Total Stock    │ │ Low Stock      │
│     1,248      │ │   85,420       │ │      24        │
└────────────────┘ └────────────────┘ └────────────────┘

┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Out of Stock   │ │ Near Expiry    │ │ Expired        │
│       8        │ │      31        │ │       4        │
└────────────────┘ └────────────────┘ └────────────────┘


Attention Required

┌────────────────────────────────────────────────────────┐
│ 🔴 8 products out of stock                     View →  │
│ 🟠 24 products low in stock                    View →  │
│ 🟡 31 batches expiring soon                    View →  │
│ 🔴 4 batches expired                            View →  │
└────────────────────────────────────────────────────────┘


Recent Inventory Activity

Product       Movement       Qty       Location       Date
Paracetamol   Purchase       +500      Main Store     Today
Amoxicillin   Sale           -20       Main Store     Today
...
```

### Important

Don't make the dashboard overly analytical.

The backend currently gives **inventory counts**, not extensive charts. So I wouldn't invent a bunch of fake analytics just to fill space.

The dashboard should answer:

> **"Is there anything in my inventory that needs my attention?"**

---

# 3. Inventory → Products

This should be the main product-management page.

The backend supports:

*  search 
*  product group 
*  brand 
*  active/inactive 
*  pagination 
*  product details 
*  stock summary  

### Header

```
```

```
Products                              [+ Add Product]

Manage medicines and inventory items

[ Search products... ] [Product Group ▾] [Brand ▾] [Status ▾]
```

### Table

I prefer a **table**, not cards, for the inventory management screen.

```
```

```
┌─────────────────────────────────────────────────────────────────────┐
│ Product          SKU        Group       Unit      Stock    Status  │
├─────────────────────────────────────────────────────────────────────┤
│ Paracetamol      PCM-500    Analgesic   Tablet    1,250    ● In    │
│ Amoxicillin      AMX-250    Antibiotic  Capsule     320    ● Low   │
│ Ibuprofen        IBU-400    Analgesic   Tablet        0    ● Out   │
│ Vitamin C        VIT-100    Vitamins    Tablet      840    ● In    │
└─────────────────────────────────────────────────────────────────────┘
```

Each row should have:

```
```

```
⋮
View
Edit
Deactivate
```

### Product detail

Clicking a product should open:

```
```

```
← Products

Paracetamol 500mg
PCM-500
Analgesic

[Active]

┌──────────────────────────────────────────┐
│ Stock Summary                             │
│                                           │
│ Total Stock       1,250 tablets           │
│ Main Store          900 tablets           │
│ Pharmacy            350 tablets           │
│ Status              In Stock              │
└──────────────────────────────────────────┘

Product Information
Name
Generic Name
Brand
SKU
Product Group

Selling Units
───────────────────────────────────────────
Unit       Conversion      Sell Price
Tablet     1               2.00 ETB
Strip      10              18.00 ETB
Box        100             160.00 ETB

[Edit Product]
```

This is important because your backend explicitly treats `Unit` as the reusable master unit and `ProductUnit` as the product-specific configuration with conversion and pricing. 

---

# 4. Product → Stock

I would **not make this a top-level sidebar page**.

It belongs inside the product detail.

For example:

```
```

```
Paracetamol 500mg

Overview | Stock | Batches | Transactions
```

### Stock tab

```
```

```
Stock

Location       Batch       Quantity    Reserved    Available
Main Store     PCM001      800         50          750
Main Store     PCM002      400          0          400
Pharmacy       PCM001      300          0          300
```

The backend already exposes stock by product and location, including quantity, reserved quantity and available quantity. 

This is much more useful than making users navigate somewhere else just to understand one product.

---

# 5. Inventory → Stock

This should answer:

> **"What stock do I currently have?"**

### Header

```
```

```
Stock                                  [Location ▾]

[ Search product or SKU... ]

[Location ▾] [Stock Status ▾] [Product Group ▾]
```

### Table

```
```

```
Product          Batch       Location       Stock      Available   Status
Paracetamol      PCM001      Main Store     800        750         In Stock
Amoxicillin      AMX004      Main Store     120        120         Low
Ibuprofen        IBU002      Pharmacy         0          0         Out
```

The API specifically exposes current stock with product, batch, location, quantity, reserved quantity, available quantity and stock status. 

---

# 6. Stock → Stock movement

I'd make this accessible through:

```
```

```
Stock
   → View stock
   → Stock movements
```

or simply have a **Movements** tab on the Stock page.

### Movement table

```
```

```
Date          Product       Type          Direction    Qty    Location
Sep 10 10:30  Paracetamol   Purchase      IN           500    Main Store
Sep 10 11:10  Paracetamol   Sale          OUT           20    Main Store
Sep 10 12:00  Amoxicillin   Adjustment    OUT            5    Main Store
Sep 10 14:20  Vitamin C     Transfer In    IN           100    Pharmacy
```

Your backend has `StockTransaction` specifically for this history, including transaction type, direction, quantity and balance after. 

Use badges:

```
```

```
PURCHASE       +500
SALE            -20
TRANSFER IN    +100
TRANSFER OUT   -100
ADJUSTMENT      -5
OPENING        +500
```

---

# 7. Stock → Bin Card

This deserves its own **detail view**, not necessarily a sidebar item.

When someone clicks:

```
```

```
Paracetamol → Stock → View ledger
```

show:

```
```

```
Paracetamol 500mg
Main Store
Base Unit: Tablet

[Batch: All ▾] [Date range ▾]


Opening Balance                         500


Date          Reference       IN       OUT      Balance
────────────────────────────────────────────────────────
Sep 01        Opening        500                 500
Sep 03        Purchase        300                 800
Sep 05        Sale                       50       750
Sep 07        Sale                       20       730
Sep 09        Adjustment                  5       725


Closing Balance                         725
```

This maps directly to your backend's **bin card**, which returns opening balance, movements and closing balance. 

This is actually one of the most valuable screens for a pharmacy because an inventory manager can answer:

> "Why does the system say we have 725 tablets?"

---

# 8. Inventory → Batches & Expiry

I would combine these into one section because they are tightly related.

```
```

```
Batches & Expiry
```

Then use tabs:

```
```

```
Batches | Expiring Soon | Expired | Actions
```

---

## Batches tab

```
```

```
Batches                                      [+ Add Batch]

[Search batch/product...] [Location ▾] [Status ▾]

Product        Batch       Received     Expiry       Stock     Status
Paracetamol    PCM001      Jan 10       Aug 2027     800      Available
Amoxicillin    AMX004      Feb 02       Oct 2026     120      Low
Ibuprofen      IBU002      Mar 12       Sep 2026       0      Depleted
```

Your batch API provides batch number, manufacturing date, received date, expiry date, purchase cost, supplier reference, quantity, status and days until expiry. 

---

# 9. Expiring Soon

This should be much more visual.

```
```

```
Expiry Monitoring

[All Locations ▾]

┌─────────────────────────────────────────────────────┐
│ Critical — within 30 days                           │
│                                                     │
│ Amoxicillin 250mg       Batch AMX004      18 days   │
│ 120 capsules            Main Store                  │
│                                                     │
│ Vitamin D               Batch VIT009      24 days   │
│ 80 bottles              Main Store                  │
└─────────────────────────────────────────────────────┘


Within 60 days     14 batches
Within 90 days     27 batches
Already expired     4 batches
```

The backend explicitly has expiry dashboard metrics and expiry-window filtering, including `windowStart` and `windowEnd`, plus location/product filtering. 

### Don't make expiry just a table.

The urgency should be visually obvious.

Something like:

```
```

```
🔴 Expired
🟠 ≤ 30 days
🟡 ≤ 60 days
○ 61–90 days
```

---

# 10. Batch Detail

Clicking a batch:

```
```

```
← Batches

Paracetamol 500mg
Batch: PCM001

┌─────────────────────┐
│ Stock               │
│ 800 Tablets         │
└─────────────────────┘

Batch Information
Batch Number       PCM001
Received Date      Jan 10, 2026
Manufactured       Dec 10, 2025
Expiry             Aug 31, 2027
Purchase Cost      1.20 ETB
Supplier Ref       INV-1023

Stock by Location
Main Store          600
Pharmacy            200


Transactions

Date       Type        Qty       Balance
...
```

The backend batch detail specifically provides stock by location and batch transaction access. 

---

# 11. Inventory → Transfers

This should feel like a workflow page.

### Main page

```
```

```
Transfers                               [+ New Transfer]

[Search...] [Status ▾] [From ▾] [To ▾]

Transfer #     From          To          Items   Status      Date
TR-00124       Main Store    Pharmacy      4    Completed   Sep 10
TR-00125       Pharmacy      Main Store    2    Pending     Sep 10
TR-00126       Main Store    Pharmacy      3    Draft       Sep 10
```

The backend supports:

```
```

```
DRAFT
PENDING
COMPLETED
CANCELLED
```

and separate endpoints for editing items, completing and cancelling transfers. 

### New Transfer

Make this a proper document-style screen:

```
```

```
New Stock Transfer

From Location      [ Main Store ▾ ]
To Location        [ Pharmacy ▾ ]
Transfer Date      [ Sep 10, 2026 ]
Reason              [________________]


Items

Product        Batch       Unit       Qty       Base Qty
Paracetamol    PCM001      Box        5         500
Amoxicillin    AMX004      Strip      10        100

                                      [+ Add Item]


                    [Save Draft] [Complete Transfer]
```

Do **not** make it look like a POS cart.

It's an inventory document.

---

# 12. Inventory → Reorder

This should be a **work queue**, not a configuration page.

```
```

```
Reorder

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Critical     │ │ High         │ │ Medium       │
│      5       │ │      12      │ │      24      │
└──────────────┘ └──────────────┘ └──────────────┘


Reorder Suggestions

Product       Current Stock   Reorder Point   Suggested Qty   Urgency
Amoxicillin       20              50               100         Critical
Ibuprofen         35              60               80          High
Vitamin C         70             100              100          Medium

                         [Generate Purchase Requirements]
```

The backend explicitly separates the reorder dashboard, reorder suggestions, per-product reorder configuration, and purchase-requirement generation. 

---

# 13. Product → Reorder Configuration

Don't make this a major page.

Put it inside Product Detail:

```
```

```
Paracetamol 500mg

Overview | Stock | Batches | Reorder | Transactions
```

Then:

```
```

```
Reorder Configuration

Minimum Stock Level       100
Reorder Point             150
Lead Time                 7 days
Reorder Quantity          500

Sales Velocity             [ On / Off ]
Buffer Percentage          20%

                    [Save Configuration]
```

The backend has a dedicated get/update endpoint for this exact configuration. 

---

# 14. Inventory → Settings

This is where I would put the master data.

```
```

```
Inventory
   Settings
      Product Groups
      Units
      Locations
```

## Product Groups

Simple management table:

```
```

```
Product Groups                       [+ Add Group]

Group                  Products      Status
Analgesics                42         Active
Antibiotics               61         Active
Vitamins                  23         Active
Medical Supplies          18         Active
```

The backend supports search, active filtering, create, update and deactivation. 

---

# 15. Units

This should be a very simple master-data screen.

```
```

```
Units                                  [+ Add Unit]

Search units...

Unit          Symbol       Status
Tablet        TAB          Active
Strip         STR          Active
Box           BOX          Active
Bottle        BTL          Active
Capsule       CAP          Active
```

Remember:

**Unit is not product-specific.**

So don't put prices or conversion factors here.

Those belong to Product → Units.

The backend explicitly describes `Unit` as the reusable master concept and product-specific behavior as `ProductUnit`. 

---

# 16. Locations

Another simple master-data screen:

```
```

```
Locations                              [+ Add Location]

Location             Status       Stock Items
Main Store            Active          843
Pharmacy              Active          512
Cold Storage          Active           82
```

Click:

```
```

```
Main Store

Description
...

Current Stock
...

Recent Movements
...
```

The backend provides location listing, creation, detail, update and deactivation. 

---

# 17. The important relationship between pages

I would design the navigation around **how an inventory manager thinks**, rather than around your API endpoints.

### Sidebar

```
```

```
INVENTORY

Overview
Products
Stock
Batches & Expiry
Transfers
Reorder

SETTINGS

Product Groups
Units
Locations
```

### But internally:

```
```

```
Products
   │
   ├── Overview
   ├── Stock
   ├── Batches
   ├── Reorder
   └── Transactions
```

And:

```
```

```
Stock
   │
   ├── Current Stock
   ├── Movements
   └── Bin Card
```

And:

```
```

```
Batches & Expiry
   │
   ├── All Batches
   ├── Expiring Soon
   ├── Expired
   └── Batch Detail
```

This gives you a **much more coherent pharmacy application**.

---

# 18. One thing I would NOT do

I wouldn't create sidebar items like:

```
```

```
❌ Dashboard
❌ Product Groups
❌ Locations
❌ Batches
❌ Expiry
❌ Reorder Dashboard
❌ Reorder Suggestions
❌ Units
❌ Products
❌ Product Units
❌ Transfers
❌ Stock
❌ Bin Card
❌ Transactions
```

That's basically exposing your API architecture directly to the user.

Your backend has separate API tags for these domains because they're technically useful, but the UI doesn't need to mirror every backend endpoint. The documentation itself lists separate tags for Products, Product Units, Batches, Expiry, Reorder, Units, Transfers and Stock. 

---

# 19. My recommended final inventory structure

If I were designing this for your pharmacy, I'd settle on:

```
```

```
┌─────────────────────────┐
│ Pharmacy                │
├─────────────────────────┤
│                         │
│ Dashboard               │
│                         │
│ POS                     │
│                         │
│ Inventory       ▾       │
│   Overview              │
│   Products              │
│   Stock                 │
│   Batches & Expiry      │
│   Transfers             │
│   Reorder               │
│                         │
│ Sales                   │
│                         │
│ ─────────────────────── │
│ Settings                │
│   Product Groups        │
│   Units                 │
│   Locations             │
│                         │
└─────────────────────────┘
```

And the **core UX flow** becomes:

```
```

```
                 INVENTORY
                     │
       ┌─────────────┼─────────────┐
       ↓             ↓             ↓
   Products        Stock       Batches/Expiry
       │             │             │
       │             │             ├── Expiring
       │             │             └── Expired
       │             │
       ├── Stock     └── Movements
       ├── Batches       └── Bin Card
       ├── Reorder
       └── Transactions

              Transfers

               Reorder
                  │
                  ↓
          Purchase Requirements

              Settings
          /      |       \
 Product Groups Units   Locations
```

**That is the structure I'd use.** It keeps the UI simple while still exposing essentially all of the functionality your current backend already supports. 

And importantly, I wouldn't add UI functionality that the current backend doesn't support yet. For example, the current documentation supports stock adjustments/opening stock, but those should appear as **actions/modals from the Stock area**, rather than becoming giant top-level pages. 

---

If you want, I can:

* Expand with UI wireframes and component details 
* Describe user roles and permission considerations 
* Suggest a roadmap for implementing the inventory UI   give me figma prompt for the above i have aready some design figma make but i want it to look like the above one so based on the above give me figma make prompt  for figma make
*
