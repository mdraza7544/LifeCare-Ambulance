import { CheckCircle2, Download, Home, Calendar, AlertTriangle } from 'lucide-react';
import { useBooking } from '@/lib/firestoreService';
import { useApp } from '@/lib/context';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';

function getBookingId(): string | null {
  const hash = window.location.hash || '';
  const match = hash.match(/[?&]id=([^&]+)/);
  return match?.[1] ?? null;
}

export default function PaymentConfirmationPage() {
  const { navigate } = useApp();
  const { data: booking, loading, error } = useBooking(getBookingId());

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 animate-fade-in">
      <div className="card p-10 text-center">
        {error ? (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-2">Couldn't load your booking</h2>
            <p className="text-sm text-gray-500 mb-5">{error.message}</p>
            <button onClick={() => navigate('/bookings')} className="btn-primary text-sm">Back to My Bookings</button>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Payment Successful!</h2>
            <p className="text-gray-600 mb-6">Your payment has been processed successfully. Your booking is now confirmed.</p>
          </>
        )}

        {loading && (
          <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto" />
        )}

        {!loading && !error && booking && (
          <div className="bg-brand-50 rounded-xl p-5 mb-6 text-left">
            <div className="flex items-center gap-2 mb-3">
              <StatusBadge status={booking.status} />
              <span className="text-sm font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full">
                Confirmed
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Booking code:</span> <span className="font-semibold text-gray-900">{booking.bookingCode ?? '—'}</span></div>
              <div><span className="text-gray-500">Amount:</span> <span className="font-semibold text-brand-600">{formatCurrency(booking.amount ?? 0)}</span></div>
              {booking.patientName && (
                <div><span className="text-gray-500">Patient:</span> <span className="font-semibold text-gray-900">{booking.patientName}</span></div>
              )}
              <div><span className="text-gray-500">Payment:</span> <span className="font-semibold text-gray-900 capitalize">{booking.paymentStatus}</span></div>
              <div className="col-span-2"><span className="text-gray-500">Pickup:</span> <span className="font-semibold text-gray-900">{booking.pickup}</span></div>
              <div className="col-span-2"><span className="text-gray-500">Destination:</span> <span className="font-semibold text-gray-900">{booking.destination}</span></div>
              <div className="col-span-2"><span className="text-gray-500">Date:</span> <span className="font-semibold text-gray-900">{formatDateTime(booking.scheduledTime)}</span></div>
              {(booking.distanceText || booking.durationText) && (
                <div className="col-span-2"><span className="text-gray-500">Distance / ETA:</span> <span className="font-semibold text-gray-900">{booking.distanceText ?? '—'} · {booking.durationText ?? '—'}</span></div>
              )}
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={() => navigate('/bookings')} className="btn-primary"><Calendar className="w-4 h-4" /> View Bookings</button>
            <button onClick={() => navigate('/dashboard')} className="btn-secondary"><Home className="w-4 h-4" /> Dashboard</button>
            <button className="btn-ghost"><Download className="w-4 h-4" /> Download Receipt</button>
          </div>
        )}
      </div>
    </div>
  );
}
