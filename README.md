# LifeCare Ambulance Service

A modern ambulance booking and healthcare mobility platform built with React, TypeScript, Vite, Google Cloud Firestore, and Firebase Cloud Functions. The platform allows patients and families to request emergency or scheduled ambulance services with interactive GPS location picking, real-time trip tracking, dynamic distance-based pricing, and secure online payments via Razorpay. A dedicated, role-guarded administration dashboard provides operators with full fleet management, driver dispatch, atomic trip allocation, and live operational reports.

---

## Documentation Index

* **[database.md](database.md)** — Comprehensive database architecture, complete Mermaid Entity-Relationship (ER) diagram, detailed collection schemas, lifecycle state machines, and Firestore security rules.
* **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)** — Firebase Authentication, Firestore indexes, Cloud Functions deployment guide, and server-side secret management.

---

## Overview

LifeCare simplifies emergency medical transport and planned hospital transfers. It combines an intuitive customer-facing web application with operational tools for dispatchers and administrators:

* **Real-time Dispatch & Tracking**: Live status updates powered by Firestore `onSnapshot` listeners.
* **Google Maps Integration**: Interactive pickup location picker, nearby hospital marker selection, and distance matrix routing.
* **Dynamic Pricing Engine**: Automated fare calculation based on ambulance equipment tier (Basic/BLS, Advanced/ALS, Cardiac, Neonatal) and route distance in kilometers.
* **Driver Pickup Verification PIN**: Server-generated 4-digit PIN system ensuring patient pickup verification and safety.
* **Seamless Payments**: Full integration with Razorpay (supporting Cards, UPI, NetBanking, and Cash on Arrival) with server-side signature verification.
* **Hospital Directory**: Integrated with a live nationwide hospital dataset (with in-memory & session caching), plus administrator directory management.
* **Multi-channel Alerts**: Automated SMS notifications via Twilio and email dispatch via EmailJS for emergency SOS alerts and critical bookings.

---

## Key Features

### For Patients & Users
* **Authentication & Profile**: Secure sign up, email/password login, password reset, and profile management with blood group, date of birth, and emergency contacts.
* **Saved Addresses**: Manage multiple destination addresses (Home, Office, Clinic) for fast one-tap booking.
* **Interactive Map Booking**: Select exact pickup coordinates on Google Maps, choose destination hospitals from an interactive map, and specify emergency priority levels (`Critical`, `Urgent`, `Normal`).
* **Instant Fare Estimation**: Transparent distance-based pricing computed automatically before booking confirmation.
* **4-Digit Safety PIN**: Unique pickup verification PIN generated server-side for each booking, visible only to the patient and verified by the driver.
* **Live Trip Tracking**: Real-time map tracking with live status updates (`pending` → `accepted` → `confirmed` → `allocated` → `completed`).
* **Razorpay Payment Gateway**: Seamless in-app checkout modal and instant payment confirmation receipts.
* **Emergency SOS & Alerting**: Trigger instant SOS alerts that fan out SMS and email notifications to registered emergency contacts.
* **Notifications Center**: Real-time notification feed with read/unread tracking and direct trip navigation.

### For Administrators & Dispatchers
* **Role-Based Access Control**: Guarded routes verifying Firebase Auth custom claims (`admin`) and database role records.
* **Operations Dashboard**: Real-time overview of active bookings, fleet availability, on-duty drivers, and financial performance.
* **Atomic Fleet Allocation**: Assign available ambulances and drivers to confirmed trips via Firestore atomic transactions to prevent race conditions or double-booking.
* **Ambulance Fleet Management**: Add, update, monitor, and retire vehicles across equipment classifications (Basic, Advanced, Cardiac, Neonatal).
* **Driver Registry**: Manage driver profiles, commercial license details, duty status (`available`, `allocated`, `off-duty`), ratings, and assigned ambulances.
* **Hospital Directory**: Search, filter by specialty or emergency readiness, and manage hospital locations.
* **Payment Ledger**: Audit trail of all transactions, payment methods, captured amounts, and refunds.
* **Analytics & Reports**: Operational metrics, trip volume charts, revenue reports, and export capabilities.

