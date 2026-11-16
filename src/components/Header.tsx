import { Phone, Ambulance, Menu, X, Bell, User, LogOut, LogIn, UserPlus, Shield, Car } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { useAuth } from '@/lib/auth';

const publicNav = [
  { label: 'Home', path: '/' },
  { label: 'Services', path: '/services' },
  { label: 'How It Works', path: '/how-it-works' },
  { label: 'About Us', path: '/about' },
  { label: 'Contact Us', path: '/contact' },
];

const userNav = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Book Ambulance', path: '/book' },
  { label: 'My Bookings', path: '/bookings' },
  { label: 'Track Ambulance', path: '/track' },
  { label: 'Driver', path: '/driver' },
  { label: 'Notifications', path: '/notifications' },
  { label: 'Profile', path: '/profile' },
];

export default function Header() {
  const { route, navigate, unreadCount } = useApp();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = user?.user_metadata?.role === 'admin';
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isUserArea = route.startsWith('/dashboard') || route.startsWith('/book') || route.startsWith('/bookings') || route.startsWith('/track') || route.startsWith('/notifications') || route.startsWith('/profile') || route.startsWith('/payment') || route.startsWith('/feedback') || route.startsWith('/address') || route.startsWith('/booking-details') || route.startsWith('/driver');

  const nav = isUserArea ? userNav : publicNav;

  const go = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="bg-brand-600 text-white text-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-9">
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5" />
            <span className="font-semibold">24/7 Helpline: 1800-LIFECARE</span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <span className="opacity-90">Trusted by 50,000+ patients</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <button onClick={() => go('/')} className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Ambulance className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <div className="font-extrabold text-lg leading-none text-gray-900">LifeCare</div>
              <div className="text-[11px] text-brand-600 font-semibold tracking-wide">AMBULANCE SERVICE</div>
            </div>
          </button>

          <nav className="hidden lg:flex items-center gap-1">
            {nav.map((item) => (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  route === item.path ? 'text-brand-600 bg-brand-50' : 'text-gray-600 hover:text-brand-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isUserArea && (
              <button
                onClick={() => go('/notifications')}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors hidden sm:block"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1.5 pr-3 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm font-bold">
                    {user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="hidden sm:block text-sm font-semibold text-gray-700 max-w-[120px] truncate">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </span>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-2 animate-fade-in z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user.user_metadata?.full_name || 'User'}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <button onClick={() => { go('/dashboard'); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <User className="w-4 h-4" /> Dashboard
                    </button>
                    <button onClick={() => { go('/profile'); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <User className="w-4 h-4" /> Profile
                    </button>
                    <button onClick={() => { go('/driver'); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Car className="w-4 h-4" /> Pickup Verification
                    </button>
                    {isAdmin && (
                      <button onClick={() => { go('/admin'); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Admin Panel
                      </button>
                    )}
                    <button onClick={async () => { await signOut(); setUserMenuOpen(false); navigate('/'); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <button onClick={() => go('/login')} className="btn-ghost text-sm">
                  <LogIn className="w-4 h-4" /> Login
                </button>
                <button onClick={() => go('/signup')} className="btn-secondary text-sm">
                  <UserPlus className="w-4 h-4" /> Sign Up
                </button>
              </div>
            )}
            <button onClick={() => go('/book')} className="hidden sm:inline-flex btn-primary text-sm">
              <Ambulance className="w-4 h-4" />
              Book Ambulance
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white animate-fade-in">
          <nav className="px-4 py-3 space-y-1">
            {nav.map((item) => (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  route === item.path ? 'text-brand-600 bg-brand-50' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button onClick={() => go('/book')} className="w-full btn-primary text-sm mt-2">
              <Ambulance className="w-4 h-4" />
              Book Ambulance
            </button>
            {!user && (
              <div className="flex gap-2 mt-2">
                <button onClick={() => go('/login')} className="flex-1 btn-secondary text-sm">
                  <LogIn className="w-4 h-4" /> Login
                </button>
                <button onClick={() => go('/signup')} className="flex-1 btn-primary text-sm">
                  <UserPlus className="w-4 h-4" /> Sign Up
                </button>
              </div>
            )}
            {user && (
              <>
                {isAdmin && (
                  <button onClick={() => go('/admin')} className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 mt-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Admin Panel
                  </button>
                )}
                <button onClick={async () => { await signOut(); go('/'); }} className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 mt-2 flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
