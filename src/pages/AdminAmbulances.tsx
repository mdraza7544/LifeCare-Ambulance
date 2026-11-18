import { useState } from 'react';
import {
  Ambulance as AmbulanceIcon,
  Plus,
  Search,
  Filter,
  X,
  Edit2,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  ExternalLink,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import {
  useAmbulances,
  useBookings,
  createAmbulance,
  updateAmbulance,
  deleteAmbulance,
  type Ambulance,
  type AmbulanceStatus,
} from '@/lib/firestoreService';
import { useApp } from '@/lib/context';

type StatusFilter = 'All' | AmbulanceStatus;

interface AmbulanceFormData {
  number: string;
  type: string;
  status: AmbulanceStatus;
}

const DEFAULT_FORM: AmbulanceFormData = {
  number: '',
  type: 'BLS',
  status: 'available',
};

const AMBULANCE_TYPES = [
  { value: 'BLS', label: 'BLS (Basic Life Support)' },
  { value: 'ALS', label: 'ALS (Advanced Life Support)' },
  { value: 'ICU', label: 'ICU (Intensive Care Unit)' },
];

export default function AdminAmbulances() {
  const { navigate } = useApp();
  const { data: ambulances, loading, error } = useAmbulances();
  const { data: bookings } = useBookings();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAmbulance, setEditingAmbulance] = useState<Ambulance | null>(null);
  const [deletingAmbulance, setDeletingAmbulance] = useState<Ambulance | null>(null);

  const [form, setForm] = useState<AmbulanceFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Map of bookingId -> Booking for fast lookup of attached booking info
  const bookingMap = new Map((bookings ?? []).map((b) => [b.id, b]));

  // Metrics
  const totalFleet = ambulances.length;
  const availableCount = ambulances.filter((a) => a.status === 'available').length;
  const bookedCount = ambulances.filter((a) => a.status === 'booked').length;
  const maintenanceCount = ambulances.filter((a) => a.status === 'maintenance').length;

  const filtered = ambulances.filter((a) => {
    const q = search.trim().toLowerCase();
    const attachedBooking = a.currentBookingId ? bookingMap.get(a.currentBookingId) : null;
    const bookingCode = attachedBooking?.bookingCode?.toLowerCase() ?? '';
    const patient = attachedBooking?.patientName?.toLowerCase() ?? '';

    const matchesSearch =
      !q ||
      a.number.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q) ||
      (a.currentBookingId && a.currentBookingId.toLowerCase().includes(q)) ||
      bookingCode.includes(q) ||
      patient.includes(q);

    const matchesStatus = statusFilter === 'All' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openAddModal = () => {
    setActionError(null);
    setForm(DEFAULT_FORM);
    setShowAddModal(true);
  };

  const openEditModal = (ambulance: Ambulance) => {
    setActionError(null);
    setEditingAmbulance(ambulance);
    setForm({
      number: ambulance.number,
      type: ambulance.type || 'BLS',
      status: ambulance.status,
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.number.trim()) {
      setActionError('Number plate is required.');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await createAmbulance({
        number: form.number.trim().toUpperCase(),
        type: form.type,
        status: form.status,
      });
      setShowAddModal(false);
      setForm(DEFAULT_FORM);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create ambulance.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAmbulance) return;
    if (!form.number.trim()) {
      setActionError('Number plate is required.');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await updateAmbulance(editingAmbulance.id, {
        number: form.number.trim().toUpperCase(),
        type: form.type,
        status: form.status,
        // If status changed to available, detach booking if desired
        ...(form.status === 'available' ? { currentBookingId: null } : {}),
      });
      setEditingAmbulance(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update ambulance.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAmbulance) return;
    setSaving(true);
    setActionError(null);
    try {
      await deleteAmbulance(deletingAmbulance.id);
      setDeletingAmbulance(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete ambulance.');
    } finally {
      setSaving(false);
    }
  };

  const renderStatusBadge = (status: AmbulanceStatus) => {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Available
          </span>
        );
      case 'booked':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Allocated
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Maintenance
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">
            {status}
          </span>
        );
    }
  };

  const renderTypeBadge = (type: string) => {
    const t = type.toUpperCase();
    if (t === 'ICU') {
      return (
        <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">
          ICU
        </span>
      );
    }
    if (t === 'ALS') {
      return (
        <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
          ALS
        </span>
      );
    }
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-700 border border-teal-200">
        BLS
      </span>
    );
  };

  return (
    <AdminLayout title="Ambulance Fleet">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700">
            <AmbulanceIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Fleet</p>
            <p className="text-xl font-bold text-gray-900">{totalFleet}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Available</p>
            <p className="text-xl font-bold text-green-600">{availableCount}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Booked / En Route</p>
            <p className="text-xl font-bold text-blue-600">{bookedCount}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">In Maintenance</p>
            <p className="text-xl font-bold text-amber-600">{maintenanceCount}</p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
            placeholder="Search number plate, type, booking code..."
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="input-field w-auto"
          >
            <option value="All">All Statuses</option>
            <option value="available">Available</option>
            <option value="booked">Booked</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>

        <button onClick={openAddModal} className="btn-primary text-sm whitespace-nowrap">
          <Plus className="w-4 h-4" /> Add Ambulance
        </button>
      </div>

      {/* Main Content */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-3" />
          <p className="text-gray-500 text-sm">Loading ambulance fleet…</p>
        </div>
      )}

      {!loading && error && (
        <div className="card p-12 text-center max-w-md mx-auto">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-gray-900 font-semibold mb-1">Failed to load fleet</p>
          <p className="text-sm text-gray-500 mb-4">{error.message}</p>
          <button onClick={() => window.location.reload()} className="btn-primary text-sm">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="card p-12 text-center text-gray-500">
          <AmbulanceIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-800 mb-1">No ambulances found</p>
          <p className="text-sm text-gray-500 mb-4">
            {search || statusFilter !== 'All'
              ? 'Try adjusting your search query or status filter.'
              : 'Add your first ambulance to start managing your fleet.'}
          </p>
          <button onClick={openAddModal} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Add Ambulance
          </button>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((amb) => {
            const attachedBooking = amb.currentBookingId ? bookingMap.get(amb.currentBookingId) : null;
            return (
              <div
                key={amb.id}
                className="card p-5 hover:shadow-card-hover transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Icon + Number Plate + Status */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                          amb.status === 'available'
                            ? 'bg-green-50 text-green-600'
                            : amb.status === 'booked'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        <AmbulanceIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-gray-900 tracking-wide text-base">
                            {amb.number}
                          </p>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          {renderTypeBadge(amb.type)}
                          <span className="text-xs text-gray-500 font-medium">Ambulance</span>
                        </div>
                      </div>
                    </div>
                    {renderStatusBadge(amb.status)}
                  </div>

                  {/* Attached Booking Section */}
                  <div className="rounded-xl bg-gray-50 p-3.5 mb-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        Current Assignment
                      </p>
                      {amb.status === 'booked' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                          Allocated
                        </span>
                      )}
                    </div>
                    {amb.currentBookingId ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-brand-600">
                            {attachedBooking?.bookingCode || `ID: ${amb.currentBookingId.slice(0, 8)}`}
                          </span>
                          <button
                            onClick={() => navigate(`/booking-details?id=${amb.currentBookingId}`)}
                            className="text-xs text-brand-600 hover:text-brand-800 flex items-center gap-1 font-medium"
                            title="View booking details"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-700 truncate">
                          <span className="text-gray-400">Patient:</span>{' '}
                          <strong className="text-gray-900">
                            {attachedBooking?.patientName || attachedBooking?.userId || 'Unknown'}
                          </strong>
                        </p>
                        {attachedBooking?.pickup && attachedBooking?.destination && (
                          <p className="text-[11px] text-gray-500 truncate" title={`${attachedBooking.pickup} → ${attachedBooking.destination}`}>
                            {attachedBooking.pickup} → {attachedBooking.destination}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No active booking attached</p>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => openEditModal(amb)}
                    className="flex-1 btn-ghost text-xs py-2 flex items-center justify-center gap-1.5 text-gray-700 hover:text-gray-900"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setDeletingAmbulance(amb)}
                    className="flex-1 btn-ghost text-xs py-2 flex items-center justify-center gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Ambulance Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-gray-900">Add Ambulance</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {actionError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Number Plate / Registration <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                  className="input-field uppercase font-mono tracking-wide"
                  placeholder="e.g. KA 01 AB 1234"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Ambulance Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="input-field"
                >
                  {AMBULANCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Initial Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as AmbulanceStatus })
                  }
                  className="input-field"
                >
                  <option value="available">Available</option>
                  <option value="booked">Booked</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-ghost flex-1 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 text-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Ambulance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Ambulance Modal */}
      {editingAmbulance && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => setEditingAmbulance(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Edit2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg text-gray-900">Edit Ambulance</h3>
              </div>
              <button
                onClick={() => setEditingAmbulance(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {actionError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Number Plate <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                  className="input-field uppercase font-mono tracking-wide"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Ambulance Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="input-field"
                >
                  {AMBULANCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as AmbulanceStatus })
                  }
                  className="input-field"
                >
                  <option value="available">Available</option>
                  <option value="booked">Booked</option>
                  <option value="maintenance">Maintenance</option>
                </select>
                {editingAmbulance.currentBookingId && form.status === 'available' && (
                  <p className="text-xs text-amber-600 mt-1">
                    Setting status to Available will clear the attached booking ({editingAmbulance.currentBookingId.slice(0, 8)}).
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingAmbulance(null)}
                  className="btn-ghost flex-1 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 text-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAmbulance && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => setDeletingAmbulance(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-gray-900 text-center mb-1">
              Delete Ambulance?
            </h3>
            <p className="text-xs text-gray-500 text-center mb-4">
              Are you sure you want to delete ambulance{' '}
              <span className="font-semibold text-gray-900">{deletingAmbulance.number}</span>?
              This action cannot be undone.
            </p>

            {deletingAmbulance.currentBookingId && (
              <div className="p-3 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                <p className="font-semibold mb-0.5">Warning: Active Booking Attached</p>
                <p>This ambulance is currently assigned to booking {deletingAmbulance.currentBookingId.slice(0, 8)}.</p>
              </div>
            )}

            {actionError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
                {actionError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingAmbulance(null)}
                className="btn-ghost flex-1 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex-1 flex items-center justify-center"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