---

## Tech Stack

| Domain | Technology |
| --- | --- |
| **Frontend Framework** | React 18 with TypeScript |
| **Build Tool & Dev Server** | Vite |
| **Styling** | Tailwind CSS |
| **Database** | Google Cloud Firestore (NoSQL Document Database) |
| **Authentication** | Firebase Authentication (Email/Password, Email Verification, Password Reset) |
| **Serverless Compute** | Firebase Cloud Functions (Node.js runtime) |
| **Maps & Routing** | Google Maps JavaScript API, Places API, Directions / Routes API |
| **Payment Gateway** | Razorpay Node.js SDK (Client Checkout + Server Verification) |
| **External Alerting** | Twilio REST API (SMS) & EmailJS REST API (Email alerts) |

---

## Project Structure

```
├── functions/                  # Firebase Cloud Functions (backend)
│   ├── src/
│   │   ├── index.ts            # Entrypoint exposing all callable functions & triggers
│   │   ├── razorpay.ts         # Razorpay order generation & signature verification
│   │   ├── twilio.ts           # Twilio SMS dispatch
│   │   ├── alerts.ts           # Emergency SOS alert fan-out
│   │   ├── bookingPin.ts       # Secure 4-digit pickup PIN generation & verification
│   │   └── hospitalProxy.ts    # Proxies & caches the third-party hospitals directory
│   ├── package.json
│   └── tsconfig.json
├── src/
│   ├── components/             # Reusable UI components
│   │   ├── AdminLayout.tsx     # Admin panel container & sidebar navigation
│   │   ├── Header.tsx          # Public & user navigation header
│   │   ├── Footer.tsx          # Application footer
│   │   ├── LocationPicker.tsx  # Google Maps interactive location selector
│   │   ├── HospitalMapPicker.tsx # Hospital map selector with distance & routing
│   │   ├── StatusBadge.tsx     # Color-coded booking status pill
│   │   ├── DemoCheckoutModal.tsx # Simulated Razorpay checkout modal
│   │   └── UI.tsx              # Modal, StatCard, EmptyState primitives
│   ├── lib/                    # Shared core utilities & services
│   │   ├── auth.tsx            # Firebase Auth provider, user profile hydration, email verification
│   │   ├── authConfig.ts       # ActionCodeSettings & action parameter parsing
│   │   ├── context.tsx         # Central application state & live listeners
│   │   ├── firebase.ts         # Firebase App initialization & client SDK exports
│   │   ├── firestoreService.ts # Unified Firestore data access layer & real-time hooks
│   │   ├── dashboardStats.ts   # Pure stats computation for User & Admin dashboards
│   │   ├── dispatchService.ts  # Auto-dispatch & queue processing engine
│   │   ├── googleMaps.ts       # Google Maps loader, geocoding & distance calculation
│   │   ├── hospitalApi.ts      # Hospital data fetching with session & memory caching
│   │   ├── payment.ts          # Unified payment wrapper (Demo vs Razorpay)
│   │   ├── pricing.ts          # Ambulance equipment tier fare definitions
│   │   ├── types.ts            # TypeScript interfaces & domain models
│   │   └── utils.ts            # Formatting helpers (currency, date, booking code)
│   ├── pages/                  # Page route components
│   │   ├── HomePage.tsx
│   │   ├── BookAmbulancePage.tsx
│   │   ├── UserDashboard.tsx
│   │   ├── MyBookingsPage.tsx
│   │   ├── BookingDetailsPage.tsx
│   │   ├── TrackAmbulancePage.tsx
│   │   ├── PaymentPage.tsx
│   │   ├── PaymentConfirmationPage.tsx
│   │   ├── NotificationsPage.tsx
│   │   ├── ProfilePage.tsx
│   │   ├── EditProfilePage.tsx
│   │   ├── VerifyEmailPage.tsx
│   │   ├── ResetPasswordPage.tsx
│   │   ├── AuthActionPage.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── AdminBookings.tsx
│   │   ├── AdminAmbulances.tsx
│   │   ├── AdminDrivers.tsx
│   │   ├── AdminUsers.tsx
│   │   ├── AdminPayments.tsx
│   │   └── AdminReports.tsx
│   ├── App.tsx                 # Route declarations & role/verification guards
│   ├── main.tsx                # React DOM entry point
│   └── index.css               # Tailwind CSS & global animations
├── firestore.rules             # Production security rules for Firestore
├── firestore.indexes.json      # Composite indexes for Firestore queries
├── package.json
└── vite.config.ts
```

