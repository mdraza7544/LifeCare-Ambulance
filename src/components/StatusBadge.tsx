import { statusColor } from '@/lib/utils';

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge ${statusColor(status)}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'confirmed' ? 'bg-green-500' :
        status === 'accepted' ? 'bg-blue-500' :
        status === 'pending' ? 'bg-amber-500' :
        status === 'paid' ? 'bg-indigo-500' :
        status === 'allocated' ? 'bg-teal-500' :
        status === 'completed' ? 'bg-emerald-500' :
        status === 'expired' ? 'bg-gray-400' :
        status === 'rejected' || status === 'cancelled' ? 'bg-red-500' :
        'bg-gray-500'
      }`} />
      {status}
    </span>
  );
}
