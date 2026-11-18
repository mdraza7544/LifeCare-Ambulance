import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';
import {
  COLLECTIONS,
  updateNotification,
  markAllNotificationsRead as fsMarkAllNotificationsRead,
} from './firestoreService';
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

  // Real-time onSnapshot listener for bookings in app context
  useEffect(() => {
    if (!user) {
      setBookings([]);
      return;
    }
    const isAdmin = user.user_metadata?.role === 'admin';
    const ref = collection(db, COLLECTIONS.bookings);
    const q = isAdmin
      ? query(ref)
      : query(ref, where('userId', '==', user.id));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rows: Booking[] = snap.docs.map((d) => {
          const r = d.data();
          return {
            id: d.id,
            bookingCode: String(r.bookingCode ?? r.booking_code ?? ''),
            patientName: String(r.patientName ?? r.patient_name ?? ''),
            phone: String(r.phone ?? ''),
            pickup: String(r.pickup ?? ''),
            destination: String(r.destination ?? ''),
            pickupLat: typeof r.pickupLat === 'number' ? r.pickupLat : (typeof r.pickup_lat === 'number' ? r.pickup_lat : undefined),
            pickupLng: typeof r.pickupLng === 'number' ? r.pickupLng : (typeof r.pickup_lng === 'number' ? r.pickup_lng : undefined),
            destinationLat: typeof r.destinationLat === 'number' ? r.destinationLat : (typeof r.destination_lat === 'number' ? r.destination_lat : undefined),
            destinationLng: typeof r.destinationLng === 'number' ? r.destinationLng : (typeof r.destination_lng === 'number' ? r.destination_lng : undefined),
            ambulanceType: r.ambulanceType ?? r.ambulance_type ?? 'Basic',
            emergencyLevel: r.emergencyLevel ?? r.emergency_level ?? 'Normal',
            scheduledFor: String(r.scheduledTime ?? r.scheduled_for ?? ''),
            bookingType: r.bookingType ?? r.booking_type ?? 'now',
            status: r.status ?? 'pending',
            amount: Number(r.amount ?? 0),
            paymentMethod: String(r.paymentMethod ?? r.payment_method ?? 'Online'),
            createdAt: String(r.createdAt ?? r.created_at ?? new Date().toISOString()),
            assignedDriverUid: r.driverId ? String(r.driverId) : (r.assigned_driver_uid ? String(r.assigned_driver_uid) : undefined),
            assignedDriverName: r.assignedDriverName ? String(r.assignedDriverName) : (r.assigned_driver_name ? String(r.assigned_driver_name) : undefined),
          } as Booking;
        });
        rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setBookings(rows);
      },
      (err) => {
        console.error('[context] Real-time bookings onSnapshot error:', err);
      },
    );
    return () => unsubscribe();
  }, [user]);

  // Single real-time onSnapshot listener for notifications
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const ref = collection(db, COLLECTIONS.notifications);
    const isAdmin = user.user_metadata?.role === 'admin';
    const q = isAdmin
      ? query(ref)
      : query(ref, where('userId', '==', user.id));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows: NotificationItem[] = snapshot.docs.map((d) => {
          const r = d.data();
          let timeStr = 'Just now';
          if (r.createdAt && typeof r.createdAt.toDate === 'function') {
            timeStr = r.createdAt.toDate().toISOString();
          } else if (r.createdAt) {
            timeStr = String(r.createdAt);
          } else if (r.created_at) {
            timeStr = String(r.created_at);
          }

          return {
            id: d.id,
            title: String(r.title ?? ''),
            message: String(r.message ?? ''),
            time: timeStr,
            read: Boolean(r.read),
            type: (String(r.type ?? 'system') as NotificationItem['type']),
            bookingId: r.bookingId ? String(r.bookingId) : (r.booking_id ? String(r.booking_id) : undefined),
          };
        });

        rows.sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());
        setNotifications(rows);
      },
      (err) => {
        console.error('[context] Real-time notifications onSnapshot error:', err);
      },
    );

    return () => unsubscribe();
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
    // Optimistic local state update
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    updateNotification(id, { read: true }).catch((err) => {
      console.error('[context] markNotificationRead write failed:', err);
      // Revert if failed
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
    });
  };

  const markAllNotificationsRead = () => {
    // Optimistic local state update
    const previous = [...notifications];
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (user) {
      fsMarkAllNotificationsRead(user.id).catch((err) => {
        console.error('[context] markAllNotificationsRead write failed:', err);
        setNotifications(previous);
      });
    }
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
