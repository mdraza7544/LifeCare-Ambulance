import { Bell, CheckCheck, Ambulance, CreditCard, Info, User, Send } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/lib/context';
import AdminLayout from '@/components/AdminLayout';
import { EmptyState } from '@/components/UI';

export default function AdminNotifications() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const iconMap = { booking: Ambulance, payment: CreditCard, system: Info, driver: User };
  const unread = notifications.filter((n) => !n.read).length;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    setMessage('');
    setTimeout(() => { setSent(false); setShowForm(false); }, 2000);
  };

  return (
    <AdminLayout title="Notifications">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">{unread} unread notification{unread !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          {unread > 0 && <button onClick={markAllNotificationsRead} className="btn-ghost text-sm"><CheckCheck className="w-4 h-4" /> Mark all read</button>}
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm"><Send className="w-4 h-4" /> Send Notification</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSend} className="card p-6 mb-6 space-y-4 animate-slide-up">
          {sent && <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium">Notification sent to all users!</div>}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Message</label>
            <textarea rows={3} required value={message} onChange={(e) => setMessage(e.target.value)} className="input-field resize-none" placeholder="Type your notification message..." />
          </div>
          <button type="submit" className="btn-primary text-sm"><Send className="w-4 h-4" /> Send to All Users</button>
        </form>
      )}

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell className="w-8 h-8" />} title="No notifications" message="All caught up." />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const Icon = iconMap[n.type] || Bell;
            return (
              <div key={n.id} className={`card p-4 cursor-pointer transition-all ${n.read ? 'opacity-70' : 'border-l-4 border-l-brand-500'}`} onClick={() => markNotificationRead(n.id)}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${n.read ? 'bg-gray-100 text-gray-400' : 'bg-brand-50 text-brand-600'}`}><Icon className="w-5 h-5" /></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm text-gray-900">{n.title}</p>
                      <span className="text-xs text-gray-400">{n.time}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
