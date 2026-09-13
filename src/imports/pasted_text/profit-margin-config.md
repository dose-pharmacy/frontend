# FIGMA PROMPT: FINANCIALS, REPORTING & ANALYTICS MODULE

```
Design a comprehensive Financials, Reporting & Analytics interface for a Pharmacy Management System with the following specifications:

## DESIGN SYSTEM

### Color Palette
- Primary Color: #49B0C1 (darkest blue) - Headers, primary buttons, navigation, important UI elements
- Secondary/Mid-tone Blue: #ABDBE3 - Accents, hover states, secondary buttons, transition elements
- Light Blue: #DBEFF3 - Cards, containers, section backgrounds, subtle highlights
- Background: White (#FFFFFF) - Main background color
- Text Colors: #333333 (primary text), #666666 (secondary text), White (on primary backgrounds)
- Status Colors: Green (#28A745), Yellow (#FFC107), Red (#DC3545), Orange (#FD7E14), Gray (#6C757D), Purple (#6F42C1)

### Chart Colors (for visualizations)
- Series 1: #49B0C1 (primary blue)
- Series 2: #ABDBE3 (light blue)
- Series 3: #28A745 (green)
- Series 4: #FFC107 (yellow)
- Series 5: #DC3545 (red)
- Series 6: #6F42C1 (purple)
- Series 7: #FD7E14 (orange)

### Iconography
- Use FontAwesome or similar icon library
- Icons should be consistent in style and size (16-24px)
- All icons should have proper accessibility labels
- Icon colors should match text color or use status colors

### Typography
- Headings: Bold, 24-32px
- Subheadings: Semi-bold, 18-20px
- Body Text: Regular, 14-16px
- Small Text: Regular, 12px
- Large Numbers: Bold, 28-48px (for KPIs)
- Chart Labels: Regular, 12px

### Component Styles
- Buttons: Primary (#49B0C1) with white text, Secondary (#ABDBE3) with dark text
- Cards: Light blue (#DBEFF3) background, 8px border radius, box shadow
- Inputs: White background, #ABDBE3 borders, 8px border radius
- Tables: Alternating rows (white and #DBEFF3)
- Charts: #ABDBE3 backgrounds for chart containers, clean minimal design
- All components: Rounded edges (4-12px border radius)

---

## PAGE 1: PROFIT MARGIN CONFIGURATION PAGE

### Purpose
Define and manage profit margins by product group. This is the configuration page for setting margin rules that affect pricing across the pharmacy.

### Page Header
```
Position: Fixed top, full width
Background: #49B0C1
Height: 64px
Padding: 0 24px
Elements:
  - Left: System Logo + "Pharmacy Management System"
  - Center: Navigation tabs: Dashboard, Inventory, POS, Purchasing, Reports, Settings
    * "Reports" should be highlighted as active
  - Right: User profile with user icon, Notifications bell icon, Logout sign-out icon
```

### Page Sub-header
```
Background: White
Padding: 16px 24px
Border-bottom: 1px solid #ABDBE3
Layout: Flex, justify-between, align-center

