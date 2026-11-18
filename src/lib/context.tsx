import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Booking, NotificationItem, Address, UserProfile } from './types';
import {
  fetchBookings,
  fetchAllBookings,
  createBooking as dbCreateBooking,
  updateBookingStatus as dbUpdateBookingStatus,
  fetchUserProfile,
  saveUserProfile,
  saveAddresses,
  fetchAddresses,
  createNotification,
  fetchNotifications,
  markNotificationRead as dbMarkNotificationRead,
  markAllNotificationsRead as dbMarkAllNotificationsRead,
} from './db';
import { useAuth } from './auth';

interface AppContextValue {
  route: string;
  navigate: (path: string) => void;
  bookings: Booking[];
  addBooking: (b: Booking) => Promise<void>;
  updateBookingStatus: (id: string, status: Booking['status']) => void;
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadCount: number;
  addresses: Address[];
  addAddress: (a: Address) => void;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  profile: UserProfile;
  updateProfile: (p: UserProfile) => void;
  adminMode: boolean;
  setAdminMode: (v: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

function parseRoute(): string {
  const hash = window.location.hash.replace(/^#/, '');
  return hash || '/';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [route, setRoute] = useState<string>(parseRoute());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [profile, setProfile] = useState<UserProfile>({ name: '', email: '', phone: '', dob: '', bloodGroup: '', address: '', emergencyContact: '', emergencyPhone: '' });
  const [adminMode, setAdminMode] = useState<boolean>(false);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [route]);

  // Load bookings from Firestore.
  useEffect(() => {
    let active = true;
    if (!user) {
      setBookings([]);
      return;
    }
    const isAdmin = user.user_metadata?.role === 'admin';
    (async () => {
      try {
        const rows = isAdmin
          ? await fetchAllBookings()
          : await fetchBookings(user.id);
        if (active) setBookings(rows);
      } catch (err) {
        console.error('[firestore] fetchBookings failed.', err);
        if (active) setBookings([]);
      }
    })();
    return () => { active = false; };
  }, [user]);

  // Load notifications (last 15 days) from Firestore.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) { if (active) setNotifications([]); return; }
      try {
        const rows = await fetchNotifications(user.id);
        if (active) setNotifications(rows);
      } catch (err) {
        console.error('[firestore] fetchNotifications failed.', err);
        if (active) setNotifications([]);
      }
    })();
    return () => { active = false; };
  }, [user]);

  // Hydrate the signed-in user's profile from Firestore.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) return;
      try {
        const p = await fetchUserProfile(user.id);
        if (active && p) {
          setProfile((prev) => ({
            ...prev,
            ...p,
            name: p.name || user.user_metadata.full_name || prev.name,
            email: p.email || user.email,
          }));
        }
      } catch {
        // keep current profile state
      }
    })();
    return () => { active = false; };
  }, [user]);

  // Load saved addresses from the user's Firestore profile document.
  useEffect(() => {
    let active = true;
    if (!user) {
      setAddresses([]);
      return;
    }
    (async () => {
      try {
        const saved = await fetchAddresses(user.id);
        if (active) setAddresses(saved);
      } catch {
        // keep empty addresses
      }
    })();
    return () => { active = false; };
  }, [user]);

  const navigate = (path: string) => {
    window.location.hash = path;
    setRoute(path);
  };

  const addBooking = async (b: Booking) => {
    setBookings((prev) => [b, ...prev]);
    try {
      await dbCreateBooking(b, user?.id ?? null);
    } catch {
      // offline-friendly: booking stays in local state
    }
    const notification: NotificationItem = {
      id: `booking-${b.id}`,
      title: 'Booking confirmed',
      message: `Your booking ${b.bookingCode} has been confirmed.`,
      time: 'Just now',
      read: false,
      type: 'booking' as const,
    };
    setNotifications((prev) => [notification, ...prev]);
    if (user) {
      try {
        await createNotification(user.id, notification);
      } catch {
        // non-fatal
      }
    }
  };

  const updateBookingStatus = (id: string, status: Booking['status']) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    dbUpdateBookingStatus(id, status).catch(() => {
      // offline-friendly fallback
    });
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    dbMarkNotificationRead(id).catch(() => undefined);
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (user) dbMarkAllNotificationsRead(user.id).catch(() => undefined);
  };

  const addAddress = (a: Address) => {
    const next = (a.isDefault ? addresses.map((x) => ({ ...x, isDefault: false })) : addresses).concat(a);
    setAddresses(next);
    if (user) saveAddresses(user.id, next).catch(() => undefined);
  };

  const removeAddress = (id: string) => {
    const next = addresses.filter((a) => a.id !== id);
    setAddresses(next);
    if (user) saveAddresses(user.id, next).catch(() => undefined);
  };

  const setDefaultAddress = (id: string) => {
    const next = addresses.map((a) => ({ ...a, isDefault: a.id === id }));
    setAddresses(next);
    if (user) saveAddresses(user.id, next).catch(() => undefined);
  };

  const updateProfile = (p: UserProfile) => {
    setProfile(p);
    if (user) saveUserProfile(user.id, p).catch(() => undefined);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppContext.Provider value={{
      route, navigate, bookings, addBooking, updateBookingStatus,
      notifications, markNotificationRead, markAllNotificationsRead, unreadCount,
      addresses, addAddress, removeAddress, setDefaultAddress,
      profile, updateProfile, adminMode, setAdminMode,
    }}>
      {children}
    </AppContext.Provider>
  );
}