---

## Application Routes

### Public Routes
* `/` — Landing page with hero banner, service overview, and testimonials
* `/services` — Detailed breakdown of ambulance tiers and life-support equipment
* `/how-it-works` — Step-by-step patient journey guide
* `/about` — About LifeCare Ambulance Service
* `/contact` — Contact information and support inquiry form
* `/login` — Account sign in
* `/signup` — Account registration
* `/forgot-password` — Password reset request (generic message & 60s cooldown)
* `/reset-password` — Password reset confirmation form
* `/auth/action` — Firebase email action link handler (verification, recovery)
* `/verify-email` — Email verification waiting room with auto-polling & cooldown resend

### Authenticated User Routes (Guarded: requires sign-in & verified email)
* `/dashboard` — User command center with live booking cards & recent history
* `/book` — Multi-step ambulance booking wizard
* `/bookings` — Searchable booking history with status filters
* `/booking-details?id=:id` — Comprehensive trip details, live driver status & PIN
* `/track` — Live GPS tracking map
* `/payment?id=:id` — Unified payment checkout
* `/payment-confirmation?id=:id` — Post-payment receipt & status confirmation
* `/notifications` — User notification center with unread badges
* `/profile` — Personal profile & password-reauthenticated email change
* `/edit-profile` — Edit personal information

### Administrator Routes (`/admin/*` — Guarded: requires admin role)
* `/admin` — High-level operational metrics, live fleet counts, revenue, and trip charts
* `/admin/bookings` — Booking management, queue processor, and manual dispatch
* `/admin/ambulances` — Vehicle fleet management
* `/admin/drivers` — Commercial driver registry
* `/admin/hospitals` — Hospital directory
* `/admin/payments` — Financial audit ledger & transaction history
* `/admin/users` — User administration
* `/admin/reports` — Analytics and operational reports

---

## Prerequisites

Before running the project locally, ensure you have:
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* A **Firebase project** with:
  * Authentication (Email/Password provider enabled)
  * Cloud Firestore database created
  * Cloud Functions enabled (Blaze plan required for external APIs like Twilio/Razorpay)

---

## Environment Setup

Create a `.env` file in the project root directory:

```env
# Firebase Web SDK Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id

# Google Maps API (JavaScript & Routes API)
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Third-party Hospitals API endpoint (defaults to WIB India Hospitals Dataset)
VITE_HOSPITALS_API_URL=https://wibest.in/data/json/hospitals.json

# EmailJS Client Configuration (Public Key only in frontend)
VITE_EMAILJS_SERVICE_ID=your_emailjs_service_id
VITE_EMAILJS_TEMPLATE_ID=your_emailjs_template_id
VITE_EMAILJS_PUBLIC_KEY=your_emailjs_public_key

# Application Base URL for Firebase Auth Action Emails (verification, password reset)
VITE_APP_URL=http://localhost:5173

# Payment Gateway Mode: "demo" (default) or "razorpay"
VITE_PAYMENT_MODE=demo

# Functions Emulator (set to false if testing with production deployed Cloud Functions)
VITE_FUNCTIONS_EMULATOR=true
```

### Switching Payment Modes (Demo vs Razorpay)

LifeCare includes a unified payment checkout wrapper (`src/lib/payment.ts`) supporting two operational modes configured via `VITE_PAYMENT_MODE`:

