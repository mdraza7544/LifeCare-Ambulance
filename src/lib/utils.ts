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

export function statusColor(status: string): string {
  switch (status) {
    case 'pending': return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'accepted': return 'bg-blue-50 text-blue-700 border border-blue-200';
    case 'paid': return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
    case 'confirmed': return 'bg-green-50 text-green-700 border border-green-200';
    case 'allocated': return 'bg-teal-50 text-teal-700 border border-teal-200';
    case 'completed': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'rejected': return 'bg-red-50 text-red-700 border border-red-200';
    case 'cancelled': return 'bg-red-50 text-red-700 border border-red-200';
    case 'expired': return 'bg-gray-100 text-gray-600 border border-gray-300';
    case 'Scheduled': return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'On Going': return 'bg-blue-50 text-blue-700 border border-blue-200';
    case 'Verified': return 'bg-teal-50 text-teal-700 border border-teal-200';
    case 'Cancelled': return 'bg-red-50 text-red-700 border border-red-200';
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
