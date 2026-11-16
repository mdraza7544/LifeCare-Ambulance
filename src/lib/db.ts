// Firestore data layer — replaces the previous Supabase query layer.
// Collections: bookings, ambulances, drivers, hospitals, users,
// emergency_contacts, alerts, notifications.
// Document fields keep the snake_case naming of the previous backend so the
// mapping layer (and Cloud Functions triggers) stay consistent.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import type {
  Address,
  Ambulance,
  Booking,
  BookingPin,
  Driver,
  EmergencyContact,
  Hospital,
  NotificationItem,
  UserProfile,
} from './types';

const COLLECTIONS = {
  bookings: 'bookings',
  bookingPins: 'booking_pins',
  ambulances: 'ambulances',
  drivers: 'drivers',
  hospitals: 'hospitals',
  users: 'users',
  emergencyContacts: 'emergency_contacts',
  alerts: 'alerts',
  notifications: 'notifications',
} as const;

const isoNow = () => new Date().toISOString();

/* ---------------- Bookings ---------------- */

function mapBooking(id: string, r: DocumentData): Booking {
  return {
    id,
    bookingCode: String(r.booking_code ?? ''),
    patientName: String(r.patient_name ?? ''),
    phone: String(r.phone ?? ''),
    pickup: String(r.pickup ?? ''),
    destination: String(r.destination ?? ''),
    pickupLat: typeof r.pickup_lat === 'number' ? r.pickup_lat : undefined,
    pickupLng: typeof r.pickup_lng === 'number' ? r.pickup_lng : undefined,
    ambulanceType: String(r.ambulance_type ?? 'Basic') as Booking['ambulanceType'],
    emergencyLevel: String(r.emergency_level ?? 'Normal') as Booking['emergencyLevel'],
    scheduledFor: String(r.scheduled_for ?? ''),
    bookingType: String(r.booking_type ?? 'now') as Booking['bookingType'],
    status: String(r.status ?? 'Scheduled') as Booking['status'],
    amount: Number(r.amount ?? 0),
    paymentMethod: String(r.payment_method ?? ''),
    createdAt: String(r.created_at ?? isoNow()),
    assignedDriverUid: r.assigned_driver_uid ? String(r.assigned_driver_uid) : undefined,
    assignedDriverName: r.assigned_driver_name ? String(r.assigned_driver_name) : undefined,
    verifiedAt: r.verified_at ? String(r.verified_at) : undefined,
  };
}

export async function fetchBookings(userId?: string | null): Promise<Booking[]> {
  if (!userId) return [];
  try {
    const ref = collection(db, COLLECTIONS.bookings);
    const q = query(ref, where('user_id', '==', userId));
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => mapBooking(d.id, d.data()));
    rows.sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0));
    return rows;
  } catch (err) {
    console.warn('[firestore] fetchBookings failed — returning an empty list.', err);
    return [];
  }
}

/** Admin-only: fetches ALL bookings (requires the `admin` custom claim). */
export async function fetchAllBookings(): Promise<Booking[]> {
  try {
    const ref = collection(db, COLLECTIONS.bookings);
    const q = query(ref, orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapBooking(d.id, d.data()));
  } catch (err) {
    console.warn('[firestore] fetchAllBookings failed — returning an empty list.', err);
    return [];
  }
}

export async function createBooking(b: Booking, userId?: string | null): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.bookings, b.id), {
    booking_code: b.bookingCode,
    patient_name: b.patientName,
    phone: b.phone,
    pickup: b.pickup,
    destination: b.destination,
    pickup_lat: b.pickupLat ?? null,
    pickup_lng: b.pickupLng ?? null,
    ambulance_type: b.ambulanceType,
    emergency_level: b.emergencyLevel,
    scheduled_for: b.scheduledFor,
    booking_type: b.bookingType,
    status: b.status,
    amount: b.amount,
    payment_method: b.paymentMethod,
    created_at: b.createdAt || isoNow(),
    user_id: userId ?? null,
  });
}

export async function updateBookingStatus(id: string, status: Booking['status']): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.bookings, id), { status });
}

/**
 * Live booking subscription (used by the tracking page). Emits the raw booking
 * document whenever it changes — dispatch updates `ambulance_lat` /
 * `ambulance_lng` on the booking doc, and the map reacts in real time.
 * Returns the unsubscribe function.
 */
