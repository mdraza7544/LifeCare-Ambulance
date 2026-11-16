/**
 * LifeCare Ambulance Service — Firebase Cloud Functions.
 *
 * Server-side logic replacing the previous Supabase backend:
 *  - `onBookingCreated`     : Firestore trigger — booking confirmation notification (+ SMS for critical bookings).
 *  - `onAlertCreated`       : Firestore trigger — emergency processing; fans out Twilio SMS + EmailJS
 *                             emails to the user's registered emergency contacts.
 *  - `onUserProfileCreated` : Firestore trigger — welcome notification for new accounts.
 *  - `setUserRole`          : Callable — admin-only promotion of accounts to admin (custom claim + profile doc).
 *
 * Credentials (Twilio, EmailJS private key) are read from Cloud Functions env
 * config (`functions/.env`) and are NEVER bundled into the frontend.
 */
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import twilio from 'twilio';
import {
  generatePin,
  hashPin,
  computeExpiry,
  evaluatePinAttempt,
  MAX_ATTEMPTS,
  type PinRecord,
} from './pin';
import { verifyPaymentSignature, verifyWebhookSignature } from './razorpay';

admin.initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const firestore = admin.firestore();

/* ------------- Credentials (server-only) ------------- */

const twilioSid = process.env.TWILIO_ACCOUNT_SID ?? '';
const twilioToken = process.env.TWILIO_AUTH_TOKEN ?? '';
const twilioFrom = process.env.TWILIO_FROM_NUMBER ?? '';

const emailjsServiceId = process.env.EMAILJS_SERVICE_ID ?? '';
const emailjsTemplateId = process.env.EMAILJS_TEMPLATE_ID ?? '';
const emailjsPublicKey = process.env.EMAILJS_PUBLIC_KEY ?? '';
const emailjsPrivateKey = process.env.EMAILJS_PRIVATE_KEY ?? '';
const emailjsFromName = process.env.EMAILJS_FROM_NAME || 'LifeCare Ambulance Service';

const razorpayKeyId = process.env.RAZORPAY_KEY_ID ?? '';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET ?? '';
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

function twilioClient(): twilio.Twilio | null {
  if (!twilioSid || !twilioToken || !twilioFrom) {
    logger.warn('Twilio not configured (TWILIO_* env vars missing) — SMS skipped.');
    return null;
  }
  return twilio(twilioSid, twilioToken);
}

/** Sends an emergency SMS via the Twilio SDK. Returns the message SID or null. */
async function sendEmergencySms(to: string, body: string): Promise<string | null> {
  const client = twilioClient();
  if (!client) return null;
  try {
    const message = await client.messages.create({ to, from: twilioFrom, body });
    logger.info(`SMS sent to ${to} (${message.sid})`);
    return message.sid;
  } catch (err) {
    logger.error('Twilio SMS failed', err);
    return null;
  }
}

/**
 * Sends an emergency/safety email via the EmailJS REST API (server-side send
 * authorized with the EmailJS private key — the browser only ever uses the
 * public key for its own direct sends).
 */
async function sendEmergencyEmail(params: {
  to_email: string; to_name: string; subject: string; message: string;
}): Promise<boolean> {
  if (!emailjsServiceId || !emailjsTemplateId || !emailjsPublicKey || !emailjsPrivateKey) {
    logger.warn('EmailJS not configured (EMAILJS_* env vars missing) — email skipped.');
    return false;
  }
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: emailjsServiceId,
        template_id: emailjsTemplateId,
        user_id: emailjsPublicKey,
        accessToken: emailjsPrivateKey,
        template_params: { from_name: emailjsFromName, ...params },
      }),
    });
    if (!res.ok) {
      logger.error(`EmailJS REST error ${res.status}: ${await res.text()}`);
      return false;
    }
    logger.info(`Email sent to ${params.to_email}`);
    return true;
  } catch (err) {
    logger.error('EmailJS send failed', err);
    return false;
  }
}

/* ------------- Emergency recipient lookup ------------- */

interface Recipient {
  name: string;
  phone?: string;
  email?: string;
}

