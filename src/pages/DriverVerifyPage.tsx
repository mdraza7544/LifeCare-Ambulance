import { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Ambulance, ArrowLeft, Loader2, Lock, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useApp } from '@/lib/context';
import { useAuth } from '@/lib/auth';
import { PageHeader, EmptyState } from '@/components/UI';
import StatusBadge from '@/components/StatusBadge';
import { fetchDriverBookings, verifyBookingPin } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';
import type { Booking } from '@/lib/types';

interface VerifyResult {
  type: 'success' | 'error';
  message: string;
  attemptsRemaining?: number;
}

/** Pulls the structured `reason` / `attemptsRemaining` out of a callable error. */
function extractError(err: unknown): VerifyResult {
  const e = err as Record<string, unknown> | null;
  const details = (e?.details ??
    (e?.customData as Record<string, unknown> | undefined)?.details) as
    Record<string, unknown> | undefined;
  const reason = typeof details?.reason === 'string' ? details.reason : undefined;
  const attemptsRemaining =
    typeof details?.attemptsRemaining === 'number' ? details.attemptsRemaining : undefined;
  const fallback: Record<string, string> = {
    'already-verified': 'This booking has already been verified.',
    expired: 'This verification PIN has expired.',
    locked: 'Too many incorrect attempts. The PIN is now locked.',
    incorrect: 'Incorrect PIN.',
  };
  const message = reason
    ? fallback[reason] ?? (typeof e?.message === 'string' ? e.message : 'Verification failed.')
    : typeof e?.message === 'string'
      ? e.message
      : 'Verification failed. Please try again.';
  return { type: 'error', message, attemptsRemaining };
}

export default function DriverVerifyPage() {
  const { navigate } = useApp();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [digits, setDigits] = useState(['', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setBookings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchDriverBookings(user.id).then((rows) => {
      if (active) {
        setBookings(rows);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [user]);

  const loadBookings = async () => {
    if (!user) return;
    setLoading(true);
    const rows = await fetchDriverBookings(user.id);
    setBookings(rows);
    setLoading(false);
  };

  const selected = bookings.find((b) => b.id === selectedId) ?? null;

  const resetDigits = () => {
    setDigits(['', '', '', '']);
    setResult(null);
    inputRefs.current[0]?.focus();
  };

  const handleDigit = (idx: number, value: string) => {
    const v = value.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[idx] = v;
      return next;
    });
    setResult(null);
    if (v && idx < 3) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4).split('');
    if (!pasted.length) return;
    e.preventDefault();
    const next = ['', '', '', ''];
    pasted.forEach((c, i) => {
      next[i] = c;
    });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 3)]?.focus();
  };

  const pin = digits.join('');
  const canVerify = pin.length === 4 && !verifying && !!selected && selected.status !== 'Verified';

  const handleVerify = async () => {
    if (!selected || pin.length !== 4) return;
    setVerifying(true);
    setResult(null);
    try {
      const res = await verifyBookingPin(selected.id, pin);
      setResult({ type: 'success', message: res.message || 'Patient pickup verified successfully.' });
      setDigits(['', '', '', '']);
      await loadBookings();
    } catch (err) {
      setResult(extractError(err));
      setDigits(['', '', '', '']);
      inputRefs.current[0]?.focus();
      await loadBookings();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      <button onClick={() => navigate('/dashboard')} className="btn-ghost mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>
      <PageHeader
        title="Pickup Verification"
        subtitle="Enter the patient's 4-digit PIN to confirm pickup"
        icon={<ShieldCheck className="w-5 h-5" />}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<Ambulance className="w-8 h-8" />}
          title="No assigned bookings"
          message="When an admin assigns a booking to you, it will appear here for PIN verification."
        />
      ) : (
        <div className="grid md:grid-cols-5 gap-6">
          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Assigned to you</p>
              <button
                onClick={loadBookings}
                className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            {bookings.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setSelectedId(b.id);
                  resetDigits();
                }}
                className={`w-full text-left card p-4 transition-all ${
                  selectedId === b.id ? 'border-2 border-brand-500' : 'hover:border-brand-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-sm text-gray-900">{b.bookingCode}</p>
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-xs text-gray-500 mt-1 truncate">{b.pickup} → {b.destination}</p>
                <p className="text-xs text-gray-400 mt-0.5">{b.patientName}</p>
              </button>
            ))}
          </div>

          <div className="md:col-span-3">
            {!selected ? (
              <div className="card p-10 text-center text-gray-500 text-sm">
                Select a booking to verify pickup.
              </div>
            ) : (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-bold text-gray-900">{selected.bookingCode}</p>
                    <p className="text-xs text-gray-500">{formatDateTime(selected.scheduledFor)}</p>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-5">
                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">Patient</p>
                    <p className="font-semibold text-gray-900">{selected.patientName}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="font-semibold text-gray-900">{selected.phone}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">Pickup</p>
                    <p className="font-semibold text-gray-900">{selected.pickup}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">Destination</p>
                    <p className="font-semibold text-gray-900">{selected.destination}</p>
                  </div>
                </div>

                {selected.status === 'Verified' ? (
                  <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3 text-green-700">
                    <CheckCircle2 className="w-6 h-6" />
                    <div>
                      <p className="font-bold text-sm">Patient pickup verified</p>
                      <p className="text-xs">
                        This booking has already been confirmed.
                        {selected.verifiedAt ? ` Verified ${formatDateTime(selected.verifiedAt)}.` : ''}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-gray-700 mb-3">
                      Enter the 4-digit PIN shared by the patient
                    </p>
                    <div className="flex gap-2 justify-center mb-2" onPaste={handlePaste}>
                      {digits.map((d, i) => (
                        <input
                          key={i}
                          ref={(el) => {
                            inputRefs.current[i] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={d}
                          autoFocus={i === 0}
                          onChange={(e) => handleDigit(i, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(i, e)}
                          className="w-14 h-16 text-center text-2xl font-extrabold text-gray-900 border-2 border-gray-200 rounded-xl focus:border-brand-500 focus:outline-none transition-colors"
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 text-center mb-4 flex items-center justify-center gap-1">
                      <Lock className="w-3 h-3" /> Verified securely on the server. Incorrect attempts are limited.
                    </p>

                    {result && (
                      <div
                        className={`p-3 rounded-lg mb-4 text-sm flex items-start gap-2 ${
                          result.type === 'success'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {result.type === 'success' ? (
                          <CheckCircle2 className="w-5 h-5 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 shrink-0" />
                        )}
                        <div>
                          <p className="font-semibold">{result.message}</p>
                          {typeof result.attemptsRemaining === 'number' &&
                            result.attemptsRemaining > 0 && (
                              <p className="text-xs mt-0.5">
                                {result.attemptsRemaining} attempt
                                {result.attemptsRemaining === 1 ? '' : 's'} remaining.
                              </p>
                            )}
                        </div>
                      </div>
                    )}

                    <button onClick={handleVerify} disabled={!canVerify} className="btn-primary w-full">
                      {verifying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" /> Verify & Confirm Pickup
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
