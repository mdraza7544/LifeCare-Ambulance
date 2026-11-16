import { useState } from 'react';
import { Calendar, Search, Ambulance, Filter } from 'lucide-react';
import { useApp } from '@/lib/context';
import { PageHeader, EmptyState } from '@/components/UI';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { BookingStatus } from '@/lib/types';

export default function MyBookingsPage() {
  const { bookings, navigate } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | BookingStatus>('All');

  const filtered = bookings.filter((b) => {
    const matchSearch = b.bookingCode.toLowerCase().includes(search.toLowerCase()) || b.patientName.toLowerCase().includes(search.toLowerCase()) || b.destination.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || b.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      <PageHeader title="My Bookings" subtitle="View and manage all your ambulance bookings" icon={<Calendar className="w-5 h-5" />} />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" placeholder="Search by booking ID, name, or hospital..." />
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
        <EmptyState icon={<Ambulance className="w-8 h-8" />} title="No bookings found" message="Try adjusting your search or filter, or book a new ambulance." action={<button onClick={() => navigate('/book')} className="btn-primary">Book Ambulance</button>} />
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="card p-5 hover:shadow-card-hover transition-shadow cursor-pointer" onClick={() => navigate(`/booking-details?id=${b.id}`)}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                  <Ambulance className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{b.bookingCode}</p>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{b.patientName} - {b.ambulanceType} Ambulance</p>
                  <p className="text-xs text-gray-500 mt-0.5">{b.pickup} → {b.destination}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(b.scheduledFor)}</p>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1">
                  <p className="font-extrabold text-brand-600 text-lg">{formatCurrency(b.amount)}</p>
                  <button onClick={(e) => { e.stopPropagation(); navigate(`/booking-details?id=${b.id}`); }} className="text-sm font-semibold text-brand-600 hover:underline">View Details</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
