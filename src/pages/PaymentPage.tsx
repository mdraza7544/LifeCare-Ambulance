import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useBooking, recordConfirmedPayment, createNotification, type Booking } from '@/lib/firestoreService';
import { useApp } from '@/lib/context';
import { verifyRazorpayPayment, type RazorpayHandlerResponse } from '@/lib/razorpay';
import { openCheckout, type PaymentMode } from '@/lib/payment';
import { processQueue } from '@/lib/dispatchService';
import { sendSafetyEmail } from '@/lib/email';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/UI';
import StatusBadge from '@/components/StatusBadge';
import DemoCheckoutModal from '@/components/DemoCheckoutModal';
import { CreditCard, Calendar, Ambulance, Loader2, XCircle, CheckCircle2, Sparkles, ShieldCheck } from 'lucide-react';

function getBookingId(): string | null {
  const hash = window.location.hash || '';
  const match = hash.match(/[?&]id=([^&]+)/);
  return match?.[1] ?? null;
}

export default function PaymentPage() {
  const { user } = useAuth();
  const { navigate } = useApp();
  const bookingId = getBookingId();
  const { data: booking, loading, error } = useBooking(bookingId);

  const [payError, setPayError] = useState<string | null>(null);
  const [payPending, setPayPending] = useState<string | null>(null);
  const [submittingMode, setSubmittingMode] = useState<PaymentMode | null>(null);

  useEffect(() => {
    if (payError || payPending) {
      const t = setTimeout(() => {
        setPayError(null);
        setPayPending(null);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [payError, payPending]);

  const isPayable =
    booking != null && booking.status === 'accepted' && booking.paymentStatus !== 'paid';
  const isConfirmed = booking?.status === 'confirmed';

  const dispatchConfirmationAlerts = async (targetBooking: Booking) => {
    // 1. In-app notification
    try {
      await createNotification({
        id: `${targetBooking.id}_payment`,
        userId: targetBooking.userId,
        title: 'Payment successful - booking confirmed',
        message: `Payment of ${formatCurrency(targetBooking.amount ?? 0)} received for booking ${targetBooking.bookingCode || targetBooking.id}. Your ambulance booking is confirmed.`,
        type: 'payment',
        bookingId: targetBooking.id,
      });
    } catch (nErr) {
      console.warn('[PaymentPage] In-app notification warning:', nErr);
    }

    // 2. Trigger confirmation email if EmailJS is configured
    try {
      if (user?.email) {
        await sendSafetyEmail({
          to_email: user.email,
          to_name: targetBooking.patientName || user.user_metadata?.full_name || 'Valued Patient',
          subject: `Booking Confirmed - ${targetBooking.bookingCode || targetBooking.id}`,
          message: `Your LifeCare ambulance booking ${targetBooking.bookingCode || targetBooking.id} has been paid and confirmed.\nPickup: ${targetBooking.pickup}\nDestination: ${targetBooking.destination}\nScheduled: ${targetBooking.scheduledTime}\nAmount: ${formatCurrency(targetBooking.amount ?? 0)}`,
        });
      }
    } catch (eErr) {
      console.warn('[PaymentPage] Email dispatch warning:', eErr);
    }
  };

  // Unified payment success handler (used for both Demo and Razorpay modes)
  const handlePaymentSuccess = async (
    response: RazorpayHandlerResponse,
    methodUsed: string = 'Demo Online Payment',
    mode: PaymentMode = 'demo',
  ) => {
    if (!booking) return;

    if (mode === 'razorpay') {
      try {
        const result = await verifyRazorpayPayment({ ...response, bookingId: booking.id });
        if (result.status === 'paid') {
          await recordConfirmedPayment({
            paymentId: response.razorpay_payment_id,
            bookingId: booking.id,
            userId: booking.userId,
            amount: Number(booking.amount ?? 0),
            method: methodUsed || 'Razorpay',
            status: 'paid',
            mode: 'razorpay',
          });
          // Process queue to auto-allocate ambulance and driver
          processQueue().catch((qErr) => console.warn('[PaymentPage] processQueue warning:', qErr));
          await dispatchConfirmationAlerts(booking);
          setSubmittingMode(null);
          navigate(`/payment-confirmation?id=${booking.id}`);
        } else if (result.status === 'pending') {
          setPayPending('Payment authorized — awaiting confirmation. Your booking will update shortly.');
          setSubmittingMode(null);
        } else {
          setPayError('Payment verification failed. Please contact support.');
          setSubmittingMode(null);
        }
      } catch (err) {
        setPayError(err instanceof Error ? err.message : 'Payment verification failed.');
        setSubmittingMode(null);
      }
    } else {
      // Demo mode: skip server-side signature verification (Cloud Function)
      try {
        await recordConfirmedPayment({
          paymentId: response.razorpay_payment_id,
          bookingId: booking.id,
          userId: booking.userId,
          amount: Number(booking.amount ?? 0),
          method: methodUsed || 'Demo Online Payment',
          status: 'paid',
          mode: 'demo',
        });
        // Process queue to auto-allocate ambulance and driver
        processQueue().catch((qErr) => console.warn('[PaymentPage] processQueue warning:', qErr));
        await dispatchConfirmationAlerts(booking);
        setSubmittingMode(null);
        navigate(`/payment-confirmation?id=${booking.id}`);
      } catch (err) {
        setPayError(err instanceof Error ? err.message : 'Payment recording failed.');
        setSubmittingMode(null);
      }
    }
  };

  const handleDismiss = () => {
    setPayError('Payment cancelled. Your booking is saved but not confirmed — choose a payment option to try again.');
    setSubmittingMode(null);
  };

  const handlePay = async (targetMode: PaymentMode) => {
    if (!booking || !isPayable) {
      setPayError('This booking is not ready for payment. Please check your booking status.');
      return;
    }
    if (!user) {
      setPayError('You must be signed in to pay. Please sign in and try again.');
      return;
    }
    setSubmittingMode(targetMode);
    setPayError(null);
    setPayPending(null);

    try {
      const opened = await openCheckout({
        bookingId: booking.id,
        bookingCode: booking.bookingCode ?? '—',
        amount: Number(booking.amount ?? 0),
        patientName: booking.patientName ?? booking.pickup,
        phone: booking.phone ?? '',
        email: user.email || '',
        method: 'Card',
        mode: targetMode,
        onSuccess: (resp, methodUsed) => handlePaymentSuccess(resp, methodUsed, targetMode),
        onDismiss: handleDismiss,
        onFailure: (err) => {
          setPayError(err.message || 'Payment failed. Please try again.');
          setSubmittingMode(null);
        },
      });

      if (!opened) {
        setPayError('Could not open the payment window. Please try again.');
        setSubmittingMode(null);
      }
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      setSubmittingMode(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      <PageHeader
        title="Complete Payment"
        subtitle="Pay for your ambulance booking to confirm it."
        icon={<CreditCard className="w-5 h-5" />}
      />

      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-gray-500 mt-3">Loading your booking…</p>
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-12">
          <p className="text-red-600">{error.message}</p>
          <button onClick={() => navigate('/bookings')} className="btn-primary mt-4 text-sm">
            Back to My Bookings
          </button>
        </div>
      )}

      {!loading && !error && !booking && (
        <div className="text-center py-12">
          <p className="text-gray-500">Booking not found. Please return to My Bookings and try again.</p>
          <button onClick={() => navigate('/bookings')} className="btn-primary mt-4 text-sm">
            Back to My Bookings
          </button>
        </div>
      )}

      {!loading && !error && booking && !isPayable && (
        <div className="text-center py-12">
          {isConfirmed ? (
            <>
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <p className="text-gray-700 font-semibold mb-1">This booking is already confirmed.</p>
              <p className="text-sm text-gray-500 mb-5">Payment has been completed for {booking.bookingCode ?? 'this booking'}.</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-7 h-7 text-amber-600" />
              </div>
              <p className="text-gray-700 font-semibold mb-1">Payment isn't available for this booking yet.</p>
              <p className="text-sm text-gray-500 mb-5">
                Status: <span className="font-semibold capitalize">{booking.status}</span>. Payment can be made once your booking is accepted.
              </p>
            </>
          )}
          <button onClick={() => navigate(`/booking-details?id=${booking.id}`)} className="btn-primary text-sm">
            View Booking Details
          </button>
        </div>
      )}

      {!loading && !error && booking && isPayable && (
        <div className="card p-6 mt-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={booking.status} />
              <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
                Accepted — please complete payment
              </span>
            </div>
            <div className="text-sm text-gray-500">{booking.bookingCode ?? 'No code'}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Pickup</p>
                <p className="font-semibold text-gray-900">{booking.pickup}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Destination</p>
                <p className="font-semibold text-gray-900">{booking.destination}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Priority</p>
                <p className="font-semibold text-gray-900">
                  {booking.priority.charAt(0).toUpperCase() + booking.priority.slice(1)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Scheduled</p>
                <p className="font-semibold text-gray-900">{formatDateTime(booking.scheduledTime)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Amount</p>
                <p className="font-semibold text-brand-600">{formatCurrency(booking.amount ?? 0)}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Booking Status</p>
                <p className="font-semibold text-gray-900 capitalize">{booking.status}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Payment Status</p>
                <p className="font-semibold text-gray-900 capitalize">{booking.paymentStatus}</p>
              </div>
              {booking.patientName && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Patient</p>
                  <p className="font-semibold text-gray-900">{booking.patientName}</p>
                </div>
              )}
              {booking.ambulanceType && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Ambulance className="w-4 h-4" />
                  <span>Ambulance: {booking.ambulanceType}</span>
                </div>
              )}
            </div>
          </div>

          {payError && (
            <p className="mt-6 text-sm text-red-600 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
              <XCircle className="w-4 h-4 shrink-0" /> {payError}
            </p>
          )}
          {payPending && (
            <p className="mt-6 text-sm text-amber-600 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Calendar className="w-4 h-4 shrink-0" /> {payPending}
            </p>
          )}

          <div className="mt-8 border-t border-gray-100 pt-6">
            <h3 className="text-sm font-semibold text-gray-800 text-center mb-4">
              Choose Payment Option
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Demo Mode Card */}
              <div className="border-2 border-amber-300/80 bg-gradient-to-b from-amber-50/60 to-white rounded-2xl p-5 flex flex-col justify-between hover:border-amber-400 transition-all shadow-sm">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      Demo / Presentation
                    </span>
                    <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                      Zero Charge
                    </span>
                  </div>
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">
                    Demo Simulated Payment
                  </h4>
                  <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                    Razorpay replica checkout with test cards and UPI. Instant confirmation without real bank deduction — ideal for client presentation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePay('demo')}
                  disabled={submittingMode !== null}
                  className="w-full py-2.5 px-4 rounded-xl font-medium text-sm text-amber-950 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submittingMode === 'demo' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing Demo…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Pay with Demo ({formatCurrency(booking.amount ?? 0)})
                    </>
                  )}
                </button>
              </div>

              {/* Real Razorpay Card */}
              <div className="border border-gray-200 bg-gradient-to-b from-slate-50/60 to-white rounded-2xl p-5 flex flex-col justify-between hover:border-brand-500 transition-all shadow-sm">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                      Live Gateway
                    </span>
                    <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      Real Payment
                    </span>
                  </div>
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">
                    Razorpay Official Gateway
                  </h4>
                  <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                    Live payment gateway for real transactions via Debit/Credit Cards, UPI QR, Netbanking, and Wallets.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePay('razorpay')}
                  disabled={submittingMode !== null}
                  className="w-full btn-primary py-2.5 px-4 rounded-xl font-medium text-sm shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submittingMode === 'razorpay' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing Razorpay…
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" /> Pay with Razorpay ({formatCurrency(booking.amount ?? 0)})
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center mt-6 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-gray-400 shrink-0" />
              Secured 256-bit encryption · Both payment options automatically update booking status and record payment history.
            </p>
          </div>
        </div>
      )}

      {/* Razorpay replica demo checkout modal */}
      <DemoCheckoutModal />
    </div>
  );
}
