// Shared Firestore data layer for LifeCare admin features.
// Stores documents in camelCase so the Firestore schema stays 1:1 with the TS types.
// This layer coexists with src/lib/db.ts (legacy snake_case mapping) — it does not
// modify that file or any UI/pages.
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Query,
  type QueryConstraint,
  type Timestamp,
  type UpdateData,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { db } from './firebase';

/* ============================================================================
   Schema / types (camelCase, 1:1 with Firestore document fields)
   ============================================================================ */

export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'paid'
  | 'confirmed'
  | 'allocated'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type BookingPriority = 'low' | 'normal' | 'high' | 'critical';

export type BookingPaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';

export type AmbulanceStatus = 'available' | 'booked' | 'maintenance';

export type DriverStatus = 'available' | 'allocated' | 'off-duty';

export type UserRole = 'user' | 'admin' | 'driver';

export type UserAccountStatus = 'active' | 'inactive';

export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';

export interface Booking {
  id: string;
  bookingCode?: string;
  userId: string;
  pickup: string;
  destination: string;
  priority: BookingPriority;
  status: BookingStatus;
  paymentStatus: BookingPaymentStatus;
  ambulanceId?: string;
  driverId?: string;
  scheduledTime: string;
  amount: number;
  patientName?: string;
  phone?: string;
  ambulanceType?: string;
  emergencyLevel?: string;
  paymentMethod?: string;
  pickupLat?: number;
  pickupLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  distanceText?: string;
  durationText?: string;
  distanceKm?: number;
  acceptedAt?: string;
  allocatedAt?: string;
  reachedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingInput {
  userId: string;
  pickup: string;
  destination: string;
  priority: BookingPriority;
  status?: BookingStatus;
  paymentStatus?: BookingPaymentStatus;
  ambulanceId?: string;
  driverId?: string;
  scheduledTime: string;
  amount: number;
  patientName?: string;
  phone?: string;
  ambulanceType?: string;
  emergencyLevel?: string;
  paymentMethod?: string;
  pickupLat?: number;
  pickupLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  distanceText?: string;
  durationText?: string;
  distanceKm?: number;
  /** Optional pre-generated booking code (display only; never used for routing). */
  bookingCode?: string;
  /** Optional reference to a notification doc created by the caller (e.g. admin). */
  notificationRef?: string;
}

export interface BookingPatch {
  pickup?: string;
  destination?: string;
  priority?: BookingPriority;
  status?: BookingStatus;
  paymentStatus?: BookingPaymentStatus;
  ambulanceId?: string;
  driverId?: string;
  scheduledTime?: string;
  amount?: number;
  patientName?: string;
  phone?: string;
  ambulanceType?: string;
  emergencyLevel?: string;
  paymentMethod?: string;
  pickupLat?: number;
  pickupLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  distanceText?: string;
  durationText?: string;
  distanceKm?: number;
  acceptedAt?: string;
  allocatedAt?: string;
  reachedAt?: string;
}

export interface Ambulance {
  id: string;
  number: string;
  type: string;
  status: AmbulanceStatus;
  currentBookingId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AmbulanceInput {
  number: string;
  type: string;
  status?: AmbulanceStatus;
  currentBookingId?: string;
}

export interface AmbulancePatch {
  number?: string;
  type?: string;
  status?: AmbulanceStatus;
  currentBookingId?: string | null;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  license?: string;
  status: DriverStatus;
  currentBookingId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DriverInput {
  name: string;
  phone: string;
  license?: string;
  status?: DriverStatus;
  currentBookingId?: string;
}

export interface DriverPatch {
  name?: string;
  phone?: string;
  license?: string;
  status?: DriverStatus;
  currentBookingId?: string | null;
}

export interface User {
  id: string; // Firebase Auth UID
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserAccountStatus;
  createdAt: string;
}

export interface UserInput {
  name: string;
  email: string;
  phone: string;
  role?: UserRole;
  status?: UserAccountStatus;
}

export interface UserPatch {
  name?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  status?: UserAccountStatus;
}

export interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  method: string;
  status: PaymentStatus;
  mode?: 'demo' | 'razorpay';
  createdAt: string;
}

export interface PaymentInput {
  bookingId: string;
  userId: string;
  amount: number;
  method?: string;
  status?: PaymentStatus;
}

export interface PaymentPatch {
  bookingId?: string;
  userId?: string;
  amount?: number;
  method?: string;
  status?: PaymentStatus;
}

/* Booking status flow documentation.
   pending -> accepted -> paid/confirmed -> allocated -> completed
   Terminal side-exits: rejected / cancelled (from pending or accepted). */
export const BOOKING_FLOW: Record<BookingStatus, BookingStatus[]> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['paid', 'confirmed', 'rejected', 'cancelled'],
  paid: ['confirmed'],
  confirmed: ['allocated'],
  allocated: ['completed', 'cancelled'],
  completed: [],
  rejected: [],
  cancelled: [],
};

/** Returns true if `from -> to` is a permitted booking status transition. */
export function isValidBookingTransition(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  if (from === to) return true;
  return BOOKING_FLOW[from]?.includes(to) ?? false;
}

/* ============================================================================
   Collection references
   ============================================================================ */

const COLLECTIONS = {
  bookings: 'bookings',
  ambulances: 'ambulances',
  drivers: 'drivers',
  users: 'users',
  payments: 'payments',
  notifications: 'notifications',
} as const;

const isoNow = () => new Date().toISOString();

/** Normalises a Firestore value (Timestamp | string | undefined) to an ISO string. */
function toISO(v: Timestamp | string | null | undefined): string {
  if (v === null || v === undefined) return isoNow();
  if (typeof v === 'string') return v;
  try {
    return v.toDate().toISOString();
  } catch {
    return isoNow();
  }
}

/* ============================================================================
   Document mapping
   ============================================================================ */

function mapBooking(id: string, r: DocumentData): Booking {
  return {
    id,
    bookingCode: r.bookingCode ? String(r.bookingCode) : (r.booking_code ? String(r.booking_code) : undefined),
    userId: String(r.userId ?? r.user_id ?? ''),
    pickup: String(r.pickup ?? ''),
    destination: String(r.destination ?? ''),
    priority: (r.priority ?? 'normal') as BookingPriority,
    status: (r.status ?? 'pending') as BookingStatus,
    paymentStatus: (r.paymentStatus ?? r.payment_status ?? 'pending') as BookingPaymentStatus,
    ambulanceId: r.ambulanceId ? String(r.ambulanceId) : undefined,
    driverId: r.driverId ? String(r.driverId) : String(r.assigned_driver_uid || r.assignedDriverUid || ''),
    scheduledTime: String(r.scheduledTime ?? r.scheduled_for ?? ''),
    amount: Number(r.amount ?? 0),
    patientName: r.patientName ? String(r.patientName) : (r.patient_name ? String(r.patient_name) : undefined),
    phone: r.phone ? String(r.phone) : undefined,
    ambulanceType: r.ambulanceType ? String(r.ambulanceType) : (r.ambulance_type ? String(r.ambulance_type) : undefined),
    emergencyLevel: r.emergencyLevel ? String(r.emergencyLevel) : (r.emergency_level ? String(r.emergency_level) : undefined),
    paymentMethod: r.paymentMethod ? String(r.paymentMethod) : (r.payment_method ? String(r.payment_method) : undefined),
    pickupLat: typeof r.pickupLat === 'number' ? r.pickupLat : (typeof r.pickup_lat === 'number' ? r.pickup_lat : undefined),
    pickupLng: typeof r.pickupLng === 'number' ? r.pickupLng : (typeof r.pickup_lng === 'number' ? r.pickup_lng : undefined),
    destinationLat: typeof r.destinationLat === 'number' ? r.destinationLat : (typeof r.destination_lat === 'number' ? r.destination_lat : undefined),
    destinationLng: typeof r.destinationLng === 'number' ? r.destinationLng : (typeof r.destination_lng === 'number' ? r.destination_lng : undefined),
    distanceText: r.distanceText ? String(r.distanceText) : (r.distance_text ? String(r.distance_text) : undefined),
    durationText: r.durationText ? String(r.durationText) : (r.duration_text ? String(r.duration_text) : undefined),
    distanceKm: typeof r.distanceKm === 'number' ? r.distanceKm : undefined,
    acceptedAt: r.acceptedAt ? toISO(r.acceptedAt) : (r.accepted_at ? toISO(r.accepted_at) : undefined),
    allocatedAt: r.allocatedAt ? toISO(r.allocatedAt) : (r.allocated_at ? toISO(r.allocated_at) : undefined),
    reachedAt: r.reachedAt ? toISO(r.reachedAt) : (r.reached_at ? toISO(r.reached_at) : undefined),
    createdAt: toISO(r.createdAt ?? r.created_at),
    updatedAt: toISO(r.updatedAt ?? r.updated_at),
  };
}

function mapAmbulance(id: string, r: DocumentData): Ambulance {
  const rawStatus = String(r.status ?? 'available').toLowerCase();
  const validStatus: AmbulanceStatus =
    rawStatus === 'booked' || rawStatus === 'on duty'
      ? 'booked'
      : rawStatus === 'maintenance'
      ? 'maintenance'
      : 'available';

  return {
    id,
    number: String(r.number ?? r.numberPlate ?? r.plateNumber ?? r.code ?? ''),
    type: String(r.type ?? 'BLS'),
    status: validStatus,
    currentBookingId: r.currentBookingId
      ? String(r.currentBookingId)
      : r.current_booking_id
      ? String(r.current_booking_id)
      : undefined,
    createdAt: r.createdAt ? toISO(r.createdAt) : (r.created_at ? toISO(r.created_at) : undefined),
    updatedAt: r.updatedAt ? toISO(r.updatedAt) : (r.updated_at ? toISO(r.updated_at) : undefined),
  };
}

function mapDriver(id: string, r: DocumentData): Driver {
  const rawStatus = String(r.status ?? 'available').toLowerCase();
  const validStatus: DriverStatus =
    rawStatus === 'allocated' || rawStatus === 'on duty' || rawStatus === 'booked'
      ? 'allocated'
      : rawStatus === 'off-duty' || rawStatus === 'off duty'
      ? 'off-duty'
      : 'available';

  return {
    id,
    name: String(r.name ?? ''),
    phone: String(r.phone ?? ''),
    license: r.license ? String(r.license) : r.licenseNumber ? String(r.licenseNumber) : undefined,
    status: validStatus,
    currentBookingId: r.currentBookingId
      ? String(r.currentBookingId)
      : r.current_booking_id
      ? String(r.current_booking_id)
      : undefined,
    createdAt: r.createdAt ? toISO(r.createdAt) : (r.created_at ? toISO(r.created_at) : undefined),
    updatedAt: r.updatedAt ? toISO(r.updatedAt) : (r.updated_at ? toISO(r.updated_at) : undefined),
  };
}

function mapUser(id: string, r: DocumentData): User {
  const name = String(r.name ?? r.full_name ?? r.displayName ?? '').trim();
  const email = String(r.email ?? '').trim();
  const phone = String(r.phone ?? r.phoneNumber ?? '').trim();
  const rawRole = String(r.role ?? 'user').toLowerCase();
  const role: UserRole = rawRole === 'admin' ? 'admin' : rawRole === 'driver' ? 'driver' : 'user';
  const rawStatus = String(r.status ?? 'active').toLowerCase();
  const status: UserAccountStatus =
    rawStatus === 'inactive' || rawStatus === 'disabled' || rawStatus === 'suspended'
      ? 'inactive'
      : 'active';
  const createdAt = toISO(r.createdAt ?? r.created_at);

  return {
    id: String(r.uid ?? id),
    name: name || (email ? email.split('@')[0] : 'User'),
    email,
    phone,
    role,
    status,
    createdAt,
  };
}

function mapPayment(id: string, r: DocumentData): Payment {
  const rawStatus = String(r.status ?? 'pending').toLowerCase();
  const status: PaymentStatus =
    rawStatus === 'paid' || rawStatus === 'captured'
      ? 'paid'
      : rawStatus === 'refunded'
      ? 'refunded'
      : rawStatus === 'failed'
      ? 'failed'
      : 'pending';

  let amount = Number(r.amount ?? 0);
  if (r.amount_in_paise && r.amount === r.amount_in_paise) {
    amount = Math.round(amount / 100);
  }

  return {
    id,
    bookingId: String(r.bookingId ?? r.booking_id ?? ''),
    userId: String(r.userId ?? r.user_id ?? ''),
    amount,
    method: String(r.method ?? r.payment_method ?? 'Razorpay'),
    status,
    mode: (r.mode === 'razorpay' ? 'razorpay' : 'demo') as 'demo' | 'razorpay',
    createdAt: String(r.createdAt ?? r.created_at ?? r.verified_at ?? r.updated_at ?? isoNow()),
  };
}


/* ============================================================================
   CRUD helpers
   ============================================================================ */

/* ---------- Bookings ---------- */

export async function createBooking(input: BookingInput): Promise<string> {
  const now = isoNow();
  const docRef = await addDoc(collection(db, COLLECTIONS.bookings), {
    userId: input.userId,
    pickup: input.pickup,
    destination: input.destination,
    priority: input.priority,
    status: input.status ?? 'pending',
    paymentStatus: input.paymentStatus ?? 'pending',
    amount: input.amount,
    scheduledTime: input.scheduledTime,
    ...(input.bookingCode !== undefined ? { bookingCode: input.bookingCode } : {}),
    ...(input.ambulanceId !== undefined ? { ambulanceId: input.ambulanceId } : {}),
    ...(input.driverId !== undefined ? { driverId: input.driverId } : {}),
    ...(input.patientName !== undefined ? { patientName: input.patientName } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.ambulanceType !== undefined ? { ambulanceType: input.ambulanceType } : {}),
    ...(input.emergencyLevel !== undefined ? { emergencyLevel: input.emergencyLevel } : {}),
    ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
    ...(input.pickupLat !== undefined ? { pickupLat: input.pickupLat } : {}),
    ...(input.pickupLng !== undefined ? { pickupLng: input.pickupLng } : {}),
    ...(input.destinationLat !== undefined ? { destinationLat: input.destinationLat } : {}),
    ...(input.destinationLng !== undefined ? { destinationLng: input.destinationLng } : {}),
    ...(input.distanceText !== undefined ? { distanceText: input.distanceText } : {}),
    ...(input.durationText !== undefined ? { durationText: input.durationText } : {}),
    ...(input.distanceKm !== undefined ? { distanceKm: input.distanceKm } : {}),
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function getBooking(id: string): Promise<Booking | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.bookings, id));
  if (!snap.exists()) return null;
  return mapBooking(snap.id, snap.data());
}

export async function updateBooking(id: string, patch: BookingPatch): Promise<void> {
  if (patch.status !== undefined) {
    const current = await getBooking(id);
    if (!current) throw new Error(`Booking ${id} not found.`);
    if (!isValidBookingTransition(current.status, patch.status)) {
      throw new Error(
        `Invalid booking status transition: ${current.status} → ${patch.status}.`,
      );
    }
  }
  await updateDoc(doc(db, COLLECTIONS.bookings, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBooking(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.bookings, id));
}

/* ---------- Ambulances ---------- */

export async function createAmbulance(input: AmbulanceInput): Promise<string> {
  const now = isoNow();
  const docRef = await addDoc(collection(db, COLLECTIONS.ambulances), {
    number: input.number,
    type: input.type,
    status: (input.status ?? 'available').toLowerCase(),
    ...(input.currentBookingId !== undefined
      ? { currentBookingId: input.currentBookingId }
      : {}),
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function getAmbulance(id: string): Promise<Ambulance | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.ambulances, id));
  if (!snap.exists()) return null;
  return mapAmbulance(snap.id, snap.data());
}

export async function updateAmbulance(
  id: string,
  patch: AmbulancePatch,
): Promise<void> {
  const data: UpdateData<DocumentData> = {
    updatedAt: isoNow(),
  };
  if (patch.number !== undefined) data.number = patch.number;
  if (patch.type !== undefined) data.type = patch.type;
  if (patch.status !== undefined) data.status = patch.status.toLowerCase();
  if (patch.currentBookingId !== undefined) {
    data.currentBookingId =
      patch.currentBookingId === null ? deleteField() : patch.currentBookingId;
  }
  await updateDoc(doc(db, COLLECTIONS.ambulances, id), data);
}

export async function deleteAmbulance(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.ambulances, id));
}

