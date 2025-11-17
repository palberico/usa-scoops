# USA Scoops - Pet Waste Removal Service Platform

## Overview
USA Scoops is a web application designed to manage a local pet waste removal service. It provides functionalities for customers to book services, technicians to manage their routes, and administrators to oversee operations. The platform aims to streamline service scheduling, customer management, and field operations, catering to the growing demand for convenient pet care services.

## User Preferences
I prefer simple language and clear instructions. I want iterative development, where I can review changes at each stage. Ask before making major architectural changes or introducing new dependencies. I prefer detailed explanations for complex implementations.

## System Architecture

### UI/UX Decisions
The application features a modern, responsive design with a mobile-first approach. It utilizes Shadcn UI components with Tailwind CSS for consistent styling. The primary color scheme is navy blue (HSL 210 100% 25% light mode, HSL 210 85% 35% dark mode) with red accents, aligning with the USA Scoops brand identity. Roboto is used as the primary font. Accessibility features include ARIA labels, semantic HTML, and keyboard navigation.

### Technical Implementations
The application employs a client-side Firebase architecture, with all database operations directly from React to Firestore. Routing is handled by Wouter, and state management utilizes React Context for authentication and TanStack Query for data fetching. Date handling is managed by `date-fns`.

### Feature Specifications

*   **Landing Page**: Hero section, "How It Works" guide, and calls to action.
*   **6-Step Signup Flow**: Guides users through a comprehensive booking process:
    1. **Zip Code Validation**: Check if service area is available
    2. **Account Creation**: Email/password registration via Firebase Auth
    3. **Dog Information**: Select number of dogs (1-10) and optionally enter names for each dog
       - **Price Quote Modal** displays after submission showing calculated price based on dog count
    4. **Property Information**: Phone number, street address, city, state (defaults to UT), zip code, optional gate code and yard notes
    5. **Time Selection**: Choose from available recurring or one-time slots filtered by customer's zip code
       - **Booking Review Modal** displays after selection showing complete booking details
    6. **Payment**: Placeholder payment form with booking summary
    - Includes waitlist functionality for non-serviced areas
    - Automated quote calculation: $15 base + $5 per additional dog
    - Dog names are optional but stored in customer profile for personalization
*   **Customer Portal**: Allows customers to view upcoming/past visits (displays recurring schedule with next service date), cancel/reschedule services to any available slot, and send support messages.
*   **Technician Portal**: Enables technicians to view and manage their work:
    - **My Assigned Visits**: Dedicated card showing only visits assigned to the logged-in technician
    - **Scheduled Visits**: Complete view of all scheduled visits for selected day with "Assigned To" column for coverage visibility
    - **Completed Jobs**: View of all completed visits with statistics
    - Features shared PortalHeader component with mobile-responsive drawer navigation
*   **Admin Dashboard**: Provides administrators with tools to:
    - Manage service zip codes
    - Create time slots (recurring and one-time)
    - **Pricing Configuration**: Dynamic pricing system with separate rates for recurring and one-time services. Admins can configure base price and additional dog pricing through Pricing tab.
    - **Upcoming Week View**: Displays all scheduled visits within the next 7 days with technician assignment status
    - **Technician Assignment**: Assign technicians to visits via detail dialog with dropdown selector
    - Oversee all visits and bookings with status filtering
    - Features shared PortalHeader component with mobile-responsive drawer navigation and portal switching (Admin ↔ Tech)
*   **Authentication & Security**: Implements Firebase Auth (email/password), role-based route protection, and Firestore Security Rules for data access control.

### System Design Choices

*   **Data Model**: Utilizes Firestore collections for `customers`, `service_zips`, `slots`, `visits`, `technicians`, `messages`, `waitlist`, and `pricing`, each structured to support specific application functionalities.
    *   **Slots**: Each slot must include a `zip` field (5-digit zip code) to associate it with a service area. Slots are filtered by customer's zip code during booking.
    *   **Pricing**: Singleton document at `pricing/default` stores configurable pricing with fields: `recurring_base`, `recurring_additional`, `onetime_base`, `onetime_additional`, `updated_at`. Public read, admin-only write.