/** Registered emergency contacts, falling back to the profile's emergency contact. */
async function loadEmergencyRecipients(userId: string): Promise<Recipient[]> {
  const recipients: Recipient[] = [];
  try {
    const snap = await firestore
      .collection('emergency_contacts')
      .where('owner_uid', '==', userId)
      .get();
    snap.forEach((d) => {
      const v = d.data();
      recipients.push({
        name: String(v.name ?? 'Emergency contact'),
        phone: v.phone ? String(v.phone) : undefined,
        email: v.email ? String(v.email) : undefined,
      });
    });
  } catch (err) {
    logger.error('Failed to load emergency contacts', err);
  }
  if (recipients.length === 0) {
    try {
      const profileSnap = await firestore.collection('users').doc(userId).get();
      const p = profileSnap.data();
      if (p?.emergency_contact && p?.emergency_phone) {
        recipients.push({
          name: String(p.emergency_contact),
          phone: String(p.emergency_phone),
          email: p.email ? String(p.email) : undefined,
        });
      }
    } catch (err) {
      logger.error('Failed to load profile fallback contact', err);
    }
  }
  return recipients;
}

const isoNow = () => new Date().toISOString();

/* ------------- Trigger: booking created ------------- */

export const onBookingCreated = onDocumentCreated('bookings/{bookingId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;
  const bookingCode = String(data.booking_code ?? event.params.bookingId);
  const userId = data.user_id ? String(data.user_id) : '';

  if (userId) {
    await firestore
      .collection('notifications')
      .doc(`booking-${event.params.bookingId}`)
      .set({
        user_id: userId,
        title: 'Booking confirmed',
        message: `Your booking ${bookingCode} has been confirmed.`,
        time: 'Just now',
        read: false,
        type: 'booking',
        created_at: isoNow(),
      }, { merge: true })
      .catch((err) => logger.error('Booking notification write failed', err));
  }

  // Critical bookings: instantly confirm over SMS to the patient's phone.
  if (data.phone && String(data.emergency_level).toLowerCase() === 'critical') {
    await sendEmergencySms(
      String(data.phone),
      `LifeCare: Emergency booking ${bookingCode} received. Help is being dispatched to: ${String(data.pickup ?? 'your location')}.`,
    );
  }

  // ---- Generate the pickup verification PIN (server-side, never client) ----
  // A unique 4-digit PIN is written to `booking_pins/{bookingId}` and linked to
  // the booking + user. The plaintext `pin` is readable ONLY by the booking
  // owner (Firestore rules); the `pin_hash` is what `verifyBookingPin` checks.
  try {
    const pin = generatePin();
    await firestore.collection('booking_pins').doc(event.params.bookingId).set({
      booking_id: event.params.bookingId,
      booking_code: bookingCode,
      user_id: userId || null,
      pin,
      pin_hash: hashPin(pin),
      attempts: 0,
      max_attempts: MAX_ATTEMPTS,
      verified: false,
      status: 'active',
      expires_at: computeExpiry(),
      assigned_driver_uid: null,
      assigned_driver_name: null,
      created_at: isoNow(),
    });
    logger.info(`Verification PIN generated for booking ${event.params.bookingId}.`);
  } catch (err) {
    logger.error('Booking PIN generation failed', err);
  }
});

/* ------------- Trigger: emergency alert created ------------- */

export const onAlertCreated = onDocumentCreated('alerts/{alertId}', async (event) => {
  const alert = event.data?.data();
  if (!alert) return;
  const alertId = event.params.alertId;
  const userId = String(alert.user_id ?? '');

  const recipients = await loadEmergencyRecipients(userId);
  const alertMessage = String(alert.message ?? 'An emergency alert was triggered.');
  const location = String(alert.location ?? 'not specified');

  const smsResults: Array<{ to: string; sid: string | null }> = [];
  const emailResults: Array<{ to: string; ok: boolean }> = [];

  // Fan-out: Twilio SMS + EmailJS email to every registered emergency contact.
  for (const r of recipients) {
    if (r.phone) {
      const sid = await sendEmergencySms(
        r.phone,
        `EMERGENCY ALERT from LifeCare: ${alertMessage} Location: ${location}.`,
      );
      smsResults.push({ to: r.phone, sid });
    }
    if (r.email) {
      const ok = await sendEmergencyEmail({
        to_email: r.email,
        to_name: r.name,
        subject: 'Emergency Alert — LifeCare Ambulance Service',
        message: `${alertMessage}\n\nLocation: ${location}\nTime: ${new Date().toLocaleString('en-IN')}`,
      });
      emailResults.push({ to: r.email, ok });
    }
  }

  await firestore
    .collection('alerts')
    .doc(alertId)
    .update({
      status: 'processed',
      processed_at: isoNow(),
      result: { recipients: recipients.length, sms: smsResults, email: emailResults },
    })
    .catch((err) => logger.error('Alert status update failed', err));
});