/**
 * Allocates an available ambulance and driver to a confirmed booking atomically via a Firestore transaction.
 * Checks ambulance and driver availability inside the transaction to prevent double-allocation.
 */
export async function allocateAmbulanceToBooking(
  bookingId: string,
  ambulanceId: string,
  driverId?: string,
): Promise<void> {
  const ambRef = doc(db, COLLECTIONS.ambulances, ambulanceId);
  const bookingRef = doc(db, COLLECTIONS.bookings, bookingId);
  const driverRef = driverId ? doc(db, COLLECTIONS.drivers, driverId) : null;

  await runTransaction(db, async (transaction) => {
    // 1. All transaction reads must precede any writes
    const ambSnap = await transaction.get(ambRef);
    if (!ambSnap.exists()) {
      throw new Error(`Ambulance "${ambulanceId}" does not exist.`);
    }

    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists()) {
      throw new Error(`Booking "${bookingId}" does not exist.`);
    }

    let driverSnap = null;
    if (driverRef) {
      driverSnap = await transaction.get(driverRef);
      if (!driverSnap.exists()) {
        throw new Error(`Driver "${driverId}" does not exist.`);
      }
    }

    const ambData = ambSnap.data();
    const ambStatus = String(ambData.status ?? 'available').toLowerCase();
    if (ambStatus !== 'available') {
      throw new Error(
        `Ambulance ${ambData.number || ambulanceId} is currently ${ambStatus}. Double-allocation prevented.`,
      );
    }

    const bookingData = bookingSnap.data();
    const currentStatus = String(bookingData.status ?? 'pending');
    if (currentStatus !== 'confirmed') {
      throw new Error(
        `Cannot allocate ambulance: booking status is "${currentStatus}" (must be "confirmed").`,
      );
    }

    if (driverSnap) {
      const driverData = driverSnap.data();
      const rawDriverStatus = String(driverData.status ?? 'available').toLowerCase();
      const driverStatus =
        rawDriverStatus === 'allocated' || rawDriverStatus === 'on duty' || rawDriverStatus === 'booked'
          ? 'allocated'
          : rawDriverStatus === 'off-duty' || rawDriverStatus === 'off duty'
          ? 'off-duty'
          : 'available';
      if (driverStatus !== 'available') {
        throw new Error(
          `Driver ${driverData.name || driverId} is currently ${driverStatus}. Double-allocation prevented.`,
        );
      }
    }

    // 2. Transaction writes
    const now = isoNow();
    transaction.update(bookingRef, {
      ambulanceId: ambulanceId,
      ...(driverId ? { driverId: driverId } : {}),
      status: 'allocated',
      allocatedAt: now,
      updatedAt: now,
    });

    transaction.update(ambRef, {
      status: 'booked',
      currentBookingId: bookingId,
      updatedAt: now,
    });

    if (driverRef) {
      transaction.update(driverRef, {
        status: 'allocated',
        currentBookingId: bookingId,
        updatedAt: now,
      });
    }
  });

  // Non-blocking notification to the user
  try {
    const booking = await getBooking(bookingId);
    if (booking?.userId) {
      await createNotification({
        userId: booking.userId,
        title: 'Ambulance & Driver Allocated',
        message: `Ambulance and driver have been allocated for your booking ${booking.bookingCode || bookingId}. They are on their way.`,
        type: 'booking',
        bookingId: bookingId,
      });
    }
  } catch (err) {
    console.warn('[allocation] User notification error:', err);
  }
}

