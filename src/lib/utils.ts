import type { BookingStatus } from './types';

export function formatCurrency(amount: number): string {
  return 'Rs. ' + amount.toLocaleString('en-IN');
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

export function statusColor(status: BookingStatus): string {
  switch (status) {
    case 'Completed': return 'bg-green-50 text-green-700 border border-green-200';
    case 'Verified': return 'bg-teal-50 text-teal-700 border border-teal-200';
    case 'On Going': return 'bg-blue-50 text-blue-700 border border-blue-200';
    case 'Cancelled': return 'bg-red-50 text-brand-700 border border-brand-200';
    case 'Scheduled': return 'bg-amber-50 text-amber-700 border border-amber-200';
    default: return 'bg-gray-50 text-gray-700 border border-gray-200';
  }
}

export function generateBookingCode(): string {
  const num = Math.floor(1025 + Math.random() * 9000);
  return `LCA-${num}`;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth's mean radius, km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