/* ------------- Trigger: user profile created ------------- */

export const onUserProfileCreated = onDocumentCreated('users/{uid}', async (event) => {
  await firestore
    .collection('notifications')
    .add({
      user_id: event.params.uid,
      title: 'Welcome to LifeCare',
      message: 'Your account is set up. Book your first ambulance anytime.',
      time: 'Just now',
      read: false,
      type: 'system',
      created_at: isoNow(),
    })
    .catch((err) => logger.error('Welcome notification failed', err));
});

/* ------------- Callable: promote an account to admin ------------- */

export const setUserRole = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const token = request.auth.token as Record<string, unknown>;
  const allowed = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const callerEmail = String(token.email ?? '').toLowerCase();
  const callerIsAdmin = token.admin === true;
  if (!callerIsAdmin && !allowed.includes(callerEmail)) {
    throw new HttpsError('permission-denied', 'Only admins can change user roles.');
  }

  const uid = String(request.data?.uid ?? '');
  const role = String(request.data?.role ?? 'user');
  if (!uid || !['user', 'admin', 'driver'].includes(role)) {
    throw new HttpsError('invalid-argument', "Provide 'uid' and 'role' ('user' | 'admin' | 'driver').");
  }

  await admin.auth().setCustomUserClaims(uid, { admin: role === 'admin', driver: role === 'driver' });
  await firestore.collection('users').doc(uid).set(
    { role, updated_at: isoNow() },
    { merge: true },
  );
  logger.info(`Role '${role}' set for ${uid} by ${callerEmail}`);
  return { ok: true, uid, role };
});

/* ------------- Callable: assign a driver to a booking ------------- */
/* Admin-only. Links a booking (and its PIN doc) to a driver's Firebase UID so
   that `verifyBookingPin` can authorize ONLY the assigned driver. */

export const assignDriverToBooking = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const token = request.auth.token as Record<string, unknown>;
  const allowed = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const callerEmail = String(token.email ?? '').toLowerCase();
  if (token.admin !== true && !allowed.includes(callerEmail)) {
    throw new HttpsError('permission-denied', 'Only admins can assign drivers to bookings.');
  }

  const bookingId = String(request.data?.bookingId ?? '');
  const driverUid = String(request.data?.driverUid ?? '').trim();
  const driverName = String(request.data?.driverName ?? '').trim();
  if (!bookingId || !driverUid) {
    throw new HttpsError('invalid-argument', "Provide 'bookingId' and 'driverUid'.");
  }

  const bookingRef = firestore.collection('bookings').doc(bookingId);
  const snap = await bookingRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Booking not found.');
  }

  const now = isoNow();
  await bookingRef.set(
    {
      assigned_driver_uid: driverUid,
      assigned_driver_name: driverName || null,
      driver_assigned_at: now,
    },
    { merge: true },
  );
  // Keep the PIN doc in sync so the authorization source of truth is consistent.
  await firestore
    .collection('booking_pins')
    .doc(bookingId)
    .set(
      { assigned_driver_uid: driverUid, assigned_driver_name: driverName || null },
      { merge: true },
    )
    .catch((err) => logger.warn('Could not sync driver onto pin doc', err));

  logger.info(`Driver ${driverUid} assigned to booking ${bookingId} by ${callerEmail}.`);
  return { ok: true, bookingId, driverUid };
});

/* ------------- Callable: verify a booking pickup PIN ------------- */
/* The core secure verification. Runs ONLY on the backend:
   - the caller must be the driver assigned to THIS booking;
   - the PIN is checked against its hash (never returned);
   - reuse, expiry and brute-force (attempt limiting) are enforced;
   - on success the booking moves to "Verified" (Patient Picked Up). */