/**
 * Marks an allocated booking as reached in a single atomic transaction.
 * Sets booking status = "completed", ambulance status = "available", driver status = "available",
 * and clears currentBookingId on both ambulance and driver.
 */
export async function markBookingReached(bookingId: string): Promise<void> {
  const bookingRef = doc(db, COLLECTIONS.bookings, bookingId);

  await runTransaction(db, async (transaction) => {
    // 1. All transaction reads first
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists()) {
      throw new Error(`Booking "${bookingId}" does not exist.`);
    }

    const bookingData = bookingSnap.data();
    const currentStatus = String(bookingData.status ?? '');
    if (currentStatus !== 'allocated') {
      throw new Error(
        `Cannot mark as reached: booking status is "${currentStatus}" (must be "allocated").`,
      );
    }

    const ambulanceId = bookingData.ambulanceId ? String(bookingData.ambulanceId) : null;
    let ambRef = null;
    if (ambulanceId) {
      const candidateAmbRef = doc(db, COLLECTIONS.ambulances, ambulanceId);
      const ambSnap = await transaction.get(candidateAmbRef);
      if (ambSnap.exists()) {
        ambRef = candidateAmbRef;
      }
    }

    const driverId = bookingData.driverId ? String(bookingData.driverId) : null;
    let driverRef = null;
    if (driverId) {
      const candidateDriverRef = doc(db, COLLECTIONS.drivers, driverId);
      const driverSnap = await transaction.get(candidateDriverRef);
      if (driverSnap.exists()) {
        driverRef = candidateDriverRef;
      }
    }

    // 2. Transaction writes
    const now = isoNow();
    transaction.update(bookingRef, {
      status: 'completed',
      reachedAt: now,
      updatedAt: now,
    });

    if (ambRef) {
      transaction.update(ambRef, {
        status: 'available',
        currentBookingId: deleteField(),
        updatedAt: now,
      });
    }

    if (driverRef) {
      transaction.update(driverRef, {
        status: 'available',
        currentBookingId: deleteField(),
        updatedAt: now,
      });
    }
  });

  // Non-blocking notification to user
  try {
    const booking = await getBooking(bookingId);
    if (booking?.userId) {
      await createNotification({
        userId: booking.userId,
        title: 'Ambulance Reached',
        message: `Your ambulance for booking ${booking.bookingCode || bookingId} has reached the destination. Trip completed.`,
        type: 'booking',
        bookingId: bookingId,
      });
    }
  } catch (err) {
    console.warn('[markBookingReached] Notification error:', err);
  }
}