*   **User Roles**: Supports `customer`, `technician`, and `admin` roles with distinct access levels and functionalities. Multi-role support allows users to have both technician and admin access.
*   **Dynamic Pricing System**: Configurable pricing stored in Firestore with fallback to defaults ($15 base + $5 per additional dog). Admins manage pricing through Admin Dashboard → Pricing tab. Signup flow fetches current pricing on load and applies to all quote calculations. Supports separate rates for recurring vs one-time services.
*   **Slot Booking**: Ensures data consistency and prevents overbooking using Firestore transactions.
*   **Role Resolution**: Prioritizes `admin` role and checks both `customers` and `technicians` collections for user roles.
*   **Recurring Schedules**: Supports both recurring monthly plans (same day/time every week) and one-time bookings:
    *   **Recurring Slots**: Defined by `day_of_week` (0-6) and time window, with empty `date` field. Displayed as "Every [Day]" format.
    *   **One-Time Slots**: Traditional date-based slots with specific calendar date.
    *   **Visit Scheduling**: Uses `calculateNextServiceDate()` helper to compute next service date for recurring slots by finding next occurrence of target day and applying time window.
    *   **24-Week Rolling Buffer**: When customers sign up for recurring service, system creates 24 future visits (6 months of weekly appointments). All visits linked via `recurring_group_id` (UUID). Auto-replenishment maintains buffer:
        *   When technician completes a visit, system creates next week's visit to maintain 24-week buffer
        *   When customer reschedules, visit is removed from recurring group and replacement visit created 7 days after latest scheduled visit
        *   Replacement uses original slot_id to keep recurring series anchored to original time/day
    *   **Customer Portal Pagination**: Recurring schedule displays 4 visits per page with Previous/Next controls. Pagination automatically resets when recurring group changes and clamps to valid range when visit count changes.
    *   **Technician Portal Efficiency**: Uses date-scoped Firestore queries with composite indexes on (status, scheduled_for) to fetch only the selected day's visits, avoiding full table scans.
    *   **Reschedule Flexibility**: Customers can reschedule any visit to any available slot (recurring or one-time, any day). Rescheduled visits become one-time appointments (removed from recurring group).
    *   **Data Integrity**: Visits store both `scheduled_for` timestamp and recurring metadata (`is_recurring`, `recurring_day_of_week`, `recurring_window_start`, `recurring_window_end`, `recurring_group_id`) to track schedule type and buffer maintenance.
    *   **Slot Accounting**: `booked_count` tracks subscription holders for recurring slots, not individual visit occurrences. Only adjusted on subscription enrollment/cancellation, not individual reschedules.

## External Dependencies

*   **Firebase**:
    *   **Authentication**: Firebase Auth (email/password)
    *   **Database**: Cloud Firestore
    *   **Security**: Firestore Security Rules
*   **React**: Frontend library
*   **TypeScript**: Type-safe JavaScript
*   **Vite**: Build tool
*   **Wouter**: Lightweight React router
*   **Shadcn UI**: UI component library
*   **Tailwind CSS**: Utility-first CSS framework
*   **TanStack Query**: Data fetching and caching library
*   **date-fns**: Date utility library
*   **Netlify**: Deployment target for static hosting

## Development & Testing

### Initial Setup Requirements

Before customers can sign up, an administrator must configure service areas and time slots:

1. **Create Admin User**: Use Firebase Console to create the first admin user account
2. **Set Admin Role**: Update the user's document in either `customers` or `technicians` collection with `role: 'admin'`
3. **Add Service Zips**: Navigate to Admin Dashboard → Zip Codes tab to add serviced zip codes (e.g., 84604, 84601)
4. **Create Time Slots**: Navigate to Admin Dashboard → Slots tab to create recurring or one-time service slots for each zip code

### Test Data Script

The `setup-test-data.js` script provides a template for adding test data, but requires Firebase Admin SDK authentication to bypass security rules. For development testing:
- Manually add service zips and slots through the Admin Dashboard UI
- Or use Firebase Console to directly add documents to `service_zips` and `slots` collections
- Field names: `zip` (not `zip_code`), `booked_count` (not `booked`)