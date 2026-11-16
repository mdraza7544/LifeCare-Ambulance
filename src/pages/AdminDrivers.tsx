import { Star, Phone, Plus, Search, Car, X, Trash2, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { fetchDrivers, addDriver, deleteDriver } from '@/lib/db';
import type { Driver as DriverType } from '@/lib/types';

interface DriverRow extends DriverType {
  id: string;
}

export default function AdminDrivers() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', license: '', status: 'Available', ambulanceCode: '' });

  const fetchItems = async () => {
    setLoading(true);
    const data = await fetchDrivers();
    if (data) {
      setItems(data);
    }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const filtered = items.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.ambulanceCode.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s: string) =>
    s === 'Available' ? 'bg-green-50 text-green-700 border-green-200' :
    s === 'On Duty' ? 'bg-blue-50 text-blue-700 border-blue-200' :
    'bg-gray-100 text-gray-600 border-gray-200';

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addDriver({
        name: form.name,
        phone: form.phone,
        license: form.license,
        status: form.status,
        ambulanceCode: form.ambulanceCode,
      });
      setShowModal(false);
      setForm({ name: '', phone: '', license: '', status: 'Available', ambulanceCode: '' });
      fetchItems();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteDriver(id);
    fetchItems();
  };

  return (
    <AdminLayout title="Drivers">
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" placeholder="Search drivers..." />
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Add Driver</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">No drivers found. Click "Add Driver" to create one.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <div key={d.id} className="card p-5 hover:shadow-card-hover transition-shadow group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-lg">{d.name.charAt(0)}</div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{d.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Car className="w-3 h-3" /> {d.ambulanceCode}</p>
                </div>
                <span className={`status-badge ${statusColor(d.status)}`}>{d.status}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Phone</span><span className="font-semibold text-gray-900 flex items-center gap-1"><Phone className="w-3 h-3" /> {d.phone}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">License</span><span className="font-semibold text-gray-900 text-xs">{d.license}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total Trips</span><span className="font-semibold text-gray-900">{d.trips}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Rating</span><span className="font-semibold text-gray-900 flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400 fill-current" /> {d.rating}</span></div>
              </div>
              <button onClick={() => handleDelete(d.id)} className="mt-4 w-full text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg py-2 flex items-center justify-center gap-1.5 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg text-gray-900">Add Driver</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Driver Name</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Enter driver name" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Phone Number</label>
                <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">License Number</label>
                <input type="text" required value={form.license} onChange={(e) => setForm({ ...form, license: e.target.value })} className="input-field" placeholder="e.g. DL-0420210005678" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-field">
                  <option value="Available">Available</option>
                  <option value="On Duty">On Duty</option>
                  <option value="Off Duty">Off Duty</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Assigned Ambulance Code</label>
                <input type="text" required value={form.ambulanceCode} onChange={(e) => setForm({ ...form, ambulanceCode: e.target.value })} className="input-field" placeholder="e.g. AMB-007" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
