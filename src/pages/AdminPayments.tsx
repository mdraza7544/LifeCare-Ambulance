import { Search, Filter, CreditCard, Wallet, TrendingUp, Download } from 'lucide-react';
import { useState } from 'react';
import { mockPayments } from '@/lib/mockData';
import AdminLayout from '@/components/AdminLayout';
import { formatCurrency, formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/UI';

export default function AdminPayments() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Paid' | 'Pending' | 'Refunded'>('All');

  const filtered = mockPayments.filter((p) => {
    const ms = p.bookingCode.toLowerCase().includes(search.toLowerCase()) || p.patientName.toLowerCase().includes(search.toLowerCase());
    return ms && (filter === 'All' || p.status === filter);
  });

  const totalPaid = mockPayments.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const totalPending = mockPayments.filter((p) => p.status === 'Pending').reduce((s, p) => s + p.amount, 0);
  const totalRefunded = mockPayments.filter((p) => p.status === 'Refunded').reduce((s, p) => s + p.amount, 0);

  const statusColor = (s: string) => s === 'Paid' ? 'bg-green-50 text-green-700 border-green-200' : s === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-brand-700 border-brand-200';

  return (
    <AdminLayout title="Payments">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center text-green-600"><Wallet className="w-5 h-5" /></div>
          </div>
          <p className="text-sm text-gray-500 font-medium">Total Paid</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><CreditCard className="w-5 h-5" /></div>
          </div>
          <p className="text-sm text-gray-500 font-medium">Pending</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{formatCurrency(totalPending)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center text-brand-600"><TrendingUp className="w-5 h-5" /></div>
          </div>
          <p className="text-sm text-gray-500 font-medium">Refunded</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{formatCurrency(totalRefunded)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" placeholder="Search payments..." />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={filter} onChange={(e) => setFilter(e.target.value as 'All' | 'Paid' | 'Pending' | 'Refunded')} className="input-field w-auto">
            <option value="All">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Refunded">Refunded</option>
          </select>
        </div>
        <button className="btn-secondary text-sm"><Download className="w-4 h-4" /> Export</button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<CreditCard className="w-8 h-8" />} title="No payments found" message="Try adjusting your search or filter." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                  <th className="px-5 py-3">Booking ID</th>
                  <th className="px-5 py-3">Patient Name</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-sm font-bold text-brand-600">{p.bookingCode}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-gray-900">{p.patientName}</td>
                    <td className="px-5 py-3 text-sm font-bold text-gray-900">{formatCurrency(p.amount)}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{p.method}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{formatDate(p.date)}</td>
                    <td className="px-5 py-3"><span className={`status-badge ${statusColor(p.status)}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
