import { useState } from 'react';
import { Bell, CheckCheck, Ambulance, CreditCard, Info, User, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApp } from '@/lib/context';
import {
  useNotifications,
  updateNotification,
  markAllNotificationsRead as fsMarkAllNotificationsRead,
  type Notification,
} from '@/lib/firestoreService';
import { PageHeader, EmptyState } from '@/components/UI';
import { formatDateTime } from '@/lib/utils';

export default function NotificationsPage() {
  const { user } = useAuth();
  const { navigate, markNotificationRead: contextMarkRead, markAllNotificationsRead: contextMarkAllRead } = useApp();
  const { data: notifications, loading, error } = useNotifications(user?.id ?? null);
  const [markingAll, setMarkingAll] = useState(false);

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    booking: Ambulance,
    payment: CreditCard,
    system: Info,
    driver: User,
  };

  const handleItemClick = async (n: Notification) => {
    if (!n.read) {
      contextMarkRead(n.id);
      try {
        await updateNotification(n.id, { read: true });
      } catch (err) {
        console.error('Failed to mark notification read:', err);
      }
    }
    if (n.bookingId) {
      navigate(`/booking-details?id=${n.bookingId}`);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    setMarkingAll(true);
    // Optimistic context update
    contextMarkAllRead();
    try {
      await fsMarkAllNotificationsRead(user.id);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const hasUnread = (notifications ?? []).some((n) => !n.read);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Notifications"
          subtitle="Stay updated on your ambulance bookings and account"
          icon={<Bell className="w-5 h-5" />}
        />
        {!loading && !error && hasUnread && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 border border-gray-200 rounded-xl hover:bg-gray-100"
          >
            {markingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCheck className="w-3.5 h-3.5 text-brand-600" />
            )}
            Mark all as read
          </button>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-gray-500 mt-3">Loading notifications…</p>
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-red-600 font-semibold mb-1">Failed to load notifications</p>
          <p className="text-gray-500 text-sm mb-4">{error.message}</p>
          <button onClick={() => window.location.reload()} className="btn-primary text-sm">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (notifications ?? []).length === 0 && (
        <EmptyState
          icon={<Bell className="w-8 h-8" />}
          title="No notifications yet"
          message="You're all caught up. New booking updates and announcements will appear here."
        />
      )}

      {!loading && !error && (notifications ?? []).length > 0 && (
        <div className="space-y-3">
          {(notifications ?? []).map((n) => {
            const Icon = iconMap[n.type] || Bell;
            return (
              <div
                key={n.id}
                className={`card p-4 cursor-pointer transition-all ${
                  n.read
                    ? 'bg-gray-50/70 border-l-4 border-l-gray-300 opacity-80 hover:opacity-100'
                    : 'bg-white border-l-4 border-l-brand-600 shadow-sm hover:shadow-md'
                }`}
                onClick={() => handleItemClick(n)}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      n.read
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-brand-50 text-brand-600 shadow-sm'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-sm ${
                          n.read ? 'font-medium text-gray-700' : 'font-bold text-gray-900'
                        }`}
                      >
                        {n.title}
                      </p>
                      <span className="text-[11px] text-gray-400 shrink-0">
                        {n.createdAt ? formatDateTime(n.createdAt) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">{n.message}</p>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      {n.bookingId && (
                        <span className="text-[11px] text-brand-600 font-semibold hover:underline inline-flex items-center gap-1">
                          View Booking →
                        </span>
                      )}
                      {!n.read && (
                        <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200 ml-auto">
                          New
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
