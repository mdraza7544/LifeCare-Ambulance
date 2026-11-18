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
| **Authentication** | Firebase Authentication (Email/Password, Custom Claims) |
| **Serverless Backend** | Firebase Cloud Functions v2 (Node.js 20, TypeScript) |
| **Maps & Routing** | Google Maps JavaScript API, Places API, Routes API |
| **Payment Gateway** | Razorpay (Checkout SDK & Cloud Function Verification) |
| **Emergency Alerts** | Twilio SMS API & EmailJS REST API |
| **Iconography** | Lucide React |

---

## Project Structure

```text
project/
├── .commandcode/              # Workspace preferences and configurations
├── dist/                      # Production build output
├── functions/                 # Firebase Cloud Functions (Node.js 20, TypeScript)
│   ├── src/
│   │   ├── index.ts           # Triggers (onBookingCreated, onAlertCreated, Razorpay verification)
│   │   ├── pin.ts             # 4-digit PIN generation and cryptographic hash verification
│   │   ├── razorpay.ts        # Razorpay signature verification and order utilities
│   │   └── seedHospitals.ts   # Hospital seeding helpers
│   ├── package.json
│   └── tsconfig.json
├── src/                       # Frontend React Application
│   ├── components/            # Reusable UI components
│   │   ├── AdminLayout.tsx    # Admin dashboard sidebar and layout
│   │   ├── HospitalMapPicker.tsx # Google Maps hospital selection modal
│   │   ├── LocationPicker.tsx # Interactive pickup map picker
│   │   ├── Navbar.tsx         # Responsive navigation bar
│   │   └── StatusBadge.tsx    # Visual status pills
│   ├── lib/                   # Core business logic and service layers
│   │   ├── auth.tsx           # Authentication context and role-guard hooks
│   │   ├── context.tsx        # Central application context
│   │   ├── db.ts              # Firestore mapping and query layer
│   │   ├── email.ts           # EmailJS browser client
│   │   ├── firebase.ts        # Firebase app, auth, db, and functions initialization
│   │   ├── firestoreService.ts# Unified Firestore CRUD, transactions, and real-time hooks
│   │   ├── googleMaps.ts      # Google Maps API loader and distance calculations
│   │   ├── hospitalApi.ts     # Live third-party hospital dataset integration & caching
│   │   ├── pricing.ts         # Distance-based dynamic fare calculation
│   │   ├── razorpay.ts        # Razorpay client checkout modal loader
│   │   ├── types.ts           # TypeScript interfaces and domain types
│   │   └── utils.ts           # Date, currency, and string formatters
│   ├── pages/                 # User and Admin views
│   │   ├── AdminAmbulances.tsx# Ambulance fleet management
│   │   ├── AdminBookings.tsx  # Dispatch and booking management
│   │   ├── AdminDashboard.tsx # Operational KPI dashboard
│   │   ├── AdminDrivers.tsx   # Driver registry management
│   │   ├── AdminHospitals.tsx # Hospital directory and search
│   │   ├── AdminPayments.tsx  # Transaction ledger
│   │   ├── AdminReports.tsx   # Operational reporting and analytics
│   │   ├── AdminUsers.tsx     # User account management
│   │   ├── BookAmbulancePage.tsx # Booking form with map picker & fare calculation
│   │   ├── BookingDetailsPage.tsx# Single trip detail view
│   │   ├── DriverVerifyPage.tsx# Driver PIN verification terminal
│   │   ├── HomePage.tsx       # Landing page
│   │   ├── MyBookingsPage.tsx # User booking history
│   │   ├── NotificationsPage.tsx # In-app notification feed
│   │   ├── PaymentPage.tsx    # Razorpay payment initiation
│   │   ├── PaymentConfirmationPage.tsx # Post-payment receipt
│   │   ├── TrackAmbulancePage.tsx # Real-time active trip map tracker
│   │   └── UserDashboard.tsx  # User account dashboard
│   ├── App.tsx                # Main router and route protection
│   ├── index.css              # Tailwind base directives and custom styling
│   └── main.tsx               # React application entry point
├── database.md                # Full Firestore schema documentation & ER diagram
├── FIREBASE_SETUP.md          # Backend configuration and Cloud Functions guide
├── firebase.json              # Firebase Hosting, Functions, and Firestore configuration
├── firestore.rules            # Firestore security rules and RBAC policies
├── firestore.indexes.json     # Compound query composite indexes
├── package.json               # Frontend dependencies and npm scripts
├── tailwind.config.js         # Tailwind styling configuration
├── tsconfig.json              # Root TypeScript project references
├── vite.config.ts             # Vite build configuration
└── README.md                  # Project documentation
```

---

## Database Architecture

LifeCare uses **Google Cloud Firestore** (NoSQL Document Store) as its database.

All data is organized into top-level collections:
* `users` — Customer and admin profiles, medical details, and embedded saved addresses.
* `bookings` — Trip records, pickup/destination GPS coordinates, fare, and lifecycle status.
* `booking_pins` — Server-generated 4-digit pickup verification PINs linked 1:1 to bookings.
* `ambulances` — Vehicle fleet registry and live assignment status.
* `drivers` — Driver records, duty status, and assigned ambulance code.
* `hospitals` — Directory of medical facilities with GPS locations, bed counts, and specialties.
* `emergency_contacts` — Patient next-of-kin contacts for emergency fan-out.
* `alerts` — SOS emergency events that trigger Twilio SMS and EmailJS dispatch.
* `notifications` — In-app notification center.
* `payments` — Razorpay payment records and audit log.

For complete entity relationships, Mermaid ER diagrams, field data dictionaries, and state machine flows, please see **[database.md](database.md)**.

---

## Core Application Routes

* `/` — Home landing page
* `/services` — Medical transport service tiers
* `/how-it-works` — How LifeCare works
* `/about` — About LifeCare
* `/contact` — Contact and support
* `/login` — Account sign in
* `/signup` — New patient account registration
* `/dashboard` — User dashboard and active booking summary
* `/book` — Book an ambulance (map picker, hospital selector, dynamic fare estimation)
* `/bookings` — User booking history
* `/booking/:id` — Booking details and verification PIN
* `/track/:id` — Live ambulance GPS tracking
* `/payment/:id` — Razorpay online payment checkout
* `/payment-confirmation` — Payment receipt and status
* `/verify-pin` — Driver terminal to verify patient pickup PIN
* `/notifications` — User notification center
* `/profile` — Profile and emergency contacts management
* `/admin` — Admin operations dashboard (Role-guarded)
* `/admin/bookings` — Admin booking dispatch and trip allocation
* `/admin/ambulances` — Fleet management
* `/admin/drivers` — Driver management
* `/admin/hospitals` — Hospital directory
* `/admin/payments` — Financial ledger
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
* Optional API keys:
  * **Google Maps API Key** (JavaScript API, Places API, Routes API)
  * **Razorpay Key ID & Secret** (for payment processing)
  * **Twilio Account SID & Auth Token** (for emergency SMS)
  * **EmailJS Service ID & Public/Private Keys** (for emergency email dispatch)

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

For Cloud Functions server-side environment secrets (`functions/.env`), see **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)**.

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

## Contributors

Built with precision for emergency medical services, patient transport, and intelligent fleet management.
