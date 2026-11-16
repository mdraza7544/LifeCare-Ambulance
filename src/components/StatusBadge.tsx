import type { BookingStatus } from '@/lib/types';
import { statusColor } from '@/lib/utils';

export default function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`status-badge ${statusColor(status)}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'Completed' ? 'bg-green-500' :
        status === 'Verified' ? 'bg-teal-500' :
        status === 'On Going' ? 'bg-blue-500' :
        status === 'Cancelled' ? 'bg-brand-500' :
        'bg-amber-500'
      }`} />
      {status}
    </span>
  );
}
