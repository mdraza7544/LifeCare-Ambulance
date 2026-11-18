import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  CreditCard,
  Wallet,
  TrendingUp,
  Download,
  Loader2,
  Calendar,
  Clock,
  AlertCircle,
  XCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { usePayments, useBookings, useUsers, type PaymentStatus } from '@/lib/firestoreService';
import AdminLayout from '@/components/AdminLayout';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { EmptyState } from '@/components/UI';

const PAGE_SIZE = 10;

type StatusFilterOption = 'all' | PaymentStatus;
type DateRangeOption = 'all' | 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'custom';

export default function AdminPayments() {
  const { data: payments, loading: paymentsLoading, error: paymentsError } = usePayments();
  const { data: bookings } = useBookings();
  const { data: users } = useUsers();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all');
  const [dateRange, setDateRange] = useState<DateRangeOption>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Reset pagination to page 1 whenever filters or search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, dateRange, startDate, endDate]);

  // Lookup maps for rapid relational joins to users & bookings
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      map.set(u.id, u.name || u.email || 'User');
    }
    return map;
  }, [users]);

  const bookingMap = useMemo(() => {
    const map = new Map<string, (typeof bookings)[0]>();
    for (const b of bookings) {
      map.set(b.id, b);
    }
    return map;
  }, [bookings]);

  // Date comparison helpers
  const isToday = (isoDate: string): boolean => {
    if (!isoDate) return false;
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isYesterday = (isoDate: string): boolean => {
    if (!isoDate) return false;
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return false;
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return (
      d.getDate() === y.getDate() &&
      d.getMonth() === y.getMonth() &&
      d.getFullYear() === y.getFullYear()
    );
  };

  const isThisMonth = (isoDate: string): boolean => {
    if (!isoDate) return false;
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    return (
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  // 1. Summary Cards (Calculated directly from real Firestore data)
  const paidPayments = useMemo(
    () => payments.filter((p) => p.status === 'paid'),
    [payments],
  );

  const totalEarnings = useMemo(
    () => paidPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [paidPayments],
  );

  const todayEarnings = useMemo(
    () =>
      paidPayments
        .filter((p) => isToday(p.createdAt))
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [paidPayments],
  );

  const todayPaidCount = useMemo(
    () => paidPayments.filter((p) => isToday(p.createdAt)).length,
    [paidPayments],
  );

  const monthEarnings = useMemo(
    () =>
      paidPayments
        .filter((p) => isThisMonth(p.createdAt))
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [paidPayments],
  );

  const monthPaidCount = useMemo(
    () => paidPayments.filter((p) => isThisMonth(p.createdAt)).length,
    [paidPayments],
  );

  const pendingPayments = useMemo(
    () => payments.filter((p) => p.status === 'pending'),
    [payments],
  );

  const pendingTotal = useMemo(
    () => pendingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [pendingPayments],
  );

  const failedPayments = useMemo(
    () => payments.filter((p) => p.status === 'failed'),
    [payments],
  );

  const failedTotal = useMemo(
    () => failedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [failedPayments],
  );

  // 2. Filter & Search logic for transactions table
  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();

    return payments.filter((p) => {
      // Status filter
      if (statusFilter !== 'all' && p.status !== statusFilter) {
        return false;
      }

      // Date range filter
      if (dateRange === 'today' && !isToday(p.createdAt)) {
        return false;
      }
      if (dateRange === 'yesterday' && !isYesterday(p.createdAt)) {
        return false;
      }
      if (dateRange === 'thisMonth' && !isThisMonth(p.createdAt)) {
        return false;
      }
      if (dateRange === 'last7') {
        const d = new Date(p.createdAt);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (isNaN(d.getTime()) || d < sevenDaysAgo) return false;
      }
      if (dateRange === 'custom') {
        const d = new Date(p.createdAt);
        if (!isNaN(d.getTime())) {
          if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (d < start) return false;
          }
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (d > end) return false;
          }
        }
      }

      // Search query
      if (q) {
        const booking = bookingMap.get(p.bookingId);
        const bookingCode = booking?.bookingCode || p.bookingId;
        const userName = userMap.get(p.userId) || '';
        const patientName = booking?.patientName || '';
        const method = p.method || '';

        const matchId = p.id.toLowerCase().includes(q);
        const matchBooking = bookingCode.toLowerCase().includes(q);
        const matchUser = userName.toLowerCase().includes(q);
        const matchPatient = patientName.toLowerCase().includes(q);
        const matchMethod = method.toLowerCase().includes(q);

        if (!matchId && !matchBooking && !matchUser && !matchPatient && !matchMethod) {
          return false;
        }
      }

      return true;
    });
  }, [payments, search, statusFilter, dateRange, startDate, endDate, bookingMap, userMap]);

  // 3. Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedPayments = filteredPayments.slice(startIndex, startIndex + PAGE_SIZE);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDateRange('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const statusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Paid
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Pending
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <RotateCcw className="w-3 h-3 text-purple-600" /> Refunded
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" /> Failed
          </span>
        );
    }
  };

  const exportCsv = () => {
    const headers = [
      'Payment ID',
      'Booking Code',
      'Booking ID',
      'User Name',
      'Patient Name',
      'Amount (INR)',
      'Payment Method',
      'Status',
      'Date & Time',
    ];

    const rows = filteredPayments.map((p) => {
      const booking = bookingMap.get(p.bookingId);
      const bookingCode = booking?.bookingCode || p.bookingId;
      const userName = userMap.get(p.userId) || 'Anonymous';
      const patientName = booking?.patientName || '—';
      return [
        `"${p.id}"`,
        `"${bookingCode}"`,
        `"${p.bookingId}"`,
        `"${userName.replace(/"/g, '""')}"`,
        `"${patientName.replace(/"/g, '""')}"`,
        p.amount,
        `"${p.method || 'Razorpay'}"`,
        p.status,
        `"${p.createdAt}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `lifecare-payments-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const initialLoading = paymentsLoading && payments.length === 0;

  return (
    <AdminLayout title="Payments & Earnings">
      {/* Live Sync Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Firestore Sync
            </span>
            <span className="text-xs text-gray-400">
              {payments.length} record{payments.length === 1 ? '' : 's'} loaded
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Real-time payments and revenue tracking powered by Firestore listeners.
          </p>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          disabled={filteredPayments.length === 0}
          className="btn-secondary text-sm self-start sm:self-auto inline-flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Export CSV ({filteredPayments.length})
        </button>
      </div>

      {paymentsError && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Failed to sync payments: {paymentsError.message}</span>
        </div>
      )}

      {/* Summary Cards: Total Earnings, Today's Earnings, This Month, Pending Payments, Failed Payments */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Total Earnings */}
        <div className="card p-5 border-l-4 border-l-emerald-500 transition-all hover:shadow-md">
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Total Earnings
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 tracking-tight">
            {formatCurrency(totalEarnings)}
          </p>
          <p className="text-xs text-emerald-600 font-medium mt-1">
            {paidPayments.length} paid transaction{paidPayments.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Today's Earnings */}
        <div className="card p-5 border-l-4 border-l-blue-500 transition-all hover:shadow-md">
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Today's Earnings
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 tracking-tight">
            {formatCurrency(todayEarnings)}
          </p>
          <p className="text-xs text-blue-600 font-medium mt-1">
            {todayPaidCount} paid today
          </p>
        </div>

        {/* This Month */}
        <div className="card p-5 border-l-4 border-l-indigo-500 transition-all hover:shadow-md">
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              This Month
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 tracking-tight">
            {formatCurrency(monthEarnings)}
          </p>
          <p className="text-xs text-indigo-600 font-medium mt-1">
            {monthPaidCount} paid this month
          </p>
        </div>

        {/* Pending Payments */}
        <div className="card p-5 border-l-4 border-l-amber-500 transition-all hover:shadow-md">
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Pending Payments
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 tracking-tight">
            {formatCurrency(pendingTotal)}
          </p>
          <p className="text-xs text-amber-600 font-medium mt-1">
            {pendingPayments.length} awaiting completion
          </p>
        </div>

        {/* Failed Payments */}
        <div className="card p-5 border-l-4 border-l-rose-500 transition-all hover:shadow-md">
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Failed Payments
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900 tracking-tight">
            {formatCurrency(failedTotal)}
          </p>
          <p className="text-xs text-rose-600 font-medium mt-1">
            {failedPayments.length} unsuccessful
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 text-sm"
              placeholder="Search by Payment ID, Booking ID, User, or Patient..."
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilterOption)}
                aria-label="Filter by payment status"
                className="input-field text-sm w-full sm:w-36 py-2"
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Date-Range Filter */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangeOption)}
                aria-label="Filter by date range"
                className="input-field text-sm w-full sm:w-36 py-2"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7">Last 7 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {(search || statusFilter !== 'all' || dateRange !== 'all') && (
              <button
                type="button"
                onClick={resetFilters}
                className="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1 shrink-0"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Pickers */}
        {dateRange === 'custom' && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <span className="font-medium text-gray-700">Custom Date Range:</span>
            <div className="flex items-center gap-2">
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field text-xs py-1.5 px-2.5 w-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field text-xs py-1.5 px-2.5 w-auto"
              />
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table & Data States */}
      {initialLoading ? (
        <div className="card p-12 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-3" />
          <p className="text-sm font-semibold text-gray-700">Loading payments from Firestore...</p>
          <p className="text-xs text-gray-400 mt-1">Subscribing to real-time payment updates</p>
        </div>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="w-8 h-8" />}
          title="No payments yet"
          message="Payments will appear here in real time as soon as patients or users pay for ambulance bookings."
        />
      ) : filteredPayments.length === 0 ? (
        <div className="card p-10 text-center flex flex-col items-center justify-center">
          <EmptyState
            icon={<Filter className="w-8 h-8" />}
            title="No matching transactions"
            message="No payment transactions match your current search and filter criteria."
            action={
              <button
                type="button"
                onClick={resetFilters}
                className="btn-secondary text-sm mt-2 inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" /> Clear All Filters
              </button>
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Payment / Trans ID</th>
                  <th className="px-5 py-3.5">Booking</th>
                  <th className="px-5 py-3.5">User / Patient</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Method</th>
                  <th className="px-5 py-3.5">Date & Time</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedPayments.map((p) => {
                  const booking = bookingMap.get(p.bookingId);
                  const bookingCode =
                    booking?.bookingCode ||
                    (p.bookingId ? `#${p.bookingId.slice(0, 8).toUpperCase()}` : '—');
                  const userName =
                    userMap.get(p.userId) ||
                    booking?.patientName ||
                    (p.userId ? `User (${p.userId.slice(0, 6)})` : 'Guest');
                  const patientName = booking?.patientName;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50/60 transition-colors text-sm"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-xs text-gray-900 font-semibold" title={p.id}>
                          {p.id.length > 20 ? `${p.id.slice(0, 16)}…` : p.id}
                        </div>
                        <span className="text-[10px] text-gray-400">Razorpay</span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-brand-600">
                          {bookingCode}
                        </div>
                        {booking?.pickup && (
                          <div className="text-[11px] text-gray-400 truncate max-w-[140px]" title={booking.pickup}>
                            {booking.pickup}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-medium text-gray-900">{userName}</div>
                        {patientName && patientName !== userName && (
                          <div className="text-xs text-gray-500">Patient: {patientName}</div>
                        )}
                      </td>

                      <td className="px-5 py-3.5 font-bold text-gray-900">
                        {formatCurrency(p.amount)}
                      </td>

                      <td className="px-5 py-3.5 text-gray-600 text-xs">
                        <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 font-medium">
                          {p.method || 'Razorpay'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                        {formatDateTime(p.createdAt)}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {statusBadge(p.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-5 py-3.5 bg-gray-50/70 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <div>
              Showing{' '}
              <span className="font-semibold text-gray-800">
                {startIndex + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-gray-800">
                {Math.min(startIndex + PAGE_SIZE, filteredPayments.length)}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-gray-800">
                {filteredPayments.length}
              </span>{' '}
              transactions
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
                className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>

              <span className="px-2 font-medium text-gray-700">
                Page {safeCurrentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage === totalPages}
                className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1 disabled:opacity-40"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
