# USA Scoops - Pet Waste Removal Service Platform

## Project Overview
USA Scoops is a comprehensive web application for managing a local pet waste removal service. The platform enables customers to book services, technicians to manage their routes, and administrators to control operations.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite
- **Routing**: Wouter (lightweight React router)
- **UI Framework**: Shadcn UI components + Tailwind CSS
- **Backend**: Firebase
  - Authentication: Firebase Auth (email/password)
  - Database: Cloud Firestore
  - Security: Firestore Security Rules
- **State Management**: React Context (Auth), TanStack Query (data fetching)
- **Date Handling**: date-fns
- **Deployment Target**: Netlify (static hosting)

## Architecture

### Client-Side Firebase Architecture
This application uses a **client-side Firebase** architecture as specified in requirements:
- All database operations go directly from React to Firestore
- No custom Express/Node.js backend server (Express is only used for Vite dev server)
- Security is enforced through Firestore Security Rules (see `firestore.rules`)
- Suitable for static deployment on Netlify

### Data Model (Firestore Collections)

**customers**
- User profile data with role field
- Address information
- Dog count and service preferences
- Status: active, paused, prospect

**service_zips**
- Defines serviceable zip codes
- Active/inactive toggle

**slots**
- Date and time windows for services
- Capacity tracking (booked_count/capacity)
- Status: open, held, booked, blocked

**visits**
- Links customers to specific time slots
- Tracks service completion
- Status: scheduled, completed, skipped, canceled

**technicians**
- Tech profile with service zip coverage
- Can have admin role for dual access

**messages**
- Customer support messages
- Status: open, closed

**waitlist**
- Customers outside service areas

## User Roles & Permissions

### Customer (`role: 'customer'`)
- Sign up with zip code validation
- Book service time slots
- View upcoming/past visits
- Send support messages
- Routes: `/portal`

### Technician (`role: 'technician'`)
- View assigned visits by date
- Mark visits complete
- See customer details and notes
- Routes: `/tech`

### Admin (`role: 'admin'`)
- Full access to technician portal
- Manage service zip codes
- Create and manage time slots
- View all visits and bookings
- Routes: `/admin`, `/tech`

**Multi-Role Support**: Set `role: 'admin'` in Firestore for users who need both tech and admin access.

## Key Features Implemented

✅ **Landing Page**
- Hero section with background image
- How It Works (3 steps with icons)
- CTA sections

✅ **Multi-Step Signup Flow**
- Step 1: Basic info + zip code validation
- Step 2: Address details + dog count
- Step 3: Time slot selection
- Waitlist for non-serviced zips
- Automated quote calculation

✅ **Customer Portal**
- Next scheduled visit card
- Visit history table
- Contact form (writes to messages collection)

✅ **Technician Portal**
- Date-filtered visit list
- Customer details (address, dog count, notes)
- Mark completed functionality

✅ **Admin Dashboard**
- Tabs navigation (Zips, Slots, Visits)
- Zip code manager (add, toggle, delete)
- Slot creator with capacity controls
- Visits overview with filters
- Confirmation dialogs for destructive actions

✅ **Authentication & Security**
- Firebase Auth email/password
- Role-based route protection
- Firestore Security Rules (must be deployed!)
- Protected routes with loading states

## Setup Instructions

### 1. Firebase Configuration
Environment variables (already configured in Replit Secrets):
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

### 2. Deploy Firestore Security Rules
**CRITICAL**: Deploy the security rules from `firestore.rules` to Firebase:
```bash
firebase deploy --only firestore:rules
```

Without deployed security rules, your Firestore data is publicly accessible!

### 3. Initial Data Setup

**Create Admin User:**
1. Sign up through the app
2. In Firebase Console → Firestore → customers collection
3. Find your user document
4. Edit `role` field to `"admin"`

**Add Service Zips:**
- Log in as admin
- Navigate to Admin Dashboard → Zip Codes tab
- Add serviceable zip codes

**Create Time Slots:**
- Admin Dashboard → Service Slots tab
- Create date/time windows with capacity

## Development

```bash
npm install
npm run dev
```

Access the app at the Replit preview URL.

## Deployment to Netlify

1. **Build**:
   ```bash
   npm run build
   ```

2. **Deploy**: Upload `dist` folder to Netlify

3. **Environment Variables**: Add all `VITE_*` variables in Netlify dashboard