/* ---------- Drivers ---------- */

export async function createDriver(input: DriverInput): Promise<string> {
  const now = isoNow();
  const docRef = await addDoc(collection(db, COLLECTIONS.drivers), {
    name: input.name,
    phone: input.phone,
    ...(input.license !== undefined ? { license: input.license } : {}),
    status: (input.status ?? 'available').toLowerCase(),
    ...(input.currentBookingId !== undefined
      ? { currentBookingId: input.currentBookingId }
      : {}),
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function getDriver(id: string): Promise<Driver | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.drivers, id));
  if (!snap.exists()) return null;
  return mapDriver(snap.id, snap.data());
}

export async function updateDriver(id: string, patch: DriverPatch): Promise<void> {
  const data: UpdateData<DocumentData> = {
    updatedAt: isoNow(),
  };
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.phone !== undefined) data.phone = patch.phone;
  if (patch.license !== undefined) data.license = patch.license;
  if (patch.status !== undefined) data.status = patch.status.toLowerCase();
  if (patch.currentBookingId !== undefined) {
    data.currentBookingId =
      patch.currentBookingId === null ? deleteField() : patch.currentBookingId;
  }
  await updateDoc(doc(db, COLLECTIONS.drivers, id), data);
}

export async function deleteDriver(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.drivers, id));
}

