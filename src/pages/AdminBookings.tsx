import { useState } from 'react';
import { Search, Filter, Calendar, Loader2, Bell, AlertTriangle, Ambulance as AmbulanceIcon, X, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/lib/context';
import {
  useBookings,
  useAmbulances,
  useDrivers,
  updateBooking,
  allocateAmbulanceToBooking,
  createNotification,
  type BookingStatus,
  type Booking,
  type Ambulance,
  type Driver,
} from '@/lib/firestoreService';
import { useAuth } from '@/lib/auth';
import AdminLayout from '@/components/AdminLayout';
import StatusBadge from '@/components/StatusBadge';
import { formatDateTime } from '@/lib/utils';
import { EmptyState } from '@/components/UI';

type StatusFilter = 'All' | BookingStatus;
type PriorityFilter = 'All' | 'low' | 'normal' | 'high' | 'critical';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
};

export default function AdminBookings() {
  const { navigate } = useApp();
  const { user } = useAuth();
  const { data: bookings, loading, error } = useBookings();
  const { data: ambulances } = useAmbulances();
  const { data: drivers } = useDrivers();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All');
  const [mutating, setMutating] = useState<Set<string>>(new Set());

  // Allocation modal state
  const [allocatingBooking, setAllocatingBooking] = useState<Booking | null>(null);
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState<string>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [allocatingLoading, setAllocatingLoading] = useState(false);
  const [allocateError, setAllocateError] = useState<string | null>(null);

  const ambulanceMap = new Map((ambulances ?? []).map((a) => [a.id, a]));
  const availableAmbulances = (ambulances ?? []).filter((a) => a.status === 'available');

  const driverMap = new Map((drivers ?? []).map((d) => [d.id, d]));
  const availableDrivers = (drivers ?? []).filter((d) => d.status === 'available');

  const openAllocateModal = (b: Booking) => {
    setAllocatingBooking(b);
    setAllocateError(null);
    // Suggest matching type if available
    const matching = availableAmbulances.find(
      (a) => a.type.toLowerCase() === (b.ambulanceType || '').toLowerCase()
    );
    setSelectedAmbulanceId(matching?.id || availableAmbulances[0]?.id || '');
    setSelectedDriverId(availableDrivers[0]?.id || '');
  };

  const handleAllocateConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatingBooking || !selectedAmbulanceId || !selectedDriverId) return;
    setAllocatingLoading(true);
    setAllocateError(null);
    try {
      await allocateAmbulanceToBooking(
        allocatingBooking.id,
        selectedAmbulanceId,
        selectedDriverId,
      );
      setAllocatingBooking(null);
      setSelectedAmbulanceId('');
      setSelectedDriverId('');
    } catch (err) {
      setAllocateError(err instanceof Error ? err.message : 'Failed to allocate.');
    } finally {
      setAllocatingLoading(false);
    }
  };

  const isMutating = (id: string) => mutating.has(id);

  const filtered = bookings.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch =
      search.trim() === '' ||
      [b.bookingCode, b.patientName, b.userId, b.pickup, b.destination]
        .filter((s): s is string => Boolean(s))
        .some((s) => s.toLowerCase().includes(q));
    const matchStatus = statusFilter === 'All' || b.status === statusFilter;
    const matchPriority = priorityFilter === 'All' || b.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const handleAccept = async (booking: Booking) => {
    if (!booking.userId || booking.status !== 'pending') return;
    setMutating((prev) => new Set([...prev, booking.id]));
    try {
      await updateBooking(booking.id, {
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
      });
      await createNotification({
        userId: booking.userId,
        title: 'Booking accepted',
        message: `Your booking ${booking.bookingCode} has been accepted. Please complete payment to confirm.`,
        type: 'booking',
        bookingId: booking.id,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not accept booking.');
    } finally {
      setMutating((prev) => {
        const next = new Set(prev);
        next.delete(booking.id);
        return next;
      });
    }
  };

  const handleReject = async (booking: Booking) => {
    if (!booking.userId) return;
    if (booking.status !== 'pending' && booking.status !== 'accepted') return;
    setMutating((prev) => new Set([...prev, booking.id]));
    try {
      await updateBooking(booking.id, { status: 'rejected' });
      await createNotification({
        userId: booking.userId,
        title: 'Booking rejected',
        message: `Your booking ${booking.bookingCode} has been rejected.`,
        type: 'booking',
        bookingId: booking.id,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not reject booking.');
    } finally {
      setMutating((prev) => {
        const next = new Set(prev);
        next.delete(booking.id);
        return next;
      });
    }
  };

  const statusOptions: BookingStatus[] = [
    'pending',
    'accepted',
    'paid',
    'confirmed',
    'allocated',
    'completed',
    'rejected',
    'cancelled',
  ];

  return (
    <AdminLayout title="Bookings">
      {loading && (
        <div className="max-w-5xl mx-auto px-4 py-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-3" />
          <p className="text-gray-500">Loading bookings�</p>
        </div>
      )}
      {!loading && error && (
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-red-600 font-semibold mb-1">Failed to load bookings</p>
          <p className="text-gray-500 text-sm mb-4">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary text-sm"
          >
            Retry
          </button>
        </div>
      )}
      {!loading && !error && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-5 items-end sm:items-center">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-10"
                placeholder="Search booking ID, user, pickup or destination\u2026"
              />
            </div>
            <div className="flex items-center gap-2 w-auto">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="input-field w-auto"
              >
                <option value="All">All Status</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 w-auto">
              <Bell className="w-4 h-4 text-gray-400" />
              <select
                value={priorityFilter}
                onChange={(e) =>
                  setPriorityFilter(e.target.value as PriorityFilter)
                }
                className="input-field w-auto"
              >
                <option value="All">All Priority</option>
                {['low', 'normal', 'high', 'critical'].map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-8 h-8" />}
              title="No bookings found"
              message="Try adjusting your search or filter."
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                      <th className="px-5 py-3">Booking ID</th>
                      <th className="px-5 py-3">Patient</th>
                      <th className="px-5 py-3">Pickup</th>
                      <th className="px-5 py-3">Destination</th>
                      <th className="px-5 py-3">Priority</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Payment</th>
                      <th className="px-5 py-3">Scheduled</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b) => (
                      <tr
                        key={b.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                          {b.bookingCode || b.id.slice(0, 8)}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600 truncate max-w-[140px]" title={b.patientName ?? b.userId}>
                          {b.patientName ?? b.userId}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">{b.pickup}</td>
                        <td className="px-5 py-4 text-sm text-gray-700">{b.destination}</td>
                        <td className="px-5 py-4 text-sm">
                          <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                            b.priority === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : b.priority === 'high'
                              ? 'bg-orange-100 text-orange-700'
                              : b.priority === 'normal'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {PRIORITY_LABELS[b.priority] ?? b.priority}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm">
                          <StatusBadge status={b.status as any} />
                        </td>
                        <td className="px-5 py-4 text-sm">
                          <span className={`font-semibold ${
                            b.paymentStatus === 'paid'
                              ? 'text-green-600'
                              : b.paymentStatus === 'failed'
                              ? 'text-red-600'
                              : 'text-gray-600'
                          }`}>
                            {b.paymentStatus}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">
                          {b.scheduledTime ? formatDateTime(b.scheduledTime) : '\u2014'}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {b.status === 'pending' && (
                            <button
                              onClick={() => handleAccept(b)}
                              disabled={isMutating(b.id)}
                              className="mr-2 px-3 py-1.5 rounded text-xs font-semibold bg-brand-50 text-brand-600 border border-brand-200 hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {isMutating(b.id) && (
                                <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />
                              )}
                              Accept
                            </button>
                          )}
                          {(b.status === 'pending' || b.status === 'accepted') && (
                            <button
                              onClick={() => handleReject(b)}
                              disabled={isMutating(b.id)}
                              className="px-3 py-1.5 rounded text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {isMutating(b.id) && (
                                <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />
                              )}
                              Reject
                            </button>
                          )}
                          {b.status === 'confirmed' && (
                            <button
                              onClick={() => openAllocateModal(b)}
                              disabled={isMutating(b.id)}
                              className="px-3 py-1.5 rounded text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
                            >
                              <AmbulanceIcon className="w-3.5 h-3.5" />
                              Allocate Ambulance
                            </button>
                          )}
                          {b.status === 'allocated' && (
                            <div className="flex flex-col items-end gap-1">
                              <span className="inline-flex items-center gap-1 text-xs text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                <AmbulanceIcon className="w-3 h-3" />
                                {ambulanceMap.get(b.ambulanceId ?? '')?.number ||
                                  (b.ambulanceId ? `Ambulance ${b.ambulanceId.slice(0, 6)}` : 'Allocated')}
                              </span>
                              {b.driverId && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-gray-700 font-medium bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                  Driver: {driverMap.get(b.driverId)?.name || b.driverId.slice(0, 6)}
                                </span>
                              )}
                            </div>
                          )}
                          {(b.status === 'accepted' ||
                            b.status === 'paid' ||
                            b.status === 'confirmed' ||
                            b.status === 'allocated' ||
                            b.status === 'completed') && (
                            <button
                              key="view"
                              onClick={() => navigate(`/booking-details?id=${b.id}`)}
                              className="mt-2 block text-xs underline text-gray-500 hover:text-gray-900"
                            >
                              View details
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Allocate Ambulance Modal */}
      {allocatingBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => setAllocatingBooking(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <AmbulanceIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Allocate Ambulance & Driver</h3>
                  <p className="text-xs text-gray-500">
                    Booking: {allocatingBooking.bookingCode || allocatingBooking.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAllocatingBooking(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Booking Details Card */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Patient:</span>
                <span className="font-semibold text-gray-900">
                  {allocatingBooking.patientName || allocatingBooking.userId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Pickup:</span>
                <span className="font-semibold text-gray-900 truncate max-w-[280px]">
                  {allocatingBooking.pickup}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Destination:</span>
                <span className="font-semibold text-gray-900 truncate max-w-[280px]">
                  {allocatingBooking.destination}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Requested Type:</span>
                <span className="font-bold text-teal-700">
                  {allocatingBooking.ambulanceType || 'BLS'}
                </span>
              </div>
            </div>

            {allocateError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{allocateError}</span>
              </div>
            )}

            <form onSubmit={handleAllocateConfirm} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Select Available Ambulance <span className="text-red-500">*</span>
                </label>
                {availableAmbulances.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    <p className="font-semibold mb-1">No ambulances available</p>
                    <p>All ambulances are currently Booked or in Maintenance. Please visit the Fleet page to make an ambulance available.</p>
                  </div>
                ) : (
                  <select
                    value={selectedAmbulanceId}
                    onChange={(e) => setSelectedAmbulanceId(e.target.value)}
                    className="input-field"
                    required
                  >
                    <option value="" disabled>-- Choose an available ambulance --</option>
                    {availableAmbulances.map((amb) => {
                      const matches =
                        amb.type.toLowerCase() === (allocatingBooking.ambulanceType || '').toLowerCase();
                      return (
                        <option key={amb.id} value={amb.id}>
                          {amb.number} ({amb.type}) {matches ? '— Matches requested type' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Select Available Driver <span className="text-red-500">*</span>
                </label>
                {availableDrivers.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    <p className="font-semibold mb-1">No drivers available</p>
                    <p>All drivers are currently Allocated or Off Duty. Please visit Driver Management to make a driver available.</p>
                  </div>
                ) : (
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="input-field"
                    required
                  >
                    <option value="" disabled>-- Choose an available driver --</option>
                    {availableDrivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name} ({driver.phone}) {driver.license ? `— ${driver.license}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAllocatingBooking(null)}
                  className="btn-ghost flex-1 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    allocatingLoading ||
                    !selectedAmbulanceId ||
                    !selectedDriverId ||
                    availableAmbulances.length === 0 ||
                    availableDrivers.length === 0
                  }
                  className="btn-primary flex-1 text-sm bg-teal-600 hover:bg-teal-700 border-teal-600 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {allocatingLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Allocating…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm Allocation
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
