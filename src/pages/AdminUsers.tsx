import { Search, Plus, Mail, Phone, Calendar } from 'lucide-react';
import { useState } from 'react';
import { mockUsers } from '@/lib/mockData';
import AdminLayout from '@/components/AdminLayout';

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const filtered = mockUsers.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout title="Users">
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" placeholder="Search users..." />
        </div>
        <button className="btn-primary text-sm"><Plus className="w-4 h-4" /> Add User</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3">Bookings</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm">{u.name.charAt(0)}</div>
                      <span className="text-sm font-semibold text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">
                    <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</div>
                    <div className="flex items-center gap-1 text-xs"><Phone className="w-3 h-3" /> {u.phone}</div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600 flex items-center gap-1"><Calendar className="w-3 h-3" /> {u.joinedDate}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-gray-900">{u.bookingsCount}</td>
                  <td className="px-5 py-3">
                    <span className={`status-badge ${u.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{u.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