Contents:
  - Left:
    * "Profit Margin Configuration" (24px, bold, #333333)
    * Breadcrumb: "Reports" → "Margins" (14px, #666666)
    * "Manage profit margins by product group" (14px, #666666)
  
  - Right:
    * "Last Updated: Today, 10:30 AM" (12px, #666666)
    * "Export" button (secondary #ABDBE3)
```

### Product Group Selector
```
Background: #DBEFF3
Padding: 16px 24px
Margin: 16px 24px 0 24px
Border-radius: 8px
Layout: Flex, align-center, gap 16px
```

#### Selector Components
```
1. "Select Product Group" (14px, #666666)
2. Dropdown with chevron-down icon
   - Options: Painkillers, Antibiotics, Vitamins, Supplements, Medical Devices
   - Selected: Painkillers (14px, bold, #333333)
   - White background, #ABDBE3 border
   - Border-radius: 6px
   - Padding: 8px 16px
   - Width: 200px

3. Group Statistics (displayed next to dropdown):
   - "Products: 245" (14px, #666666)
   - "Current Average Margin: 15.2%" (14px, #28A745)
   - "Last Updated: 02/15/2026" (12px, #666666)
```

### Margin Settings Form
```
Background: White
Padding: 24px
Margin: 16px 24px
Border-radius: 8px
Border: 1px solid #DBEFF3
```

#### Form Layout
```
1. Group Name (Display only):
   - Label: "Product Group" (14px, #666666)
   - Value: "Painkillers" (16px, bold, #333333)
   - Background: #DBEFF3
   - Padding: 8px 12px
   - Border-radius: 6px

2. Default Margin:
   - Label: "Default Margin" (14px, #666666)
   - Input: "15" (number) with "%" suffix
   - White background, #ABDBE3 border
   - Border-radius: 6px
   - Padding: 8px 12px
   - Width: 120px
   - Helper text: "Default margin percentage for all products in this group"

3. Minimum Margin:
   - Label: "Minimum Allowed Margin" (14px, #666666)
   - Input: "10" with "%" suffix
   - White background, #ABDBE3 border
   - Border-radius: 6px
   - Padding: 8px 12px
   - Width: 120px
   - Helper text: "Lowest margin allowed for any product in this group"

4. Maximum Margin:
   - Label: "Maximum Allowed Margin" (14px, #666666)
   - Input: "25" with "%" suffix
   - White background, #ABDBE3 border
   - Border-radius: 6px
   - Padding: 8px 12px
   - Width: 120px
   - Helper text: "Highest margin allowed for any product in this group"

5. Calculation Method:
   - Label: "Margin Calculation Method" (14px, #666666)
   - Radio buttons (horizontal):
     * "Auto-calculate Selling Price" - Cost Price + Margin = Selling Price
     * "Reference/Reporting Only" - Margin used for reporting only
   - Selected: "Auto-calculate Selling Price" (radio #49B0C1)
   - Helper text: "How margin will be applied to products in this group"
```

### Margin Preview Section
```
Background: #DBEFF3
Padding: 16px 20px
Margin: 0 24px 16px 24px
Border-radius: 8px
```

#### Preview Content
```
Header: "Impact Preview" (16px, bold, #333333)

Layout: Horizontal, 3 cards, gap 16px

Card 1:
  - "Average Margin" (12px, #666666)
  - "15.2%" (24px, bold, #49B0C1)
  - "Up from 14.8% (+0.4%)" (12px, #28A745, arrow-up icon)

Card 2:
  - "Products Affected" (12px, #666666)
  - "245 products" (24px, bold, #333333)
  - "All products in this group" (12px, #666666)

Card 3:
  - "Estimated Impact" (12px, #666666)
  - "+12,450 ETB" (24px, bold, #28A745)
  - "Projected monthly increase" (12px, #666666)
```

### Products in Group Table
```
Background: White
Margin: 0 24px 16px 24px
Border-radius: 8px
Overflow: hidden
Border: 1px solid #DBEFF3
```

#### Table Design
```
Table Header:
  Background: #ABDBE3
  Padding: 12px 16px
  
  Columns:
    1. # (14px, bold, #333333)
    2. Product (14px, bold, #333333)
    3. Brand (14px, bold, #333333)
    4. Cost Price (14px, bold, #333333)
    5. Current Sell Price (14px, bold, #333333)
    6. Current Margin (14px, bold, #333333)
    7. New Sell Price (14px, bold, #333333)
    8. New Margin (14px, bold, #333333)

Table Rows:
  Background: White (alternating #DBEFF3)
  Padding: 12px 16px
  Border-bottom: 1px solid #DBEFF3

  Row Example 1:
    1. #: "1"
    2. Product: "Panadol 500mg" (14px, #333333)
    3. Brand: "Panadol" (14px, #666666)
    4. Cost Price: "200.00 ETB" (14px, #333333)
    5. Current Sell Price: "250.00 ETB" (14px, #333333)
    6. Current Margin: "20%" (14px, #28A745)
    7. New Sell Price: "230.00 ETB" (14px, #49B0C1)
    8. New Margin: "15%" (14px, #FFC107)

  Row Example 2:
    1. #: "2"
    2. Product: "Advil 200mg" (14px, #333333)
    3. Brand: "Advil" (14px, #666666)
    4. Cost Price: "180.00 ETB" (14px, #333333)
    5. Current Sell Price: "210.00 ETB" (14px, #333333)
    6. Current Margin: "14.3%" (14px, #FFC107)
    7. New Sell Price: "207.00 ETB" (14px, #49B0C1)
    8. New Margin: "15%" (14px, #28A745)

Status Indicators:
  - Margin Increase: Green arrow-up icon
  - Margin Decrease: Yellow arrow-down icon
  - No Change: Gray dash icon
```

### Action Buttons
```
Background: White
Padding: 16px 24px
Border-top: 1px solid #DBEFF3
Position: Sticky bottom
Layout: Flex, justify-end, gap 12px

Buttons:
  1. "Cancel":
     - Background: #DC3545 (red)
     - Text: "Cancel", 14px, white
     - Border-radius: 6px
     - Padding: 10px 24px
     - xmark icon

  2. "Preview Changes":
     - Background: #ABDBE3
     - Text: "Preview Changes", 14px, #333333
     - Border-radius: 6px
     - Padding: 10px 24px
     - Eye icon

  3. "Apply to All":
     - Background: #49B0C1 (primary)
     - Text: "Apply to All", 14px, white
     - Border-radius: 6px
     - Padding: 10px 32px
     - Font-weight: bold
     - Check icon
     - Disabled if no changes made
```

---

## PAGE 2: PROFITABILITY DASHBOARD

### Purpose
View profit margins and profitability analysis across brands, product groups, and time periods.

### Page Header
```
Background: #49B0C1
Padding: 16px 24px
Layout: Flex, justify-between, align-center

Contents:
  - Left:
    * "Profitability Report" (24px, bold, white)
    * Breadcrumb: "Reports" → "Profitability" (14px, #ABDBE3)
  
  - Right:
    * Date range picker with calendar icon
    * "Export" button (secondary #ABDBE3 with white border, white text)
    * "Print" button (secondary with printer icon, white text)
```

### Filter Section
```
Background: #DBEFF3
Padding: 12px 24px
Layout: Flex, align-center, gap 16px
Border-bottom: 1px solid #ABDBE3
```

#### Filter Components
```
1. Date Range:
   - Date picker with calendar icon
   - From: [02/01/2026] To: [02/28/2026]
   - White background, #ABDBE3 border
   - Border-radius: 6px

2. Analysis Level:
   - Label: "Analysis Level" (12px, #666666)
   - Dropdown with chevron-down icon
   - Options: Overall, By Brand, By Product Group, By Product
   - Selected: By Brand
   - White background, #ABDBE3 border

3. Compare Period:
   - Toggle: "Compare to Previous Period"
   - #49B0C1 when active
   - Options: Previous Month, Previous Quarter, Previous Year
   - Visible when toggle is on

4. "Refresh" button:
   - Secondary (#ABDBE3)
   - Rotate icon
   - 12px text
```

### Key Metrics Cards
```
Layout: Horizontal row, 4 cards, gap 16px
Padding: 16px 24px
Background: White
```

#### Card Designs
```
Each Card:
  Background: White (or #DBEFF3)
  Border: 1px solid #DBEFF3
  Border-radius: 8px
  Padding: 16px 20px
  Flex: 1
  Box-shadow: 0 2px 4px rgba(0,0,0,0.05)

  Contents:
    - Icon in circle (primary color background or status color)
    - Label: Metric name (12px, #666666)
    - Value: Large number (24px, bold, #333333)
    - Change indicator: (12px)
      * Green arrow-up for increase
      * Red arrow-down for decrease

Cards:
  1. Total Revenue:
     - Icon: money-bill-wave (green)
     - Label: "Total Revenue"
     - Value: "1,245,750.00 ETB"
     - Change: "+12.5% from last month" (green)

  2. Total Cost:
     - Icon: coins (orange)
     - Label: "Total Cost"
     - Value: "892,340.00 ETB"
     - Change: "+8.3% from last month" (red)

  3. Gross Profit:
     - Icon: chart-line (blue)
     - Label: "Gross Profit"
     - Value: "353,410.00 ETB"
     - Change: "+15.2% from last month" (green)

  4. Average Margin:
     - Icon: percentage (purple)
     - Label: "Average Margin"
     - Value: "28.4%"
     - Change: "+2.1% from last month" (green)
```

### Brand Analysis Section
```
Background: #DBEFF3
Margin: 0 24px 16px 24px
Padding: 16px 20px
Border-radius: 8px
```

#### Section Header
```
Layout: Flex, justify-between, align-center
Border-bottom: 1px solid #ABDBE3
Padding-bottom: 12px

Contents:
  - Left:
    * "Brand Analysis" (16px, bold, #333333)
    * "Top 5 brands by profitability" (12px, #666666)
  - Right:
    * "View All" link (14px, #49B0C1)
```

#### Brand Analysis Table
```
Table:
  Header:
    Background: #ABDBE3
    Columns:
      1. Brand (14px, bold)
      2. Revenue (14px, bold)
      3. Cost (14px, bold)
      4. Profit (14px, bold)
      5. Margin % (14px, bold)
      6. Trend (14px, bold)

  Rows:
    Background: White (alternating #DBEFF3)
    Border-bottom: 1px solid #DBEFF3

    Row Example 1:
      - Brand: "Panadol" (14px, bold, #333333)
      - Revenue: "245,500.00 ETB" (14px, #333333)
      - Cost: "175,200.00 ETB" (14px, #333333)
      - Profit: "70,300.00 ETB" (14px, #28A745)
      - Margin: "28.6%" (14px, #28A745, bold)
      - Trend: "📈 +5.2%" (14px, green)

    Row Example 2:
      - Brand: "Advil" (14px, bold, #333333)
      - Revenue: "189,200.00 ETB" (14px, #333333)
      - Cost: "145,600.00 ETB" (14px, #333333)
      - Profit: "43,600.00 ETB" (14px, #28A745)
      - Margin: "23.0%" (14px, #FFC107, bold)
      - Trend: "📈 +2.1%" (14px, green)

    Row Example 3:
      - Brand: "Cecon" (14px, bold, #333333)
      - Revenue: "167,800.00 ETB" (14px, #333333)
      - Cost: "128,400.00 ETB" (14px, #333333)
      - Profit: "39,400.00 ETB" (14px, #28A745)
      - Margin: "23.5%" (14px, #FFC107, bold)
      - Trend: "📉 -1.2%" (14px, red)

  Chart Visualization (bar chart):
    - Horizontal bar chart showing margin % for each brand
    - Bars: #49B0C1 (primary color)
    - X-axis: Brand names
    - Y-axis: Margin percentage
    - Tooltip on hover showing exact values
    - #ABDBE3 background for chart container
```

### Product Group Analysis Section
```
Background: White
Margin: 0 24px 16px 24px
Padding: 16px 20px
Border-radius: 8px
Border: 1px solid #DBEFF3
```

#### Section Header
```
Layout: Flex, justify-between, align-center
Border-bottom: 1px solid #DBEFF3
Padding-bottom: 12px

Contents:
  - Left:
    * "Product Group Analysis" (16px, bold, #333333)
    * "Performance by category" (12px, #666666)
  - Right:
    * "View All" link (14px, #49B0C1)
```

#### Product Group Table
```
Table:
  Header:
    Background: #ABDBE3
    Columns:
      1. Product Group (14px, bold)
      2. Sales (14px, bold)
      3. Profit (14px, bold)
      4. Margin % (14px, bold)
      5. Performance (14px, bold)

  Rows:
    Background: White (alternating #DBEFF3)
    Border-bottom: 1px solid #DBEFF3

    Row Example 1:
      - Group: "Painkillers" (14px, bold, #333333)
      - Sales: "425,500.00 ETB" (14px, #333333)
      - Profit: "98,250.00 ETB" (14px, #28A745)
      - Margin: "23.1%" (14px, #28A745)
      - Performance: "⭐ Top Performer" (14px, green)

    Row Example 2:
      - Group: "Antibiotics" (14px, bold, #333333)
      - Sales: "312,800.00 ETB" (14px, #333333)
      - Profit: "68,200.00 ETB" (14px, #28A745)
      - Margin: "21.8%" (14px, #FFC107)
      - Performance: "📈 Growing" (14px, yellow)

    Row Example 3:
      - Group: "Vitamins" (14px, bold, #333333)
      - Sales: "289,400.00 ETB" (14px, #333333)
      - Profit: "55,100.00 ETB" (14px, #28A745)
      - Margin: "19.0%" (14px, #FFC107)
      - Performance: "📊 Stable" (14px, blue)

    Row Example 4:
      - Group: "Supplements" (14px, bold, #333333)
      - Sales: "218,050.00 ETB" (14px, #333333)
      - Profit: "32,860.00 ETB" (14px, #28A745)
      - Margin: "15.1%" (14px, #DC3545)
      - Performance: "⚠️ Needs Review" (14px, red)
```

### Charts Section
```
Background: #DBEFF3
Margin: 0 24px 16px 24px
Padding: 16px 20px
Border-radius: 8px
Layout: Grid (2 columns), gap 16px
```

#### Chart 1: Profit Margin Trends
```
Container: #ABDBE3 background
Border-radius: 8px
Padding: 16px

Header: "Profit Margin Trends (Monthly)" (14px, bold, #333333)

Chart Type: Line chart
  - X-axis: Months (Jan, Feb, Mar, Apr, May, Jun)
  - Y-axis: Percentage (%)
  - Lines:
    * Overall Margin: #49B0C1 (solid)
    * Painkillers: #28A745 (dashed)
    * Antibiotics: #FFC107 (dotted)
    * Vitamins: #6F42C1 (dashed)
  - Points: Circles on data points
  - Grid: Light gray horizontal lines
  - Legend: Bottom of chart
  - Hover: Tooltip showing values
  - Height: 250px
```

#### Chart 2: Revenue by Product Group
```
Container: #ABDBE3 background
Border-radius: 8px
Padding: 16px

Header: "Revenue by Product Group" (14px, bold, #333333)

Chart Type: Bar chart or Pie chart
  - Bar chart:
    * X-axis: Product Groups (Painkillers, Antibiotics, Vitamins, Supplements, Medical Devices)
    * Y-axis: Revenue (ETB)
    * Bars: #49B0C1
    * Each bar showing revenue amount on top
    * Height: 250px
  - Pie chart:
    * Slices: Painkillers (35%), Antibiotics (25%), Vitamins (20%), Supplements (15%), Medical Devices (5%)
    * Colors: #49B0C1, #ABDBE3, #28A745, #FFC107, #6F42C1
    * Labels showing percentage
    * Hover: Tooltip with exact values
    * Height: 250px
```

---

## PAGE 3: STOCK PERFORMANCE DASHBOARD

### Purpose
Identify slow-moving and dead stock to optimize inventory management and cash flow.

### Page Header
```
Background: #49B0C1
Padding: 16px 24px
Layout: Flex, justify-between, align-center

Contents:
  - Left:
    * "Stock Performance Report" (24px, bold, white)
    * Breadcrumb: "Reports" → "Stock Performance" (14px, #ABDBE3)
    * "Last Updated: Today, 10:30 AM" (14px, white)
  
  - Right:
    * "Generate Report" button (primary with white border, white text, rotate icon)
    * "Export CSV" button (secondary #ABDBE3 with white border, white text)
    * "Print" button (secondary with printer icon, white text)
```

### Filter Section
```
Background: #DBEFF3
Padding: 12px 24px
Layout: Flex, align-center, gap 16px
Border-bottom: 1px solid #ABDBE3
```

#### Filter Components
```
1. Analysis Period:
   - Label: "Analysis Period" (12px, #666666)
   - Dropdown with chevron-down icon
   - Options: Last 30 Days, Last 60 Days, Last 90 Days, Custom
   - Selected: Last 90 Days
   - White background, #ABDBE3 border

2. Movement Threshold:
   - Label: "Movement Threshold" (12px, #666666)
   - Input: "10" (number) with "units/month" suffix
   - White background, #ABDBE3 border
   - Border-radius: 6px
   - Padding: 6px 12px
   - Width: 120px
   - Helper: "Products selling below this threshold are considered slow-moving"

3. Category Filter:
   - Label: "Category" (12px, #666666)
   - Dropdown: All Categories, Painkillers, Antibiotics, Vitamins, Supplements
   - White background, #ABDBE3 border

4. "Apply" Button:
   - Background: #49B0C1 (primary)
   - Text: "Apply", 12px, white
   - Border-radius: 6px
   - Padding: 6px 16px
```

### Summary Statistics Cards
```
Layout: Horizontal row, 4 cards, gap 16px
Padding: 16px 24px
Background: White
```

#### Card Designs
```
1. Total Products:
   - Icon: pills (blue)
   - Label: "Total Products"
   - Value: "1,245" (24px, bold, #333333)
   - Change: "All inventory items" (12px, #666666)

2. Slow-Moving Products:
   - Icon: clock (yellow)
   - Label: "Slow-Moving Items"
   - Value: "87" (24px, bold, #FFC107)
   - Change: "7.0% of total" (12px, #666666)
   - Show count: "42 items > 60 days in stock"

3. Dead Stock:
   - Icon: box (red)
   - Label: "Dead Stock Items"
   - Value: "23" (24px, bold, #DC3545)
   - Change: "1.8% of total" (12px, #666666)
   - Show count: "12 items > 180 days in stock"

4. Dead Stock Value:
   - Icon: money-bill (red)
   - Label: "Value of Dead Stock"
   - Value: "67,450.00 ETB" (24px, bold, #DC3545)
   - Change: "Tied in non-moving inventory" (12px, #666666)
```

### Slow-Moving Products Table
```
Background: White
Margin: 0 24px 16px 24px
Border-radius: 8px
Overflow: hidden
Border: 1px solid #DBEFF3
```

#### Table Design
```
Table Header:
  Background: #ABDBE3
  Padding: 12px 16px
  
  Columns:
    1. # (14px, bold, #333333)
    2. Product (14px, bold, #333333)
    3. Category (14px, bold, #333333)
    4. Stock Qty (14px, bold, #333333)
    5. Days in Stock (14px, bold, #333333)
    6. Units Sold (Period) (14px, bold, #333333)
    7. Turnover Rate (14px, bold, #333333)
    8. Status (14px, bold, #333333)
    9. Action (14px, bold, #333333)

Table Rows:
  Background: White (alternating #DBEFF3)
  Padding: 12px 16px
  Border-bottom: 1px solid #DBEFF3

  Row Example 1 - Slow-Moving:
    1. #: "1"
    2. Product: "Vitamin C 1000mg" (14px, #333333)
       Brand: "Cecon" (12px, #666666)
    3. Category: "Vitamins" (14px, #333333)
    4. Stock Qty: "150 Boxes" (14px, #FFC107)
    5. Days in Stock: "85 Days" (14px, #FFC107, clock icon)
    6. Units Sold: "12 units" (14px, #333333)
    7. Turnover Rate: "0.14" (14px, #FFC107)
    8. Status: "⚠️ Slow-Moving" (yellow badge, exclamation-triangle icon)
    9. Action: "View" (eye icon) & "Action" (chevron-down dropdown)

  Row Example 2 - Dead Stock:
    1. #: "2"
    2. Product: "Amoxicillin 250mg" (14px, #333333)
       Brand: "Amoxil" (12px, #666666)
    3. Category: "Antibiotics" (14px, #333333)
    4. Stock Qty: "200 Boxes" (14px, #DC3545)
    5. Days in Stock: "195 Days" (14px, #DC3545, clock icon)
    6. Units Sold: "3 units" (14px, #333333)
    7. Turnover Rate: "0.015" (14px, #DC3545)
    8. Status: "🔥 Dead Stock" (red badge, fire icon)
    9. Action: "View" (eye icon) & "Action" (chevron-down dropdown)

  Row Example 3 - Moderate:
    1. #: "3"
    2. Product: "Multivitamin Tablets" (14px, #333333)
       Brand: "Centrum" (12px, #666666)
    3. Category: "Supplements" (14px, #333333)
    4. Stock Qty: "45 Bottles" (14px, #333333)
    5. Days in Stock: "42 Days" (14px, #333333)
    6. Units Sold: "18 units" (14px, #333333)
    7. Turnover Rate: "0.43" (14px, #333333)
    8. Status: "📊 Moderate" (blue badge, chart-simple icon)
    9. Action: "View" & "Action"
```

### Action Recommendations Section
```
Background: #DBEFF3
Margin: 0 24px 16px 24px
Padding: 16px 20px
Border-radius: 8px
```

#### Section Header
```
Layout: Flex, justify-between, align-center
Border-bottom: 1px solid #ABDBE3
Padding-bottom: 12px

Contents:
  - Left:
    * "Action Recommendations" (16px, bold, #333333)
    * "Suggested actions for slow-moving products" (12px, #666666)
  - Right:
    * "Apply Bulk Actions" checkbox (14px, #49B0C1)
```

#### Recommendation Cards
```
Each Product Recommendation:
  Background: White
  Border: 1px solid #DBEFF3
  Border-radius: 8px
  Padding: 12px 16px
  Margin-bottom: 8px
  Layout: Flex, justify-between, align-center

  Product: "Vitamin C 1000mg" (14px, bold, #333333)
  Category: "Vitamins" (12px, #666666)
  Stock Value: "37,500.00 ETB" (14px, #333333)
  Days in Stock: "85 Days" (14px, #FFC107)

  Recommended Actions (buttons):
    1. "Discount Sale" (primary #49B0C1, 12px, white)
       - Discount suggested: 20-30%
    2. "Return to Supplier" (secondary #ABDBE3, 12px, dark)
    3. "Bundle with Popular Item" (secondary #ABDBE3, 12px, dark)
    4. "Promotion" (secondary #ABDBE3, 12px, dark)
```

### Charts Section
```
Background: #ABDBE3
Margin: 0 24px 16px 24px
Padding: 16px 20px
Border-radius: 8px
Layout: Grid (2 columns), gap 16px
```

#### Chart 1: Stock Turnover by Category
```
Container: #DBEFF3 background
Border-radius: 8px
Padding: 16px

Header: "Stock Turnover by Category" (14px, bold, #333333)

Chart Type: Bar chart (horizontal)
  - X-axis: Turnover Rate
  - Y-axis: Product Categories (Painkillers, Antibiotics, Vitamins, Supplements, Medical Devices)
  - Bars: Color-coded
    * Painkillers: #28A745 (green) - 8.2
    * Antibiotics: #49B0C1 (blue) - 6.5
    * Vitamins: #FFC107 (yellow) - 4.3
    * Supplements: #FD7E14 (orange) - 3.1
    * Medical Devices: #DC3545 (red) - 1.8
  - Reference line: Target turnover rate (5.0)
  - Tooltip on hover showing exact values
  - Height: 250px
```

#### Chart 2: Value of Dead Stock Over Time
```
Container: #DBEFF3 background
Border-radius: 8px
Padding: 16px

Header: "Value of Dead Stock Over Time" (14px, bold, #333333)

Chart Type: Line chart
  - X-axis: Months (Sep, Oct, Nov, Dec, Jan, Feb)
  - Y-axis: Value (ETB)
  - Line: #DC3545 (red)
  - Area fill: #FFEBEE (light red, opacity 30%)
  - Points: Circles on data points
  - Grid: Light gray horizontal lines
  - Trend line: Dashed line showing trend
  - Hover: Tooltip with exact values
  - Height: 250px
  - Current value annotation: "Dead Stock Value: 67,450 ETB" (14px, bold, #DC3545)
```

### Pagination
```
Position: Bottom of table
Background: White
Padding: 12px 24px
Border-top: 1px solid #DBEFF3
Layout: Flex, justify-between, align-center

Contents:
  - Left: "Showing 1-10 of 87 slow-moving products" (14px, #666666)
  - Right: Previous/Next buttons with page numbers
```

---

## PAGE 4: SALES REPORT DASHBOARD

### Purpose
View sales performance across time periods with comprehensive analytics and breakdowns.

### Page Header
```
Background: #49B0C1
Padding: 16px 24px
Layout: Flex, justify-between, align-center

Contents:
  - Left:
    * "Sales Reports" (24px, bold, white)
    * Breadcrumb: "Reports" → "Sales" (14px, #ABDBE3)
  
  - Right:
    * Date range picker with calendar icon
    * "Export" button (secondary #ABDBE3 with white border, white text)
    * "Print" button (secondary with printer icon, white text)
```

### Period Tabs
```
Background: #DBEFF3
Padding: 8px 24px
Layout: Horizontal, gap 8px
```

#### Tab Design
```
Tabs:
  1. "Daily" - Active: #49B0C1 background, white text
  2. "Weekly" - Inactive: White background, dark text
  3. "Monthly" - Inactive: White background, dark text
  4. "Quarterly" - Inactive: White background, dark text
  5. "Annual" - Inactive: White background, dark text
  6. "Custom" - Inactive: White background, dark text

Each Tab:
  Border-radius: 6px
  Padding: 8px 20px
  Font-size: 14px
  Hover: #ABDBE3 background
```

### Key Metrics Cards
```
Layout: Horizontal row, 4 cards, gap 16px
Padding: 16px 24px
Background: White
```

#### Card Designs
```
1. Total Sales:
   - Icon: money-bill-wave (green)
   - Label: "Total Sales"
   - Value: "45,750.00 ETB" (24px, bold, #333333)
   - Change: "+12.5% vs yesterday" (green, arrow-up)

2. Transactions:
   - Icon: shopping-cart (blue)
   - Label: "Transactions"
   - Value: "127" (24px, bold, #333333)
   - Change: "+8.3% vs yesterday" (green)

3. Average Transaction Value:
   - Icon: wallet (purple)
   - Label: "Avg. Transaction"
   - Value: "360.24 ETB" (24px, bold, #333333)
   - Change: "+3.9% vs yesterday" (green)

4. Top Selling Product:
   - Icon: pills (orange)
   - Label: "Top Product"
   - Value: "Panadol" (24px, bold, #333333)
   - Units Sold: "48 units today" (12px, #666666)
```

### Filter Section
```
Background: #DBEFF3
Padding: 8px 24px
Layout: Flex, align-center, gap 16px
```

#### Filter Components
```
1. "Compare with Previous Period":
   - Toggle: On/Off (#49B0C1 when active)
   - When on: Previous Period dropdown appears

2. "Include Tax":
   - Toggle: On/Off (#49B0C1 when active)
   - Toggle label: "Show tax-inclusive amounts"

3. "Group By":
   - Label: "Group By" (12px, #666666)
   - Dropdown: Product, Category, Brand, Payment Method
   - White background, #ABDBE3 border

4. "Refresh" button:
   - Secondary (#ABDBE3)
   - Rotate icon
   - 12px text
```

### Sales Summary Table
```
Background: White
Margin: 0 24px 16px 24px
Border-radius: 8px
Overflow: hidden
Border: 1px solid #DBEFF3
```

#### Table Design
```
Table Header:
  Background: #ABDBE3
  Padding: 12px 16px
  
  Columns:
    1. Period (14px, bold, #333333)
    2. Transactions (14px, bold, #333333)
    3. Total Sales (14px, bold, #333333)
    4. Tax (14px, bold, #333333)
    5. Net Sales (14px, bold, #333333)
    6. Avg. Transaction (14px, bold, #333333)
    7. Growth (14px, bold, #333333)

Table Rows:
  Background: White (alternating #DBEFF3)
  Padding: 12px 16px
  Border-bottom: 1px solid #DBEFF3

  Row Example 1:
    1. Period: "Feb 28, 2026" (14px, #333333)
    2. Transactions: "127" (14px, #333333)
    3. Total Sales: "45,750.00 ETB" (14px, #333333)
    4. Tax: "5,962.50 ETB" (14px, #333333)
    5. Net Sales: "39,787.50 ETB" (14px, bold, #49B0C1)
    6. Avg. Transaction: "360.24 ETB" (14px, #333333)
    7. Growth: "+12.5%" (14px, green, arrow-up icon)

  Row Example 2:
    1. Period: "Feb 27, 2026" (14px, #333333)
    2. Transactions: "118" (14px, #333333)
    3. Total Sales: "42,300.00 ETB" (14px, #333333)
    4. Tax: "5,508.70 ETB" (14px, #333333)
    5. Net Sales: "36,791.30 ETB" (14px, bold, #49B0C1)
    6. Avg. Transaction: "358.47 ETB" (14px, #333333)
    7. Growth: "-3.2%" (14px, red, arrow-down icon)

  Row Example 3:
    1. Period: "Feb 26, 2026" (14px, #333333)
    2. Transactions: "132" (14px, #333333)
    3. Total Sales: "48,950.00 ETB" (14px, #333333)
    4. Tax: "6,378.26 ETB" (14px, #333333)
    5. Net Sales: "42,571.74 ETB" (14px, bold, #49B0C1)
    6. Avg. Transaction: "370.83 ETB" (14px, #333333)
    7. Growth: "+8.1%" (14px, green, arrow-up icon)
```

### Charts Section
```
Background: #ABDBE3
Margin: 0 24px 16px 24px
Padding: 16px 20px
Border-radius: 8px
Layout: Grid (2 columns), gap 16px
```

#### Chart 1: Sales Trend
```
Container: #DBEFF3 background
Border-radius: 8px
Padding: 16px

Header: "Daily Sales Trend" (14px, bold, #333333)

Chart Type: Line chart with area fill
  - X-axis: Dates (Feb 1, Feb 3, Feb 5, ... Feb 28)
  - Y-axis: Revenue (ETB)
  - Line: #49B0C1 (primary)
  - Area fill: #DBEFF3 (light blue, opacity 40%)
  - Points: Circles on data points
  - Grid: Light gray horizontal lines
  - Hover: Tooltip with date and value
  - Height: 200px
  - Average line: Dashed horizontal line showing average
```

#### Chart 2: Sales by Product Category
```
Container: #DBEFF3 background
Border-radius: 8px
Padding: 16px

Header: "Sales by Product Category" (14px, bold, #333333)

Chart Type: Pie chart or Donut chart
  - Slices:
    * Painkillers: 35% (#49B0C1)
    * Antibiotics: 25% (#28A745)
    * Vitamins: 20% (#FFC107)
    * Supplements: 12% (#6F42C1)
    * Medical Devices: 8% (#DC3545)
  - Center label: "Total Sales: 45,750 ETB"
  - Hover: Tooltip with category, sales amount, percentage
  - Legend: Below chart with color indicators
  - Height: 200px
```

#### Chart 3: Top Products by Sales
```
Container: #DBEFF3 background
Border-radius: 8px
Padding: 16px

Header: "Top Products by Sales" (14px, bold, #333333)

Chart Type: Horizontal bar chart
  - X-axis: Sales Amount (ETB)
  - Y-axis: Product Names
  - Bars: #49B0C1
  - Values shown: 5-10 top products
  - Each bar shows product name and sales amount
  - Tooltip: Exact values
  - Height: 200px

  Example Data:
    Panadol: 4,500 ETB
    Advil: 3,200 ETB
    Amoxicillin: 2,800 ETB
    Vitamin C: 2,100 ETB
    Ibuprofen: 1,900 ETB
```

#### Chart 4: Hourly Sales Distribution
```
Container: #DBEFF3 background
Border-radius: 8px
Padding: 16px

Header: "Hourly Sales Distribution" (14px, bold, #333333)

Chart Type: Area chart
  - X-axis: Hours (8 AM - 8 PM)
  - Y-axis: Transaction Count
  - Line: #ABDBE3
  - Area fill: #DBEFF3
  - Points: Circles on data points
  - Peak hours highlighted with markers
  - Height: 200px
  - Peak hour annotation: "10 AM - 12 PM: Peak Hours" (12px, #49B0C1)
```

### Detailed Breakdown (Expandable)
```
Background: White
Margin: 0 24px 16px 24px
Border-radius: 8px
Border: 1px solid #DBEFF3
Padding: 16px 20px
```

#### Breakdown Sections
```
Header: "Detailed Breakdown" (16px, bold, #333333)

Tabs (horizontal):
  1. "By Product" - Active: #49B0C1, white text
  2. "By Brand" - Inactive: #ABDBE3, dark text
  3. "By Category" - Inactive: #ABDBE3, dark text
  4. "By Payment Method" - Inactive: #ABDBE3, dark text

Content Area (matching selected tab):
  - Table showing detailed breakdown
  - Columns depend on selected tab
  - Alternating row colors (white and #DBEFF3)
  - Sortable columns
  - "View All" link at bottom

  Example - By Product:
    Columns: Product, Units Sold, Revenue, % of Total
    Rows: Top 10 products with totals
    Footer: Total row with sums
```

### Comparative Analysis
```
Background: #DBEFF3
Margin: 0 24px 16px 24px
Padding: 16px 20px
Border-radius: 8px
```

#### Comparison Content
```
Header: "Comparative Analysis" (16px, bold, #333333)

Layout: Grid (2 columns), gap 16px

Left Side - Period Comparison:
  - Current Period: Feb 2026
  - Previous Period: Jan 2026
  - Comparison Table:
    * Metric: Sales, Transactions, Avg. Transaction
    * Current: 45,750 ETB, 127, 360.24 ETB
    * Previous: 40,200 ETB, 115, 349.57 ETB
    * Change: +13.8%, +10.4%, +3.1%

Right Side - Year-over-Year:
  - Current Period: Feb 2026
  - Same Period Last Year: Feb 2025
  - Comparison Table:
    * Metric: Sales, Transactions, Avg. Transaction
    * Current: 45,750 ETB, 127, 360.24 ETB
    * Last Year: 38,200 ETB, 108, 353.70 ETB
    * Change: +19.8%, +17.6%, +1.8%

Visual Indicators:
  - Positive changes: Green with arrow-up
  - Negative changes: Red with arrow-down
  - Neutral: Gray with dash
  - Each metric card has trend sparkline (small chart)
```

---

## PAGE 5: COMPREHENSIVE REPORTS DASHBOARD (Overview)

### Purpose
Central hub for accessing all reports and analytics with quick previews and navigation.

### Page Header
```
Background: #49B0C1
Padding: 16px 24px
Layout: Flex, justify-between, align-center

Contents:
  - Left:
    * "Reports Dashboard" (24px, bold, white)
    * Breadcrumb: "Reports" → "Dashboard" (14px, #ABDBE3)
  
  - Right:
    * Quick Actions: "New Report" button (primary with white border, white text)
    * "Export" button (secondary #ABDBE3 with white border, white text)
    * Notification bell icon
```

### Quick Stats Cards
```
Layout: Horizontal row, 4 cards, gap 16px
Padding: 16px 24px
Background: White
```

#### Card Designs
```
1. Today's Sales:
   - Icon: shopping-cart (green)
   - Label: "Today's Sales"
   - Value: "45,750 ETB" (20px, bold, #333333)
   - Link: "View Details" (12px, #49B0C1)

2. This Week:
   - Icon: calendar-week (blue)
   - Label: "This Week"
   - Value: "312,400 ETB" (20px, bold, #333333)
   - Link: "View Details" (12px, #49B0C1)

3. This Month:
   - Icon: calendar (purple)
   - Label: "This Month"
   - Value: "1,245,750 ETB" (20px, bold, #333333)
   - Link: "View Details" (12px, #49B0C1)

4. Year to Date:
   - Icon: chart-simple (orange)
   - Label: "Year to Date"
   - Value: "4,892,300 ETB" (20px, bold, #333333)
   - Link: "View Details" (12px, #49B0C1)
```

### Report Categories Grid
```
Background: #DBEFF3
Margin: 0 24px 16px 24px
Padding: 16px 20px
Border-radius: 8px
```

#### Category Cards
```
Layout: Grid (3 columns), gap 16px

Card 1: Sales Reports
  Background: White
  Border-radius: 8px
  Padding: 16px
  Box-shadow: 0 2px 4px rgba(0,0,0,0.05)
  Hover: Shadow increases, border #49B0C1

  Contents:
    - Icon: shopping-cart (green, 32px)
    - Title: "Sales Reports" (16px, bold, #333333)
    - Description: "Daily, weekly, monthly sales analysis" (12px, #666666)
    - Sub-reports:
      * Daily Sales
      * Weekly Sales
      * Monthly Sales
      * Sales by Product
    - "View All" link (12px, #49B0C1)

Card 2: Inventory Reports
  Background: White
  Border-radius: 8px
  Padding: 16px
  Box-shadow: 0 2px 4px rgba(0,0,0,0.05)

  Contents:
    - Icon: boxes (blue, 32px)
    - Title: "Inventory Reports" (16px, bold, #333333)
    - Description: "Stock levels, movement, and valuation" (12px, #666666)
    - Sub-reports:
      * Stock Valuation
      * Stock Movement
      * Slow-Moving Items
      * Expiry Report
    - "View All" link (12px, #49B0C1)

Card 3: Financial Reports
  Background: White
  Border-radius: 8px
  Padding: 16px
  Box-shadow: 0 2px 4px rgba(0,0,0,0.05)

  Contents:
    - Icon: chart-pie (purple, 32px)
    - Title: "Financial Reports" (16px, bold, #333333)
    - Description: "Revenue, costs, and profitability" (12px, #666666)
    - Sub-reports:
      * Profit & Loss
      * Profit Margins
      * Revenue Analysis
      * Tax Report
    - "View All" link (12px, #49B0C1)

Card 4: Purchasing Reports
  Background: White
  Border-radius: 8px
  Padding: 16px
  Box-shadow: 0 2px 4px rgba(0,0,0,0.05)

  Contents:
    - Icon: truck (orange, 32px)
    - Title: "Purchasing Reports" (16px, bold, #333333)
    - Description: "Orders, suppliers, and spending" (12px, #666666)
    - Sub-reports:
      * Supplier Performance
      * Order History
      * Purchase Spend
      * Returns Analysis
    - "View All" link (12px, #49B0C1)

Card 5: Customer Reports
  Background: White
  Border-radius: 8px
  Padding: 16px
  Box-shadow: 0 2px 4px rgba(0,0,0,0.05)

  Contents:
    - Icon: users (green, 32px)
    - Title: "Customer Reports" (16px, bold, #333333)
    - Description: "Customer buying patterns" (12px, #666666)
    - Sub-reports:
      * Customer Purchase History
      * Customer Preferences
      * Repeat Customers
    - "View All" link (12px, #49B0C1)

Card 6: Regulatory Reports
  Background: White
  Border-radius: 8px
  Padding: 16px
  Box-shadow: 0 2px 4px rgba(0,0,0,0.05)

  Contents:
    - Icon: scale-balanced (red, 32px)
    - Title: "Regulatory Reports" (16px, bold, #333333)
    - Description: "Compliance and audit reports" (12px, #666666)
    - Sub-reports:
      * Controlled Substance Log
      * Expiry Compliance
      * Audit Trail
    - "View All" link (12px, #49B0C1)
```

### Recent Reports Section
```
Background: White
Margin: 0 24px 16px 24px
Padding: 16px 20px
Border-radius: 8px
Border: 1px solid #DBEFF3
```

#### Recent Reports List
```
Header: "Recent Reports" (16px, bold, #333333)

Table:
  Columns:
    1. Report Name (14px, bold, #333333)
    2. Type (14px, #666666)
    3. Generated By (14px, #666666)
    4. Date (14px, #666666)
    5. Actions (14px)

  Rows:
    - "February Sales Report" (14px, #49B0C1, link)
      Type: "Sales" (12px, #666666)
      Generated By: "John" (12px, #666666)
      Date: "Feb 28, 2026" (12px, #666666)
      Actions: "View" (eye icon) & "Download" (download icon)

    - "Slow-Moving Inventory" (14px, #49B0C1, link)
      Type: "Inventory" (12px, #666666)
      Generated By: "Sarah" (12px, #666666)
      Date: "Feb 27, 2026" (12px, #666666)
      Actions: "View" & "Download"

    - "Profit Margin Analysis" (14px, #49B0C1, link)
      Type: "Financial" (12px, #666666)
      Generated By: "John" (12px, #666666)
      Date: "Feb 26, 2026" (12px, #666666)
      Actions: "View" & "Download"

  "View All Reports" link (12px, #49B0C1) at bottom
```

### Scheduled Reports Section
```
Background: #DBEFF3
Margin: 0 24px 16px 24px
Padding: 16px 20px
Border-radius: 8px
```

#### Scheduled Reports List
```
Header: "Scheduled Reports" (16px, bold, #333333)

Cards (horizontal scroll):
  Each Card:
    Background: White
    Border-radius: 8px
    Padding: 12px 16px
    Width: 250px
    Margin-right: 12px

    Contents:
      - "Daily Sales Summary" (14px, bold, #333333)
      - Frequency: "Daily at 6:00 PM" (12px, #666666)
      - Recipients: "2 recipients" (12px, #666666)
      - Status: "✅ Active" (12px, green)
      - Actions: "Edit" (pencil) & "Pause" (pause)

      - "Weekly Inventory Report" (14px, bold, #333333)
      - Frequency: "Weekly on Monday" (12px, #666666)
      - Recipients: "3 recipients" (12px, #666666)
      - Status: "✅ Active" (12px, green)
      - Actions: "Edit" & "Pause"

  "Schedule New Report" button (secondary #ABDBE3, plus icon)
```

---

## COMPONENT LIBRARY (REPORTS-SPECIFIC)

### Navigation Bar
- Fixed top position
- Primary color (#49B0C1) background
- White text
- Logo with pharmacy icon on left
- Navigation links: Dashboard, Inventory, POS, Purchasing, Reports, Settings
- User profile with user icon on right

### Report Cards
- White background
- Border-radius: 8px
- Box shadow: 0 2px 4px rgba(0,0,0,0.05)
- Hover: Shadow increases, border #49B0C1
- Padding: 16px
- Icon in circle (32px)
- Title (16px, bold)
- Description (12px, #666666)

### KPI Cards
- Background: White or #DBEFF3
- Border: 1px solid #DBEFF3
- Border-radius: 8px
- Padding: 16px 20px
- Icon in circle with background color
- Label (12px, #666666)
- Value (24px, bold)
- Change indicator with icon

### Charts
- Container background: #ABDBE3
- Border-radius: 8px
- Padding: 16px
- Clean, minimal design
- Axis labels: #666666, 12px
- Legend: Below chart
- Hover tooltips

### Tables
- Full-width
- Alternating white and #DBEFF3 rows
- Header background: #ABDBE3
- Hover state: #DBEFF3
- Responsive scrolling
- Sortable columns (indicated by chevron icon)

### Tabs
- Horizontal row
- Active: #49B0C1 background, white text
- Inactive: White background, dark text
- Border-radius: 6px
- Padding: 8px 20px

### Period Selectors
- Toggle buttons or dropdown
- Options: Daily, Weekly, Monthly, Quarterly, Annual, Custom
- Active: #49B0C1 background, white text
- Inactive: White background, dark text

### Status Badges
- Active: Green background, white text
- Inactive: Gray background, white text
- Pending: Yellow background, dark text
- Complete: Green background, white text
- Critical: Red background, white text
- Warning: Orange background, white text

### Export Buttons
- CSV Export: #49B0C1 or #ABDBE3
- PDF Export: #ABDBE3
- Print: #ABDBE3
- With download or printer icon

### Filter Components
- Dropdowns with chevron-down icon
- Date pickers with calendar icon
- Toggle switches (#49B0C1 when active)
- Search inputs with magnifying glass icon

### Icons Reference
- Sales: money-bill-wave, credit-card, shopping-cart, wallet
- Inventory: pills, capsule, box, boxes, layer-group
- Financial: chart-simple, chart-pie, chart-bar, chart-line, percentage
- Purchasing: truck, shopping-bag, file-invoice, clipboard-list
- Reports: file, file-pdf, file-excel, printer, download
- Time: calendar, clock, hourglass, calendar-week, calendar-day
- Status: check-circle, xmark-circle, exclamation-triangle, circle-info
- Actions: eye, pencil, trash, plus, minus, xmark, check, arrow-up, arrow-down
- Navigation: house, chevron-left, chevron-right, chevron-down
- Users: user, users, user-plus, user-check

### Modals/Dialogs
- Centered overlay
- White background
- Primary color (#49B0C1) header
- Border-radius: 12px
- Box shadow for depth
- Close (xmark) button in header

### Pagination
- Centered at bottom
- Current page highlighted with #49B0C1
- Previous/Next buttons with chevron icons
- Page numbers in circles

### Toast Notifications
- Position: Top-right
- Background: White with color border
- Border-radius: 8px
- Box shadow
- Icon on left
- Text message
- Auto-dismiss after 3-5 seconds

### Loading States
- Skeleton loaders for cards
- Spinner animation for buttons
- Gray shimmer effect for content placeholders

### Empty States
- Icon in light gray (64px)
- "No data available" text (18px, #666666)
- "Adjust your filters or date range" subtext (14px, #666666)
- "Reset Filters" button (#49B0C1)

### Tooltips
- Position: Above or below element
- Background: #333333
- Text: White, 12px
- Border-radius: 4px
- Padding: 4px 8px
- Box shadow: 0 2px 4px rgba(0,0,0,0.2)
```