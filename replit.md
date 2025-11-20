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
*   **5-Step Signup Flow**: Guides users through booking with streamlined steps:
    1. Zip code validation (with waitlist for unavailable areas)
    2. Account creation (Firebase Auth)
    3. Dog information entry (count and names)
    4. Property details (address, phone, gate code, notes)
    5. Booking completion (slot selection, quote review, payment) via integrated BookingWizard component
    *   **Code Architecture**: Signup flow delegates all booking logic to `BookingWizard` component, eliminating duplicate code and maintaining single source of truth for slot selection, pricing display, and payment processing.
*   **BookingWizard Component**: Reusable booking component used in both signup flow (step 5) and existing customer rebooking (`/book` route). Handles slot selection, displays quote confirmation modal with pricing details, and processes payment. Creates exactly 8 visits for recurring bookings using `VISIT_BUFFER_SIZE` constant.
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
    *   **8-Visit Rolling Buffer**: Creates 8 future visits initially for recurring services. When visits are completed, the system automatically replenishes to maintain an 8-visit buffer. This reduces upfront Firestore writes by 67% while still providing ~2 months of visibility. Visits are linked by `recurring_group_id`. The `replenishVisits()` utility function handles auto-replenishment.
    *   **Reschedule Flexibility**: Customers can reschedule visits, which become one-time appointments.
    *   **Slot Accounting**: `booked_count` tracks subscription holders for recurring slots, not individual visit occurrences.
*   **Technician Profile Data Denormalization**: Technician `name`, `title`, and `avatar_url` are stored directly on visit documents for performance.
*   **Firebase Storage Structure**: Technician avatars stored at `technicians/{uid}/avatar.jpg`.

## External Dependencies

*   **Firebase**: Authentication (Auth), Database (Cloud Firestore), Storage (avatars).
*   **Firebase Admin SDK**: Server-side Firestore access for secure payment validation (validates customer data, slot availability, and pricing configuration before creating payment intents).
*   **Stripe**: Payment processing with production-ready webhook-based fulfillment.
    *   **Integration Details**: Custom embedded payment forms using Stripe Elements (stays on usascoops.com domain, no redirects).
    *   **Security Architecture**: 
        *   All payment amounts are calculated server-side by fetching customer data (dog count), slot configuration, and pricing from Firestore. The server never trusts client-provided amounts.
        *   Before creating payment intents, the server re-validates slot capacity to prevent paying for unavailable slots (returns HTTP 409 if full).
        *   **Client-side booking creation is completely disabled** - customers cannot create bookings directly in Firestore. All bookings are created exclusively by the webhook handler after verified payment.
        *   Webhook signature verification using `STRIPE_WEBHOOK_SECRET` ensures requests are authentic.
        *   Idempotency checks via `payment_tracking` collection prevent duplicate bookings if webhooks retry.
    *   **API Endpoints**:
        *   `/api/create-payment-intent` - Creates one-time payment intents with server-side validation
        *   `/api/create-subscription` - Creates recurring subscriptions (for future use)
        *   `/api/stripe-webhook` - Production webhook endpoint with signature verification, processes `payment_intent.succeeded` events and creates bookings server-side
        *   `/api/booking-status/:paymentIntentId` - Polling endpoint for clients to check if webhook has processed their payment
    *   **Payment Flow**: 
        1. Customer selects slot → Server validates slot availability and fetches customer data
        2. Server creates payment intent with validated amount and metadata
        3. Customer completes payment via Stripe Elements
        4. Stripe webhook sends `payment_intent.succeeded` event (verified via signature)
        5. Server creates booking in Firestore (8 visits for recurring, 1 for one-time)
        6. Client polls `/api/booking-status` endpoint to detect completion
        7. Client shows "confirming booking" screen, then redirects to success
    *   **Test Mode**: Currently configured with test API keys for development (pk_test_ and sk_test_ prefixes).
*   **React**: Frontend library.
*   **TypeScript**: Type-safe JavaScript.
*   **Vite**: Build tool.
*   **Express**: Backend server for API routes.
*   **Wouter**: Lightweight React router.
*   **Shadcn UI**: UI component library.
*   **Tailwind CSS**: Utility-first CSS framework.
*   **TanStack Query**: Data fetching and caching.
*   **date-fns**: Date utility library.
*   **Netlify**: Deployment target.