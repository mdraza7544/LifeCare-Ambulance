import { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Phone,
  Edit2,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coffee,
  ExternalLink,
  X,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import {
  useDrivers,
  useBookings,
  createDriver,
  updateDriver,
  deleteDriver,
  type Driver,
  type DriverStatus,
} from '@/lib/firestoreService';
import { processQueue } from '@/lib/dispatchService';
import { useApp } from '@/lib/context';

type StatusFilter = 'All' | DriverStatus;

interface DriverFormData {
  name: string;
  phone: string;
  license: string;
  status: DriverStatus;
}

const DEFAULT_FORM: DriverFormData = {
  name: '',
  phone: '',
  license: '',
  status: 'available',
};

export default function AdminDrivers() {
  const { navigate } = useApp();
  const { data: drivers, loading, error } = useDrivers();
  const { data: bookings } = useBookings();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);

  const [form, setForm] = useState<DriverFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Map of bookingId -> Booking for resolving attached booking details
  const bookingMap = new Map((bookings ?? []).map((b) => [b.id, b]));

  // Metrics
  const totalDrivers = drivers.length;
  const availableCount = drivers.filter((d) => d.status === 'available').length;
  const allocatedCount = drivers.filter((d) => d.status === 'allocated').length;
  const offDutyCount = drivers.filter((d) => d.status === 'off-duty').length;

  const filtered = drivers.filter((d) => {
    const q = search.trim().toLowerCase();
    const attachedBooking = d.currentBookingId ? bookingMap.get(d.currentBookingId) : null;
    const bookingCode = attachedBooking?.bookingCode?.toLowerCase() ?? '';
    const patient = attachedBooking?.patientName?.toLowerCase() ?? '';

    const matchesSearch =
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.phone.toLowerCase().includes(q) ||
      (d.license && d.license.toLowerCase().includes(q)) ||
      (d.currentBookingId && d.currentBookingId.toLowerCase().includes(q)) ||
      bookingCode.includes(q) ||
      patient.includes(q);

    const matchesStatus = statusFilter === 'All' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openAddModal = () => {
    setActionError(null);
    setForm(DEFAULT_FORM);
    setShowAddModal(true);
  };

  const openEditModal = (driver: Driver) => {
    setActionError(null);
    setEditingDriver(driver);
    setForm({
      name: driver.name,
      phone: driver.phone,
      license: driver.license || '',
      status: driver.status,
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.license.trim()) {
      setActionError('Name, phone, and license number are required.');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await createDriver({
        name: form.name.trim(),
        phone: form.phone.trim(),
        license: form.license.trim().toUpperCase(),
        status: form.status,
      });
      processQueue().catch((qErr) => console.warn('[AdminDrivers] processQueue warning:', qErr));
      setShowAddModal(false);
      setForm(DEFAULT_FORM);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create driver.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;
    if (!form.name.trim() || !form.phone.trim() || !form.license.trim()) {
      setActionError('Name, phone, and license number are required.');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await updateDriver(editingDriver.id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        license: form.license.trim().toUpperCase(),
        status: form.status,
        ...(form.status === 'available' ? { currentBookingId: null } : {}),
      });
      processQueue().catch((qErr) => console.warn('[AdminDrivers] processQueue warning:', qErr));
      setEditingDriver(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update driver.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDriver) return;
    setSaving(true);
    setActionError(null);
    try {
      await deleteDriver(deletingDriver.id);
      setDeletingDriver(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete driver.');
    } finally {
      setSaving(false);
    }
  };

  const renderStatusBadge = (status: DriverStatus) => {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Available
          </span>
        );
      case 'allocated':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Allocated
          </span>
        );
      case 'off-duty':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Off Duty
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

  return (
    <AdminLayout title="Driver Management">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Drivers</p>
            <p className="text-xl font-bold text-gray-900">{totalDrivers}</p>
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
            <p className="text-xs text-gray-500 font-medium">Allocated / On Duty</p>
            <p className="text-xl font-bold text-blue-600">{allocatedCount}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Off Duty</p>
            <p className="text-xl font-bold text-gray-600">{offDutyCount}</p>
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
            placeholder="Search driver name, phone, license, booking ID..."
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
            <option value="allocated">Allocated</option>
            <option value="off-duty">Off Duty</option>
          </select>
        </div>

        <button onClick={openAddModal} className="btn-primary text-sm whitespace-nowrap">
          <Plus className="w-4 h-4" /> Add Driver
        </button>
      </div>

      {/* Main Content */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-3" />
          <p className="text-gray-500 text-sm">Loading driver workforce…</p>
        </div>
      )}

      {!loading && error && (
        <div className="card p-12 text-center max-w-md mx-auto">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-gray-900 font-semibold mb-1">Failed to load drivers</p>
          <p className="text-sm text-gray-500 mb-4">{error.message}</p>
          <button onClick={() => window.location.reload()} className="btn-primary text-sm">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="card p-12 text-center text-gray-500">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-800 mb-1">No drivers found</p>
          <p className="text-sm text-gray-500 mb-4">
            {search || statusFilter !== 'All'
              ? 'Try adjusting your search query or status filter.'
              : 'Add your first driver to start dispatching bookings.'}
          </p>
          <button onClick={openAddModal} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Add Driver
          </button>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((driver) => {
            const attachedBooking = driver.currentBookingId ? bookingMap.get(driver.currentBookingId) : null;
            return (
              <div
                key={driver.id}
                className="card p-5 hover:shadow-card-hover transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Avatar + Name + Status */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
                        {driver.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-extrabold text-gray-900 text-base leading-tight">
                          {driver.name}
                        </p>
                        <a
                          href={`tel:${driver.phone.replace(/\s/g, '')}`}
                          className="text-xs text-brand-600 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <Phone className="w-3 h-3" /> {driver.phone}
                        </a>
                      </div>
                    </div>
                    {renderStatusBadge(driver.status)}
                  </div>

                  {/* Driver Meta info */}
                  <div className="space-y-1.5 text-xs text-gray-600 mb-3 px-1">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">License:</span>
                      <span className="font-mono font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                        {driver.license || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Attached Booking Section (Requirement 4) */}
                  <div className="rounded-xl bg-gray-50 p-3.5 mb-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        Current Assignment
                      </p>
                      {driver.status === 'allocated' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                          Allocated
                        </span>
                      )}
                    </div>
                    {driver.currentBookingId ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-brand-600">
                            {attachedBooking?.bookingCode || `ID: ${driver.currentBookingId.slice(0, 8)}`}
                          </span>
                          <button
                            onClick={() => navigate(`/booking-details?id=${driver.currentBookingId}`)}
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
                          <p
                            className="text-[11px] text-gray-500 truncate"
                            title={`${attachedBooking.pickup} → ${attachedBooking.destination}`}
                          >
                            {attachedBooking.pickup} → {attachedBooking.destination}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No active booking assigned</p>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => openEditModal(driver)}
                    className="flex-1 btn-ghost text-xs py-2 flex items-center justify-center gap-1.5 text-gray-700 hover:text-gray-900"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setDeletingDriver(driver)}
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

      {/* Add Driver Modal */}
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
                <h3 className="font-bold text-lg text-gray-900">Add Driver</h3>
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
                  Driver Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-field"
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input-field"
                  placeholder="e.g. +91 98765 43210"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  License Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.license}
                  onChange={(e) => setForm({ ...form, license: e.target.value })}
                  className="input-field font-mono uppercase"
                  placeholder="e.g. DL-0420210005678"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Initial Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as DriverStatus })}
                  className="input-field"
                >
                  <option value="available">Available</option>
                  <option value="allocated">Allocated</option>
                  <option value="off-duty">Off Duty</option>
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
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Driver Modal */}
      {editingDriver && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => setEditingDriver(null)}
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
                <h3 className="font-bold text-lg text-gray-900">Edit Driver</h3>
              </div>
              <button
                onClick={() => setEditingDriver(null)}
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
                  Driver Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  License Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.license}
                  onChange={(e) => setForm({ ...form, license: e.target.value })}
                  className="input-field font-mono uppercase"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as DriverStatus })}
                  className="input-field"
                >
                  <option value="available">Available</option>
                  <option value="allocated">Allocated</option>
                  <option value="off-duty">Off Duty</option>
                </select>
                {editingDriver.currentBookingId && form.status === 'available' && (
                  <p className="text-xs text-amber-600 mt-1">
                    Setting status to Available will clear the attached booking ({editingDriver.currentBookingId.slice(0, 8)}).
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingDriver(null)}
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
      {deletingDriver && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => setDeletingDriver(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-gray-900 text-center mb-1">
              Delete Driver?
            </h3>
            <p className="text-xs text-gray-500 text-center mb-4">
              Are you sure you want to delete driver{' '}
              <span className="font-semibold text-gray-900">{deletingDriver.name}</span>?
              This action cannot be undone.
            </p>

            {deletingDriver.currentBookingId && (
              <div className="p-3 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                <p className="font-semibold mb-0.5">Warning: Active Booking Attached</p>
                <p>This driver is currently assigned to booking {deletingDriver.currentBookingId.slice(0, 8)}.</p>
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
                onClick={() => setDeletingDriver(null)}
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
