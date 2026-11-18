import { useState, useMemo } from 'react';
import {
  Calendar,
  Users,
  Ambulance,
  Wallet,
  MoreVertical,
  ArrowUpRight,
  UserCheck,
  Clock,
  Layers,
} from 'lucide-react';
import { useApp } from '@/lib/context';
import {
  useBookings,
  useAmbulances,
  useDrivers,
  useUsers,
  usePayments,
} from '@/lib/firestoreService';
import { getAdminStats, getAdminChartData } from '@/lib/dashboardStats';
import AdminLayout from '@/components/AdminLayout';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/utils';

function AdminStatSkeleton() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 rounded-xl bg-gray-200" />
        <div className="w-12 h-4 bg-gray-200 rounded" />
      </div>
      <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
      <div className="h-7 w-20 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-32 bg-gray-100 rounded" />
    </div>
  );
}

export default function AdminDashboard() {
  const { navigate } = useApp();
  const { data: bookings, loading: bookingsLoading } = useBookings();
  const { data: ambulances, loading: ambulancesLoading } = useAmbulances();
  const { data: drivers, loading: driversLoading } = useDrivers();
  const { data: users, loading: usersLoading } = useUsers();
  const { data: payments, loading: paymentsLoading } = usePayments();

  const [chartPeriod, setChartPeriod] = useState<'Week' | 'Month' | 'Year'>('Week');

  const isLoading =
    bookingsLoading || ambulancesLoading || driversLoading || usersLoading || paymentsLoading;

  // Single shared stats calculation via pure helper
  const stats = useMemo(
    () => getAdminStats({ bookings, ambulances, drivers, users, payments }),
    [bookings, ambulances, drivers, users, payments],
  );

  // Dynamic booking overview chart data from real Firestore bookings
  const { labels: chartLabels, data: chartData } = useMemo(
    () => getAdminChartData(bookings, chartPeriod),
    [bookings, chartPeriod],
  );

  const maxVal = Math.max(...chartData, 1);

  // Status breakdown list with live counts
  const statusBreakdown = useMemo(() => {
    return [
      { label: 'Pending', value: stats.pending, color: 'bg-amber-400' },
      { label: 'Accepted (Unpaid)', value: stats.accepted, color: 'bg-yellow-500' },
      { label: 'Confirmed (Paid)', value: stats.confirmed, color: 'bg-emerald-500' },
      { label: 'Allocated (En Route)', value: stats.allocated, color: 'bg-blue-500' },
      { label: 'Completed', value: stats.completed, color: 'bg-green-600' },
      { label: 'In Queue', value: stats.queueLength, color: 'bg-purple-500' },
      {
        label: 'Cancelled / Rejected / Expired',
        value: stats.cancelled + stats.rejected + stats.expired,
        color: 'bg-rose-500',
      },
    ];
  }, [stats]);

  return (
    <AdminLayout title="Dashboard">
      {/* 5 Real-Time Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {isLoading ? (
          <>
            <AdminStatSkeleton />
            <AdminStatSkeleton />
            <AdminStatSkeleton />
            <AdminStatSkeleton />
            <AdminStatSkeleton />
          </>
        ) : (
          <>
            {/* Total Bookings */}
            <div className="card p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <ArrowUpRight className="w-3 h-3" /> Live
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">Total Bookings</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{stats.totalBookings}</p>
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                <span>Pending: <b className="text-amber-600">{stats.pending}</b></span>
                <span>Active: <b className="text-blue-600">{stats.allocated}</b></span>
                <span>Done: <b className="text-green-600">{stats.completed}</b></span>
              </div>
            </div>

            {/* Total Revenue (from Payments collection) */}
            <div className="card p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Wallet className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <ArrowUpRight className="w-3 h-3" /> Paid
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">Total Revenue</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-0.5 truncate">
                {formatCurrency(stats.earnings.total)}
              </p>
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                <span>Today: <b className="text-gray-900">{formatCurrency(stats.earnings.today)}</b></span>
                <span>Month: <b className="text-gray-900">{formatCurrency(stats.earnings.thisMonth)}</b></span>
              </div>
            </div>

            {/* Ambulances */}
            <div className="card p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Ambulance className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Fleet
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">Ambulances</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{stats.ambulances.total}</p>
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                <span title="Available"><b className="text-emerald-600">{stats.ambulances.available}</b> Free</span>
                <span title="Booked"><b className="text-blue-600">{stats.ambulances.booked}</b> Busy</span>
                <span title="Maintenance"><b className="text-gray-500">{stats.ambulances.maintenance}</b> Maint</span>
              </div>
            </div>

            {/* Drivers */}
            <div className="card p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <UserCheck className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Staff
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">Drivers</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{stats.drivers.total}</p>
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                <span title="Available"><b className="text-emerald-600">{stats.drivers.available}</b> Free</span>
                <span title="Allocated"><b className="text-blue-600">{stats.drivers.allocated}</b> On duty</span>
                <span title="Off duty"><b className="text-gray-500">{stats.drivers.offDuty}</b> Off</span>
              </div>
            </div>

            {/* Users */}
            <div className="card p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                  Clients
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">Total Users</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{stats.totalUsers}</p>
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                <span>New Today: <b className="text-blue-600">+{stats.newUsersToday}</b></span>
                {stats.queueLength > 0 && (
                  <span className="text-purple-600 font-bold flex items-center gap-0.5">
                    <Clock className="w-3 h-3" /> Q: {stats.queueLength}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Charts & Status Breakdown */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Booking Overview Chart */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="font-bold text-gray-900">Booking Overview</h3>
              <p className="text-xs text-gray-500 mt-0.5">Real-time ambulance booking requests (Asia/Kolkata)</p>
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

        {/* Status Breakdown Card */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-gray-900">Status Breakdown</h3>
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> All Bookings
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-4">Live distribution of all dispatch states</p>

          <div className="flex items-center justify-center my-3">
            <div className="relative w-32 h-32 rounded-full border-8 border-gray-100 flex items-center justify-center bg-gray-50/50">
              <div className="text-center">
                <span className="text-2xl font-extrabold text-gray-900">{stats.totalBookings}</span>
                <span className="text-[11px] text-gray-500 block">Total</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            {statusBreakdown.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${s.color}`} />
                  <span className="text-gray-600">{s.label}</span>
                </div>
                <span className="font-semibold text-gray-900">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Bookings Table (Directly from live data) */}
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
            View All ({stats.totalBookings})
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
                bookings.slice(0, 8).map((b) => (
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
