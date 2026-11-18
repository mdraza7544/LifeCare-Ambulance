import type { Booking, Ambulance, Driver, User, Payment } from './firestoreService';

export const KOLKATA_TZ = 'Asia/Kolkata';

/** Converts any Firestore timestamp, ISO string, or Date to a valid JS Date */
export function toJsDate(val: unknown): Date | null {
  if (!val) return null;
  if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate();
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Returns 'YYYY-MM-DD' formatted in Asia/Kolkata */
export function getKolkataDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: KOLKATA_TZ });
}

/** Returns 'YYYY-MM' formatted in Asia/Kolkata */
export function getKolkataMonthString(date: Date = new Date()): string {
  const parts = getKolkataDateString(date).split('-');
  return `${parts[0]}-${parts[1]}`;
}

/** Determines if a booking is considered Upcoming */
export function isUpcomingBooking(b: Booking, now: Date = new Date()): boolean {
  const status = (b.status || '').toLowerCase();
  if (['completed', 'cancelled', 'rejected', 'expired'].includes(status)) {
    return false;
  }
  if (status === 'allocated') {
    // Ambulance and driver assigned; in transit/arrival phase
    return true;
  }
  if (status === 'confirmed' || (status === 'accepted' && b.paymentStatus === 'paid')) {
    const schedDate = toJsDate(b.scheduledTime);
    if (!schedDate) return true;
    // Include future scheduled bookings or recent active bookings within 2 hours
    return schedDate.getTime() >= now.getTime() - 2 * 60 * 60 * 1000;
  }
  return false;
}

export interface UserStats {
  totalBookings: number;
  completed: number;
  totalSpent: number;
  upcoming: number;
  activeBooking: Booking | null;
}