export const verifyBookingPin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const bookingId = String(request.data?.bookingId ?? '');
  const submittedPin = String(request.data?.pin ?? '').trim();
  if (!bookingId || !/^\d{4}$/.test(submittedPin)) {
    throw new HttpsError('invalid-argument', "Provide 'bookingId' and a 4-digit 'pin'.");
  }

  const bookingSnap = await firestore.collection('bookings').doc(bookingId).get();
  if (!bookingSnap.exists) {
    throw new HttpsError('not-found', 'Booking not found.');
  }
  const booking = bookingSnap.data() ?? {};

  // Authorization (requirement 8): only the assigned driver may verify.
  const assignedDriverUid = booking.assigned_driver_uid ? String(booking.assigned_driver_uid) : null;
  if (!assignedDriverUid || assignedDriverUid !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'You are not the assigned driver for this booking.');
  }

  const pinSnap = await firestore.collection('booking_pins').doc(bookingId).get();
  if (!pinSnap.exists) {
    throw new HttpsError('not-found', 'Verification PIN not found for this booking.');
  }
  const pinDoc = pinSnap.data() ?? {};

  const record: PinRecord = {
    pinHash: String(pinDoc.pin_hash ?? ''),
    status: String(pinDoc.status ?? 'active') as PinRecord['status'],
    attempts: Number(pinDoc.attempts ?? 0),
    maxAttempts: Number(pinDoc.max_attempts ?? MAX_ATTEMPTS),
    expiresAt: String(pinDoc.expires_at ?? ''),
    verified: Boolean(pinDoc.verified),
  };

  const outcome = evaluatePinAttempt(record, submittedPin);
  const now = isoNow();

  if (outcome.ok) {
    // Mark PIN used + transition the booking to Verified (Patient Picked Up).
    await firestore.collection('booking_pins').doc(bookingId).set(
      {
        verified: true,
        status: 'verified',
        verified_at: outcome.verifiedAt,
        verified_by: request.auth.uid,
      },
      { merge: true },
    );
    await firestore.collection('bookings').doc(bookingId).set(
      {
        status: 'Verified',
        verified_at: outcome.verifiedAt,
        verified_by_driver_uid: request.auth.uid,
      },
      { merge: true },
    );
    logger.info(`Booking ${bookingId} verified by driver ${request.auth.uid}.`);
    return { ok: true, status: 'Verified', message: 'Patient pickup verified successfully.' };
  }

  // Failed attempt — persist the incremented attempt count / status change.
  await firestore.collection('booking_pins').doc(bookingId).set(
    {
      attempts: outcome.nextAttempts,
      status: outcome.nextStatus,
      last_attempt_at: now,
    },
    { merge: true },
  );

  const messages: Record<string, string> = {
    'already-verified': 'This booking has already been verified.',
    expired: 'This verification PIN has expired.',
    locked: 'Too many incorrect attempts. The PIN is now locked.',
    incorrect: 'Incorrect PIN.',
  };
  logger.warn(
    `PIN verify failed for booking ${bookingId}: ${outcome.reason} (${outcome.nextAttempts}/${record.maxAttempts}).`,
  );
  throw new HttpsError(
    outcome.reason === 'incorrect' ? 'invalid-argument' : 'failed-precondition',
    messages[outcome.reason],
    { reason: outcome.reason, attemptsRemaining: outcome.attemptsRemaining },
  );
});

/* ------------- Razorpay: real-time payments (server-side only) ------------- */
/* The key secret NEVER leaves this runtime — the browser only receives the
   public key id, the order id and the amount, as required by Razorpay
   Checkout. Orders + verifications are recorded in the `payments` collection. */

const RAZORPAY_ORDER_URL = 'https://api.razorpay.com/v1/orders';

function razorpayAuthHeader(): string {
  return `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64')}`;
}

