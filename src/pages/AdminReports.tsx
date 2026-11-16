import { BarChart3, TrendingUp, Calendar, Ambulance, Users, Wallet, Download, Star } from 'lucide-react';
import { useApp } from '@/lib/context';
import { mockUsers, mockAmbulances, mockDrivers, mockPayments, mockHospitals } from '@/lib/mockData';
import AdminLayout from '@/components/AdminLayout';
import { formatCurrency } from '@/lib/utils';

export default function AdminReports() {
  const { bookings } = useApp();

  const totalRevenue = mockPayments.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const completedBookings = bookings.filter((b) => b.status === 'Completed').length;
  const completionRate = bookings.length > 0 ? Math.round((completedBookings / bookings.length) * 100) : 0;

  const monthlyData = [
    { month: 'Jan', bookings: 180, revenue: 540000 },
    { month: 'Feb', bookings: 210, revenue: 630000 },
    { month: 'Mar', bookings: 195, revenue: 585000 },
    { month: 'Apr', bookings: 240, revenue: 720000 },
    { month: 'May', bookings: 220, revenue: 660000 },
    { month: 'Jun', bookings: 260, revenue: 780000 },
    { month: 'Jul', bookings: 250, revenue: 750000 },
    { month: 'Aug', bookings: 280, revenue: 840000 },
  ];
  const maxBookings = Math.max(...monthlyData.map((d) => d.bookings));
  const maxRevenue = Math.max(...monthlyData.map((d) => d.revenue));

  const ambulanceTypeStats = [
    { type: 'Basic', count: bookings.filter((b) => b.ambulanceType === 'Basic').length, color: 'bg-blue-500' },
    { type: 'Advanced', count: bookings.filter((b) => b.ambulanceType === 'Advanced').length, color: 'bg-brand-500' },
    { type: 'Cardiac', count: bookings.filter((b) => b.ambulanceType === 'Cardiac').length, color: 'bg-green-500' },
    { type: 'Neonatal', count: bookings.filter((b) => b.ambulanceType === 'Neonatal').length, color: 'bg-amber-500' },
  ];
  const maxType = Math.max(...ambulanceTypeStats.map((t) => t.count), 1);

  return (
    <AdminLayout title="Reports">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-gray-500">Analytics and insights for LifeCare operations</p>
        <button className="btn-secondary text-sm"><Download className="w-4 h-4" /> Export Report</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Bookings', value: String(bookings.length), icon: Calendar, color: 'brand' },
          { label: 'Completion Rate', value: `${completionRate}%`, icon: TrendingUp, color: 'green' },
          { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: Wallet, color: 'amber' },
          { label: 'Avg Rating', value: '4.8', icon: Star, color: 'blue' },
        ].map((s, i) => (
          <div key={i} className="card p-5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${
              s.color === 'brand' ? 'bg-brand-50 text-brand-600' :
              s.color === 'green' ? 'bg-green-50 text-green-600' :
              s.color === 'amber' ? 'bg-amber-50 text-amber-600' :
              'bg-blue-50 text-blue-600'
            }`}><s.icon className="w-5 h-5" /></div>
            <p className="text-sm text-gray-500 font-medium">{s.label}</p>
            <p className="text-xl font-extrabold text-gray-900 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-1">Monthly Bookings</h3>
          <p className="text-xs text-gray-500 mb-5">Booking trends over the year</p>
          <div className="flex items-end justify-between gap-2 h-40">
            {monthlyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end justify-center h-full">
                  <div className="w-full max-w-[28px] rounded-t-lg bg-brand-500 hover:bg-brand-600 transition-colors relative group" style={{ height: `${(d.bookings / maxBookings) * 100}%` }}>
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">{d.bookings}</span>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 font-medium">{d.month}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-1">Monthly Revenue</h3>
          <p className="text-xs text-gray-500 mb-5">Revenue in Rs.</p>
          <div className="flex items-end justify-between gap-2 h-40">
            {monthlyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end justify-center h-full">
                  <div className="w-full max-w-[28px] rounded-t-lg bg-green-500 hover:bg-green-600 transition-colors relative group" style={{ height: `${(d.revenue / maxRevenue) * 100}%` }}>
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{(d.revenue / 1000).toFixed(0)}K</span>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 font-medium">{d.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-5">Ambulance Type Usage</h3>
          <div className="space-y-4">
            {ambulanceTypeStats.map((t, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-semibold text-gray-700">{t.type}</span>
                  <span className="font-bold text-gray-900">{t.count} bookings</span>
                </div>
                <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${t.color} transition-all duration-500`} style={{ width: `${(t.count / maxType) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-5">Fleet Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Total Ambulances', value: mockAmbulances.length, icon: Ambulance },
              { label: 'Total Drivers', value: mockDrivers.length, icon: Users },
              { label: 'Total Users', value: mockUsers.length, icon: Users },
              { label: 'Partner Hospitals', value: mockHospitals.length, icon: BarChart3 },
            ].map((s, i) => (
              <div key={i} className="p-4 rounded-xl bg-gray-50">
                <s.icon className="w-5 h-5 text-brand-500 mb-2" />
                <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
