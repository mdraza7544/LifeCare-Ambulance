import { Calendar, Users, Ambulance, Wallet, MoreVertical, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useApp } from '@/lib/context';
import { useUsers, useAmbulances, useBookings } from '@/lib/firestoreService';
import AdminLayout from '@/components/AdminLayout';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useState, useMemo } from 'react';

export default function AdminDashboard() {
  const { navigate } = useApp();
  const { data: users } = useUsers();
  const { data: ambulances } = useAmbulances();
  const { data: bookings } = useBookings();
  const [chartPeriod, setChartPeriod] = useState<'Week' | 'Month' | 'Year'>('Week');

  // Compute real revenue from completed or paid bookings
  const totalRevenue = useMemo(() => {
    return bookings
      .filter(
        (b) =>
          b.status === 'completed' ||
          b.paymentStatus === 'paid' ||
          String(b.status).toLowerCase() === 'completed'
      )
      .reduce((s, b) => s + (Number(b.amount) || 0), 0);
  }, [bookings]);

  // Dynamic booking overview chart data from real Firestore bookings
  const chartLabels = useMemo(() => {
    if (chartPeriod === 'Week') {
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    }
    if (chartPeriod === 'Month') {
      return ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'];
    }
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  }, [chartPeriod]);

  const chartData = useMemo(() => {
    const counts = new Array(chartLabels.length).fill(0);
    const now = new Date();
    const currentYear = now.getFullYear();

    bookings.forEach((b) => {
      const d = new Date(b.createdAt || b.scheduledTime);
      if (isNaN(d.getTime())) return;

      if (chartPeriod === 'Week') {
        // Group by day of week (Mon = 0, Sun = 6)
        const dayIdx = (d.getDay() + 6) % 7;
        counts[dayIdx] += 1;
      } else if (chartPeriod === 'Month') {
        if (d.getFullYear() === currentYear) {
          const monthIdx = d.getMonth();
          if (monthIdx < counts.length) counts[monthIdx] += 1;
        }
      } else {
        // Year: group by month of current year
        if (d.getFullYear() === currentYear) {
          const monthIdx = d.getMonth();
          counts[monthIdx] += 1;
        }
      }
    });

    return counts;
  }, [bookings, chartPeriod, chartLabels.length]);

  const maxVal = Math.max(...chartData, 1);

  // Booking Status breakdown from real bookings
  const statusBreakdown = useMemo(() => {
    const normalize = (status: string) => status.toLowerCase();
    return [
      {
        label: 'Completed',
        value: bookings.filter((b) => normalize(b.status) === 'completed').length,
        color: 'bg-green-500',
      },
      {
        label: 'On Going / Allocated',
        value: bookings.filter(
          (b) => normalize(b.status) === 'allocated' || normalize(b.status) === 'on going'
        ).length,
        color: 'bg-blue-500',
      },
      {
        label: 'Accepted / Confirmed',
        value: bookings.filter(
          (b) =>
            normalize(b.status) === 'accepted' ||
            normalize(b.status) === 'confirmed' ||
            normalize(b.status) === 'scheduled'
        ).length,
        color: 'bg-amber-500',
      },
      {
        label: 'Cancelled / Rejected',
        value: bookings.filter(
          (b) => normalize(b.status) === 'cancelled' || normalize(b.status) === 'rejected'
        ).length,
        color: 'bg-brand-500',
      },
    ];
  }, [bookings]);

  return (
    <AdminLayout title="Dashboard">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" /> Live
            </span>
          </div>
          <p className="text-sm text-gray-500 font-medium">Total Bookings</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{bookings.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" /> Live
            </span>
          </div>
          <p className="text-sm text-gray-500 font-medium">Total Users</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{users.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
              <Ambulance className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-brand-600 flex items-center gap-0.5">
              <ArrowDownRight className="w-3 h-3" /> Fleet
            </span>
          </div>
          <p className="text-sm text-gray-500 font-medium">Total Ambulances</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{ambulances.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" /> Earned
            </span>
          </div>
          <p className="text-sm text-gray-500 font-medium">Total Revenue</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="font-bold text-gray-900">Booking Overview</h3>
              <p className="text-xs text-gray-500 mt-0.5">Real-time ambulance booking requests</p>
            </div>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {(['Week', 'Month', 'Year'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setChartPeriod(period)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    chartPeriod === period
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end justify-between gap-2 h-52 pt-6">
            {chartData.map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end justify-center h-full">
                  <div
                    className="w-full max-w-[32px] rounded-t-lg bg-brand-500 hover:bg-brand-600 transition-all duration-300 relative group cursor-pointer"
                    style={{ height: `${Math.max((val / maxVal) * 100, 4)}%` }}
                  >
                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-700 bg-white shadow px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                      {val} bookings
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 font-medium">{chartLabels[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-1">Status Breakdown</h3>
          <p className="text-xs text-gray-500 mb-6">Distribution of booking statuses</p>
          <div className="flex items-center justify-center my-4">
            <div className="relative w-36 h-36 rounded-full border-8 border-gray-100 flex items-center justify-center">
              <div className="text-center">
                <span className="text-2xl font-extrabold text-gray-900">{bookings.length}</span>
                <span className="text-[11px] text-gray-500 block">Total</span>
              </div>
            </div>
          </div>
          <div className="space-y-2 mt-4">
            {statusBreakdown.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                  <span className="text-gray-600 text-xs">{s.label}</span>
                </div>
                <span className="font-semibold text-gray-900 text-xs">{s.value}</span>
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
          <button
            onClick={() => navigate('/admin/bookings')}
            className="text-sm font-semibold text-brand-600 hover:underline"
          >
            View All
          </button>
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
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500 text-sm">
                    No bookings yet.
                  </td>
                </tr>
              ) : (
                bookings.slice(0, 6).map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="py-3 pr-4 text-sm font-bold text-brand-600">
                      {b.bookingCode || b.id.slice(0, 8)}
                    </td>
                    <td className="py-3 pr-4 text-sm font-semibold text-gray-900">
                      {b.patientName || '—'}
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-600 truncate max-w-[150px]">
                      {b.pickup}
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-600 truncate max-w-[150px]">
                      {b.destination}
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-600">
                      {formatDateTime(b.scheduledTime || b.createdAt)}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="py-3 pr-4 text-sm font-bold text-gray-900">
                      {formatCurrency(b.amount)}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => navigate('/admin/bookings')}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        title="Manage Booking"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