/** CORS headers helper for Razorpay HTTP endpoints. */
function setRazorpayCorsHeaders(res: any): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/** Extracts and verifies the Firebase ID token from the Authorization header. */
async function verifyFirebaseIdToken(req: any): Promise<{ uid: string } | null> {
  const authHeader = String(req.headers.authorization ?? '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

/**
 * Fetches a URL with retry logic and timeout.
 * Retries on network errors (e.g. "socket hang up", ECONNREFUSED, ETIMEDOUT).
 * @param url The URL to fetch.
 * @param init Fetch options.
 * @param retries Number of retry attempts (default 2).
 * @param timeoutMs Request timeout in ms (default 10000).
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries: number = 2,
  timeoutMs: number = 10000,
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      // If it's an AbortError from timeout, don't retry — just fail fast.
      if ((err as DOMException).name === 'AbortError') {
        logger.error(`Fetch to ${url} timed out after ${timeoutMs}ms`);
        break;
      }
      if (attempt < retries) {
        logger.warn(`Fetch to ${url} failed (attempt ${attempt + 1}/${retries + 1}), retrying…`, err);
        // Small backoff before retry
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

/** Creates a Razorpay order for a booking. Called from the payment page via HTTP. */
export const createRazorpayOrder = onRequest(async (req, res) => {
  setRazorpayCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const user = await verifyFirebaseIdToken(req);
  if (!user) {
    res.status(401).json({ error: 'You must be signed in to pay.' });
    return;
  }

  if (!razorpayKeyId || !razorpayKeySecret) {
    logger.error('Razorpay not configured (RAZORPAY_* env vars missing).');
    res.status(500).json({ error: 'Payments are not configured yet.' });
    return;
  }

  const body = req.body as { bookingId?: string } ?? {};
  const bookingId = String(body.bookingId ?? '');
  const uid = user.uid;
  if (!bookingId) {
    res.status(400).json({ error: "Provide 'bookingId'." });
    return;
  }

  // Amount is always taken from the booking document on the server — never
  // trusted from the client.
  const bookingSnap = await firestore.collection('bookings').doc(bookingId).get();
  if (!bookingSnap.exists) {
    res.status(404).json({ error: 'Booking not found.' });
    return;
  }
  const booking = bookingSnap.data() ?? {};
  if (booking.user_id !== uid) {
    res.status(403).json({ error: 'This booking does not belong to you.' });
    return;
  }
  // Prevent creating a new order for a booking that has already been paid.
  if (booking.payment_status === 'Paid') {
    res.status(400).json({ error: 'This booking has already been paid.' });
    return;
  }
  const amountInPaise = Math.round(Number(booking.amount ?? 0) * 100);
  if (amountInPaise <= 0) {
    res.status(400).json({ error: 'Booking amount is invalid.' });
    return;
  }

  let razorpayRes: Response;
  try {
    razorpayRes = await fetchWithRetry(RAZORPAY_ORDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: razorpayAuthHeader(),
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: booking.booking_code ?? bookingId,
        notes: { booking_id: bookingId, user_id: uid },
      }),
    });
  } catch (err) {
    logger.error('Razorpay order creation failed (network error)', err);
    res.status(503).json({
      error: 'Payment service is temporarily unavailable. Please try again.',
    });
    return;
  }
  if (!razorpayRes.ok) {
    logger.error('Razorpay order creation failed', await razorpayRes.text());
    res.status(500).json({ error: 'Could not create the payment order.' });
    return;
  }
  const order = (await razorpayRes.json()) as { id: string; amount: number; currency: string };

  // Record the order immediately (payment pending).
  await firestore.collection('payments').doc(order.id).set({
    razorpay_order_id: order.id,
    booking_id: bookingId,
    user_id: uid,
    amount: amountInPaise,
    currency: order.currency,
    status: 'created',
    created_at: isoNow(),
  });

  logger.info(`Razorpay order ${order.id} created for booking ${bookingId}`);
  res.status(200).json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: razorpayKeyId, // public key id — safe for the browser
    bookingCode: String(booking.booking_code ?? ''),
  });
});

/** Normalizes a Razorpay payment status into our internal payment state. */
function toPaymentStatus(razorpayStatus: string): 'paid' | 'pending' | 'failed' {
  if (razorpayStatus === 'captured') return 'paid';
  if (razorpayStatus === 'authorized') return 'pending';
  return 'failed';
}

interface PaymentContext {
  orderId: string;
  paymentId: string;
  bookingId: string;
  uid: string | null;
  method: string | null;
  razorpayStatus: string;
}

