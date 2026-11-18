# Firebase Backend Migration — Setup Guide

LifeCare has been migrated from **Supabase** to a **Firebase** backend:

| Concern | Technology |
| --- | --- |
| Auth (register / login / logout / identity) | Firebase Authentication (email + password) |
| Database (users, emergency contacts, alerts, bookings, fleet, safety info) | Firebase Firestore |
| Server-side logic, emergency processing, DB triggers | Firebase Cloud Functions (Node 20, TypeScript) |
| Emergency SMS alerts | Twilio SDK (inside Cloud Functions — credentials stay server-side) |
| Emergency / safety emails | EmailJS (browser sends + server-side REST send from Cloud Functions) |

## 1. Create the Firebase project

1. Create a project at https://console.firebase.google.com and add a **Web app**.
2. Copy the web SDK config values into `.env` (edit it directly — it is the single env file, git-ignored).
3. Enable **Authentication → Email/Password**.
4. Create a **Firestore database** (production mode).

## 2. Frontend environment (`.env`)

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_EMAILJS_SERVICE_ID=...
VITE_EMAILJS_TEMPLATE_ID=...
VITE_EMAILJS_PUBLIC_KEY=...
```

These are public-by-design identifiers (Firebase web keys and EmailJS public
keys). No private credentials live in the frontend.

## 3. EmailJS setup

1. Create an EmailJS account, add an email service and a template.
2. Template variables used by the app: `to_email`, `to_name`, `subject`,
   `message`, `from_name`, `reply_to`.
3. Put `VITE_EMAILJS_*` (service id, template id, **public** key) in `.env`,
   and the **private** key in Cloud Functions env (step 4) so the server can
   also send emails via the EmailJS REST API.

## 4. Cloud Functions configuration (secrets)

```bash
cd functions
cp .env.example .env      # fill in real values
npm install
npm run build
```

`functions/.env` variables (never committed, already git-ignored):

```
TWILIO_ACCOUNT_SID=ACxxxx          # Twilio console
TWILIO_AUTH_TOKEN=xxxx             # Twilio console
TWILIO_FROM_NUMBER=+1xxxxxxxxxx    # Twilio phone number (SMS-capable)
EMAILJS_SERVICE_ID=...             # same service as frontend
EMAILJS_TEMPLATE_ID=...
EMAILJS_PUBLIC_KEY=...
EMAILJS_PRIVATE_KEY=...            # EmailJS > Account > API keys (private)
EMAILJS_FROM_NAME=LifeCare Ambulance Service
ADMIN_EMAILS=you@example.com       # bootstrap admins for setUserRole
```

For production, prefer Firebase secret params over `.env`:
`firebase functions:secrets:set TWILIO_AUTH_TOKEN` (and friends).

## 5. Deploy

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,firestore:indexes,functions
```

## Deployed functions

| Function | Type | Purpose |
| --- | --- | --- |
| `onBookingCreated` | Firestore trigger | Booking-confirmed notification for the user; SMS confirmation for `Critical` bookings. |
| `onAlertCreated` | Firestore trigger | Emergency processing: looks up the user's `emergency_contacts` (falls back to the profile's emergency contact), sends **Twilio SMS** + **EmailJS email** to each, then marks the alert `processed`. |
| `onUserProfileCreated` | Firestore trigger | Welcome notification for new accounts. |
| `setUserRole` | Callable | Admin-only. Sets the `admin` custom claim + `users/{uid}.role`. Guarded by the `admin` claim or `ADMIN_EMAILS`. |
| `createRazorpayOrder` | Callable | Creates a Razorpay order (amount read from the booking doc server-side). Returns the public key ID + order ID. |
| `verifyRazorpayPayment` | Callable | Verifies the Razorpay signature server-side and records the payment in `payments`. |

**Making an admin:** add your email to `ADMIN_EMAILS`, deploy, sign in, then
call `setUserRole` (e.g. from the emulator suite or a small script):

```js
const setUserRole = httpsCallable(functions, 'setUserRole');
await setUserRole({ uid: '<target-uid>', role: 'admin' });
```

## 6. Firestore data model

| Collection | Contents |
| --- | --- |
| `users/{uid}` | Profile: `full_name`, `email`, `phone`, `role`, `status`, `dob`, `blood_group`, `address`, `emergency_contact`, `emergency_phone`, `addresses[]` |
| `bookings` | `booking_code`, `patient_name`, `phone`, `pickup`, `destination`, `ambulance_type`, `emergency_level`, `scheduled_for`, `status`, `amount`, `payment_method`, `created_at`, `user_id` |
| `ambulances` / `drivers` / `hospitals` | Fleet registry (admin-writable) |
| `emergency_contacts` | `owner_uid`, `name`, `phone`, `relationship`, `email` |
| `alerts` | Emergency alerts with `status: pending → processed` and fan-out `result` |
| `notifications` | Per-user notifications (`user_id`, `title`, `message`, `read`, `type`) |

Security rules enforcing ownership and the `admin` claim are in
`firestore.rules`.

## 7. Removed (previous backend)

- `@supabase/supabase-js` dependency, `src/lib/supabase.ts`, and the entire
  `supabase/` directory (config + SQL migrations) were deleted.
- All legacy mock/demo data (`src/lib/mockData.ts`) has been removed; all features
  query real Firestore collections via real-time onSnapshot listeners and third-party APIs.

## 8. Local development

```bash
npm run dev            # Vite dev server (http://localhost:5173)
npm run typecheck      # frontend TS check
npm run build          # production build
npm --prefix functions run serve   # functions + emulators
```
