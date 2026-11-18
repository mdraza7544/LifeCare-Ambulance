import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  useBooking,
  useAmbulances,
  useDrivers,
  markBookingReached,
  type BookingStatus,
} from '@/lib/firestoreService';
import { useApp } from '@/lib/context';
import StatusBadge from '@/components/StatusBadge';
import { PageHeader } from '@/components/UI';
import { formatDateTime } from '@/lib/utils';
import { CreditCard, Calendar, Ambulance, MapPin, CheckCircle2, Loader2, AlertTriangle, Navigation, Phone } from 'lucide-react';

function getBookingId(): string | null {
  const hash = window.location.hash || '';
  const match = hash.match(/[?&]id=([^&]+)/);
  return match?.[1] ?? null;
}

export default function BookingDetailsPage() {
  const { user } = useAuth();
  const { data: booking, loading, error } = useBooking(getBookingId());
  const { data: ambulances } = useAmbulances();
  const { data: drivers } = useDrivers();
  const { navigate } = useApp();

  const [reaching, setReaching] = useState(false);
  const [reachError, setReachError] = useState<string | null>(null);

  const assignedAmbulance = ambulances.find((a) => a.id === booking?.ambulanceId);
  const assignedDriver = drivers.find((d) => d.id === booking?.driverId);

  const isAcceptedUnpaid = booking?.status === 'accepted' && booking?.paymentStatus !== 'paid';
  const isConfirmed = booking?.status === 'confirmed';
  const isAllocated = booking?.status === 'allocated';
  const isCompleted = booking?.status === 'completed';

  const handleMarkReached = async () => {
    if (!booking) return;
    setReaching(true);
    setReachError(null);
    try {
      await markBookingReached(booking.id);
    } catch (err) {
      setReachError(err instanceof Error ? err.message : 'Failed to mark as reached.');
    } finally {
      setReaching(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      <PageHeader
        title="Booking Details"
        subtitle={
          isCompleted
            ? 'Trip completed — thank you for using LifeCare.'
            : isAllocated
            ? 'Ambulance is allocated and on the way.'
            : isConfirmed
            ? 'Your booking is confirmed — ambulance allocation in progress.'
            : isAcceptedUnpaid
            ? 'Accepted — please complete your payment to confirm.'
            : booking
            ? 'View and manage your booking.'
            : 'Booking details'
        }
        icon={<Ambulance className="w-5 h-5" />}
      />

      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-gray-500 mt-3">Loading booking…</p>
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
          <p className="text-gray-500">Booking not found or no longer available.</p>
          <button onClick={() => navigate('/bookings')} className="btn-primary mt-4 text-sm">
            Back to My Bookings
          </button>
        </div>
      )}

      {booking && (
        <div className="card p-6 mt-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={booking.status} />
              {isConfirmed && (
                <span className="text-sm font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full">
                  Confirmed
                </span>
              )}
              {isAcceptedUnpaid && (
                <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
                  Accepted — please complete payment
                </span>
              )}
              {isAllocated && (
                <span className="text-sm font-semibold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                  Ambulance Allocated
                </span>
              )}
              {isCompleted && (
                <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Trip Completed
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500">{booking.bookingCode ?? 'No code'}</div>
          </div>

          {reachError && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{reachError}</span>
            </div>
          )}

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
              {(booking.distanceText || booking.durationText) && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Distance / ETA</p>
                  <p className="font-semibold text-gray-900">{booking.distanceText ?? '—'} · {booking.durationText ?? '—'}</p>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Calendar className="w-4 h-4" />
                <span>{formatDateTime(booking.createdAt)}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <p className="font-semibold text-gray-900">{booking.status}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Payment Status</p>
                <p className="font-semibold text-gray-900">{booking.paymentStatus}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">User</p>
                <p className="font-semibold text-gray-900">{booking.userId}</p>
              </div>
              {booking.ambulanceId && (
                <div className="flex items-center gap-2 text-xs text-gray-700">
                  <Ambulance className="w-4 h-4 text-teal-600" />
                  <span>
                    Ambulance:{' '}
                    <strong className="text-gray-900">
                      {assignedAmbulance ? `${assignedAmbulance.number} (${assignedAmbulance.type})` : booking.ambulanceId}
                    </strong>
                  </span>
                </div>
              )}
              {booking.driverId && (
                <div className="flex items-center justify-between text-xs text-gray-700 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-extrabold flex items-center justify-center text-xs shrink-0">
                      {assignedDriver?.name ? assignedDriver.name.charAt(0).toUpperCase() : <MapPin className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {assignedDriver ? assignedDriver.name : `Driver ID: ${booking.driverId.slice(0, 8)}`}
                      </p>
                      {assignedDriver?.phone && (
                        <p className="text-[11px] text-gray-500">{assignedDriver.phone}</p>
                      )}
                    </div>
                  </div>
                  {assignedDriver?.phone && (
                    <a
                      href={`tel:${assignedDriver.phone.replace(/\s/g, '')}`}
                      className="px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 font-semibold text-xs flex items-center gap-1 transition-colors"
                    >
                      <Phone className="w-3 h-3" /> Call
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {isAcceptedUnpaid && (
            <div className="mt-8 text-right">
              <button
                onClick={() => navigate(`/payment?id=${booking.id}`)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" /> Pay Now
              </button>
            </div>
          )}

          {isAllocated && (
            <div className="mt-8 p-5 rounded-2xl bg-teal-50 border border-teal-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                    <Ambulance className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">Ambulance & Driver Allocated</h4>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {assignedAmbulance ? `Vehicle ${assignedAmbulance.number} (${assignedAmbulance.type})` : 'Your ambulance'}
                      {assignedDriver ? ` with driver ${assignedDriver.name} (${assignedDriver.phone})` : ''} is on the way. Once you have reached the destination, click below to complete the trip.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => navigate(`/track?id=${booking.id}`)}
                    className="btn-ghost text-xs py-2.5 px-3.5 border border-teal-300 text-teal-800 bg-white hover:bg-teal-100 flex items-center gap-1.5"
                  >
                    <Navigation className="w-3.5 h-3.5" /> Track Live
                  </button>
                  <button
                    onClick={handleMarkReached}
                    disabled={reaching}
                    className="btn-primary text-xs py-2.5 px-4 bg-teal-600 hover:bg-teal-700 border-teal-600 text-white inline-flex items-center gap-1.5 shadow-sm"
                  >
                    {reaching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Updating…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark as Reached
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isCompleted && (
            <div className="mt-8 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold">Trip Successfully Completed</p>
                <p className="text-emerald-700">Thank you for choosing LifeCare Ambulance Service.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