1. **Demo Payment Mode (`VITE_PAYMENT_MODE=demo` - Default)**:
   - Opens an interactive Razorpay-replica modal (`DemoCheckoutModal`) supporting Cards, UPI, Netbanking, and Wallets.
   - Requires **no Razorpay API keys or credentials**.
   - Test Card `4111 1111 1111 1111` or any valid UPI ID succeeds.
   - Test Card `4000 0000 0000 0002` or "Simulate failure flow" tests failure scenarios.
   - Skips server-side signature verification while updating booking (`paymentStatus = 'paid'`, `status = 'confirmed'`) and creating idempotent records in the Firestore `payments` collection.
2. **Live/Test Razorpay Mode (`VITE_PAYMENT_MODE=razorpay`)**:
   - Calls Cloud Function `createRazorpayOrder` to generate a real Razorpay Order ID.
   - Launches standard Razorpay Checkout SDK.
   - Executes server-side HMAC-SHA256 signature verification via Cloud Function `verifyRazorpayPayment`.
   - Requires `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `functions/.env`.

---

### Firebase Auth Email Setup (Free Spark Plan Safe)

LifeCare uses Firebase Authentication's native client email mechanisms (no Cloud Functions or paid third-party email services required):

1. **Email Verification on Signup**: Sends a verification link upon account creation. Unverified users cannot access `/dashboard`, `/book`, `/bookings`, `/track`, `/profile`, or payment pages. Admin accounts are exempt.
2. **Password Reset**: Secure forgot-password flow with account enumeration protection, minimum 8-character complexity rules (letters + numbers), and 60-second cooldowns.
3. **Verified Email Change**: Secure reauthenticated email changes using `verifyBeforeUpdateEmail` (the current email remains active everywhere until the new address is verified; reversible via `recoverEmail`).
4. **Action Link Interceptor**: Built-in URL query parameter parser (`parseAuthActionParams`) handles links where Firebase appends parameters before the hash router (`?mode=...&oobCode=...#/`).

#### Configuration:
- Set `VITE_APP_URL` in `.env` to your application URL (e.g. `http://localhost:5173` for development, `https://lifecare-ambulance.web.app` in production).
- In **Firebase Console > Authentication > Settings > Authorized domains**, ensure your domains (e.g. `localhost`, `lifecare-ambulance.web.app`) are listed.
- In **Firebase Console > Authentication > Templates**:
  - The built-in email templates (`Email address verification`, `Password reset`, `Email address change`) work out of the box with the default Firebase action handler.
  - If customizing the "Action URL" in template settings:
    - For local development: `http://localhost:5173/`
    - For production: `https://<your-project-id>.web.app/`
    - Firebase attaches `?mode=...&oobCode=...` which LifeCare automatically reads from `window.location.search` at startup.

---

## Installation & Running Locally

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install Cloud Functions dependencies
cd functions
npm install
cd ..
```

### 2. Run the Development Server

#### Frontend Only
```bash
npm run dev
```
The application will be accessible at `http://localhost:5173`.

#### Full Stack (Frontend + Firebase Cloud Functions Emulator)
```bash
npm run dev:all
```
This runs the Vite dev server concurrently with the Firebase Cloud Functions emulator on port `5001`.

---

## Available NPM Scripts

```bash
# Frontend development server
npm run dev

# Compile TypeScript and build production bundle
npm run build

# Preview production build locally
npm run preview

# Run TypeScript typechecks across src/
npm run typecheck

# Run ESLint linter
npm run lint

# Compile Cloud Functions TypeScript to JavaScript
npm run build:functions

# Start the Firebase Functions emulator
npm run start:functions

# Start frontend dev server and Functions emulator concurrently
npm run dev:all
```

---

## Deploying to Production

### 1. Build the Frontend
```bash
npm run build
```

### 2. Deploy Firestore Rules and Indexes
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 3. Deploy Cloud Functions
```bash
firebase deploy --only functions
```

### 4. Deploy Frontend Hosting
```bash
firebase deploy --only hosting
```

Or deploy all components in a single command:
```bash
firebase deploy
```

---

## License

This project is licensed under the MIT License.