export function watchBooking(
  id: string,
  onChange: (data: DocumentData | null) => void,
): () => void {
  try {
    return onSnapshot(
      doc(db, COLLECTIONS.bookings, id),
      (snap) => onChange(snap.exists() ? snap.data() : null),
      (err) => {
        console.warn('[firestore] watchBooking failed.', err);
        onChange(null);
      },
    );
  } catch (err) {
    console.warn('[firestore] watchBooking unavailable.', err);
    onChange(null);
    return () => undefined;
  }
}

/** Driver-only: fetches all bookings assigned to a driver (by Firebase UID). */
export async function fetchDriverBookings(driverUid: string): Promise<Booking[]> {
  try {
    const ref = collection(db, COLLECTIONS.bookings);
    const q = query(ref, where('assigned_driver_uid', '==', driverUid), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapBooking(d.id, d.data()));
  } catch (err) {
    console.warn('[firestore] fetchDriverBookings failed — returning an empty list.', err);
    return [];
  }
}

/* ---------------- Booking verification PIN ---------------- */

function mapBookingPin(id: string, r: DocumentData): BookingPin {
  return {
    bookingId: id,
    bookingCode: String(r.booking_code ?? ''),
    userId: r.user_id ? String(r.user_id) : null,
    pin: String(r.pin ?? ''),
    attempts: Number(r.attempts ?? 0),
    maxAttempts: Number(r.max_attempts ?? 5),
    verified: Boolean(r.verified),
    status: String(r.status ?? 'active') as BookingPin['status'],
    expiresAt: String(r.expires_at ?? ''),
    assignedDriverUid: r.assigned_driver_uid ? String(r.assigned_driver_uid) : null,
    assignedDriverName: r.assigned_driver_name ? String(r.assigned_driver_name) : null,
    createdAt: String(r.created_at ?? isoNow()),
  };
}

/** Fetches the pickup PIN for a booking (owner-only read by Firestore rules). */
export async function fetchBookingPin(bookingId: string): Promise<BookingPin | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.bookingPins, bookingId));
    if (!snap.exists()) return null;
    return mapBookingPin(bookingId, snap.data());
  } catch (err) {
    console.warn('[firestore] fetchBookingPin failed.', err);
    return null;
  }
}

/**
 * Live PIN subscription — used by the booking confirmation page so the PIN
 * appears as soon as the `onBookingCreated` Cloud Function generates it.
 * Returns the unsubscribe function.
 */
export function watchBookingPin(
  bookingId: string,
  onChange: (pin: BookingPin | null) => void,
): () => void {
  try {
    return onSnapshot(
      doc(db, COLLECTIONS.bookingPins, bookingId),
      (snap) => onChange(snap.exists() ? mapBookingPin(bookingId, snap.data()) : null),
      (err) => {
        console.warn('[firestore] watchBookingPin failed.', err);
        onChange(null);
      },
    );
  } catch (err) {
    console.warn('[firestore] watchBookingPin unavailable.', err);
    onChange(null);
    return () => undefined;
  }
}

/* ---------------- PIN verification callables (backend-only) ---------------- */

/** Verifies a pickup PIN server-side. Throws on failure (incorrect/expired/locked). */
export async function verifyBookingPin(
  bookingId: string,
  pin: string,
): Promise<{ ok: true; status: string; message: string }> {
  const fn = httpsCallable<
    { bookingId: string; pin: string },
    { ok: true; status: string; message: string }
  >(functions, 'verifyBookingPin');
  const res = await fn({ bookingId, pin });
  return res.data;
}

/** Admin-only: assigns a driver (by Firebase UID) to a booking. */
export async function assignDriverToBooking(
  bookingId: string,
  driverUid: string,
  driverName: string,
): Promise<{ ok: true; bookingId: string; driverUid: string }> {
  const fn = httpsCallable<
    { bookingId: string; driverUid: string; driverName: string },
    { ok: true; bookingId: string; driverUid: string }
  >(functions, 'assignDriverToBooking');
  const res = await fn({ bookingId, driverUid, driverName });
  return res.data;
}

/* ---------------- Ambulances ---------------- */

function mapAmbulance(id: string, r: DocumentData): Ambulance {
  return {
    id,
    code: String(r.code ?? ''),
    type: String(r.type ?? 'Basic') as Ambulance['type'],
    driverName: String(r.driver_name ?? ''),
    status: String(r.status ?? 'Available') as Ambulance['status'],
    location: String(r.location ?? ''),
    rating: Number(r.rating ?? 0),
  };
}

