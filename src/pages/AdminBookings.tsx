import { useState } from 'react';
import {
  Search,
  Filter,
  Calendar,
  Loader2,
  Bell,
  AlertTriangle,
  Ambulance as AmbulanceIcon,
  X,
  CheckCircle2,
  Sparkles,
  Clock,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
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
} from '@/lib/firestoreService';
import {
  useDispatchSettings,
  updateDispatchSettings,
  processQueue,
  compareQueuedBookings,
} from '@/lib/dispatchService';
import AdminLayout from '@/components/AdminLayout';
import StatusBadge from '@/components/StatusBadge';
import { formatDateTime } from '@/lib/utils';
import { EmptyState } from '@/components/UI';

type StatusFilter = 'All' | BookingStatus;
type PriorityFilter = 'All' | 'low' | 'normal' | 'high' | 'critical';
type AdminTab = 'all' | 'queue' | 'active';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
};

function formatWaitTime(iso?: string): string {
  if (!iso) return 'Just now';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export default function AdminBookings() {
  const { navigate } = useApp();
  const { data: bookings, loading, error } = useBookings();
  const { data: ambulances } = useAmbulances();
  const { data: drivers } = useDrivers();
  const { settings: dispatchSettings } = useDispatchSettings();

  const [activeTab, setActiveTab] = useState<AdminTab>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All');
  const [mutating, setMutating] = useState<Set<string>>(new Set());
  const [processingManualQueue, setProcessingManualQueue] = useState(false);

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

  // Queued bookings (both accept queue and allocation queue)
  const queuedBookings = bookings.filter(
    (b) =>
      b.queueType === 'accept' ||
      b.queueType === 'allocate' ||
      b.status === 'pending' ||
      (b.status === 'confirmed' && !b.ambulanceId),
  );
  queuedBookings.sort(compareQueuedBookings);

  // Active bookings (accepted, confirmed, allocated)
  const activeBookings = bookings.filter(
    (b) => b.status === 'accepted' || b.status === 'confirmed' || b.status === 'allocated',
  );

  const openAllocateModal = (b: Booking) => {
    setAllocatingBooking(b);
    setAllocateError(null);
    const matching = availableAmbulances.find(
      (a) => a.type.toLowerCase() === (b.ambulanceType || '').toLowerCase(),
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
        'manual',
      );
      setAllocatingBooking(null);
      setSelectedAmbulanceId('');
      setSelectedDriverId('');

      // Advance remaining queue
      processQueue().catch((qErr) => console.warn('[AdminBookings] queue advance warning:', qErr));
    } catch (err) {
      setAllocateError(err instanceof Error ? err.message : 'Failed to allocate.');
    } finally {
      setAllocatingLoading(false);
    }
  };

  const isMutating = (id: string) => mutating.has(id);

  const filtered = (
    activeTab === 'queue'
      ? queuedBookings
      : activeTab === 'active'
      ? activeBookings
      : bookings
  ).filter((b) => {
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
        queueType: null,
        allocationMode: 'manual',
      });
      await createNotification({
        id: `${booking.id}_accepted`,
        userId: booking.userId,
        title: 'Booking accepted - please complete payment',
        message: `Your booking ${booking.bookingCode} has been accepted by an admin. Please complete payment to confirm.`,
        type: 'booking',
        bookingId: booking.id,
      });

      // Trigger queue process
      processQueue().catch((qErr) => console.warn('[AdminBookings] processQueue warning:', qErr));
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
      await updateBooking(booking.id, {
        status: 'rejected',
        queueType: null,
      });
      await createNotification({
        id: `${booking.id}_rejected`,
        userId: booking.userId,
        title: 'Booking rejected',
        message: `Your booking ${booking.bookingCode} has been rejected.`,
        type: 'booking',
        bookingId: booking.id,
      });

      // Process queue for waiting bookings
      processQueue().catch((qErr) => console.warn('[AdminBookings] processQueue warning:', qErr));
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

  const handleToggleSetting = async (key: 'autoAccept' | 'autoAllocate', value: boolean) => {
    try {
      await updateDispatchSettings({ [key]: value });
      if (value) {
        processQueue().catch(() => {});
      }
    } catch {
      alert('Could not update dispatch setting.');
    }
  };

  const handleTriggerManualQueue = async () => {
    setProcessingManualQueue(true);
    try {
      const res = await processQueue();
      alert(`Queue processed!\n- Allocations: ${res.allocations}\n- Auto-accepts: ${res.accepts}\n- Expired: ${res.expired}`);
    } catch {
      alert('Error processing queue.');
    } finally {
      setProcessingManualQueue(false);
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
    'expired',
  ];

  return (
    <AdminLayout title="Bookings & Dispatch">
      {/* Dispatch Controls & Automation Toggles */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 mb-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-brand-50 text-brand-600">
                <Sparkles className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-gray-900">
                Automated Dispatch & Queue Controls
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Toggle automatic triage and allocation. When toggled OFF, requests wait for manual admin review.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            {/* Auto-Accept Toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={dispatchSettings.autoAccept}
                  onChange={(e) => handleToggleSetting('autoAccept', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600"></div>
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-900 block">Auto-Accept</span>
                <span className="text-[10px] text-gray-500 block">
                  {dispatchSettings.autoAccept ? 'Active (Checks fleet capacity)' : 'Manual (Paused)'}
                </span>
              </div>
            </label>

            {/* Auto-Allocate Toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={dispatchSettings.autoAllocate}
                  onChange={(e) => handleToggleSetting('autoAllocate', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-900 block">Auto-Allocate</span>
                <span className="text-[10px] text-gray-500 block">
                  {dispatchSettings.autoAllocate ? 'Active (Assigns on payment)' : 'Manual (Paused)'}
                </span>
              </div>
            </label>

            <button
              type="button"
              onClick={handleTriggerManualQueue}
              disabled={processingManualQueue}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${processingManualQueue ? 'animate-spin' : ''}`} />
              Process Queue
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 mb-5 pb-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'all'
              ? 'bg-brand-50 text-brand-700 border border-brand-200 shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          All Bookings ({bookings.length})
        </button>
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'queue'
              ? 'bg-amber-50 text-amber-900 border border-amber-300 shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Dispatch Queue ({queuedBookings.length})
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === 'active'
              ? 'bg-teal-50 text-teal-800 border border-teal-200 shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Active Trips ({activeBookings.length})
        </button>
      </div>

      {loading && (
        <div className="max-w-5xl mx-auto px-4 py-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-3" />
          <p className="text-gray-500">Loading bookings…</p>
        </div>
      )}

      {!loading && error && (
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-red-600 font-semibold mb-1">Failed to load bookings</p>
          <p className="text-gray-500 text-sm mb-4">{error.message}</p>
          <button onClick={() => window.location.reload()} className="btn-primary text-sm">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-5 items-end sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-10"
                placeholder="Search booking ID, user, pickup or destination…"
              />
            </div>
            {activeTab === 'all' && (
              <div className="flex items-center gap-2 w-auto">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="input-field w-auto"
                >
                  <option value="All">All Status</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2 w-auto">
              <Bell className="w-4 h-4 text-gray-400" />
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
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
              title={activeTab === 'queue' ? 'Queue is clear' : 'No bookings found'}
              message={
                activeTab === 'queue'
                  ? 'There are no bookings waiting in the dispatch or allocation queue.'
                  : 'Try adjusting your search or filter.'
              }
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                      {activeTab === 'queue' && <th className="px-5 py-3">Queue #</th>}
                      <th className="px-5 py-3">Booking ID</th>
                      <th className="px-5 py-3">Patient</th>
                      <th className="px-5 py-3">Pickup → Destination</th>
                      <th className="px-5 py-3">Priority</th>
                      <th className="px-5 py-3">Status & Mode</th>
                      {activeTab === 'queue' ? (
                        <th className="px-5 py-3">Waiting Time</th>
                      ) : (
                        <>
                          <th className="px-5 py-3">Payment</th>
                          <th className="px-5 py-3">Scheduled</th>
                        </>
                      )}
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b, idx) => {
                      const isAllocationQueue =
                        b.status === 'confirmed' && (!b.ambulanceId || b.queueType === 'allocate');

                      return (
                        <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                          {activeTab === 'queue' && (
                            <td className="px-5 py-4">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg font-bold text-xs bg-amber-100 text-amber-900 border border-amber-200">
                                #{idx + 1}
                              </span>
                            </td>
                          )}
                          <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                            <div>{b.bookingCode || b.id.slice(0, 8)}</div>
                            {b.queueType && (
                              <span className="text-[10px] text-amber-700 font-medium">
                                {isAllocationQueue ? 'Allocation Queue' : 'Accept Queue'}
                              </span>
                            )}
                          </td>
                          <td
                            className="px-5 py-4 text-sm text-gray-600 truncate max-w-[140px]"
                            title={b.patientName ?? b.userId}
                          >
                            <p className="font-medium text-gray-900">{b.patientName || '—'}</p>
                            <p className="text-xs text-gray-400 truncate">{b.userId}</p>
                          </td>
                          <td className="px-5 py-4 text-xs text-gray-700 max-w-[200px]">
                            <p className="font-medium text-gray-900 truncate">{b.pickup}</p>
                            <p className="text-gray-500 truncate flex items-center gap-1 mt-0.5">
                              <ArrowRight className="w-3 h-3 shrink-0" /> {b.destination}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-sm">
                            <span
                              className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                                b.priority === 'critical'
                                  ? 'bg-red-100 text-red-700'
                                  : b.priority === 'high'
                                  ? 'bg-orange-100 text-orange-700'
                                  : b.priority === 'normal'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {PRIORITY_LABELS[b.priority] ?? b.priority}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <StatusBadge status={b.status} />
                              {b.allocationMode === 'auto' && (
                                <span
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  title="Automatically processed by dispatch engine"
                                >
                                  Auto
                                </span>
                              )}
                              {b.allocationMode === 'manual' && (
                                <span
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200"
                                  title="Manually handled by Admin"
                                >
                                  Manual
                                </span>
                              )}
                            </div>
                          </td>
                          {activeTab === 'queue' ? (
                            <td className="px-5 py-4 text-xs font-medium text-gray-600">
                              {formatWaitTime(b.queuedAt || b.createdAt)}
                            </td>
                          ) : (
                            <>
                              <td className="px-5 py-4 text-sm">
                                <span
                                  className={`font-semibold text-xs ${
                                    b.paymentStatus === 'paid'
                                      ? 'text-green-600'
                                      : b.paymentStatus === 'failed'
                                      ? 'text-red-600'
                                      : 'text-gray-500'
                                  }`}
                                >
                                  {b.paymentStatus}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-xs text-gray-600">
                                {b.scheduledTime ? formatDateTime(b.scheduledTime) : '—'}
                              </td>
                            </>
                          )}
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              {b.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleAccept(b)}
                                    disabled={isMutating(b.id)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 disabled:opacity-50 transition-colors"
                                  >
                                    {isMutating(b.id) && (
                                      <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />
                                    )}
                                    Accept Manually
                                  </button>
                                  <button
                                    onClick={() => handleReject(b)}
                                    disabled={isMutating(b.id)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {b.status === 'confirmed' && (
                                <button
                                  onClick={() => openAllocateModal(b)}
                                  disabled={isMutating(b.id)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 shadow-sm"
                                >
                                  <AmbulanceIcon className="w-3.5 h-3.5" />
                                  Allocate Manually
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

                              <button
                                onClick={() => navigate(`/booking-details?id=${b.id}`)}
                                className="text-xs underline text-gray-500 hover:text-gray-900 ml-1"
                              >
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Allocate Ambulance & Driver Modal */}
      {allocatingBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => setAllocatingBooking(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
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
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3.5 space-y-1 text-xs text-gray-600 border border-gray-100">
              <p>
                <strong className="text-gray-900">Patient:</strong> {allocatingBooking.patientName || '—'}
              </p>
              <p>
                <strong className="text-gray-900">Route:</strong> {allocatingBooking.pickup} → {allocatingBooking.destination}
              </p>
              <p>
                <strong className="text-gray-900">Requested Type:</strong>{' '}
                <span className="font-semibold text-brand-600 uppercase">
                  {allocatingBooking.ambulanceType || 'BLS'}
                </span>
              </p>
            </div>

            {allocateError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
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
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
                    <p className="font-semibold">No available ambulances found.</p>
                    <p>All ambulances are currently on duty or in maintenance.</p>
                  </div>
                ) : (
                  <select
                    value={selectedAmbulanceId}
                    onChange={(e) => setSelectedAmbulanceId(e.target.value)}
                    className="input-field"
                    required
                  >
                    <option value="">-- Choose an ambulance --</option>
                    {availableAmbulances.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.number} ({a.type})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Select Available Driver <span className="text-red-500">*</span>
                </label>
                {availableDrivers.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
                    <p className="font-semibold">No available drivers found.</p>
                    <p>All drivers are currently allocated or off duty.</p>
                  </div>
                ) : (
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="input-field"
                    required
                  >
                    <option value="">-- Choose a driver --</option>
                    {availableDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.phone})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAllocatingBooking(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    allocatingLoading ||
                    availableAmbulances.length === 0 ||
                    availableDrivers.length === 0 ||
                    !selectedAmbulanceId ||
                    !selectedDriverId
                  }
                  className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5 shadow-sm"
                >
                  {allocatingLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Allocating…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Allocation
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