/* ---------- Users ---------- */

export async function createUser(input: UserInput, uid: string): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.users, uid), {
    name: input.name,
    email: input.email,
    phone: input.phone,
    role: input.role ?? 'user',
    status: input.status ?? 'active',
    createdAt: isoNow(),
  });
}

export async function getUser(id: string): Promise<User | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.users, id));
  if (!snap.exists()) return null;
  return mapUser(snap.id, snap.data());
}

export async function updateUser(id: string, patch: UserPatch): Promise<void> {
  const payload: UpdateData<DocumentData> = { ...patch };
  if (patch.name) {
    payload.name = patch.name;
    payload.full_name = patch.name;
  }
  if (patch.status) {
    payload.status = patch.status;
  }
  if (patch.role) {
    payload.role = patch.role;
  }
  payload.updatedAt = isoNow();
  payload.updated_at = isoNow();
  await updateDoc(doc(db, COLLECTIONS.users, id), payload);
}

export async function deleteUser(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.users, id));
}

/* ---------- Payments ---------- */

export async function createPayment(input: PaymentInput): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTIONS.payments), {
    bookingId: input.bookingId,
    userId: input.userId,
    amount: input.amount,
    status: input.status ?? 'pending',
    createdAt: isoNow(),
  });
  return docRef.id;
}

