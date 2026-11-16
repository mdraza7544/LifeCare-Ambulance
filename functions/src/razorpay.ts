/**
 * Pure Razorpay signature verification helpers.
 *
 * Extracted from the Cloud Functions entry point so the cryptographic
 * verification (the trust anchor for marking a booking paid) can be
 * unit-tested with dummy secrets — no network, no real credentials.
 *
 * The Key Secret / Webhook Secret themselves live only in the Cloud Functions
 * runtime (functions/.env) and are NEVER imported here. Callers pass the
 * secret in at runtime.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** HMAC-SHA256 of `order_id|payment_id` with the Key Secret — Razorpay's
 *  checkout signature scheme. */
export function computePaymentSignature(
  orderId: string,
  paymentId: string,
  keySecret: string,
): string {
  return createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
}

/** Constant-time comparison of two hex digests (length-safe). */
export function safeEqualHex(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/** Verifies a Razorpay Checkout payment signature (`order_id|payment_id`). */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  return safeEqualHex(computePaymentSignature(orderId, paymentId, keySecret), signature);
}

/**
 * Verifies a Razorpay webhook signature — HMAC-SHA256 of the RAW request body
 * with the Webhook Secret, compared against the `X-Razorpay-Signature` header.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string,
  webhookSecret: string,
): boolean {
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
}
