import { Bell, CheckCheck, Ambulance, CreditCard, Info, User } from 'lucide-react';
import { useApp } from '@/lib/context';
import { PageHeader, EmptyState } from '@/components/UI';

export default function NotificationsPage() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useApp();

  const iconMap = {
    booking: Ambulance,
    payment: CreditCard,
    system: Info,
    driver: User,
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Notifications" subtitle="Stay updated on your bookings and account" icon={<Bell className="w-5 h-5" />} />
        {notifications.some((n) => !n.read) && (
          <button onClick={markAllNotificationsRead} className="btn-ghost text-sm">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell className="w-8 h-8" />} title="No notifications" message="You're all caught up. New notifications will appear here." />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const Icon = iconMap[n.type] || Bell;
            return (
              <div key={n.id} className={`card p-4 cursor-pointer transition-all ${n.read ? 'opacity-70' : 'border-l-4 border-l-brand-500'}`} onClick={() => markNotificationRead(n.id)}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${n.read ? 'bg-gray-100 text-gray-400' : 'bg-brand-50 text-brand-600'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm text-gray-900">{n.title}</p>
                      <span className="text-xs text-gray-400">{n.time}</span>
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
