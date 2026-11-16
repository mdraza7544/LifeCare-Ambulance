import { Ambulance, Star, Plus, Search, X, Trash2, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { fetchAmbulances, addAmbulance, deleteAmbulance } from '@/lib/db';
import type { Ambulance as AmbulanceType } from '@/lib/types';

interface AmbulanceRow extends AmbulanceType {
  id: string;
}

export default function AdminAmbulances() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<AmbulanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', type: 'Basic', driverName: '', status: 'Available', location: '' });

  const fetchItems = async () => {
    setLoading(true);
    const data = await fetchAmbulances();
    if (data) {
      setItems(data);
    }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const filtered = items.filter((a) =>
    a.code.toLowerCase().includes(search.toLowerCase()) ||
    a.driverName.toLowerCase().includes(search.toLowerCase()) ||
    a.type.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s: string) =>
    s === 'Available' ? 'bg-green-50 text-green-700 border-green-200' :
    s === 'On Duty' ? 'bg-blue-50 text-blue-700 border-blue-200' :
    'bg-amber-50 text-amber-700 border-amber-200';

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addAmbulance({
        code: form.code,
        type: form.type,
        driverName: form.driverName,
        status: form.status,
        location: form.location,
      });
      setShowModal(false);
      setForm({ code: '', type: 'Basic', driverName: '', status: 'Available', location: '' });
      fetchItems();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteAmbulance(id);
    fetchItems();
  };

  return (
    <AdminLayout title="Ambulances">
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" placeholder="Search ambulances..." />
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Add Ambulance</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">No ambulances found. Click "Add Ambulance" to create one.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => (
            <div key={a.id} className="card p-5 hover:shadow-card-hover transition-shadow group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600"><Ambulance className="w-6 h-6" /></div>
                  <div>
                    <p className="font-bold text-gray-900">{a.code}</p>
                    <p className="text-xs text-gray-500">{a.type} Ambulance</p>
                  </div>
                </div>
                <span className={`status-badge ${statusColor(a.status)}`}>{a.status}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Driver</span><span className="font-semibold text-gray-900">{a.driverName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Location</span><span className="font-semibold text-gray-900">{a.location}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Rating</span><span className="font-semibold text-gray-900 flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400 fill-current" /> {a.rating}</span></div>
              </div>
              <button onClick={() => handleDelete(a.id)} className="mt-4 w-full text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg py-2 flex items-center justify-center gap-1.5 transition-colors opacity-0 group-hover:opacity-100">
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
              <h3 className="font-bold text-lg text-gray-900">Add Ambulance</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Ambulance Code</label>
                <input type="text" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input-field" placeholder="e.g. AMB-007" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Ambulance Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-field">
                  <option value="Basic">Basic</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Cardiac">Cardiac</option>
                  <option value="Neonatal">Neonatal</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Driver Name</label>
                <input type="text" required value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} className="input-field" placeholder="Enter driver name" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-field">
                  <option value="Available">Available</option>
                  <option value="On Duty">On Duty</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Location</label>
                <input type="text" required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input-field" placeholder="e.g. Indiranagar" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Ambulance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