export async function getPayment(id: string): Promise<Payment | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.payments, id));
  if (!snap.exists()) return null;
  return mapPayment(snap.id, snap.data());
}

export async function updatePayment(
  id: string,
  patch: PaymentPatch,
): Promise<void> {
  const payload: UpdateData<DocumentData> = { ...patch };
  await updateDoc(doc(db, COLLECTIONS.payments, id), payload);
}

export async function deletePayment(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.payments, id));
}

/**
 * Records a confirmed payment idempotently using paymentId as the document ID,
 * and sets the booking document's paymentStatus = "paid".
 */
export async function recordConfirmedPayment(input: {
  paymentId: string;
  bookingId: string;
  userId: string;
  amount: number;
  method?: string;
  status?: PaymentStatus;
  mode?: 'demo' | 'razorpay';
}): Promise<void> {
  const now = isoNow();
  const paymentRef = doc(db, COLLECTIONS.payments, input.paymentId);
  await setDoc(
    paymentRef,
    {
      id: input.paymentId,
      paymentId: input.paymentId,
      bookingId: input.bookingId,
      booking_id: input.bookingId,
      userId: input.userId,
      user_id: input.userId,
      amount: input.amount,
      method: input.method || 'Razorpay',
      status: input.status || 'paid',
      mode: input.mode || 'demo',
      createdAt: now,
      created_at: now,
      updatedAt: now,
      updated_at: now,
    },
    { merge: true },
  );

  const bookingRef = doc(db, COLLECTIONS.bookings, input.bookingId);
  await setDoc(
    bookingRef,
    {
      status: 'confirmed',
      paymentStatus: 'paid',
      payment_status: 'paid',
      paymentMethod: input.method || 'Razorpay',
      payment_method: input.method || 'Razorpay',
      paymentUpdatedAt: now,
      updatedAt: now,
    },
    { merge: true },
  );
}


