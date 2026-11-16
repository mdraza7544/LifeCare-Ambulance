import { Save, Bell, Shield, Globe, Ambulance, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';

export default function AdminSettings() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    siteName: 'LifeCare Ambulance Service',
    helpline: '1800-LIFECARE',
    email: 'support@lifecare.com',
    responseTime: '10',
    bookingRadius: '15',
    enableSms: true,
    enableEmail: true,
    enablePush: false,
    autoAssign: true,
    maintenanceMode: false,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <AdminLayout title="Settings">
      <form onSubmit={handleSave} className="max-w-3xl space-y-6">
        {saved && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-5 h-5" /> Settings saved successfully!
          </div>
        )}

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600"><Globe className="w-5 h-5" /></div>
            <div><h3 className="font-bold text-gray-900">General Settings</h3><p className="text-xs text-gray-500">Site-wide configuration</p></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Site Name</label>
              <input type="text" value={settings.siteName} onChange={(e) => setSettings({ ...settings, siteName: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Helpline Number</label>
              <input type="text" value={settings.helpline} onChange={(e) => setSettings({ ...settings, helpline: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Support Email</label>
              <input type="email" value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Default Response Time (min)</label>
              <input type="number" value={settings.responseTime} onChange={(e) => setSettings({ ...settings, responseTime: e.target.value })} className="input-field" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Ambulance className="w-5 h-5" /></div>
            <div><h3 className="font-bold text-gray-900">Operations</h3><p className="text-xs text-gray-500">Ambulance dispatch settings</p></div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Booking Radius (km)</label>
              <input type="number" value={settings.bookingRadius} onChange={(e) => setSettings({ ...settings, bookingRadius: e.target.value })} className="input-field" />
            </div>
            <label className="flex items-center justify-between p-3 rounded-lg bg-gray-50 cursor-pointer">
              <div><p className="text-sm font-semibold text-gray-900">Auto-assign nearest ambulance</p><p className="text-xs text-gray-500">Automatically assign the closest available ambulance to new bookings</p></div>
              <input type="checkbox" checked={settings.autoAssign} onChange={(e) => setSettings({ ...settings, autoAssign: e.target.checked })} className="w-5 h-5 rounded text-brand-500 focus:ring-brand-400" />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg bg-gray-50 cursor-pointer">
              <div><p className="text-sm font-semibold text-gray-900">Maintenance mode</p><p className="text-xs text-gray-500">Temporarily disable new bookings</p></div>
              <input type="checkbox" checked={settings.maintenanceMode} onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })} className="w-5 h-5 rounded text-brand-500 focus:ring-brand-400" />
            </label>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><Bell className="w-5 h-5" /></div>
            <div><h3 className="font-bold text-gray-900">Notification Preferences</h3><p className="text-xs text-gray-500">How users receive alerts</p></div>
          </div>
          <div className="space-y-3">
            {[
              { key: 'enableSms', label: 'SMS Notifications', desc: 'Send booking updates via SMS' },
              { key: 'enableEmail', label: 'Email Notifications', desc: 'Send booking updates via email' },
              { key: 'enablePush', label: 'Push Notifications', desc: 'Send push notifications to mobile devices' },
            ].map((opt) => (
              <label key={opt.key} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 cursor-pointer">
                <div><p className="text-sm font-semibold text-gray-900">{opt.label}</p><p className="text-xs text-gray-500">{opt.desc}</p></div>
                <input type="checkbox" checked={settings[opt.key as keyof typeof settings] as boolean} onChange={(e) => setSettings({ ...settings, [opt.key]: e.target.checked })} className="w-5 h-5 rounded text-brand-500 focus:ring-brand-400" />
              </label>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600"><Shield className="w-5 h-5" /></div>
            <div><h3 className="font-bold text-gray-900">Security</h3><p className="text-xs text-gray-500">Access and authentication</p></div>
          </div>
          <p className="text-sm text-gray-500">Admin accounts use secure authentication. Contact your system administrator for access changes.</p>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary"><Save className="w-4 h-4" /> Save Settings</button>
          <button type="button" onClick={() => setSaved(false)} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </AdminLayout>
  );
}
