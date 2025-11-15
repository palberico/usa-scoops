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
*   **Multi-Step Signup Flow**: Guides users through zip code validation, account creation, address and dog count input, and time slot selection (both recurring and one-time). Includes a waitlist for non-serviced areas and automated quote calculation.
*   **Customer Portal**: Allows customers to view upcoming/past visits (displays recurring schedule with next service date), cancel/reschedule services to any available slot, and send support messages.
*   **Technician Portal**: Enables technicians to view assigned visits, access customer details, and mark visits as complete.
*   **Admin Dashboard**: Provides administrators with tools to manage service zip codes, create time slots (recurring and one-time), and oversee all visits and bookings.
*   **Authentication & Security**: Implements Firebase Auth (email/password), role-based route protection, and Firestore Security Rules for data access control.

### System Design Choices

*   **Data Model**: Utilizes Firestore collections for `customers`, `service_zips`, `slots`, `visits`, `technicians`, `messages`, and `waitlist`, each structured to support specific application functionalities.
    *   **Slots**: Each slot must include a `zip` field (5-digit zip code) to associate it with a service area. Slots are filtered by customer's zip code during booking.
*   **User Roles**: Supports `customer`, `technician`, and `admin` roles with distinct access levels and functionalities. Multi-role support allows users to have both technician and admin access.
*   **Quote Calculation**: Based on a base price of $15 plus $5 for each additional dog.
*   **Slot Booking**: Ensures data consistency and prevents overbooking using Firestore transactions.
*   **Role Resolution**: Prioritizes `admin` role and checks both `customers` and `technicians` collections for user roles.
*   **Recurring Schedules**: Supports both recurring monthly plans (same day/time every week) and one-time bookings:
    *   **Recurring Slots**: Defined by `day_of_week` (0-6) and time window, with empty `date` field. Displayed as "Every [Day]" format.
    *   **One-Time Slots**: Traditional date-based slots with specific calendar date.
    *   **Visit Scheduling**: Uses `calculateNextServiceDate()` helper to compute next service date for recurring slots by finding next occurrence of target day and applying time window.
    *   **Reschedule Flexibility**: Customers can reschedule any visit to any available slot (recurring or one-time, any day). This is a one-time change that doesn't affect future recurring visits.
    *   **Data Integrity**: Visits store both `scheduled_for` timestamp and recurring metadata (`is_recurring`, `recurring_day_of_week`, `recurring_window_start`, `recurring_window_end`) to track schedule type.

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