# LifeCare Ambulance Service

A modern ambulance booking and healthcare mobility platform built with React, TypeScript, Vite, and Firebase. The application allows users to request emergency or scheduled ambulance services, track booking status, manage profiles and addresses, and access a dedicated admin dashboard for fleet and operations management.

## Overview

LifeCare is designed to simplify ambulance booking and patient support for both emergency and planned hospital transfers. It combines a responsive customer-facing experience with operational tools for administrators, including fleet management, booking oversight, payment tracking, user management, and notification workflows.

The app supports:

- User registration and login
- Booking ambulance trips with pickup and destination details
- Tracking live ambulance status
- Saving address information for faster bookings
- Managing profiles and emergency contacts
- Payment and confirmation flows
- Admin dashboards for bookings, payments, users, hospitals, drivers, and notifications
- Firebase-backed authentication and data storage

## Key Features

### For Users

- Secure sign up, sign in, password reset, and sign out
- Dashboard with booking summary and activity overview
- Ambulance booking form with trip details and emergency priority levels
- My bookings list with status tracking
- Booking detail view and trip updates
- Real-time tracking interface for active bookings
- Notification center with read/unread status
- Saved addresses and profile management
- Payment page and confirmation flow
- Feedback form for service review

### For Administrators

- Admin-only access route protection
- Booking overview and status management
- Ambulance fleet management
- Driver management
- User management
- Hospital directory management
- Payment and earnings summary
- Reports and operational analytics
- Notification management
- Site configuration and account settings

### Technical Highlights

- Firebase Authentication for identity management
- Firestore for app data persistence
- Type-safe React application with TypeScript
- Styling with Tailwind CSS
- Vite-based fast development workflow
- Cloud Functions support for advanced backend automation and notifications
- EmailJS and Twilio integration support through server-side functions

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Firebase Authentication
- Firestore
- Firebase Cloud Functions
- EmailJS
- Lucide React icons

## Project Structure

```text
project/
├── public/
├── src/
│   ├── components/
│   ├── lib/
│   ├── pages/
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── functions/
│   ├── src/
│   └── lib/
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── FIREBASE_SETUP.md
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── README.md
```

## Core Application Flow

The app uses a hash-based router and central app context to manage navigation, profile state, bookings, notifications, and addresses.

Main application routes include:

- `/` — Home page
- `/services` — Services overview
- `/how-it-works` — Process overview
- `/about` — Company details
- `/contact` — Contact support
- `/login` — User sign in
- `/signup` — New account creation
- `/dashboard` — User dashboard
- `/book` — Create a booking
- `/bookings` — Booking history
- `/track` — Ambulance tracking
- `/profile` — User profile
- `/admin` — Admin dashboard

## Prerequisites

Before running the project, make sure you have:

- Node.js 18+ recommended
- npm or yarn
- Firebase project access
- Optional: Firebase CLI and Cloud Functions setup if you want backend features enabled

## Installation

1. Clone the repository
2. Change into the project directory
3. Install the frontend dependencies

```bash
npm install
```

## Environment Setup

This project uses Firebase configuration values in environment variables. Create a `.env` file in the project root and add your Firebase and EmailJS values.

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

VITE_EMAILJS_SERVICE_ID=your_emailjs_service
VITE_EMAILJS_TEMPLATE_ID=your_emailjs_template
VITE_EMAILJS_PUBLIC_KEY=your_emailjs_public_key
```

For complete backend setup and deployment guidance, refer to:

- [FIREBASE_SETUP.md](FIREBASE_SETUP.md)

## Running the Project

### Frontend only

Start the Vite development server:

```bash
npm run dev
```

Then open the app in your browser:

```text
http://localhost:5173/
```

### Frontend + Functions emulator (for payments and backend features)

Start both the Vite dev server and the Firebase Functions emulator in one command:

```bash
npm run dev:all
```

Or start them separately:

```bash
# Terminal 1 — frontend
npm run dev

# Terminal 2 — Functions emulator
npm run start:functions
```

The emulator serves Cloud Functions at `http://127.0.0.1:5001/<project-id>/us-central1/<endpoint>`.
The frontend automatically points to the emulator when running on `localhost` (unless `VITE_FUNCTIONS_EMULATOR=false` is set in `.env`).

## Available Scripts

```bash
npm run dev
```
Runs the Vite development server.

```bash
npm run build
```
Creates a production-ready build.

```bash
npm run preview
```
Serves the production build locally.

```bash
npm run typecheck
```
Runs TypeScript checks for the project.

```bash
npm run lint
```
Runs ESLint across the codebase.

```bash
npm run build:functions
```
Compiles TypeScript Cloud Functions in `functions/src/` to `functions/lib/`.

```bash
npm run start:functions
```
Starts the Firebase Functions emulator on port 5001.

```bash
npm run dev:all
```
Runs the frontend dev server and Functions emulator concurrently.

## Firebase and Backend Notes

The project is designed for Firebase-first backend usage:

- Firebase Authentication for customer/admin sign in
- Firestore for users, bookings, notifications, hospitals, and other app records
- Cloud Functions for booking notifications, emergency alerts, role management, and payment verification workflows

The app also includes a local/demo-friendly state layer so it can behave gracefully even when database connectivity is unavailable.

## Admin Setup

Admin access is controlled through user role information in the auth/profile model. By default, the app checks for an admin role before allowing access to admin routes.

For a full role setup and Firebase server configuration, see the Firebase setup guide in [FIREBASE_SETUP.md](FIREBASE_SETUP.md).

## Deployment

The project is ready for deployment using a static hosting platform or Firebase hosting, and backend logic can be deployed via Firebase Cloud Functions.

Typical deployment flow:

```bash
npm run build
firebase deploy
```

If you are using Firebase Cloud Functions, also deploy the function backend according to the Firebase setup guide.

## Notes

- The app contains demo/mock fallback data for offline or empty-database scenarios.
- Some admin and payment features depend on Firebase backend configuration and Cloud Functions.
- The frontend is built to be responsive and suitable for both desktop and mobile browsing.

## License

This project does not currently include an explicit license file. If you plan to publish or distribute it, add a license file such as MIT before release.

## Contributors

This project was created as a working ambulance service management platform and can be extended for production deployment, carrier integrations, or additional healthcare workflows.