/**
 * Writes the final payment result to the `payments` doc and — ONLY when the
 * payment is fully captured — advances the booking to "On Going" and marks it
 * paid. Shared by the client-triggered verify callable and the webhook so both
 * stay consistent and idempotent.
 */
async function finalizePayment(ctx: PaymentContext): Promise<'paid' | 'pending' | 'failed'> {
  const status = toPaymentStatus(ctx.razorpayStatus);
  const now = isoNow();
  await firestore.collection('payments').doc(ctx.orderId).set(
    {
      razorpay_order_id: ctx.orderId,
      razorpay_payment_id: ctx.paymentId,
      booking_id: ctx.bookingId,
      user_id: ctx.uid ?? null,
      method: ctx.method ?? null,
      status,
      verified: status !== 'failed',
      verified_at: now,
      updated_at: now,
    },
    { merge: true },
  );

  if (status === 'paid') {
    // Update the booking status ONLY after a verified, captured payment.
    await firestore.collection('bookings').doc(ctx.bookingId).set(
      {
        payment_status: 'Paid',
        payment_method: ctx.method ? `Razorpay (${ctx.method})` : 'Razorpay',
        razorpay_order_id: ctx.orderId,
        razorpay_payment_id: ctx.paymentId,
        status: 'On Going',
        payment_updated_at: now,
      },
      { merge: true },
    );
  }
  return status;
}

/** Fetches the authoritative payment status + method from Razorpay. */
async function fetchRazorpayPayment(
  paymentId: string,
): Promise<{ method: string | null; status: string }> {
  try {
    const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: { Authorization: razorpayAuthHeader() },
    });
    if (res.ok) {
      const payment = (await res.json()) as { method?: string; status?: string };
      return { method: payment.method ?? null, status: String(payment.status ?? '') };
    }
  } catch (err) {
    logger.warn('Could not fetch Razorpay payment details', err);
  }
  return { method: null, status: '' };
}

/**
 * Verifies the Razorpay checkout signature (HMAC-SHA256 of `order_id|payment_id`
 * with the Key Secret) and records the payment result. The `payments` write and
 * the booking update happen here because clients are not allowed to write either
 * by Firestore rules. A booking is marked paid ONLY when the signature is valid
 * AND Razorpay confirms the payment is captured — never on the frontend response
 * alone. Reconciliation is also handled by `razorpayWebhook`.
 */
export const verifyRazorpayPayment = onRequest(async (req, res) => {
  setRazorpayCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const user = await verifyFirebaseIdToken(req);
  if (!user) {
    res.status(401).json({ error: 'You must be signed in.' });
    return;
  }

  if (!razorpayKeyId || !razorpayKeySecret) {
    res.status(500).json({ error: 'Payments are not configured yet.' });
    return;
  }

  const uid = user.uid;
  const body = req.body as { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string; bookingId?: string } ?? {};
  const orderId = String(body.razorpay_order_id ?? '');
  const paymentId = String(body.razorpay_payment_id ?? '');
  const signature = String(body.razorpay_signature ?? '');
  const bookingId = String(body.bookingId ?? '');
  if (!orderId || !paymentId || !signature || !bookingId) {
    res.status(400).json({ error: 'Missing Razorpay payment details.' });
    return;
  }

  // Idempotency: if a webhook (or a prior call) already reconciled this order,
  // return the existing state instead of re-processing.
  const existingSnap = await firestore.collection('payments').doc(orderId).get();
  if (existingSnap.exists) {
    const existing = existingSnap.data() ?? {};
    const existingStatus = String(existing.status ?? '');
    if (existingStatus === 'paid') {
      res.status(200).json({ ok: true, status: 'paid', orderId, paymentId });
      return;
    }
    if (existingStatus === 'pending') {
      res.status(200).json({ ok: false, status: 'pending', orderId, paymentId });
      return;
    }
  }

  const signatureValid = verifyPaymentSignature(orderId, paymentId, signature, razorpayKeySecret);

  if (!signatureValid) {
    const now = isoNow();
    await firestore.collection('payments').doc(orderId).set(
      {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        booking_id: bookingId,
        user_id: uid,
        method: null,
        status: 'failed',
        verified: false,
        verified_at: now,
        updated_at: now,
      },
      { merge: true },
    );
    logger.warn(`Razorpay signature mismatch for order ${orderId} (payment ${paymentId})`);
    res.status(200).json({ ok: false, status: 'failed', orderId, paymentId });
    return;
  }

  const { method, status: razorpayStatus } = await fetchRazorpayPayment(paymentId);
  const finalStatus = await finalizePayment({
    orderId,
    paymentId,
    bookingId,
    uid,
    method,
    razorpayStatus,
  });
  if (finalStatus === 'paid') {
    logger.info(`Razorpay payment ${paymentId} verified for booking ${bookingId}`);
  } else if (finalStatus === 'pending') {
    logger.info(`Razorpay payment ${paymentId} authorized (pending capture) for booking ${bookingId}`);
  }
  res.status(200).json({ ok: finalStatus === 'paid', status: finalStatus, orderId, paymentId });
});

