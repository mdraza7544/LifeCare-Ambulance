import { useState } from 'react';
import { LayoutDashboard, Calendar, Ambulance, Users, Hospital, CreditCard, BarChart3, Bell, Settings, LogOut, Menu, Ambulance as Logo, ArrowLeft } from 'lucide-react';
import { useApp } from '@/lib/context';
import { useAuth } from '@/lib/auth';

const adminNav = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'Bookings', path: '/admin/bookings', icon: Calendar },
  { label: 'Ambulances', path: '/admin/ambulances', icon: Ambulance },
  { label: 'Drivers', path: '/admin/drivers', icon: Users },
  { label: 'Users', path: '/admin/users', icon: Users },
  { label: 'Hospitals', path: '/admin/hospitals', icon: Hospital },
  { label: 'Payments', path: '/admin/payments', icon: CreditCard },
  { label: 'Reports', path: '/admin/reports', icon: BarChart3 },
  { label: 'Notifications', path: '/admin/notifications', icon: Bell },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
];

export default function AdminLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const { route, navigate } = useApp();
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => route === path || (path === '/admin' && route === '/admin');

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-gray-900 text-gray-300 flex flex-col transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 flex items-center gap-2.5 border-b border-gray-800">
          <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center"><Logo className="w-6 h-6 text-white" /></div>
          <div><div className="font-extrabold text-white">LifeCare</div><div className="text-[11px] text-brand-400 font-semibold tracking-wide">ADMIN PANEL</div></div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {adminNav.map((item) => (
            <button key={item.path} onClick={() => { navigate(item.path); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${isActive(item.path) ? 'bg-brand-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <item.icon className="w-4 h-4" /> {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-800 space-y-1">
          <button onClick={() => navigate('/')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Site
          </button>
          <button onClick={async () => { await signOut(); navigate('/'); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-brand-400 hover:bg-brand-500/10 transition-colors">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 h-16 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100"><Menu className="w-5 h-5" /></button>
            <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin/notifications')} className="relative p-2 rounded-lg hover:bg-gray-100"><Bell className="w-5 h-5 text-gray-600" /></button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm">
                {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="hidden sm:block"><p className="text-sm font-semibold text-gray-900 leading-none">{user?.user_metadata?.full_name || 'Admin'}</p><p className="text-xs text-gray-500 mt-0.5">{user?.email || 'Administrator'}</p></div>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
