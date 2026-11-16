/**
 * Pure, framework-free PIN verification logic for LifeCare bookings.
 *
 * Kept separate from the Cloud Functions entry point so the security policy
 * (generation, hashing, attempt limiting, expiry, reuse prevention) can be
 * unit-tested without Firebase.
 *
 * Security notes:
 *  - The 4-digit PIN is generated server-side with a CSPRNG.
 *  - For verification the submitted PIN is hashed with a server-side pepper
 *    (SHA-256) and compared in constant time. The plaintext PIN is stored on
 *    the `booking_pins` doc only so the *booking owner* can read & share it;
 *    Firestore rules deny drivers any read access — they verify via the
 *    `verifyBookingPin` callable, never by reading the value.
 *  - Brute force is bounded by `MAX_ATTEMPTS`; once exceeded the PIN is
 *    locked. The PIN also expires after `PIN_TTL_MS`.
 */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

/** Server-side pepper. Read from env so it is never bundled into the client. */
const PIN_PEPPER = process.env.PIN_PEPPER ?? 'lifecare-pin-pepper-v1';

export const PIN_LENGTH = 4;
export const MAX_ATTEMPTS = 5;
/** 24 hours — a PIN is only valid for pickup verification on the booking day. */
export const PIN_TTL_MS = 24 * 60 * 60 * 1000;

export const PIN_CONFIG = {
  length: PIN_LENGTH,
  maxAttempts: MAX_ATTEMPTS,
  ttlMs: PIN_TTL_MS,
} as const;

export type PinStatus = 'active' | 'verified' | 'expired' | 'locked';

/** Generates a zero-padded 4-digit PIN (0000–9999) using a CSPRNG. */
export function generatePin(): string {
  return randomInt(0, 10_000).toString().padStart(PIN_LENGTH, '0');
}

/** Peppered SHA-256 hash of a PIN — what gets stored for verification. */
export function hashPin(pin: string): string {
  return createHash('sha256').update(`${pin}:${PIN_PEPPER}`).digest('hex');
}

/** Constant-time comparison of a submitted PIN against the stored hash. */
export function verifyPinHash(submitted: string, storedHash: string): boolean {
  const a = Buffer.from(hashPin(submitted), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** ISO timestamp `PIN_TTL_MS` from now — the expiry written when a PIN is created. */
export function computeExpiry(from: Date = new Date()): string {
  return new Date(from.getTime() + PIN_TTL_MS).toISOString();
}

/** True when the expiry timestamp has passed. */
export function isExpired(expiresAt: string, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

/**
 * The subset of a `booking_pins` document that drives the verification policy.
 * The callable function loads the doc, builds this record, and applies the
 * returned outcome to Firestore.
 */
export interface PinRecord {
  pinHash: string;
  status: PinStatus;
  attempts: number;
  maxAttempts: number;
  expiresAt: string;
  verified: boolean;
}

export type VerifyOutcome =
  | { ok: true; status: 'verified'; verifiedAt: string }
  | {
      ok: false;
      reason: 'already-verified' | 'expired' | 'locked' | 'incorrect';
      /** Attempts remaining after this failed attempt (0 once locked). */
      attemptsRemaining: number;
      /** The attempt count to persist after this attempt. */
      nextAttempts: number;
      /** Whether the PIN should now be marked locked/expired. */
      nextStatus: PinStatus;
    };

/**
 * Evaluates a single verification attempt against the policy — the heart of
 * the security rules:
 *  - A verified PIN can never be re-used (reuse prevention).
 *  - An expired or already-locked PIN is rejected.
 *  - Exceeding `maxAttempts` locks the PIN (unlimited-guessing prevention).
 *  - A correct PIN yields success; a wrong one increments attempts and may
 *    lock the PIN if the limit is reached.
 */
export function evaluatePinAttempt(
  record: PinRecord,
  submittedPin: string,
  now: Date = new Date(),
): VerifyOutcome {
  const max = record.maxAttempts || MAX_ATTEMPTS;

  // 1) Reuse prevention — a PIN that has already verified cannot verify again.
  if (record.verified || record.status === 'verified') {
    return failed('already-verified', record.attempts, record.status);
  }

  // 2) Already locked from a previous attempt burst.
  if (record.status === 'locked') {
    return failed('locked', record.attempts, 'locked');
  }

  // 3) Expired — either explicitly or by timestamp.
  if (record.status === 'expired' || isExpired(record.expiresAt, now)) {
    return failed('expired', record.attempts, 'expired');
  }

  // 4) Attempt ceiling already reached (defensive — should also be 'locked').
  if (record.attempts >= max) {
    return failed('locked', record.attempts, 'locked');
  }

  // 5) Correct PIN -> success.
  if (verifyPinHash(submittedPin, record.pinHash)) {
    return { ok: true, status: 'verified', verifiedAt: now.toISOString() };
  }

  // 6) Incorrect PIN -> increment attempts; lock if the limit is now reached.
  const nextAttempts = record.attempts + 1;
  const locked = nextAttempts >= max;
  return {
    ok: false,
    reason: locked ? 'locked' : 'incorrect',
    attemptsRemaining: Math.max(0, max - nextAttempts),
    nextAttempts,
    nextStatus: locked ? 'locked' : 'active',
  };
}

function failed(
  reason: 'already-verified' | 'expired' | 'locked',
  attempts: number,
  nextStatus: PinStatus,
): VerifyOutcome {
  return {
    ok: false,
    reason,
    attemptsRemaining: 0,
    nextAttempts: attempts,
    nextStatus,
  };
}
