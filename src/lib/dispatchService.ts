/**
 * LifeCare Ambulance Service — Dispatch & Queue Scheduling Service
 *
 * Manages automated dispatch rules:
 * - Auto-Accept: checks net availability (available fleet minus accepted/confirmed reservations).
 * - Accept Queue: pending bookings waiting for fleet availability (emergency priority + FIFO).
 * - Auto-Allocate: assigns ambulance & driver atomically upon payment confirmation.
 * - Allocation Queue: confirmed paid bookings waiting for freed fleet.
 * - Auto-Expire: cancels unpaid accepted bookings after 15 minutes.
 * - Manual Overrides: admin can toggle auto-accept/allocate and manually accept/allocate.
 */

import { useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  deleteField,
  query,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  COLLECTIONS,
  allocateAmbulanceToBooking,
  createNotification,
  type Booking,
  type BookingPriority,
  type Ambulance,
  type Driver,
} from './firestoreService';

export const PAYMENT_EXPIRY_MINUTES = 15;
export const PAYMENT_TIMEOUT_MS = PAYMENT_EXPIRY_MINUTES * 60 * 1000;

export interface DispatchSettings {
  autoAccept: boolean;
  autoAllocate: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_DISPATCH_SETTINGS: DispatchSettings = {
  autoAccept: true,
  autoAllocate: true,
};

const DISPATCH_SETTINGS_DOC = 'dispatch';

/**
 * Priority weighting for queue sorting.
 * Critical > High > Normal > Low
 */
export const PRIORITY_WEIGHT: Record<BookingPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

/**
 * Compares two queued bookings:
 * 1. Emergency priority first (Critical > High > Normal > Low)
 * 2. FIFO by queuedAt (or createdAt) ascending
 */
export function compareQueuedBookings(a: Booking, b: Booking): number {
  const pA = PRIORITY_WEIGHT[a.priority] ?? 2;
  const pB = PRIORITY_WEIGHT[b.priority] ?? 2;
  if (pB !== pA) return pB - pA;

  const tA = new Date(a.queuedAt || a.createdAt).getTime();
  const tB = new Date(b.queuedAt || b.createdAt).getTime();
  return tA - tB;
}

/**
 * Calculates a booking's 1-based queue position and total count in its queue.
 */
export function getQueuePosition(
  bookings: Booking[],
  targetBookingId: string,
  queueType: 'accept' | 'allocate',
): { position: number; total: number } {
  const inQueue = bookings.filter((b) => {
    if (queueType === 'accept') {
      return b.status === 'pending' && b.queueType === 'accept';
    }
    return b.status === 'confirmed' && b.queueType === 'allocate';
  });

  inQueue.sort(compareQueuedBookings);

  const index = inQueue.findIndex((b) => b.id === targetBookingId);
  return {
    position: index >= 0 ? index + 1 : 0,
    total: inQueue.length,
  };
}

/** Fetches current dispatch settings from Firestore. */
export async function getDispatchSettings(): Promise<DispatchSettings> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.settings, DISPATCH_SETTINGS_DOC));
    if (snap.exists()) {
      const data = snap.data();
      return {
        autoAccept: data.autoAccept !== undefined ? Boolean(data.autoAccept) : true,
        autoAllocate: data.autoAllocate !== undefined ? Boolean(data.autoAllocate) : true,
        updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
        updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
      };
    }
  } catch (err) {
    console.warn('[dispatch] Could not load settings, falling back to defaults:', err);
  }
  return { ...DEFAULT_DISPATCH_SETTINGS };
}

