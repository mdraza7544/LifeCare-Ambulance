import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useBooking, recordConfirmedPayment, createNotification, type Booking } from '@/lib/firestoreService';
import { useApp } from '@/lib/context';
import { verifyRazorpayPayment, type RazorpayHandlerResponse } from '@/lib/razorpay';
import { openCheckout, getPaymentMode } from '@/lib/payment';
import { sendSafetyEmail } from '@/lib/email';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/UI';
import StatusBadge from '@/components/StatusBadge';
import DemoCheckoutModal from '@/components/DemoCheckoutModal';
import { CreditCard, Calendar, Ambulance, Loader2, XCircle, CheckCircle2, Sparkles } from 'lucide-react';

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
  const [submitting, setSubmitting] = useState(false);

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
        userId: targetBooking.userId,
        title: 'Payment Confirmed',
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
  ) => {
    if (!booking) return;
    const mode = getPaymentMode();

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
          await dispatchConfirmationAlerts(booking);
          setSubmitting(false);
          navigate(`/payment-confirmation?id=${booking.id}`);
        } else if (result.status === 'pending') {
          setPayPending('Payment authorized — awaiting confirmation. Your booking will update shortly.');
          setSubmitting(false);
        } else {
          setPayError('Payment verification failed. Please contact support.');
          setSubmitting(false);
        }
      } catch (err) {
        setPayError(err instanceof Error ? err.message : 'Payment verification failed.');
        setSubmitting(false);
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
        await dispatchConfirmationAlerts(booking);
        setSubmitting(false);
        navigate(`/payment-confirmation?id=${booking.id}`);
      } catch (err) {
        setPayError(err instanceof Error ? err.message : 'Payment recording failed.');
        setSubmitting(false);
      }
    }
  };

  const handleDismiss = () => {
    setPayError('Payment cancelled. Your booking is saved but not confirmed — tap Pay Now to try again.');
    setSubmitting(false);
  };

  const handlePay = async () => {
    if (!booking || !isPayable) {
      setPayError('This booking is not ready for payment. Please check your booking status.');
      return;
    }
    if (!user) {
      setPayError('You must be signed in to pay. Please sign in and try again.');
      return;
    }
    setSubmitting(true);
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
        onSuccess: (resp, methodUsed) => handlePaymentSuccess(resp, methodUsed),
        onDismiss: handleDismiss,
        onFailure: (err) => {
          setPayError(err.message || 'Payment failed. Please try again.');
          setSubmitting(false);
        },
      });

      if (!opened) {
        setPayError('Could not open the payment window. Please try again.');
        setSubmitting(false);
      }
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      setSubmitting(false);
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

          <div className="mt-8 flex flex-col items-center gap-4">
            <button onClick={handlePay} disabled={submitting} className="btn-primary inline-flex items-center gap-2">
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" /> Pay Now
                </>
              )}
            </button>
            <p className="text-xs text-gray-400 text-center">
              Secured by Razorpay · Your payment is encrypted and safe.
            </p>

            {getPaymentMode() === 'demo' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Demo Payment Mode Active (No real charges)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Razorpay replica demo checkout modal */}
      <DemoCheckoutModal />
    </div>
  );
}