/* ============================================================================
   Real-time subscription hooks (onSnapshot with unsubscribe cleanup)
   ============================================================================ */

interface UseCollectionResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

/** Internal hook: subscribes to a Firestore query and keeps local state in sync. */
function useCollection<T>(
  q: Query | null,
  map: (id: string, data: DocumentData) => T,
): UseCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!q) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }
    let active = true;
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (!active) return;
        setData(snap.docs.map((d) => map(d.id, d.data())));
        setLoading(false);
        setError(null);
      },
      (err) => {
        if (!active) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [q, map]);

  return { data, loading, error };
}

/** All bookings, or only those belonging to `userId` when provided. Ordered by createdAt desc. */
export function useBookings(userId?: string | null): UseCollectionResult<Booking> {
  const q = useMemo(() => {
    const ref = collection(db, COLLECTIONS.bookings);
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    if (userId) constraints.unshift(where('userId', '==', userId));
    return query(ref, ...constraints);
  }, [userId]);
  return useCollection(q, mapBooking);
}

/** All ambulances, updated in real time via onSnapshot. */
export function useAmbulances(): UseCollectionResult<Ambulance> {
  const q = useMemo(
    () => query(collection(db, COLLECTIONS.ambulances)),
    [],
  );
  const result = useCollection(q, mapAmbulance);
  const sortedData = useMemo(() => {
    return [...result.data].sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return b.createdAt.localeCompare(a.createdAt);
      }
      return a.number.localeCompare(b.number);
    });
  }, [result.data]);

  return { data: sortedData, loading: result.loading, error: result.error };
}

