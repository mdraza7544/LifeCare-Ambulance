import { Bell, CheckCheck, Ambulance, CreditCard, Info, User, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  useNotifications,
  updateNotification,
  type Notification,
} from '@/lib/firestoreService';
import { PageHeader, EmptyState } from '@/components/UI';
import { formatDateTime } from '@/lib/utils';

export default function NotificationsPage() {
  const { user } = useAuth();
  const { data: notifications, loading, error } = useNotifications(user?.id ?? null);

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    booking: Ambulance,
    payment: CreditCard,
    system: Info,
    driver: User,
  };

  const handleMarkRead = async (id: string) => {
    try {
      await updateNotification(id, { read: true });
    } catch (err) {
      console.warn('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unreadList = (notifications ?? []).filter((n) => !n.read);
      await Promise.all(unreadList.map((n) => updateNotification(n.id, { read: true })));
    } catch (err) {
      console.warn('Failed to mark all notifications read:', err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Notifications" subtitle="Stay updated on your bookings and account" icon={<Bell className="w-5 h-5" />} />
        {!loading && !error && (notifications ?? []).some((n) => !n.read) && (
          <button onClick={handleMarkAllRead} className="btn-ghost text-sm">
            <CheckCheck className="w-4 h-4" /> Mark all read
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
          <button onClick={() => window.location.reload()} className="btn-primary text-sm">Retry</button>
        </div>
      )}

      {!loading && !error && (notifications ?? []).length === 0 && (
        <EmptyState icon={<Bell className="w-8 h-8" />} title="No notifications" message="You're all caught up. New notifications will appear here." />
      )}

      {!loading && !error && (notifications ?? []).length > 0 && (
        <div className="space-y-3">
          {(notifications ?? []).map((n) => {
            const Icon = iconMap[n.type] || Bell;
            return (
              <div
                key={n.id}
                className={`card p-4 cursor-pointer transition-all ${n.read ? 'opacity-70' : 'border-l-4 border-l-brand-500'}`}
                onClick={() => !n.read && handleMarkRead(n.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${n.read ? 'bg-gray-100 text-gray-400' : 'bg-brand-50 text-brand-600'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm text-gray-900">{n.title}</p>
                      <span className="text-xs text-gray-400">{n.createdAt ? formatDateTime(n.createdAt) : ''}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                    {!n.read && <span className="inline-block mt-1.5 text-xs font-semibold text-brand-600">Click to mark as read</span>}
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
