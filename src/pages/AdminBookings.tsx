import { useState } from 'react';
import { Search, Filter, Eye, X, Calendar, Loader2, Car, UserPlus } from 'lucide-react';
import { useApp } from '@/lib/context';
import { assignDriverToBooking } from '@/lib/db';
import AdminLayout from '@/components/AdminLayout';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { BookingStatus } from '@/lib/types';
import { EmptyState } from '@/components/UI';

export default function AdminBookings() {
  const { bookings, updateBookingStatus } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | BookingStatus>('All');
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = bookings.filter((b) => {
    const ms = b.bookingCode.toLowerCase().includes(search.toLowerCase()) || b.patientName.toLowerCase().includes(search.toLowerCase());
    return ms && (filter === 'All' || b.status === filter);
  });

  const booking = bookings.find((b) => b.id === selected);

  const [assignUid, setAssignUid] = useState('');
  const [assignName, setAssignName] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleAssignDriver = async () => {
    if (!booking || !assignUid.trim()) return;
    setAssigning(true);
    setAssignMsg(null);
    try {
      await assignDriverToBooking(booking.id, assignUid.trim(), assignName.trim());
      setAssignMsg({ ok: true, text: 'Driver assigned. They can now verify the pickup PIN.' });
      setAssignUid('');
      setAssignName('');
    } catch (err) {
      setAssignMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not assign driver.' });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <AdminLayout title="Bookings">
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" placeholder="Search bookings..." />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={filter} onChange={(e) => setFilter(e.target.value as 'All' | BookingStatus)} className="input-field w-auto">
            <option value="All">All Status</option>
            <option value="Scheduled">Scheduled</option>
            <option value="On Going">On Going</option>
            <option value="Verified">Verified</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Calendar className="w-8 h-8" />} title="No bookings found" message="Try adjusting your search or filter." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-5 py-3">Booking ID</th>
                  <th className="px-5 py-3">Patient Name</th>
                  <th className="px-5 py-3">From</th>
                  <th className="px-5 py-3">To</th>
                  <th className="px-5 py-3">Date & Time</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-sm font-bold text-brand-600">{b.bookingCode}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-gray-900">{b.patientName}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{b.pickup}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{b.destination}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{formatDateTime(b.scheduledFor)}</td>
                    <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-5 py-3 text-sm font-bold text-gray-900">{formatCurrency(b.amount)}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => setSelected(b.id)} className="p-1.5 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600 transition-colors"><Eye className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900">Booking {booking.bookingCode}</h3>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-gray-50"><p className="text-xs text-gray-500">Patient</p><p className="font-semibold text-gray-900">{booking.patientName}</p></div>
                <div className="p-3 rounded-lg bg-gray-50"><p className="text-xs text-gray-500">Phone</p><p className="font-semibold text-gray-900">{booking.phone}</p></div>
                <div className="p-3 rounded-lg bg-gray-50"><p className="text-xs text-gray-500">Pickup</p><p className="font-semibold text-gray-900">{booking.pickup}</p></div>
                <div className="p-3 rounded-lg bg-gray-50"><p className="text-xs text-gray-500">Destination</p><p className="font-semibold text-gray-900">{booking.destination}</p></div>
                <div className="p-3 rounded-lg bg-gray-50"><p className="text-xs text-gray-500">Ambulance Type</p><p className="font-semibold text-gray-900">{booking.ambulanceType}</p></div>
                <div className="p-3 rounded-lg bg-gray-50"><p className="text-xs text-gray-500">Emergency Level</p><p className="font-semibold text-gray-900">{booking.emergencyLevel}</p></div>
                <div className="p-3 rounded-lg bg-gray-50"><p className="text-xs text-gray-500">Amount</p><p className="font-semibold text-brand-600">{formatCurrency(booking.amount)}</p></div>
                <div className="p-3 rounded-lg bg-gray-50"><p className="text-xs text-gray-500">Payment</p><p className="font-semibold text-gray-900">{booking.paymentMethod}</p></div>
                <div className="p-3 rounded-lg bg-gray-50 col-span-2"><p className="text-xs text-gray-500">Assigned Driver</p><p className="font-semibold text-gray-900">{booking.assignedDriverName ? `${booking.assignedDriverName}${booking.assignedDriverUid ? ` · ${booking.assignedDriverUid.slice(0, 8)}…` : ''}` : 'No driver assigned yet'}</p></div>
              </div>

              {/* Assign a driver so they can verify the pickup PIN */}
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><Car className="w-4 h-4 text-brand-500" /> Assign Driver</p>
                <p className="text-xs text-gray-500 mb-3">Enter the driver's account UID (and name). Only the assigned driver can verify this booking's pickup PIN.</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input type="text" value={assignUid} onChange={(e) => setAssignUid(e.target.value)} className="input-field text-sm" placeholder="Driver UID" />
                  <input type="text" value={assignName} onChange={(e) => setAssignName(e.target.value)} className="input-field text-sm" placeholder="Driver name (optional)" />
                </div>
                {assignMsg && (
                  <p className={`text-xs mb-2 ${assignMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{assignMsg.text}</p>
                )}
                <button onClick={handleAssignDriver} disabled={!assignUid.trim() || assigning} className="btn-primary text-sm">
                  {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4" /> Assign Driver</>}
                </button>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Update Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['Scheduled', 'On Going', 'Verified', 'Completed', 'Cancelled'] as BookingStatus[]).map((s) => (
                    <button key={s} onClick={() => { updateBookingStatus(booking.id, s); setSelected(null); }} className={`px-3 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${booking.status === s ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-600 hover:border-brand-200'}`}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
