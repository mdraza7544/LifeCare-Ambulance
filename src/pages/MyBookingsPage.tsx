import { useState } from 'react';
import { Calendar, Search, Ambulance, Filter, AlertTriangle, CheckCircle2, CreditCard } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useBookings, type Booking, type BookingStatus } from '@/lib/firestoreService';
import { PageHeader, EmptyState } from '@/components/UI';
import StatusBadge from '@/components/StatusBadge';
import { formatDateTime } from '@/lib/utils';

export default function MyBookingsPage() {
  const { user } = useAuth();
  const { data: bookings, loading, error } = useBookings(user?.id ?? null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | BookingStatus>('All');

  const filtered = (bookings ?? []).filter((b) => {
    const q = search.toLowerCase();
    const matchSearch =
      (b.bookingCode ?? '').toLowerCase().includes(q) ||
      (b.userId ?? '').toLowerCase().includes(q) ||
      (b.pickup ?? '').toLowerCase().includes(q) ||
      (b.destination ?? '').toLowerCase().includes(q);
    const matchFilter = filter === 'All' || b.status === filter;
    return matchSearch && matchFilter;
  });

  const statusLabel = (status: string) => {
    if (status === 'confirmed') return 'Confirmed';
    if (status === 'accepted') return 'Accepted';
    if (status === 'pending') return 'Pending';
    if (status === 'paid') return 'Paid';
    if (status === 'allocated') return 'Allocated';
    if (status === 'completed') return 'Completed';
    if (status === 'rejected' || status === 'cancelled') return status;
    return status;
  };

  const navigate = (path: string) => {
    window.location.hash = path;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      <PageHeader title="My Bookings" subtitle="View and manage all your ambulance bookings" icon={<Calendar className="w-5 h-5" />} />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" placeholder="Search by booking ID, user ID, pickup or destination..." />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={filter} onChange={(e) => setFilter(e.target.value as 'All' | BookingStatus)} className="input-field w-auto">
            <option value="All">All Status</option>
            {(['pending', 'accepted', 'paid', 'confirmed', 'allocated', 'completed', 'rejected', 'cancelled'] as BookingStatus[]).map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-gray-500 mt-3">Loading your bookings…</p>
        </div>
      )}
      {!loading && error && (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-red-600 font-semibold mb-1">Failed to load bookings</p>
          <p className="text-gray-500 text-sm mb-4">{error.message}</p>
          <button onClick={() => window.location.reload()} className="btn-primary text-sm">Retry</button>
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState icon={<Ambulance className="w-8 h-8" />} title="No bookings found" message="Try adjusting your search or filter, or book a new ambulance." action={<button onClick={() => navigate('/book')} className="btn-primary">Book Ambulance</button>} />
      )}
      {!loading && !error && filtered.map((b) => {
        const isAcceptedUnpaid = b.status === 'accepted' && b.paymentStatus !== 'paid';
        const isConfirmed = b.status === 'confirmed';
        return (
          <div key={b.id} className="card p-5 hover:shadow-card-hover transition-shadow cursor-pointer" onClick={() => navigate(`/booking-details?id=${b.id}`)}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                <Ambulance className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-gray-900 truncate">{b.bookingCode ?? 'No code'}</p>
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-sm text-gray-500 mt-1">User {b.userId ?? '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{b.pickup} → {b.destination}</p>
                <p className="text-xs text-gray-400 mt-0.5">Scheduled: {formatDateTime(b.scheduledTime)}</p>
                {(b.distanceText || b.durationText) && (
                  <p className="text-xs text-brand-700 font-medium mt-1">
                    {[b.distanceText, b.durationText].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1">
                <div className="text-right flex flex-col items-end">
                  {isAcceptedUnpaid && (
                    <>
                      <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full mb-1">
                        Accepted — please complete payment
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/payment?id=${b.id}`);
                        }}
                        className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 mt-1"
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Pay Now
                      </button>
                    </>
                  )}
                  {isConfirmed && (
                    <span className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full mb-1 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
                    </span>
                  )}
                  {b.status === 'allocated' && (
                    <>
                      <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full mb-1 inline-flex items-center gap-1">
                        <Ambulance className="w-3.5 h-3.5" /> Ambulance Allocated
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/track?id=${b.id}`);
                        }}
                        className="btn-ghost text-xs py-1 px-2.5 border border-teal-300 text-teal-700 hover:bg-teal-50 mt-1 inline-flex items-center gap-1"
                      >
                        Track Ambulance
                      </button>
                    </>
                  )}
                  {b.status === 'completed' && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full mb-1 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                    </span>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); navigate(`/booking-details?id=${b.id}`); }} className="text-sm font-semibold text-brand-600 hover:underline mt-1">View Details</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
