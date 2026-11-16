import { Calendar, Users, Ambulance, Wallet, MoreVertical, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useApp } from '@/lib/context';
import { mockUsers, mockAmbulances, mockPayments } from '@/lib/mockData';
import AdminLayout from '@/components/AdminLayout';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useState } from 'react';

export default function AdminDashboard() {
  const { bookings, navigate } = useApp();
  const [chartPeriod, setChartPeriod] = useState<'Week' | 'Month' | 'Year'>('Week');

  const totalRevenue = mockPayments.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);

  // Booking Overview chart data
  const weekData = [12, 19, 15, 22, 28, 18, 25];
  const monthData = [45, 52, 38, 60, 48, 55, 42, 58, 50, 63, 47, 59];
  const yearData = [180, 210, 195, 240, 220, 260, 250, 280, 245, 290, 270, 310];
  const chartData = chartPeriod === 'Week' ? weekData : chartPeriod === 'Month' ? monthData : yearData;
  const chartLabels = chartPeriod === 'Week' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : chartPeriod === 'Month' ? ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const maxVal = Math.max(...chartData);

  // Booking Status breakdown
  const statusBreakdown = [
    { label: 'Completed', value: bookings.filter((b) => b.status === 'Completed').length, color: 'bg-green-500' },
    { label: 'On Going', value: bookings.filter((b) => b.status === 'On Going').length, color: 'bg-blue-500' },
    { label: 'Scheduled', value: bookings.filter((b) => b.status === 'Scheduled').length, color: 'bg-amber-500' },
    { label: 'Cancelled', value: bookings.filter((b) => b.status === 'Cancelled').length, color: 'bg-brand-500' },
  ];
  const totalStatus = statusBreakdown.reduce((s, x) => s + x.value, 0) || 1;

  return (
    <AdminLayout title="Dashboard">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600"><Calendar className="w-5 h-5" /></div>
            <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" /> 12%</span>
          </div>
          <p className="text-sm text-gray-500 font-medium">Total Bookings</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{bookings.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Users className="w-5 h-5" /></div>
            <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" /> 8%</span>
          </div>
          <p className="text-sm text-gray-500 font-medium">Total Users</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{mockUsers.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center text-green-600"><Ambulance className="w-5 h-5" /></div>
            <span className="text-xs font-semibold text-brand-600 flex items-center gap-0.5"><ArrowDownRight className="w-3 h-3" /> 2%</span>
          </div>
          <p className="text-sm text-gray-500 font-medium">Total Ambulances</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{mockAmbulances.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><Wallet className="w-5 h-5" /></div>
            <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" /> 18%</span>
          </div>
          <p className="text-sm text-gray-500 font-medium">Total Revenue</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{formatCurrency(totalRevenue)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Booking Overview */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-gray-900">Booking Overview</h3>
              <p className="text-xs text-gray-500 mt-0.5">Number of bookings over time</p>
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['Week', 'Month', 'Year'] as const).map((p) => (
                <button key={p} onClick={() => setChartPeriod(p)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${chartPeriod === p ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{p}</button>
              ))}
            </div>
          </div>
          <div className="flex items-end justify-between gap-2 h-48">
            {chartData.map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end justify-center h-full">
                  <div className="w-full max-w-[32px] rounded-t-lg bg-gradient-to-t from-brand-500 to-brand-400 transition-all duration-500 hover:from-brand-600 hover:to-brand-500 relative group" style={{ height: `${(val / maxVal) * 100}%` }}>
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">{val}</span>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 font-medium">{chartLabels[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Booking Status */}
        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-1">Booking Status</h3>
          <p className="text-xs text-gray-500 mb-5">Current distribution</p>
          <div className="flex items-center justify-center mb-5">
            <div className="relative w-36 h-36">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {(() => {
                  let offset = 0;
                  return statusBreakdown.map((s, i) => {
                    const pct = (s.value / totalStatus) * 100;
                    const dash = (pct / 100) * 251.2;
                    const el = <circle key={i} cx="50" cy="50" r="40" fill="none" strokeWidth="12" strokeDasharray={`${dash} 251.2`} strokeDashoffset={-offset} className={s.color.replace('bg-', 'stroke-')} strokeLinecap="round" />;
                    offset += dash;
                    return el;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-extrabold text-gray-900">{bookings.length}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {statusBreakdown.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${s.color}`} /><span className="text-gray-600">{s.label}</span></div>
                <span className="font-semibold text-gray-900">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-gray-900">Recent Bookings</h3>
            <p className="text-xs text-gray-500 mt-0.5">Latest ambulance booking requests</p>
          </div>
          <button onClick={() => navigate('/admin/bookings')} className="text-sm font-semibold text-brand-600 hover:underline">View All</button>
        </div>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="pb-3 pr-4">Booking ID</th>
                <th className="pb-3 pr-4">Patient Name</th>
                <th className="pb-3 pr-4">From</th>
                <th className="pb-3 pr-4">To</th>
                <th className="pb-3 pr-4">Date & Time</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Amount</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {bookings.slice(0, 6).map((b) => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 pr-4 text-sm font-bold text-brand-600">{b.bookingCode}</td>
                  <td className="py-3 pr-4 text-sm font-semibold text-gray-900">{b.patientName}</td>
                  <td className="py-3 pr-4 text-sm text-gray-600">{b.pickup}</td>
                  <td className="py-3 pr-4 text-sm text-gray-600">{b.destination}</td>
                  <td className="py-3 pr-4 text-sm text-gray-600">{formatDateTime(b.scheduledFor)}</td>
                  <td className="py-3 pr-4"><StatusBadge status={b.status} /></td>
                  <td className="py-3 pr-4 text-sm font-bold text-gray-900">{formatCurrency(b.amount)}</td>
                  <td className="py-3">
                    <button onClick={() => navigate(`/admin/bookings`)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><MoreVertical className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
