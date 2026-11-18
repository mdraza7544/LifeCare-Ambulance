import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Ambulance as AmbulanceIcon,
  Users,
  Wallet,
  Download,
  Clock,
  MapPin,
  Building2,
  Filter,
  Loader2,
  ShieldAlert,
  Percent,
  RotateCcw,
} from 'lucide-react';
import {
  useBookings,
  useAmbulances,
  useDrivers,
  useUsers,
  usePayments,
  type Booking,
} from '@/lib/firestoreService';
import { getHospitals } from '@/lib/hospitalApi';
import AdminLayout from '@/components/AdminLayout';
import { formatCurrency } from '@/lib/utils';
import { EmptyState } from '@/components/UI';

type DatePreset = '7d' | '30d' | '90d' | 'thisMonth' | 'year' | 'all' | 'custom';
type Aggregation = 'daily' | 'weekly' | 'monthly';

interface TimeBucket {
  key: string;
  label: string;
  bookings: number;
  revenue: number;
}

export default function AdminReports() {
  // Real-time Firestore subscriptions via onSnapshot hooks
  const { data: bookings, loading: bookingsLoading } = useBookings();
  const { data: ambulances, loading: ambulancesLoading } = useAmbulances();
  const { data: drivers, loading: driversLoading } = useDrivers();
  const { data: users, loading: usersLoading } = useUsers();
  const { data: payments, loading: paymentsLoading } = usePayments();

  const [hospitalCount, setHospitalCount] = useState<number>(0);
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [aggregation, setAggregation] = useState<Aggregation>('daily');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [chartMode, setChartMode] = useState<'bookings' | 'revenue'>('bookings');

  useEffect(() => {
    let active = true;
    getHospitals()
      .then((h) => {
        if (active) setHospitalCount(h.length);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const loading =
    bookingsLoading || ambulancesLoading || driversLoading || usersLoading || paymentsLoading;

  // 1. Calculate Date Range Bounds based on Preset
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let start: Date;

    if (datePreset === '7d') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    } else if (datePreset === '30d') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
    } else if (datePreset === '90d') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89, 0, 0, 0, 0);
    } else if (datePreset === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else if (datePreset === 'year') {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    } else if (datePreset === 'custom') {
      start = customStart ? new Date(customStart) : new Date(0);
      start.setHours(0, 0, 0, 0);
      const customEndD = customEnd ? new Date(customEnd) : now;
      customEndD.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: customEndD };
    } else {
      // 'all'
      start = new Date(0);
    }

    return { startDate: start, endDate: end };
  }, [datePreset, customStart, customEnd]);

  // Filter bookings within the selected date range
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const d = new Date(b.createdAt || b.scheduledTime);
      if (isNaN(d.getTime())) return false;
      return d >= startDate && d <= endDate;
    });
  }, [bookings, startDate, endDate]);

  // 2. High-Level Summary Metrics
  const totalRevenue = useMemo(() => {
    return filteredBookings
      .filter((b) => b.paymentStatus === 'paid' || b.status === 'completed')
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  }, [filteredBookings]);

  const completedCount = useMemo(() => {
    return filteredBookings.filter((b) => b.status === 'completed').length;
  }, [filteredBookings]);

  const completionRate = useMemo(() => {
    if (filteredBookings.length === 0) return 0;
    return Math.round((completedCount / filteredBookings.length) * 100);
  }, [completedCount, filteredBookings.length]);

  // 3. Operational Efficiency (Average times from real lifecycle timestamps)
  const averageTimeToAccept = useMemo(() => {
    const validDeltas: number[] = [];
    for (const b of filteredBookings) {
      if (b.acceptedAt && b.createdAt) {
        const deltaMs = new Date(b.acceptedAt).getTime() - new Date(b.createdAt).getTime();
        if (deltaMs > 0 && deltaMs < 48 * 3600 * 1000) {
          validDeltas.push(deltaMs);
        }
      } else if (b.status !== 'pending' && b.updatedAt && b.createdAt) {
        const deltaMs = new Date(b.updatedAt).getTime() - new Date(b.createdAt).getTime();
        if (deltaMs > 0 && deltaMs < 48 * 3600 * 1000) {
          validDeltas.push(deltaMs);
        }
      }
    }
    if (validDeltas.length === 0) return null;
    const avgMs = validDeltas.reduce((a, b) => a + b, 0) / validDeltas.length;
    return avgMs / (1000 * 60); // In minutes
  }, [filteredBookings]);

  const averageTimeToReach = useMemo(() => {
    const validDeltas: number[] = [];
    for (const b of filteredBookings) {
      if (b.status === 'completed' && b.allocatedAt) {
        const reachTime = b.reachedAt ? new Date(b.reachedAt) : new Date(b.updatedAt);
        const deltaMs = reachTime.getTime() - new Date(b.allocatedAt).getTime();
        if (deltaMs > 0 && deltaMs < 24 * 3600 * 1000) {
          validDeltas.push(deltaMs);
        }
      }
    }
    if (validDeltas.length === 0) return null;
    const avgMs = validDeltas.reduce((a, b) => a + b, 0) / validDeltas.length;
    return avgMs / (1000 * 60); // In minutes
  }, [filteredBookings]);

  // 4. Fleet Utilisation Metrics
  const fleetStats = useMemo(() => {
    const total = ambulances.length;
    const booked = ambulances.filter((a) => a.status === 'booked').length;
    const available = ambulances.filter((a) => a.status === 'available').length;
    const maintenance = ambulances.filter((a) => a.status === 'maintenance').length;
    const utilisationPct = total > 0 ? Math.round((booked / total) * 100) : 0;

    // Type-level utilization
    const types = ['Basic', 'Advanced', 'Cardiac', 'Neonatal'];
    const typeBreakdown = types.map((t) => {
      const match = ambulances.filter((a) => a.type.toLowerCase() === t.toLowerCase());
      const typeBooked = match.filter((a) => a.status === 'booked').length;
      const typeTotal = match.length;
      return {
        type: t,
        total: typeTotal,
        booked: typeBooked,
        available: match.filter((a) => a.status === 'available').length,
        utilisation: typeTotal > 0 ? Math.round((typeBooked / typeTotal) * 100) : 0,
      };
    });

    return { total, booked, available, maintenance, utilisationPct, typeBreakdown };
  }, [ambulances]);

  // 5. Bookings Over Time & Revenue Trend Time-Series Buckets
  const timeBuckets = useMemo((): TimeBucket[] => {
    if (filteredBookings.length === 0 && datePreset === 'all') {
      return [];
    }

    const bucketMap = new Map<string, { label: string; bookings: number; revenue: number }>();

    if (aggregation === 'daily') {
      // If range is within 60 days, prefill each day
      const diffDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays <= 60 && datePreset !== 'all') {
        const cur = new Date(startDate);
        while (cur <= endDate) {
          const key = cur.toISOString().slice(0, 10);
          const label = cur.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
          bucketMap.set(key, { label, bookings: 0, revenue: 0 });
          cur.setDate(cur.getDate() + 1);
        }
      }
    }

    filteredBookings.forEach((b) => {
      const d = new Date(b.createdAt || b.scheduledTime);
      if (isNaN(d.getTime())) return;

      let key = '';
      let label = '';

      if (aggregation === 'daily') {
        key = d.toISOString().slice(0, 10);
        label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      } else if (aggregation === 'weekly') {
        // Start of week (Sunday or Monday)
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        key = monday.toISOString().slice(0, 10);
        label = `Wk ${monday.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`;
      } else {
        // Monthly
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      }

      const existing = bucketMap.get(key) || { label, bookings: 0, revenue: 0 };
      existing.bookings += 1;
      if (b.paymentStatus === 'paid' || b.status === 'completed') {
        existing.revenue += Number(b.amount) || 0;
      }
      bucketMap.set(key, existing);
    });

    return Array.from(bucketMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, data]) => ({ key, ...data }));
  }, [filteredBookings, aggregation, startDate, endDate, datePreset]);

  const maxBucketValue = useMemo(() => {
    if (timeBuckets.length === 0) return 1;
    if (chartMode === 'bookings') {
      return Math.max(...timeBuckets.map((d) => d.bookings), 1);
    }
    return Math.max(...timeBuckets.map((d) => d.revenue), 1);
  }, [timeBuckets, chartMode]);

  // 6. Bookings Breakdown by Status
  const statusStats = useMemo(() => {
    const statuses: { status: Booking['status']; label: string; color: string; bg: string }[] = [
      { status: 'pending', label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-500' },
      { status: 'accepted', label: 'Accepted', color: 'text-blue-700', bg: 'bg-blue-500' },
      { status: 'paid', label: 'Paid', color: 'text-green-700', bg: 'bg-green-500' },
      { status: 'confirmed', label: 'Confirmed', color: 'text-cyan-700', bg: 'bg-cyan-500' },
      { status: 'allocated', label: 'Allocated', color: 'text-teal-700', bg: 'bg-teal-500' },
      { status: 'completed', label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-500' },
      { status: 'rejected', label: 'Rejected', color: 'text-rose-700', bg: 'bg-rose-500' },
      { status: 'cancelled', label: 'Cancelled', color: 'text-gray-700', bg: 'bg-gray-400' },
    ];

    const total = filteredBookings.length;
    return statuses.map((s) => {
      const count = filteredBookings.filter((b) => b.status === s.status).length;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return { ...s, count, pct };
    });
  }, [filteredBookings]);

  // 7. Bookings Breakdown by Priority (Emergency vs Scheduled)
  const priorityStats = useMemo(() => {
    const total = filteredBookings.length;
    const isEmergency = (p: string) => {
      const norm = p.toLowerCase();
      return (
        norm === 'emergency' || norm === 'critical' || norm === 'high' || norm === 'urgent'
      );
    };

    const emergencyCount = filteredBookings.filter((b) => isEmergency(b.priority)).length;
    const scheduledCount = total - emergencyCount;

    return {
      total,
      emergencyCount,
      emergencyPct: total > 0 ? Math.round((emergencyCount / total) * 100) : 0,
      scheduledCount,
      scheduledPct: total > 0 ? Math.round((scheduledCount / total) * 100) : 0,
    };
  }, [filteredBookings]);

  // 8. Top Pickup Areas and Most Used Destination Hospitals
  const topPickups = useMemo(() => {
    const counts = new Map<string, number>();
    filteredBookings.forEach((b) => {
      if (!b.pickup) return;
      // Clean up pickup: take first or main segment
      const clean = b.pickup.split(',')[0].trim();
      counts.set(clean, (counts.get(clean) || 0) + 1);
    });
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const max = sorted[0]?.[1] || 1;
    return sorted.map(([area, count]) => ({ area, count, pct: Math.round((count / max) * 100) }));
  }, [filteredBookings]);

  const topHospitals = useMemo(() => {
    const counts = new Map<string, number>();
    filteredBookings.forEach((b) => {
      if (!b.destination) return;
      const clean = b.destination.split(',')[0].trim();
      counts.set(clean, (counts.get(clean) || 0) + 1);
    });
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const max = sorted[0]?.[1] || 1;
    return sorted.map(([hospital, count]) => ({
      hospital,
      count,
      pct: Math.round((count / max) * 100),
    }));
  }, [filteredBookings]);

  // Helper formatting for durations
  const formatMinutes = (mins: number | null): string => {
    if (mins === null || isNaN(mins)) return '—';
    if (mins < 1) return '< 1 min';
    if (mins < 60) return `${mins.toFixed(1)} min`;
    return `${(mins / 60).toFixed(1)} hrs`;
  };

  // 9. Comprehensive CSV Export
  const handleExport = () => {
    const rows = [
      ['LifeCare Ambulance Service — Operations & Analytics Report'],
      ['Generated On', new Date().toLocaleString('en-IN')],
      ['Date Range Filter', datePreset.toUpperCase()],
      ['Time Interval', aggregation.toUpperCase()],
      [],
      ['--- EXECUTIVE SUMMARY ---'],
      ['Metric', 'Value'],
      ['Total Bookings', filteredBookings.length],
      ['Completed Bookings', completedCount],
      ['Completion Rate', `${completionRate}%`],
      ['Total Revenue (INR)', totalRevenue],
      ['Total Active Ambulances', fleetStats.total],
      ['Fleet Utilisation', `${fleetStats.utilisationPct}%`],
      ['Ambulances Booked', fleetStats.booked],
      ['Ambulances Available', fleetStats.available],
      ['Average Acceptance Time', formatMinutes(averageTimeToAccept)],
      ['Average Transit Time to Reached', formatMinutes(averageTimeToReach)],
      ['Registered Users', users.length],
      ['Registered Drivers', drivers.length],
      ['Partner Hospitals Network', hospitalCount],
      [],
      ['--- TIME SERIES BREAKDOWN ---'],
      ['Period', 'Bookings Count', 'Revenue (INR)'],
      ...timeBuckets.map((b) => [`"${b.label}"`, b.bookings, b.revenue]),
      [],
      ['--- BOOKINGS BY STATUS ---'],
      ['Status', 'Count', 'Share %'],
      ...statusStats.map((s) => [s.label, s.count, `${s.pct}%`]),
      [],
      ['--- BOOKINGS BY PRIORITY ---'],
      ['Priority Type', 'Count', 'Share %'],
      ['Emergency / Critical', priorityStats.emergencyCount, `${priorityStats.emergencyPct}%`],
      ['Scheduled / Normal', priorityStats.scheduledCount, `${priorityStats.scheduledPct}%`],
      [],
      ['--- TOP PICKUP LOCATIONS ---'],
      ['Rank', 'Location Area', 'Bookings'],
      ...topPickups.map((p, i) => [i + 1, `"${p.area}"`, p.count]),
      [],
      ['--- TOP DESTINATION HOSPITALS ---'],
      ['Rank', 'Hospital / Destination', 'Bookings'],
      ...topHospitals.map((h, i) => [i + 1, `"${h.hospital}"`, h.count]),
      [],
      ['--- FILTERED INDIVIDUAL BOOKING RECORDS ---'],
      [
        'Booking Code',
        'Date & Time',
        'Pickup',
        'Destination',
        'Priority',
        'Status',
        'Payment Status',
        'Amount',
        'Ambulance Type',
      ],
      ...filteredBookings.map((b) => [
        `"${b.bookingCode || b.id}"`,
        `"${b.createdAt || b.scheduledTime}"`,
        `"${(b.pickup || '').replace(/"/g, '""')}"`,
        `"${(b.destination || '').replace(/"/g, '""')}"`,
        b.priority,
        b.status,
        b.paymentStatus,
        b.amount,
        `"${b.ambulanceType || 'Basic'}"`,
      ]),
    ];

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `lifecare-analytics-${datePreset}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Reports & Analytics">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Operations Intelligence</h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Real-time analytics, fleet utilisation, and service speed computed directly from Firestore.
          </p>
        </div>

        {/* Global Controls Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Preset Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm text-xs">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              className="bg-transparent border-none text-gray-700 font-medium focus:ring-0 focus:outline-none cursor-pointer"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Time Bucket Aggregation Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm text-xs">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value as Aggregation)}
              className="bg-transparent border-none text-gray-700 font-medium focus:ring-0 focus:outline-none cursor-pointer"
            >
              <option value="daily">Daily View</option>
              <option value="weekly">Weekly View</option>
              <option value="monthly">Monthly View</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={filteredBookings.length === 0}
            className="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Custom Date Pickers */}
      {datePreset === 'custom' && (
        <div className="card p-4 mb-6 flex flex-wrap items-center gap-4 text-xs text-gray-600 animate-fade-in">
          <span className="font-semibold text-gray-700">Filter Custom Period:</span>
          <div className="flex items-center gap-2">
            <span>From:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="input-field text-xs py-1.5 px-2.5 w-auto"
            />
          </div>
          <div className="flex items-center gap-2">
            <span>To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="input-field text-xs py-1.5 px-2.5 w-auto"
            />
          </div>
          {(customStart || customEnd) && (
            <button
              type="button"
              onClick={() => {
                setCustomStart('');
                setCustomEnd('');
              }}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="card p-14 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-3" />
          <p className="text-sm font-semibold text-gray-700">Compiling real-time analytics...</p>
          <p className="text-xs text-gray-400 mt-1">Aggregating live bookings, fleet status, and financials</p>
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="w-8 h-8" />}
          title="No bookings recorded yet"
          message="Once ambulance bookings are created, real-time reports, fleet utilization, and transit times will appear here."
        />
      ) : (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Bookings */}
            <div className="card p-5 border-l-4 border-l-brand-500 transition-all hover:shadow-md">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Total Bookings
                </span>
                <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-gray-900 tracking-tight">
                {filteredBookings.length}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {completedCount} completed ({completionRate}%)
              </p>
            </div>

            {/* Total Revenue */}
            <div className="card p-5 border-l-4 border-l-emerald-500 transition-all hover:shadow-md">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Revenue Collected
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-gray-900 tracking-tight">
                {formatCurrency(totalRevenue)}
              </p>
              <p className="text-xs text-emerald-600 font-medium mt-1">
                {payments.filter((p) => p.status === 'paid').length} verified payments
              </p>
            </div>

            {/* Fleet Utilisation */}
            <div className="card p-5 border-l-4 border-l-amber-500 transition-all hover:shadow-md">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Fleet Utilisation
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Percent className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-gray-900 tracking-tight">
                {fleetStats.utilisationPct}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {fleetStats.booked} of {fleetStats.total} ambulances on duty
              </p>
            </div>

            {/* Average Acceptance Speed */}
            <div className="card p-5 border-l-4 border-l-blue-500 transition-all hover:shadow-md">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Avg Acceptance Time
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-gray-900 tracking-tight">
                {formatMinutes(averageTimeToAccept)}
              </p>
              <p className="text-xs text-blue-600 font-medium mt-1">
                From booking creation to approval
              </p>
            </div>
          </div>

          {/* Section 1: Bookings & Revenue Over Time Chart */}
          <div className="card p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-bold text-gray-900 text-base">
                  {chartMode === 'bookings' ? 'Bookings Volume Over Time' : 'Revenue Trend (INR)'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Aggregated {aggregation} for period:{' '}
                  <span className="font-semibold text-gray-700 capitalize">{datePreset}</span>
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="inline-flex rounded-xl bg-gray-100 p-1 self-start sm:self-auto text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setChartMode('bookings')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    chartMode === 'bookings'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Bookings Volume
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('revenue')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    chartMode === 'revenue'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Revenue Trend
                </button>
              </div>
            </div>

            {timeBuckets.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">
                No activity recorded in this date range. Try switching to a wider preset (e.g. Last 90 Days or All Time).
              </div>
            ) : (
              <div>
                <div className="flex items-end justify-between gap-1 sm:gap-2 h-52 pt-6 pb-2 border-b border-gray-100">
                  {timeBuckets.map((bucket) => {
                    const value = chartMode === 'bookings' ? bucket.bookings : bucket.revenue;
                    const heightPct = Math.max((value / maxBucketValue) * 100, 3);

                    return (
                      <div
                        key={bucket.key}
                        className="flex-1 flex flex-col items-center justify-end h-full group relative min-w-[20px]"
                      >
                        {/* Tooltip */}
                        <div className="absolute -top-11 z-20 hidden group-hover:flex flex-col items-center bg-gray-900 text-white text-[10px] py-1 px-2.5 rounded shadow-lg whitespace-nowrap pointer-events-none">
                          <span className="font-semibold">{bucket.label}</span>
                          <span>
                            {chartMode === 'bookings'
                              ? `${bucket.bookings} booking${bucket.bookings === 1 ? '' : 's'}`
                              : formatCurrency(bucket.revenue)}
                          </span>
                        </div>

                        {/* Bar */}
                        <div
                          className={`w-full max-w-[32px] rounded-t-md transition-all duration-300 ${
                            chartMode === 'bookings'
                              ? 'bg-brand-500 hover:bg-brand-600'
                              : 'bg-emerald-500 hover:bg-emerald-600'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* X-Axis Labels */}
                <div className="flex justify-between gap-1 pt-2 text-[10px] text-gray-400 overflow-x-hidden">
                  {timeBuckets.map((bucket, idx) => {
                    // Show a subset of labels if there are many buckets
                    const shouldShow =
                      timeBuckets.length <= 12 ||
                      idx === 0 ||
                      idx === timeBuckets.length - 1 ||
                      idx % Math.ceil(timeBuckets.length / 8) === 0;

                    return (
                      <div
                        key={bucket.key}
                        className="flex-1 text-center truncate font-medium"
                      >
                        {shouldShow ? bucket.label : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Fleet Utilisation & Operational Speed Row */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Fleet Utilisation Card */}
            <div className="card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <AmbulanceIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Fleet Utilisation</h3>
                      <p className="text-xs text-gray-500">Live ambulance capacity and deployment</p>
                    </div>
                  </div>
                  <span className="text-xl font-extrabold text-gray-900">
                    {fleetStats.utilisationPct}%
                  </span>
                </div>

                {/* Overall Gauge Bar */}
                <div className="w-full h-3.5 bg-gray-100 rounded-full overflow-hidden mb-5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      fleetStats.utilisationPct > 80
                        ? 'bg-rose-500'
                        : fleetStats.utilisationPct > 50
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${fleetStats.utilisationPct}%` }}
                  />
                </div>

                {/* Status Badges */}
                <div className="grid grid-cols-3 gap-3 mb-5 text-center">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                    <p className="text-xs font-semibold text-emerald-800">Available</p>
                    <p className="text-lg font-black text-emerald-700">{fleetStats.available}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <p className="text-xs font-semibold text-amber-800">Booked / Duty</p>
                    <p className="text-lg font-black text-amber-700">{fleetStats.booked}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-700">Maintenance</p>
                    <p className="text-lg font-black text-gray-800">{fleetStats.maintenance}</p>
                  </div>
                </div>

                {/* Per-Type Utilisation Breakdown */}
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2.5">
                  Utilisation by Ambulance Type
                </h4>
                <div className="space-y-2.5">
                  {fleetStats.typeBreakdown.map((t) => (
                    <div key={t.type} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-gray-700">{t.type}</span>
                        <span className="text-gray-500">
                          {t.booked} / {t.total} on duty ({t.utilisation}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all"
                          style={{ width: `${t.utilisation}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Service Speed & Turnaround Times Card */}
            <div className="card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Service Response & Transit Times</h3>
                    <p className="text-xs text-gray-500">Real lifecycle milestones measured from Firestore</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Time 1: Booking to Acceptance */}
                  <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="text-xs font-semibold text-blue-900">
                          Time from Booking to Acceptance
                        </p>
                        <p className="text-[11px] text-blue-700">
                          Dispatcher acknowledgment and initial triage
                        </p>
                      </div>
                      <span className="text-xl font-black text-blue-900">
                        {formatMinutes(averageTimeToAccept)}
                      </span>
                    </div>
                    {averageTimeToAccept === null && (
                      <p className="text-[11px] text-gray-400 mt-2">
                        No accepted bookings found in this period to measure speed.
                      </p>
                    )}
                  </div>

                  {/* Time 2: Allocation to Reached */}
                  <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-100">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="text-xs font-semibold text-teal-900">
                          Time from Allocation to "Reached"
                        </p>
                        <p className="text-[11px] text-teal-700">
                          Ambulance dispatch to arrival / trip completion
                        </p>
                      </div>
                      <span className="text-xl font-black text-teal-900">
                        {formatMinutes(averageTimeToReach)}
                      </span>
                    </div>
                    {averageTimeToReach === null && (
                      <p className="text-[11px] text-gray-400 mt-2">
                        Requires completed trips with recorded allocation times.
                      </p>
                    )}
                  </div>

                  {/* Network Infrastructure Overview */}
                  <div className="pt-2">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                      Operations Network
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2.5 rounded-lg bg-gray-50">
                        <Users className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                        <span className="font-bold text-gray-900">{drivers.length}</span>
                        <p className="text-[10px] text-gray-500">Active Drivers</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-gray-50">
                        <Users className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                        <span className="font-bold text-gray-900">{users.length}</span>
                        <p className="text-[10px] text-gray-500">Total Users</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-gray-50">
                        <Building2 className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                        <span className="font-bold text-gray-900">{hospitalCount || '—'}</span>
                        <p className="text-[10px] text-gray-500">Hospitals</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Status & Priority Distributions */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Bookings by Status */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">Bookings by Status</h3>
                  <p className="text-xs text-gray-500">Distribution across active booking lifecycle states</p>
                </div>
                <span className="text-xs font-semibold text-gray-500">
                  {filteredBookings.length} total
                </span>
              </div>

              <div className="space-y-3">
                {statusStats.map((s) => (
                  <div key={s.status}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-700">{s.label}</span>
                      <span className="text-gray-500">
                        <span className="font-bold text-gray-900">{s.count}</span> ({s.pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.bg} transition-all duration-500`}
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bookings by Priority (Emergency vs Scheduled) */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">Emergency vs Scheduled Bookings</h3>
                  <p className="text-xs text-gray-500">Triage volume and service urgency breakdown</p>
                </div>
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              </div>

              {/* Priority Split Bar */}
              <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex mb-6">
                <div
                  className="h-full bg-rose-500 transition-all duration-500"
                  style={{ width: `${priorityStats.emergencyPct}%` }}
                  title={`Emergency: ${priorityStats.emergencyCount} (${priorityStats.emergencyPct}%)`}
                />
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${priorityStats.scheduledPct}%` }}
                  title={`Scheduled: ${priorityStats.scheduledCount} (${priorityStats.scheduledPct}%)`}
                />
              </div>

              {/* Priority Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-100">
                  <div className="flex items-center gap-1.5 text-rose-700 text-xs font-bold mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                    Emergency Bookings
                  </div>
                  <p className="text-2xl font-black text-rose-950 mt-1">
                    {priorityStats.emergencyCount}
                  </p>
                  <p className="text-xs text-rose-600 mt-0.5">
                    {priorityStats.emergencyPct}% of total volume
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100">
                  <div className="flex items-center gap-1.5 text-blue-700 text-xs font-bold mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                    Scheduled Bookings
                  </div>
                  <p className="text-2xl font-black text-blue-950 mt-1">
                    {priorityStats.scheduledCount}
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    {priorityStats.scheduledPct}% of total volume
                  </p>
                </div>
              </div>

              <div className="mt-5 p-3 rounded-lg bg-gray-50 text-xs text-gray-500">
                <p>
                  <strong className="text-gray-700">Triage Note:</strong> Emergency requests receive immediate driver and ambulance allocation priority over standard transfers.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Top Pickup Areas & Most Used Hospitals */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top Pickup Areas */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Top Pickup Areas</h3>
                  <p className="text-xs text-gray-500">Highest ambulance request zones</p>
                </div>
              </div>

              {topPickups.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  No pickup locations recorded in this range.
                </div>
              ) : (
                <div className="space-y-3">
                  {topPickups.map((p, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-gray-800 truncate max-w-[240px]">
                          {idx + 1}. {p.area}
                        </span>
                        <span className="text-gray-500 font-bold">
                          {p.count} request{p.count === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all"
                          style={{ width: `${p.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Most Used Destination Hospitals */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Most Used Destination Hospitals</h3>
                  <p className="text-xs text-gray-500">Primary patient receiving healthcare centers</p>
                </div>
              </div>

              {topHospitals.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  No hospital transfers recorded in this range.
                </div>
              ) : (
                <div className="space-y-3">
                  {topHospitals.map((h, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-gray-800 truncate max-w-[240px]">
                          {idx + 1}. {h.hospital}
                        </span>
                        <span className="text-gray-500 font-bold">
                          {h.count} transfer{h.count === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${h.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