/** Pure function to compute user dashboard stats */
export function getUserStats(bookings: Booking[], now: Date = new Date()): UserStats {
  const activeBookings = bookings.filter((b) => {
    const s = (b.status || '').toLowerCase();
    return !['cancelled', 'rejected', 'expired'].includes(s);
  });

  const completed = bookings.filter((b) => (b.status || '').toLowerCase() === 'completed');

  const totalSpent = bookings
    .filter((b) => (b.paymentStatus || '').toLowerCase() === 'paid')
    .reduce((sum, b) => {
      const amt = Number(b.amount);
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);

  const upcomingCount = bookings.filter((b) => isUpcomingBooking(b, now)).length;

  const activeBooking =
    bookings.find((b) => (b.status || '').toLowerCase() === 'allocated') || null;

  return {
    totalBookings: activeBookings.length,
    completed: completed.length,
    totalSpent,
    upcoming: upcomingCount,
    activeBooking,
  };
}

export interface AdminStats {
  totalBookings: number;
  pending: number;
  accepted: number;
  confirmed: number;
  allocated: number;
  completed: number;
  cancelled: number;
  rejected: number;
  expired: number;
  queueLength: number;

  totalUsers: number;
  newUsersToday: number;

  ambulances: {
    total: number;
    available: number;
    booked: number;
    maintenance: number;
  };

  drivers: {
    total: number;
    available: number;
    allocated: number;
    offDuty: number;
  };

  earnings: {
    total: number;
    today: number;
    thisMonth: number;
    pendingCount: number;
  };
}

export interface AdminStatsInput {
  bookings: Booking[];
  ambulances: Ambulance[];
  drivers: Driver[];
  users: User[];
  payments: Payment[];
}

/** Pure function to compute admin dashboard stats */
export function getAdminStats(input: AdminStatsInput, now: Date = new Date()): AdminStats {
  const { bookings, ambulances, drivers, users, payments } = input;
  const todayStr = getKolkataDateString(now);
  const thisMonthStr = getKolkataMonthString(now);

  // 1. Bookings by status
  let pending = 0;
  let accepted = 0;
  let confirmed = 0;
  let allocated = 0;
  let completed = 0;
  let cancelled = 0;
  let rejected = 0;
  let expired = 0;
  let queueLength = 0;

  for (const b of bookings) {
    const s = (b.status || '').toLowerCase();
    if (s === 'pending') pending++;
    else if (s === 'accepted') accepted++;
    else if (s === 'confirmed') confirmed++;
    else if (s === 'allocated') allocated++;
    else if (s === 'completed') completed++;
    else if (s === 'cancelled') cancelled++;
    else if (s === 'rejected') rejected++;
    else if (s === 'expired') expired++;

    if (b.queueType) queueLength++;
  }

  // 2. Users
  let newUsersToday = 0;
  for (const u of users) {
    const d = toJsDate(u.createdAt);
    if (d && getKolkataDateString(d) === todayStr) {
      newUsersToday++;
    }
  }

  // 3. Ambulances
  let ambAvailable = 0;
  let ambBooked = 0;
  let ambMaintenance = 0;

  for (const a of ambulances) {
    const s = (a.status || '').toLowerCase();
    if (s === 'available') ambAvailable++;
    else if (s === 'booked' || s === 'on duty') ambBooked++;
    else if (s === 'maintenance' || s === 'inactive') ambMaintenance++;
    else ambAvailable++;
  }

  // 4. Drivers
  let drvAvailable = 0;
  let drvAllocated = 0;
  let drvOffDuty = 0;

  for (const d of drivers) {
    const s = (d.status || '').toLowerCase();
    if (s === 'available') drvAvailable++;
    else if (s === 'allocated' || s === 'on duty' || s === 'booked') drvAllocated++;
    else if (s === 'off-duty' || s === 'off duty') drvOffDuty++;
    else drvAvailable++;
  }

  // 5. Earnings from payments collection
  let totalEarnings = 0;
  let todayEarnings = 0;
  let thisMonthEarnings = 0;
  let pendingPaymentsCount = 0;

  for (const p of payments) {
    const s = (p.status || '').toLowerCase();
    const amt = Number(p.amount) || 0;
    const isPaid = s === 'paid' || s === 'success';

    if (isPaid) {
      totalEarnings += amt;
      const d = toJsDate(p.createdAt);
      if (d) {
        if (getKolkataDateString(d) === todayStr) {
          todayEarnings += amt;
        }
        if (getKolkataMonthString(d) === thisMonthStr) {
          thisMonthEarnings += amt;
        }
      }
    } else if (s === 'pending') {
      pendingPaymentsCount++;
    }
  }

  return {
    totalBookings: bookings.length,
    pending,
    accepted,
    confirmed,
    allocated,
    completed,
    cancelled,
    rejected,
    expired,
    queueLength,
    totalUsers: users.length,
    newUsersToday,
    ambulances: {
      total: ambulances.length,
      available: ambAvailable,
      booked: ambBooked,
      maintenance: ambMaintenance,
    },
    drivers: {
      total: drivers.length,
      available: drvAvailable,
      allocated: drvAllocated,
      offDuty: drvOffDuty,
    },
    earnings: {
      total: totalEarnings,
      today: todayEarnings,
      thisMonth: thisMonthEarnings,
      pendingCount: pendingPaymentsCount,
    },
  };
}

/** Pure helper to generate chart labels and aggregated bucket data for Asia/Kolkata */
export function getAdminChartData(
  bookings: Booking[],
  period: 'Week' | 'Month' | 'Year',
  now: Date = new Date(),
): { labels: string[]; data: number[] } {
  if (period === 'Week') {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = new Array(7).fill(0);
    // Find Monday of the current week in Kolkata
    const nowKolkata = new Date(now.toLocaleString('en-US', { timeZone: KOLKATA_TZ }));
    const currentDay = nowKolkata.getDay(); // 0 is Sunday
    const distanceToMonday = (currentDay + 6) % 7;
    const monday = new Date(nowKolkata);
    monday.setDate(nowKolkata.getDate() - distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    for (const b of bookings) {
      const d = toJsDate(b.createdAt || b.scheduledTime);
      if (!d) continue;
      const dKolkata = new Date(d.toLocaleString('en-US', { timeZone: KOLKATA_TZ }));
      if (dKolkata >= monday && dKolkata <= sunday) {
        const dayIdx = (dKolkata.getDay() + 6) % 7;
        data[dayIdx]++;
      }
    }
    return { labels, data };
  }

  if (period === 'Month') {
    const labels = ['W1', 'W2', 'W3', 'W4', 'W5'];
    const data = new Array(5).fill(0);
    const nowKolkata = new Date(now.toLocaleString('en-US', { timeZone: KOLKATA_TZ }));
    const currentMonth = nowKolkata.getMonth();
    const currentYear = nowKolkata.getFullYear();

    for (const b of bookings) {
      const d = toJsDate(b.createdAt || b.scheduledTime);
      if (!d) continue;
      const dKolkata = new Date(d.toLocaleString('en-US', { timeZone: KOLKATA_TZ }));
      if (dKolkata.getFullYear() === currentYear && dKolkata.getMonth() === currentMonth) {
        const weekIdx = Math.min(Math.floor((dKolkata.getDate() - 1) / 7), 4);
        data[weekIdx]++;
      }
    }
    return { labels, data };
  }

  // Year
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const data = new Array(12).fill(0);
  const nowKolkata = new Date(now.toLocaleString('en-US', { timeZone: KOLKATA_TZ }));
  const currentYear = nowKolkata.getFullYear();

  for (const b of bookings) {
    const d = toJsDate(b.createdAt || b.scheduledTime);
    if (!d) continue;
    const dKolkata = new Date(d.toLocaleString('en-US', { timeZone: KOLKATA_TZ }));
    if (dKolkata.getFullYear() === currentYear) {
      data[dKolkata.getMonth()]++;
    }
  }
  return { labels, data };
}