4. **Redirects**: Already configured in `client/public/_redirects` for SPA routing

## File Structure

```
client/
  src/
    components/
      ProtectedRoute.tsx    # Role-based route guard
      ui/                   # Shadcn UI components
    hooks/
      use-auth.tsx          # Firebase auth context
    lib/
      firebase.ts           # Firebase initialization
    pages/
      landing.tsx           # Public landing page
      login.tsx             # Login form
      signup.tsx            # Multi-step signup
      customer-portal.tsx   # Customer dashboard
      technician-portal.tsx # Tech visit management
      admin-dashboard.tsx   # Admin controls
    App.tsx                 # Route configuration
    index.css              # Tailwind + design tokens
  public/
    _redirects            # Netlify SPA routing
shared/
  types.ts                # TypeScript types for all data models
firestore.rules          # Firebase security rules
README.md                # Deployment instructions
```

## Design System

- **Primary Color**: Navy Blue (HSL 210 100% 25% light mode, HSL 210 85% 35% dark mode)
- **Brand Identity**: Navy blue with red accents matching USA Scoops logo
- **Font**: Roboto (Material Design standard)
- **Components**: Shadcn UI with custom theming
- **Responsive**: Mobile-first design
- **Accessibility**: ARIA labels, semantic HTML, keyboard navigation, password visibility toggles

## Business Logic

**Quote Calculation**:
- Base price: $15
- Additional dogs: +$5 each
- Example: 3 dogs = $15 + (2 × $5) = $25

**Slot Booking**:
- Uses Firestore transactions for safety
- Prevents overbooking through capacity checks
- Increments `booked_count` atomically

**Role Resolution**:
- Checks `customers` collection first
- Falls back to `technicians` collection
- Admin role takes precedence for multi-role users

## Testing Considerations

**Test Admin Workflow**:
1. Create admin user (manually in Firestore)
2. Add service zips
3. Create time slots
4. Verify slots appear in signup flow

**Test Customer Workflow**:
1. Sign up with valid zip code
2. Complete address form
3. Select time slot
4. Verify booking appears in customer portal

**Test Technician Workflow**:
1. Create technician user (manually in Firestore)
2. Assign visit to technician (set technician_uid)
3. Log in as tech
4. Mark visit complete

## Known Limitations (MVP)

- No Stripe integration (payment is simulated)
- No Cloud Functions (booking logic is client-side)
- No email notifications
- No recurring service schedules
- No automated technician assignment
- Manual role assignment (no UI for creating techs/admins)

These are documented for Phase 2 implementation.

## Security Notes

⚠️ **CRITICAL**: 
1. Firestore security rules MUST be deployed before production use
2. Never commit Firebase API keys to public repos (use environment variables)
3. Role assignment must be done manually in Firestore console for MVP
4. For production, implement Cloud Functions for:
   - Slot booking transactions
   - Role management
   - Admin user creation

## User Preferences

None documented yet. Will update as preferences are communicated.

## Recent Changes

- 2024-11-15: Two-Row Header Redesign for Maximum Logo Visibility
  - Redesigned header with two distinct rows for better brand prominence
  - Top row: Large centered logo (h-32 mobile, h-36 tablet, h-40 desktop) with "USA Scoops" text
  - Bottom row: Streamlined navigation with only "Sign In" button
  - Responsive design: Logo and text stack vertically on mobile, align horizontally on larger screens
  - Hero section margins adjusted (mt-60/64/72) to accommodate taller header
  - Visual separator border between branding and navigation rows
  - Removed "Get Started" button from header for cleaner design
  - Made hero "Get Started Today" button darker navy blue (#003366)
  - Logo is now 2x larger than previous design for maximum brand impact

- 2024-11-15: Visual Rebranding
  - Complete color scheme change from green to navy blue
  - Updated primary color to HSL 210 100% 25% (light) and HSL 210 85% 35% (dark)
  - Added USA Scoops logo (logo-icon.png and logo-full.png)
  - Landing page header with larger logo and branding text
  - All buttons, focus rings, and UI elements now use navy blue theme
  - Maintained accessibility with proper contrast ratios

- 2024-11-15: Initial MVP implementation
  - Complete UI for all user roles
  - Firebase integration with auth and Firestore
  - Multi-step signup with slot booking
  - Role-based access control
  - Firestore security rules
  - Timestamp handling fixes
  - Multi-role support (admin + technician)
  - Password visibility toggles on login/signup pages
