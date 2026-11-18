import { Bell, CheckCheck, Ambulance, CreditCard, Info, User, Send, AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import {
  useNotifications,
  updateNotification,
  createNotification,
} from '@/lib/firestoreService';
import { useAuth } from '@/lib/auth';
import AdminLayout from '@/components/AdminLayout';
import { EmptyState } from '@/components/UI';
import { formatDateTime } from '@/lib/utils';

export default function AdminNotifications() {
  const { user } = useAuth();
  const { data: notifications, loading, error } = useNotifications();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    booking: Ambulance,
    payment: CreditCard,
    system: Info,
    driver: User,
  };
  const unread = (notifications ?? []).filter((n) => !n.read).length;

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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user) return;
    setSending(true);
    try {
      await createNotification({
        userId: user.id,
        title: 'System Announcement',
        message: message.trim(),
        type: 'system',
      });
      setSent(true);
      setMessage('');
      setTimeout(() => { setSent(false); setShowForm(false); }, 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not send notification.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout title="Notifications">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">{unread} unread notification{unread !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          {unread > 0 && (
            <button onClick={handleMarkAllRead} className="btn-ghost text-sm">
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
            <Send className="w-4 h-4" /> Send Notification
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSend} className="card p-6 mb-6 space-y-4 animate-slide-up">
          {sent && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
              Notification created successfully!
            </div>
          )}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Message</label>
            <textarea
              rows={3}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="input-field resize-none"
              placeholder="Type your notification message..."
            />
          </div>
          <button type="submit" disabled={sending} className="btn-primary text-sm">
            {sending ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : <Send className="w-4 h-4 inline mr-1" />}
            Send Notification
          </button>
        </form>
      )}

      {loading && (
        <div className="max-w-5xl mx-auto px-4 py-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-3" />
          <p className="text-gray-500">Loading notifications…</p>
        </div>
      )}

      {!loading && error && (
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
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

      {!loading && !error && (notifications ?? []).length === 0 ? (
        <EmptyState icon={<Bell className="w-8 h-8" />} title="No notifications" message="All caught up." />
      ) : (
        !loading && !error && (
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
        )
      )}
    </AdminLayout>
  );
}
