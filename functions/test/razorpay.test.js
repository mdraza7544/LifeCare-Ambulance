/**
 * Unit tests for Razorpay signature verification (functions/src/razorpay.ts).
 *
 * Uses DUMMY secrets only — the real Key Secret / Webhook Secret never appear
 * here. Run after building the functions:
 *   npm --prefix functions run build
 *   node --test functions/test/razorpay.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert');
const {
  computePaymentSignature,
  verifyPaymentSignature,
  verifyWebhookSignature,
  safeEqualHex,
} = require('../lib/razorpay.js');

const KEY_SECRET = 'dummy-key-secret';
const WEBHOOK_SECRET = 'dummy-webhook-secret';

test('verifyPaymentSignature accepts a correctly computed signature', () => {
  const orderId = 'order_NqQwLxJ3mXYZ';
  const paymentId = 'pay_NqQxAbC12345';
  const sig = computePaymentSignature(orderId, paymentId, KEY_SECRET);
  assert.equal(verifyPaymentSignature(orderId, paymentId, sig, KEY_SECRET), true);
});

test('verifyPaymentSignature rejects a tampered payment id', () => {
  const orderId = 'order_abc';
  const sig = computePaymentSignature(orderId, 'pay_one', KEY_SECRET);
  assert.equal(verifyPaymentSignature(orderId, 'pay_two', sig, KEY_SECRET), false);
});

test('verifyPaymentSignature rejects a tampered order id', () => {
  const sig = computePaymentSignature('order_one', 'pay_x', KEY_SECRET);
  assert.equal(verifyPaymentSignature('order_two', 'pay_x', sig, KEY_SECRET), false);
});

test('verifyPaymentSignature rejects a wrong secret', () => {
  const sig = computePaymentSignature('order_a', 'pay_a', KEY_SECRET);
  assert.equal(verifyPaymentSignature('order_a', 'pay_a', sig, 'different-secret'), false);
});

test('verifyPaymentSignature rejects a garbage / wrong-length signature', () => {
  assert.equal(verifyPaymentSignature('order_a', 'pay_a', 'not-a-real-signature', KEY_SECRET), false);
  assert.equal(verifyPaymentSignature('order_a', 'pay_a', '', KEY_SECRET), false);
});

test('verifyWebhookSignature accepts the correct HMAC of the raw body', () => {
  const raw = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
  const sig = computeWebhookSig(raw, WEBHOOK_SECRET);
  assert.equal(verifyWebhookSignature(raw, sig, WEBHOOK_SECRET), true);
});

test('verifyWebhookSignature rejects a modified body', () => {
  const raw = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
  const sig = computeWebhookSig(raw, WEBHOOK_SECRET);
  const tampered = Buffer.from(JSON.stringify({ event: 'payment.failed' }));
  assert.equal(verifyWebhookSignature(tampered, sig, WEBHOOK_SECRET), false);
});

test('verifyWebhookSignature rejects a wrong webhook secret', () => {
  const raw = Buffer.from('payload');
  const sig = computeWebhookSig(raw, WEBHOOK_SECRET);
  assert.equal(verifyWebhookSignature(raw, sig, 'other-secret'), false);
});

test('safeEqualHex is false for different-length hex strings', () => {
  assert.equal(safeEqualHex('abcd', 'abcdef'), false);
});

function computeWebhookSig(rawBody, secret) {
  const { createHmac } = require('node:crypto');
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}
