We are building a Pharmacy Management System frontend from scratch.

IMPORTANT:
This is a frontend implementation based on the provided UI/Figma documentation.

Do NOT inspect or modify an existing frontend.
Do NOT assume an existing frontend architecture.
You are responsible for creating the frontend structure from scratch.

We will build the project PART BY PART.

For this task, implement ONLY:

# PHASE 1 — AUTHENTICATION

Do not implement inventory, products, POS, purchasing, reports, or other pharmacy features yet.

==================================================
1. READ THE PROVIDED UI DOCUMENTATION
==================================================

Use the provided Pharmacy Management System UI documentation as the main design reference.

Follow the documented design system consistently.

Design system:

Colors:
- Primary: #49B0C1
- Secondary/Mid-tone: #ABDBE3
- Light Blue: #DBEFF3
- Main Background: #FFFFFF
- Primary Text: #333333
- Secondary Text: #666666

Styling:
- Rounded edges
- Clean and modern pharmacy/healthcare appearance
- Professional layout
- Good spacing and visual hierarchy

Typography:
- Headings: bold, approximately 24–32px
- Subheadings: semi-bold, approximately 18–20px
- Body: approximately 14–16px
- Small text: approximately 12px

Component styles:
- Primary buttons: #49B0C1 with white text
- Secondary buttons: #ABDBE3 with dark text
- Cards: #DBEFF3 background
- Inputs: white background with #ABDBE3 borders

Do not randomly introduce a different design system.

==================================================
2. FRONTEND PROJECT FOUNDATION
==================================================

Before building authentication:

Create a clean, scalable frontend structure.

The project will later grow into a complete Pharmacy Management System.

Set up a maintainable structure for:

- Pages
- Components
- Layouts
- Authentication
- Routing
- API services
- Shared UI components
- Styles

Do not over-engineer.

Create a simple but scalable structure because we will build the system feature by feature.

==================================================
3. BUILD THE AUTHENTICATION UI
==================================================

Implement the authentication pages and flow.

For now, build:

## Login Page

The login page should contain:

- Pharmacy logo/branding area
- Pharmacy Management System name
- Welcome/login heading
- Email or username input
- Password input
- Password visibility toggle
- Login button
- Loading state
- Form validation
- Authentication error display

The design should feel:

- Modern
- Professional
- Clean
- Pharmacy/healthcare focused
- Responsive

Do not make it look like a generic template.

==================================================
4. RESPONSIVE DESIGN
==================================================

The authentication page must work well on:

- Desktop
- Tablet
- Mobile

Test responsiveness and ensure:

- No overflow
- Inputs remain usable
- Buttons remain accessible
- Layout adapts properly
- Text does not break unnecessarily

==================================================
5. AUTHENTICATION ARCHITECTURE
==================================================

For now, focus primarily on the frontend architecture.

Create a clean authentication layer that can later connect to the backend.

Do not hardcode backend URLs throughout components.

Create a dedicated authentication/API service structure.

For now, if the backend authentication API is not ready:

- Create a clearly isolated mock or placeholder authentication implementation
- Make it easy to replace with the real backend API later
- Do not mix mock authentication logic directly into UI components

The UI components should not depend directly on backend implementation details.

Architecture should conceptually support:

UI
↓
Authentication Service
↓
API Layer
↓
Backend

==================================================
6. AUTHENTICATION STATE
==================================================

Create a basic authentication state structure.

It should support:

- Logged in
- Logged out
- Loading
- Authentication error

Do not implement complicated role permissions yet.

However, structure the system so roles can later be added:

- Admin
- Pharmacist
- Cashier
- Inventory Staff
- Manager

==================================================
7. ROUTING
==================================================

Create the authentication routes cleanly.

For example:

/login

After successful authentication:

/dashboard

The dashboard itself does NOT need to be implemented yet.

A simple protected placeholder page is enough for testing navigation.

Create basic route protection so the architecture supports:

Unauthenticated User
        ↓
Login Page

Authenticated User
        ↓
Pharmacy Application

==================================================
8. REUSABLE COMPONENTS
==================================================

Create reusable components where appropriate.

For example:

- Button
- Input
- Password Input
- Authentication Layout
- Form Error Message
- Loading Button

Do not create unnecessary components.

The goal is to create reusable foundations that will also be useful for future Pharmacy pages.

==================================================
9. CODE QUALITY
==================================================

Requirements:

- Clean and readable code
- Proper component separation
- Reusable UI components
- No unnecessary duplication
- No large files containing unrelated logic
- Consistent naming
- Scalable folder structure
- Keep API logic separate from UI logic

==================================================
10. TESTING
==================================================

Test the implementation properly.

Test:

1. Empty username/email
2. Empty password
3. Both fields empty
4. Invalid input format
5. Password visibility toggle
6. Login loading state
7. Authentication error state
8. Successful login flow using mock/placeholder authentication
9. Redirect after login
10. Protected route behavior
11. Responsive behavior
12. Browser console errors
13. Routing errors

Fix any issues discovered.

==================================================
11. DOCUMENTATION
==================================================

After implementation, create/update frontend documentation explaining:

- Project structure
- Authentication architecture
- Routing structure
- Authentication state handling
- Reusable components created
- Mock authentication behavior
- How the real backend API should later connect

Also document:

UI
↓
Auth Service
↓
API Layer
↓
Backend

==================================================
IMPORTANT SCOPE RULE
==================================================

ONLY implement authentication and the frontend foundation required for authentication.

Do NOT start building:

- Inventory
- Medicines
- Product Management
- POS
- Purchasing
- Reports
- Settings
- Expiry Management
- Dashboard features

We will implement those later, part by part.

==================================================
FINAL REVIEW
==================================================

Before finishing:

- Review the implementation
- Check consistency with the provided UI documentation
- Test the important authentication flows
- Fix errors
- Check responsive behavior
- Check for console errors
- Check for broken routes

Then provide a concise summary:

1. What was implemented
2. Project structure created
3. Components created
4. Routes created
5. Authentication architecture
6. Tests performed
7. Files created/modified
8. What is ready for the next phase