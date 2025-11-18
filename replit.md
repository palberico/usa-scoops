# USA Scoops - Pet Waste Removal Service Platform

## Overview
USA Scoops is a web application for managing a local pet waste removal service. It enables customers to book services, technicians to manage routes, and administrators to oversee operations, aiming to streamline scheduling, customer management, and field operations.

## User Preferences
I prefer simple language and clear instructions. I want iterative development, where I can review changes at each stage. Ask before making major architectural changes or introducing new dependencies. I prefer detailed explanations for complex implementations.

## System Architecture

### UI/UX Decisions
The application features a modern, responsive, mobile-first design using Shadcn UI components with Tailwind CSS. The color scheme is navy blue with red accents (USA Scoops brand identity), and Roboto is the primary font. Accessibility features include ARIA labels, semantic HTML, and keyboard navigation.

### Technical Implementations
The application uses a client-side Firebase architecture with React for the UI, Wouter for routing, React Context for authentication state, and TanStack Query for data fetching. `date-fns` handles date operations.

### Feature Specifications
*   **Landing Page**: Hero section, "How It Works" guide, calls to action.
*   **6-Step Signup Flow**: Guides users through booking, including zip code validation, account creation (Firebase Auth), dog information entry (with price quote: $15 base + $5 per additional dog), property details, time slot selection (recurring/one-time), and a payment placeholder. Includes waitlist functionality.
*   **Customer Portal**: Allows viewing/managing visits, canceling/rescheduling, and sending support messages. Displays technician information for upcoming visits.
*   **Technician Portal**: Enables technicians to view assigned visits, see all scheduled visits for a day (with assignment status and self-assignment option), view completed jobs, and manage their public profile. Mobile-optimized with fixed-height cards and drawer navigation.
*   **Admin Dashboard**: Provides tools for managing service zip codes, creating time slots, configuring dynamic pricing (base, additional dog rates for recurring/one-time services), assigning technicians to visits, and overseeing all bookings. Includes a 7-day upcoming visit view.
*   **Authentication & Security**: Firebase Auth (email/password), role-based route protection, and Firestore Security Rules.
*   **Technician Profiles & About Us**: Technicians can create public profiles with avatars and bios. A public "About Us" page displays technician cards, with clickable profiles. Technician data is denormalized to visit documents for performance.

### System Design Choices
*   **Data Model**: Firestore collections for `customers`, `service_zips`, `slots`, `visits`, `technicians`, `messages`, `waitlist`, `pricing`, and `technician_profiles`. `slots` include `zip` for service area association. `pricing` is a singleton document for configurable rates.
*   **User Roles**: Supports `customer`, `technician`, and `admin` roles with distinct access levels and multi-role support.
*   **Dynamic Pricing System**: Configurable pricing stored in Firestore, applied during signup and managed via Admin Dashboard.
*   **Slot Booking**: Uses Firestore transactions to ensure data consistency and prevent overbooking.
*   **Role Resolution**: Prioritizes `admin` role and checks `customers` and `technicians` collections.
*   **Recurring Schedules**: Supports recurring monthly plans and one-time bookings.
    *   **Visit Scheduling**: `calculateNextServiceDate()` computes next service date for recurring slots.
    *   **24-Week Rolling Buffer**: Creates 24 future visits for recurring services, maintained by auto-replenishment upon visit completion or rescheduling. Visits are linked by `recurring_group_id`.
    *   **Reschedule Flexibility**: Customers can reschedule visits, which become one-time appointments.
    *   **Slot Accounting**: `booked_count` tracks subscription holders for recurring slots, not individual visit occurrences.
*   **Technician Profile Data Denormalization**: Technician `name`, `title`, and `avatar_url` are stored directly on visit documents for performance.
*   **Firebase Storage Structure**: Technician avatars stored at `technicians/{uid}/avatar.jpg`.

## External Dependencies

*   **Firebase**: Authentication (Auth), Database (Cloud Firestore), Storage (avatars).
*   **React**: Frontend library.
*   **TypeScript**: Type-safe JavaScript.
*   **Vite**: Build tool.
*   **Wouter**: Lightweight React router.
*   **Shadcn UI**: UI component library.
*   **Tailwind CSS**: Utility-first CSS framework.
*   **TanStack Query**: Data fetching and caching.
*   **date-fns**: Date utility library.
*   **Netlify**: Deployment target.