/* ------------- Razorpay webhook (server-side reconciliation) ------------- */
/* Razorpay sends `payment.captured` / `payment.authorized` events here. This is
   the authoritative path for marking a booking paid: it fires even if the user
   closes the browser before the client `handler` runs. The webhook signature is
   verified with RAZORPAY_WEBHOOK_SECRET (set in the Razorpay dashboard). */

interface RazorpayEvent {
  event?: string;
  payload?: {
    payment?: {
      entity?: { id?: string; order_id?: string; status?: string; method?: string };
    };
  };
}

/** Reconciles a payment from a webhook event using the order's stored booking. */
async function reconcileRazorpayPayment(
  orderId: string,
  paymentId: string,
  razorpayStatus: string,
  method: string | null,
): Promise<void> {
  const paySnap = await firestore.collection('payments').doc(orderId).get();
  if (!paySnap.exists) {
    logger.warn(`Webhook: payments/${orderId} not found — ignoring.`);
    return;
  }
  const payDoc = paySnap.data() ?? {};
  if (String(payDoc.status ?? '') === 'paid') return; // already reconciled
  const bookingId = String(payDoc.booking_id ?? '');
  const uid = payDoc.user_id ? String(payDoc.user_id) : null;
  if (!bookingId) return;
  const finalStatus = await finalizePayment({ orderId, paymentId, bookingId, uid, method, razorpayStatus });
  logger.info(`Webhook reconciled payment ${paymentId} (order ${orderId}) → ${finalStatus}`);
}

export const razorpayWebhook = onRequest(async (req, res) => {
  if (!razorpayWebhookSecret) {
    logger.error('RAZORPAY_WEBHOOK_SECRET not configured — webhook rejected.');
    res.status(200).send('ok');
    return;
  }
  const signature = String(req.headers['x-razorpay-signature'] ?? '');
  const rawBody = req.rawBody ?? Buffer.from('');
  if (!verifyWebhookSignature(rawBody, signature, razorpayWebhookSecret)) {
    logger.warn('Razorpay webhook signature mismatch.');
    res.status(400).send('invalid signature');
    return;
  }

  const event = req.body as RazorpayEvent;
  if (event.event === 'payment.captured' || event.event === 'payment.authorized') {
    const entity = event.payload?.payment?.entity;
    if (entity?.id && entity?.order_id) {
      try {
        await reconcileRazorpayPayment(
          entity.order_id,
          entity.id,
          String(entity.status ?? ''),
          entity.method ? String(entity.method) : null,
        );
      } catch (err) {
        logger.error('Razorpay webhook reconcile failed', err);
      }
    }
  }
  res.status(200).send('ok');
});

/** Tracks a login event via trusted backend (called after client sign-in). */
export const recordLogin = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const uid = request.auth.uid;
  const email = request.auth.token.email || '';
  await firestore.collection('activity_log').add({
    user_id: uid,
    email,
    event: 'login',
    timestamp: isoNow(),
    ip: (request.rawRequest?.ip) || null,
  });
  await firestore.collection('users').doc(uid).set({ last_login: isoNow() }, { merge: true });
  return { ok: true };
});

/** Tracks a logout event via trusted backend. */
export const recordLogout = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const uid = request.auth.uid;
  await firestore.collection('activity_log').add({
    user_id: uid,
    event: 'logout',
    timestamp: isoNow(),
  });
  return { ok: true };
});