import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        {icon && <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">{icon}</div>}
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: ReactNode; title: string; message: string; action?: ReactNode }) {
  return (
    <div className="card p-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-400 mx-auto mb-4">{icon}</div>
      <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{message}</p>
      {action}
    </div>
  );
}

export function StatCard({ label, value, icon, trend, color = 'brand' }: { label: string; value: string; icon: ReactNode; trend?: string; color?: string }) {
  const colorMap: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{value}</p>
          {trend && <p className="text-xs text-green-600 font-semibold mt-1">{trend}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl ${colorMap[color]} flex items-center justify-center`}>{icon}</div>
      </div>
    </div>
  );
}