/** All drivers, updated in real time via onSnapshot. */
export function useDrivers(): UseCollectionResult<Driver> {
  const q = useMemo(
    () => query(collection(db, COLLECTIONS.drivers)),
    [],
  );
  const result = useCollection(q, mapDriver);
  const sortedData = useMemo(() => {
    return [...result.data].sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return b.createdAt.localeCompare(a.createdAt);
      }
      return a.name.localeCompare(b.name);
    });
  }, [result.data]);

  return { data: sortedData, loading: result.loading, error: result.error };
}

/** All user profiles, updated in real time via onSnapshot. */
export function useUsers(): UseCollectionResult<User> {
  const q = useMemo(
    () => query(collection(db, COLLECTIONS.users)),
    [],
  );
  const result = useCollection(q, mapUser);
  const sortedData = useMemo(() => {
    return [...result.data].sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return b.createdAt.localeCompare(a.createdAt);
      }
      return a.name.localeCompare(b.name);
    });
  }, [result.data]);

  return { data: sortedData, loading: result.loading, error: result.error };
}

/** All payments, or only those for `bookingId` when provided. Subscribes via onSnapshot in real time. */
export function usePayments(bookingId?: string | null): UseCollectionResult<Payment> {
  const q = useMemo(() => {
    const ref = collection(db, COLLECTIONS.payments);
    if (bookingId) {
      return query(ref, where('bookingId', '==', bookingId));
    }
    return query(ref);
  }, [bookingId]);

  const result = useCollection(q, mapPayment);

  const sortedData = useMemo(() => {
    return [...result.data].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime() || 0;
      const tb = new Date(b.createdAt).getTime() || 0;
      return tb - ta;
    });
  }, [result.data]);

  return { data: sortedData, loading: result.loading, error: result.error };
}

/* ============================================================================
   Notifications (written by admin via Cloud Functions / client; owned by user)
   ============================================================================ */

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  type: 'booking' | 'payment' | 'system' | 'driver';
  bookingId?: string;
  createdAt: string;
}

export interface NotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: Notification['type'];
  bookingId?: string;
}

export interface NotificationPatch {
  read?: boolean;
}

export async function createNotification(input: NotificationInput): Promise<string> {
  const now = isoNow();
  const docRef = await addDoc(collection(db, COLLECTIONS.notifications), {
    userId: input.userId,
    user_id: input.userId,
    title: input.title,
    message: input.message,
    read: false,
    type: input.type ?? 'system',
    ...(input.bookingId !== undefined ? { bookingId: input.bookingId } : {}),
    createdAt: now,
    created_at: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateNotification(id: string, patch: NotificationPatch): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.notifications, id), {
    ...patch,
    updatedAt: isoNow(),
  });
}

/** Single booking real-time subscription. */
export function useBooking(id: string | null): UseBookingResult {
  const [data, setData] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    let active = true;
    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.bookings, id),
      (snap) => {
        if (!active) return;
        setData(snap.exists() ? mapBooking(snap.id, snap.data()) : null);
        setLoading(false);
        setError(null);
      },
      (err) => {
        if (!active) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [id]);

  return { data, loading, error };
}

interface UseBookingResult {
  data: Booking | null;
  loading: boolean;
  error: Error | null;
}

/** All notifications for a user (or all if userId not provided), ordered by createdAt desc. */
export function useNotifications(userId?: string | null): UseCollectionResult<Notification> {
  const q = useMemo(() => {
    if (userId === null || userId === '') return null;
    const ref = collection(db, COLLECTIONS.notifications);
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    if (userId) constraints.unshift(where('userId', '==', userId));
    return query(ref, ...constraints);
  }, [userId]);
  return useCollection(q, mapNotification);
}

function mapNotification(id: string, r: DocumentData): Notification {
  return {
    id,
    userId: String(r.userId ?? r.user_id ?? ''),
    title: String(r.title ?? ''),
    message: String(r.message ?? ''),
    read: Boolean(r.read),
    type: (r.type ?? 'system') as Notification['type'],
    bookingId: r.bookingId ? String(r.bookingId) : undefined,
    createdAt: toISO(r.createdAt ?? r.created_at),
  };
}

