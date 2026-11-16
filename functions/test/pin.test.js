/**
 * Unit tests for the booking PIN core logic (functions/src/pin.ts).
 *
 * Run after building the functions:
 *   npm --prefix functions run build
 *   node --test functions/test/pin.test.js
 *
 * These cover the full security policy with no Firebase dependency:
 * generation, hashing/verification, attempt limiting, expiry, reuse
 * prevention and locking.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const {
  generatePin,
  hashPin,
  verifyPinHash,
  computeExpiry,
  isExpired,
  evaluatePinAttempt,
  MAX_ATTEMPTS,
  PIN_LENGTH,
} = require('../lib/pin.js');

/** Builds an active (unverified, unexpired) PinRecord for a known PIN. */
function activeRecord(pin, overrides = {}) {
  return {
    pinHash: hashPin(pin),
    status: 'active',
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    expiresAt: computeExpiry(),
    verified: false,
    ...overrides,
  };
}

test('generatePin returns a zero-padded 4-digit string', () => {
  for (let i = 0; i < 500; i++) {
    const p = generatePin();
    assert.ok(/^\d{4}$/.test(p), `PIN not 4 digits: ${p}`);
    assert.equal(p.length, PIN_LENGTH);
    const n = Number(p);
    assert.ok(n >= 0 && n <= 9999, `PIN out of range: ${p}`);
  }
});

test('generatePin produces a varied set (not a constant)', () => {
  const set = new Set();
  for (let i = 0; i < 1000; i++) set.add(generatePin());
  assert.ok(set.size > 500, `Expected variety, got ${set.size} unique values`);
});

test('hashPin + verifyPinHash round-trip', () => {
  const pin = '0427';
  const h = hashPin(pin);
  assert.equal(h.length, 64);
  assert.ok(/^[0-9a-f]{64}$/.test(h), 'hash should be a 64-char hex string');
  assert.equal(verifyPinHash(pin, h), true, 'matching PIN should verify');
  assert.equal(verifyPinHash('0428', h), false, 'wrong PIN should not verify');
  assert.equal(verifyPinHash('', h), false, 'empty PIN should not verify');
});

test('computeExpiry / isExpired', () => {
  const future = computeExpiry();
  assert.ok(new Date(future).getTime() > Date.now(), 'expiry should be in the future');
  assert.equal(isExpired(future), false);
  const past = new Date(Date.now() - 1000).toISOString();
  assert.equal(isExpired(past), true);
});

test('correct PIN verifies successfully', () => {
  const rec = activeRecord('1234');
  const out = evaluatePinAttempt(rec, '1234');
  assert.equal(out.ok, true);
  assert.equal(out.status, 'verified');
  assert.ok(out.verifiedAt, 'verifiedAt should be set');
});

test('incorrect PIN increments attempts and stays active', () => {
  const rec = activeRecord('1234');
  const out = evaluatePinAttempt(rec, '9999');
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'incorrect');
  assert.equal(out.nextAttempts, 1);
  assert.equal(out.attemptsRemaining, MAX_ATTEMPTS - 1);
  assert.equal(out.nextStatus, 'active');
});

test('locks after the maximum number of wrong attempts', () => {
  const rec = activeRecord('1234', { attempts: MAX_ATTEMPTS - 1 });
  const out = evaluatePinAttempt(rec, '0000');
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'locked');
  assert.equal(out.nextAttempts, MAX_ATTEMPTS);
  assert.equal(out.attemptsRemaining, 0);
  assert.equal(out.nextStatus, 'locked');
});

test('a correct PIN on the last allowed attempt still verifies', () => {
  const rec = activeRecord('1234', { attempts: MAX_ATTEMPTS - 1 });
  const out = evaluatePinAttempt(rec, '1234');
  assert.equal(out.ok, true);
  assert.equal(out.status, 'verified');
});

test('reuse is prevented once a PIN is verified', () => {
  const rec = activeRecord('1234', { verified: true, status: 'verified' });
  const out = evaluatePinAttempt(rec, '1234');
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'already-verified');
});

test('expired by timestamp is rejected even with the correct PIN', () => {
  const rec = activeRecord('1234', {
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  });
  const out = evaluatePinAttempt(rec, '1234');
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'expired');
});

test('expired status is rejected', () => {
  const rec = activeRecord('1234', { status: 'expired' });
  const out = evaluatePinAttempt(rec, '1234');
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'expired');
});

test('locked status is rejected', () => {
  const rec = activeRecord('1234', { status: 'locked', attempts: MAX_ATTEMPTS });
  const out = evaluatePinAttempt(rec, '1234');
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'locked');
});

test('attempt ceiling already reached is treated as locked', () => {
  const rec = activeRecord('1234', { attempts: MAX_ATTEMPTS });
  const out = evaluatePinAttempt(rec, '1234');
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'locked');
});