export async function fetchAmbulances(): Promise<Ambulance[]> {
  try {
    const snap = await getDocs(query(collection(db, COLLECTIONS.ambulances), orderBy('created_at', 'desc')));
    return snap.docs.map((d) => mapAmbulance(d.id, d.data()));
  } catch (err) {
    console.warn('[firestore] fetchAmbulances failed.', err);
    return [];
  }
}

export async function addAmbulance(input: {
  code: string; type: string; driverName: string; status: string; location: string;
}): Promise<void> {
  await addDoc(collection(db, COLLECTIONS.ambulances), {
    code: input.code,
    type: input.type,
    driver_name: input.driverName,
    status: input.status,
    location: input.location,
    rating: 4.5,
    created_at: isoNow(),
  });
}

export async function deleteAmbulance(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.ambulances, id));
}

/* ---------------- Drivers ---------------- */

function mapDriver(id: string, r: DocumentData): Driver {
  return {
    id,
    name: String(r.name ?? ''),
    phone: String(r.phone ?? ''),
    license: String(r.license ?? ''),
    status: String(r.status ?? 'Available') as Driver['status'],
    rating: Number(r.rating ?? 0),
    trips: Number(r.trips ?? 0),
    ambulanceCode: String(r.ambulance_code ?? ''),
  };
}

export async function fetchDrivers(): Promise<Driver[]> {
  try {
    const snap = await getDocs(query(collection(db, COLLECTIONS.drivers), orderBy('created_at', 'desc')));
    return snap.docs.map((d) => mapDriver(d.id, d.data()));
  } catch (err) {
    console.warn('[firestore] fetchDrivers failed.', err);
    return [];
  }
}

export async function addDriver(input: {
  name: string; phone: string; license: string; status: string; ambulanceCode: string;
}): Promise<void> {
  await addDoc(collection(db, COLLECTIONS.drivers), {
    name: input.name,
    phone: input.phone,
    license: input.license,
    status: input.status,
    ambulance_code: input.ambulanceCode,
    rating: 4.5,
    trips: 0,
    created_at: isoNow(),
  });
}

export async function deleteDriver(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.drivers, id));
}

/* ---------------- Hospitals ---------------- */

function mapHospital(id: string, r: DocumentData): Hospital {
  return {
    id,
    name: String(r.name ?? ''),
    area: String(r.area ?? ''),
    city: String(r.city ?? ''),
    address: String(r.address ?? ''),
    beds: Number(r.beds ?? 0),
    phone: String(r.phone ?? ''),
    emergency: Boolean(r.emergency),
    lat: typeof r.lat === 'number' ? r.lat : 0,
    lng: typeof r.lng === 'number' ? r.lng : 0,
  };
}

export async function fetchHospitals(): Promise<Hospital[]> {
  try {
    const snap = await getDocs(query(collection(db, COLLECTIONS.hospitals), orderBy('created_at', 'desc')));
    return snap.docs.map((d) => mapHospital(d.id, d.data()));
  } catch (err) {
    console.warn('[firestore] fetchHospitals failed.', err);
    return [];
  }
}

export async function addHospital(input: {
  name: string; area: string; city?: string; address?: string; beds: number; phone: string; emergency: boolean; lat?: number; lng?: number;
}): Promise<void> {
  await addDoc(collection(db, COLLECTIONS.hospitals), {
    name: input.name,
    area: input.area,
    city: input.city ?? '',
    address: input.address ?? '',
    beds: input.beds,
    phone: input.phone,
    emergency: input.emergency,
    lat: input.lat ?? 0,
    lng: input.lng ?? 0,
    created_at: isoNow(),
  });
}

export async function deleteHospital(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.hospitals, id));
}

/* ---------------- User profile ---------------- */

export async function fetchUserProfile(uid: string): Promise<Partial<UserProfile> | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.users, uid));
    if (!snap.exists()) return null;
    const r = snap.data();
    return {
      name: String(r.full_name ?? ''),
      email: String(r.email ?? ''),
      phone: String(r.phone ?? ''),
      dob: String(r.dob ?? ''),
      bloodGroup: String(r.blood_group ?? ''),
      address: String(r.address ?? ''),
      emergencyContact: String(r.emergency_contact ?? ''),
      emergencyPhone: String(r.emergency_phone ?? ''),
    };
  } catch (err) {
    console.warn('[firestore] fetchUserProfile failed.', err);
    return null;
  }
}

export async function saveUserProfile(uid: string, profile: UserProfile): Promise<void> {
  await setDoc(
    doc(db, COLLECTIONS.users, uid),
    {
      full_name: profile.name,
      email: profile.email,
      phone: profile.phone,
      dob: profile.dob,
      blood_group: profile.bloodGroup,
      address: profile.address,
      emergency_contact: profile.emergencyContact,
      emergency_phone: profile.emergencyPhone,
      updated_at: isoNow(),
    },
    { merge: true },
  );
}

