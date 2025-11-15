# USA Scoops - Pet Waste Removal Service

A comprehensive web application for managing pet waste removal services with customer booking, technician scheduling, and admin controls.

## Architecture

This application uses:
- **Frontend**: React with Vite, Wouter for routing, Shadcn UI components
- **Backend**: Firebase (Firestore for database, Firebase Auth for authentication)
- **Deployment**: Designed for Netlify deployment

## Firebase Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing project
3. Enable Firebase Authentication with Email/Password provider
4. Enable Cloud Firestore

### 2. Deploy Firestore Security Rules
Deploy the security rules to protect your data:
```bash
firebase deploy --only firestore:rules
```

The security rules in `firestore.rules` ensure:
- Customers can only access their own data
- Technicians can see assigned visits
- Admins have full access
- Public can browse available service zips and slots

### 3. Environment Variables
The following environment variables are already configured in Replit Secrets:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## Initial Data Setup

### Create Admin User
1. Sign up through the app at `/signup`
2. In Firebase Console, go to Firestore Database
3. Find your user in the `customers` collection
4. Update the document to set `role: "admin"`

### Add Service Zip Codes
1. Log in as admin
2. Go to Admin Dashboard → Zip Codes tab
3. Add zip codes you service

### Create Service Slots
1. Go to Admin Dashboard → Service Slots tab
2. Create time windows for available dates

## User Roles

### Customer
- Sign up and book services
- View upcoming and past visits
- Send messages to support
- Access: `/portal`

### Technician  
- View assigned visits by date
- Mark visits as completed
- Access: `/tech`

### Admin
- Manage service zip codes
- Create and manage service slots
- View all visits and bookings
- Access technician portal
- Access: `/admin`

**Multi-role Support**: Users can have both technician and admin roles. Set the `role` field in Firestore to `"admin"` for full access.

## Features

✅ Multi-step signup with zip code validation
✅ Real-time slot availability tracking
✅ Automated quote calculation based on dog count
✅ Waitlist for non-serviced areas
✅ Role-based access control
✅ Mobile-responsive design
✅ Secure Firebase authentication
✅ Protected routes with role enforcement

## Development

```bash
npm install
npm run dev
```

## Deployment to Netlify

1. Build the project:
```bash
npm run build
```

2. Deploy the `dist` folder to Netlify

3. Set environment variables in Netlify dashboard

4. Configure redirects for SPA routing by creating `public/_redirects`:
```
/*    /index.html   200
```

## Security Notes

⚠️ **Important**: The Firestore security rules in `firestore.rules` must be deployed to Firebase for production use. Without these rules, your data is vulnerable.

The application is designed to work entirely client-side with Firebase, making it ideal for static hosting on Netlify while maintaining security through Firebase's built-in authentication and Firestore security rules.