/** Updates dispatch settings in Firestore. */
export async function updateDispatchSettings(patch: Partial<DispatchSettings>): Promise<void> {
  const ref = doc(db, COLLECTIONS.settings, DISPATCH_SETTINGS_DOC);
  await setDoc(
    ref,
    {
      ...patch,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

/** Real-time hook for dispatch settings. */
export function useDispatchSettings() {
  const [settings, setSettings] = useState<DispatchSettings>(DEFAULT_DISPATCH_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const ref = doc(db, COLLECTIONS.settings, DISPATCH_SETTINGS_DOC);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setSettings({
            autoAccept: data.autoAccept !== undefined ? Boolean(data.autoAccept) : true,
            autoAllocate: data.autoAllocate !== undefined ? Boolean(data.autoAllocate) : true,
            updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
            updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
          });
        } else {
          setSettings(DEFAULT_DISPATCH_SETTINGS);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('[dispatch] settings listener error:', err);
        setError(err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  return { settings, loading, error };
}

// Concurrency lock for processQueue execution within the client tab
let isProcessingQueue = false;

/**
 * Checks for accepted bookings that have remained unpaid beyond PAYMENT_TIMEOUT_MS (15 minutes).
 * Expired bookings release their reservation so waiting queued bookings can proceed.
 */
export async function checkExpiredBookings(): Promise<number> {
  let expiredCount = 0;
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.bookings));
    const now = Date.now();

    for (const d of snap.docs) {
      const data = d.data();
      if (data.status === 'accepted' && data.paymentStatus !== 'paid') {
        const acceptedTime = new Date(data.acceptedAt || data.createdAt || 0).getTime();
        if (acceptedTime > 0 && now - acceptedTime > PAYMENT_TIMEOUT_MS) {
          try {
            const bRef = doc(db, COLLECTIONS.bookings, d.id);
            const iso = new Date().toISOString();
            await setDoc(
              bRef,
              {
                status: 'expired',
                queueType: deleteField(),
                expiredAt: iso,
                updatedAt: iso,
              },
              { merge: true },
            );
            expiredCount++;

            if (data.userId) {
              await createNotification({
                id: `${d.id}_expired`,
                userId: data.userId,
                title: 'Booking expired',
                message: `Booking ${data.bookingCode || d.id} was not paid within ${PAYMENT_EXPIRY_MINUTES} minutes and has expired.`,
                type: 'booking',
                bookingId: d.id,
              });
            }
          } catch (err) {
            console.warn(`[dispatch] Error expiring booking ${d.id}:`, err);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[dispatch] checkExpiredBookings query failed:', err);
  }
  return expiredCount;
}

/**
 * Central Queue Processing Engine.
 *
 * Runs atomically to:
 * 1. Expire stale unpaid accepted bookings (>15 min).
 * 2. Process ALLOCATION QUEUE first (confirmed paid bookings waiting for fleet).
 * 3. Process ACCEPT QUEUE second (pending bookings waiting for availability).
 *
 * Safe to call repeatedly; uses Firestore transactions to prevent duplicate allocations.
 */
export async function processQueue(): Promise<{
  allocations: number;
  accepts: number;
  expired: number;
}> {
  if (isProcessingQueue) {
    return { allocations: 0, accepts: 0, expired: 0 };
  }
  isProcessingQueue = true;

  let allocationsCount = 0;
  let acceptsCount = 0;
  let expiredCount = 0;

  try {
    // Step 1: Expire unpaid accepted bookings
    expiredCount = await checkExpiredBookings();

    // Step 2: Fetch current settings & collections
    const settings = await getDispatchSettings();

    const [bookingsSnap, ambSnap, drvSnap] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.bookings)),
      getDocs(collection(db, COLLECTIONS.ambulances)),
      getDocs(collection(db, COLLECTIONS.drivers)),
    ]);

    const bookings: Booking[] = bookingsSnap.docs.map((d) => {
      const r = d.data();
      return {
        id: d.id,
        bookingCode: r.bookingCode || r.booking_code,
        userId: r.userId || r.user_id,
        pickup: r.pickup || '',
        destination: r.destination || '',
        priority: (r.priority || 'normal') as BookingPriority,
        status: r.status || 'pending',
        paymentStatus: r.paymentStatus || r.payment_status || 'pending',
        queueType: r.queueType ?? r.queue_type ?? null,
        queuedAt: r.queuedAt || r.queued_at,
        ambulanceId: r.ambulanceId,
        driverId: r.driverId,
        ambulanceType: r.ambulanceType || r.ambulance_type,
        createdAt: r.createdAt || r.created_at || new Date().toISOString(),
        updatedAt: r.updatedAt || r.updated_at || new Date().toISOString(),
        scheduledTime: r.scheduledTime || '',
        amount: Number(r.amount || 0),
      };
    });

    const ambulances: Ambulance[] = ambSnap.docs.map((d) => {
      const r = d.data();
      const rawStatus = String(r.status || 'available').toLowerCase();
      return {
        id: d.id,
        number: r.number || r.plateNumber || '',
        type: r.type || 'BLS',
        status: rawStatus === 'booked' ? 'booked' : rawStatus === 'maintenance' ? 'maintenance' : 'available',
        currentBookingId: r.currentBookingId,
      };
    });

    const drivers: Driver[] = drvSnap.docs.map((d) => {
      const r = d.data();
      const rawStatus = String(r.status || 'available').toLowerCase();
      return {
        id: d.id,
        name: r.name || '',
        phone: r.phone || '',
        status: rawStatus === 'allocated' || rawStatus === 'on duty' ? 'allocated' : rawStatus === 'off-duty' ? 'off-duty' : 'available',
        currentBookingId: r.currentBookingId,
      };
    });

    // Available resources (excluding maintenance or booked)
    let availableAmbulances = ambulances.filter((a) => a.status === 'available');
    let availableDrivers = drivers.filter((d) => d.status === 'available');

    // =========================================================================
    // Step 3: Process ALLOCATION QUEUE (Paid/Confirmed bookings first)
    // =========================================================================
    if (settings.autoAllocate) {
      const allocationQueue = bookings.filter(
        (b) => b.status === 'confirmed' && (!b.ambulanceId || b.queueType === 'allocate'),
      );
      allocationQueue.sort(compareQueuedBookings);

      for (const booking of allocationQueue) {
        if (availableAmbulances.length === 0 || availableDrivers.length === 0) {
          // No more vehicles or drivers available; remaining stay in allocation queue
          break;
        }

        // Match requested ambulance type if available, otherwise take first available
        const matchingAmbIndex = availableAmbulances.findIndex(
          (a) => (a.type || '').toLowerCase() === (booking.ambulanceType || '').toLowerCase(),
        );
        const ambToAssign = matchingAmbIndex >= 0
          ? availableAmbulances[matchingAmbIndex]
          : availableAmbulances[0];

        const drvToAssign = availableDrivers[0];

        try {
          await allocateAmbulanceToBooking(booking.id, ambToAssign.id, drvToAssign.id, 'auto');
          allocationsCount++;

          // Remove assigned resources from pool
          availableAmbulances = availableAmbulances.filter((a) => a.id !== ambToAssign.id);
          availableDrivers = availableDrivers.filter((d) => d.id !== drvToAssign.id);

          // Update in-memory booking
          booking.status = 'allocated';
          booking.ambulanceId = ambToAssign.id;
          booking.driverId = drvToAssign.id;
          booking.queueType = null;
        } catch (allocErr) {
          console.warn(`[dispatch] Auto-allocate failed for booking ${booking.id}:`, allocErr);
        }
      }
    }

    // =========================================================================
    // Step 4: Process ACCEPT QUEUE (Pending bookings)
    // =========================================================================
    if (settings.autoAccept) {
      // Calculate net free resources:
      // Active reservations = accepted or confirmed bookings that don't have vehicle/driver yet
      const activeReservations = bookings.filter(
        (b) => (b.status === 'accepted' || b.status === 'confirmed') && (!b.ambulanceId || !b.driverId),
      ).length;

      let netFreeAmbulances = availableAmbulances.length - activeReservations;
      let netFreeDrivers = availableDrivers.length - activeReservations;

      const acceptQueue = bookings.filter(
        (b) => b.status === 'pending' && (b.queueType === 'accept' || !b.queueType),
      );
      acceptQueue.sort(compareQueuedBookings);

      for (const booking of acceptQueue) {
        if (netFreeAmbulances <= 0 || netFreeDrivers <= 0) {
          // No capacity to auto-accept more; ensure booking has queueType set
          if (booking.queueType !== 'accept') {
            try {
              const bRef = doc(db, COLLECTIONS.bookings, booking.id);
              await setDoc(
                bRef,
                {
                  queueType: 'accept',
                  queuedAt: booking.queuedAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
                { merge: true },
              );
            } catch (qErr) {
              console.warn(`[dispatch] Error updating queueType for ${booking.id}:`, qErr);
            }
          }
          continue;
        }

        // Capacity exists! Auto-accept the booking
        try {
          const nowIso = new Date().toISOString();
          const bRef = doc(db, COLLECTIONS.bookings, booking.id);

          await runTransaction(db, async (txn) => {
            const snap = await txn.get(bRef);
            if (!snap.exists()) return;
            const currentStatus = snap.data().status;
            if (currentStatus !== 'pending') return;

            txn.update(bRef, {
              status: 'accepted',
              acceptedAt: nowIso,
              queueType: deleteField(),
              allocationMode: 'auto',
              updatedAt: nowIso,
            });
          });

          acceptsCount++;
          netFreeAmbulances--;
          netFreeDrivers--;

          // Notify user
          if (booking.userId) {
            await createNotification({
              id: `${booking.id}_accepted`,
              userId: booking.userId,
              title: 'Booking accepted - please complete payment',
              message: `Your booking ${booking.bookingCode || booking.id} has been accepted! Please complete payment within ${PAYMENT_EXPIRY_MINUTES} minutes to confirm your ambulance.`,
              type: 'booking',
              bookingId: booking.id,
            });
          }
        } catch (acceptErr) {
          console.warn(`[dispatch] Auto-accept failed for booking ${booking.id}:`, acceptErr);
        }
      }
    }
  } catch (err) {
    console.error('[dispatch] Error running processQueue:', err);
  } finally {
    isProcessingQueue = false;
  }

  return { allocations: allocationsCount, accepts: acceptsCount, expired: expiredCount };
}

/**
 * Background Dispatch Watcher Hook.
 *
 * Runs automatically when mounted on Admin or Booking pages.
 * Listens for state changes or interval timer and invokes processQueue().
 */
export function useDispatchWatcher() {
  const isRunningRef = useRef(false);

  useEffect(() => {
    // 1. Initial run on mount
    processQueue();

    // 2. Periodic expiration & queue check every 30 seconds
    const interval = setInterval(() => {
      processQueue();
    }, 30000);

    // 3. Real-time trigger on collection updates
    const qBookings = query(collection(db, COLLECTIONS.bookings));
    const unsubBookings = onSnapshot(qBookings, () => {
      if (!isRunningRef.current) {
        isRunningRef.current = true;
        setTimeout(() => {
          processQueue().finally(() => {
            isRunningRef.current = false;
          });
        }, 600);
      }
    });

    return () => {
      clearInterval(interval);
      unsubBookings();
    };
  }, []);
}