export async function saveAddresses(uid: string, addresses: Address[]): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.users, uid), { addresses, updated_at: isoNow() }, { merge: true });
}

export async function fetchAddresses(uid: string): Promise<Address[]> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.users, uid));
    if (!snap.exists()) return [];
    const r = snap.data();
    if (!Array.isArray(r.addresses)) return [];
    return (r.addresses as Array<Record<string, unknown>>).map((a) => ({
      id: String(a.id ?? ''),
      label: String(a.label ?? ''),
      fullAddress: String(a.fullAddress ?? ''),
      city: String(a.city ?? ''),
      pincode: String(a.pincode ?? ''),
      isDefault: Boolean(a.isDefault),
    }));
  } catch (err) {
    console.warn('[firestore] fetchAddresses failed.', err);
    return [];
  }
}

/* ---------------- Notifications ---------------- */

export async function createNotification(userId: string, n: NotificationItem): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.notifications, n.id), {
    user_id: userId,
    title: n.title,
    message: n.message,
    time: n.time,
    read: n.read,
    type: n.type,
    created_at: isoNow(),
  });
}

export async function fetchNotifications(userId: string): Promise<NotificationItem[]> {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.notifications), where('user_id', '==', userId)),
    );
    const docs = snap.docs.slice().sort((a, b) => {
      const ta = String(a.data().created_at ?? '');
      const tb = String(b.data().created_at ?? '');
      return tb > ta ? 1 : tb < ta ? -1 : 0;
    });
    return docs.map((d) => {
      const r = d.data();
      return {
        id: d.id,
        title: String(r.title ?? ''),
        message: String(r.message ?? ''),
        time: String(r.time ?? ''),
        read: Boolean(r.read),
        type: String(r.type ?? 'system') as NotificationItem['type'],
      };
    });
  } catch (err) {
    console.warn('[firestore] fetchNotifications failed.', err);
    return [];
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.notifications, id), { read: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.notifications), where('user_id', '==', userId)),
  );
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    if (d.data().read === false) batch.update(d.ref, { read: true });
  });
  await batch.commit();
}

/* ---------------- Emergency contacts ---------------- */

function mapEmergencyContact(id: string, r: DocumentData): EmergencyContact {
  return {
    id,
    name: String(r.name ?? ''),
    phone: String(r.phone ?? ''),
    relationship: String(r.relationship ?? ''),
    email: r.email ? String(r.email) : undefined,
  };
}

export async function fetchEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.emergencyContacts), where('owner_uid', '==', userId)),
    );
    return snap.docs.map((d) => mapEmergencyContact(d.id, d.data()));
  } catch (err) {
    console.warn('[firestore] fetchEmergencyContacts failed.', err);
    return [];
  }
}

export async function addEmergencyContact(
  userId: string,
  input: Omit<EmergencyContact, 'id'>,
): Promise<void> {
  await addDoc(collection(db, COLLECTIONS.emergencyContacts), {
    owner_uid: userId,
    name: input.name,
    phone: input.phone,
    relationship: input.relationship,
    email: input.email ?? null,
    created_at: isoNow(),
  });
}

export async function removeEmergencyContact(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.emergencyContacts, id));
}

/* ---------------- Emergency alerts ---------------- */

export interface EmergencyAlertInput {
  userId: string;
  userName?: string;
  userPhone?: string;
  type: 'sos' | 'booking' | 'safety_check';
  message: string;
  location?: string;
  bookingCode?: string;
}

/**
 * Creates an `alerts` document. The `onAlertCreated` Cloud Function picks it up
 * and fans out emergency SMS (Twilio) + email (EmailJS) notifications to the
 * user's registered emergency contacts.
 */
export async function createEmergencyAlert(input: EmergencyAlertInput): Promise<string | null> {
  try {
    const ref = await addDoc(collection(db, COLLECTIONS.alerts), {
      user_id: input.userId,
      user_name: input.userName ?? null,
      user_phone: input.userPhone ?? null,
      type: input.type,
      message: input.message,
      location: input.location ?? null,
      booking_code: input.bookingCode ?? null,
      status: 'pending',
      created_at: isoNow(),
    });
    return ref.id;
  } catch (err) {
    console.warn('[firestore] createEmergencyAlert failed.', err);
    return null;
  }
}