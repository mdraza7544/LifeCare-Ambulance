import { Ambulance, Calendar, Clock, MapPin, TrendingUp, Phone, Bell, ArrowRight, Activity, Wallet, AlertTriangle } from 'lucide-react';
import { useApp } from '@/lib/context';
import { PageHeader, StatCard, EmptyState } from '@/components/UI';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export default function UserDashboard() {
  const { bookings, navigate, notifications, unreadCount } = useApp();

  const upcoming = bookings.filter((b) => b.status === 'Scheduled' || b.status === 'On Going');
  const completed = bookings.filter((b) => b.status === 'Completed');
  const totalSpent = completed.reduce((s, b) => s + b.amount, 0);
  const activeBooking = bookings.find((b) => b.status === 'On Going');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      <PageHeader title="My Dashboard" subtitle="Welcome back, manage your bookings and account" icon={<Activity className="w-5 h-5" />} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Bookings" value={String(bookings.length)} icon={<Calendar className="w-6 h-6" />} color="brand" />
        <StatCard label="Upcoming" value={String(upcoming.length)} icon={<Clock className="w-6 h-6" />} color="amber" />
        <StatCard label="Completed" value={String(completed.length)} icon={<TrendingUp className="w-6 h-6" />} color="green" />
        <StatCard label="Total Spent" value={formatCurrency(totalSpent)} icon={<Wallet className="w-6 h-6" />} color="blue" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {activeBooking && (
            <div className="card p-6 border-2 border-brand-200 bg-gradient-to-r from-brand-50 to-accent-50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse-soft" />
                  <h3 className="font-bold text-gray-900">Active Ambulance</h3>
                </div>
                <StatusBadge status={activeBooking.status} />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-brand-500 flex items-center justify-center text-white shrink-0">
                  <Ambulance className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{activeBooking.bookingCode}</p>
                  <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5"><MapPin className="w-3.5 h-3.5" /> {activeBooking.pickup} → {activeBooking.destination}</p>
                </div>
                <button onClick={() => navigate('/track')} className="btn-primary text-sm">Track</button>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-900">Recent Bookings</h3>
              <button onClick={() => navigate('/bookings')} className="text-sm font-semibold text-brand-600 hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {bookings.length === 0 ? (
              <EmptyState icon={<Calendar className="w-8 h-8" />} title="No bookings yet" message="Book your first ambulance to get started." action={<button onClick={() => navigate('/book')} className="btn-primary">Book Ambulance</button>} />
            ) : (
              <div className="space-y-3">
                {bookings.slice(0, 4).map((b) => (
                  <div key={b.id} className="card p-4 flex items-center gap-4 hover:shadow-card-hover transition-shadow cursor-pointer" onClick={() => navigate(`/booking-details?id=${b.id}`)}>
                    <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                      <Ambulance className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 text-sm">{b.bookingCode}</p>
                        <StatusBadge status={b.status} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{b.pickup} → {b.destination}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(b.scheduledFor)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-brand-600 text-sm">{formatCurrency(b.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Ambulance className="w-8 h-8 mb-3" />
            <h3 className="font-bold text-lg">Need an Ambulance?</h3>
            <p className="text-sm text-brand-100 mt-1 mb-4">Book now and get help in minutes.</p>
            <button onClick={() => navigate('/book')} className="w-full px-4 py-2.5 bg-white text-brand-600 font-bold rounded-lg hover:bg-brand-50 transition-colors">
              Book Ambulance
            </button>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Notifications</h3>
              {unreadCount > 0 && <span className="text-xs font-bold text-white bg-brand-500 px-2 py-0.5 rounded-full">{unreadCount}</span>}
            </div>
            <div className="space-y-3">
              {notifications.slice(0, 3).map((n) => (
                <div key={n.id} className={`p-3 rounded-lg ${n.read ? 'bg-gray-50' : 'bg-brand-50 border border-brand-100'}`}>
                  <div className="flex items-start gap-2.5">
                    <Bell className={`w-4 h-4 mt-0.5 shrink-0 ${n.read ? 'text-gray-400' : 'text-brand-500'}`} />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{n.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/notifications')} className="btn-ghost w-full mt-3 text-sm">View All</button>
          </div>

          <div className="card p-6 bg-red-50 border border-red-100">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-brand-600" />
              <h3 className="font-bold text-gray-900">Emergency Support</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Call our 24/7 helpline for immediate assistance.</p>
            <a href="tel:1800LIFECARE" className="btn-primary w-full text-sm">
              <Phone className="w-4 h-4" /> 1800-LIFECARE
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
