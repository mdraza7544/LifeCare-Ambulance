import { Hospital, Phone, MapPin, Plus, Search, BedDouble, X, Trash2, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { fetchHospitals, addHospital, deleteHospital } from '@/lib/db';
import type { Hospital as HospitalType } from '@/lib/types';

interface HospitalRow extends HospitalType {
  id: string;
}

export default function AdminHospitals() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<HospitalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', area: '', beds: '', phone: '', emergency: false });

  const fetchItems = async () => {
    setLoading(true);
    const data = await fetchHospitals();
    if (data) {
      setItems(data);
    }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const filtered = items.filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.area.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addHospital({
        name: form.name,
        area: form.area,
        beds: parseInt(form.beds) || 0,
        phone: form.phone,
        emergency: form.emergency,
      });
      setShowModal(false);
      setForm({ name: '', area: '', beds: '', phone: '', emergency: false });
      fetchItems();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteHospital(id);
    fetchItems();
  };

  return (
    <AdminLayout title="Hospitals">
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" placeholder="Search hospitals..." />
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Add Hospital</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">No hospitals found. Click "Add Hospital" to create one.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((h) => (
            <div key={h.id} className="card p-5 hover:shadow-card-hover transition-shadow group">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0"><Hospital className="w-6 h-6" /></div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{h.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {h.area}</p>
                </div>
                {h.emergency && <span className="status-badge bg-red-50 text-brand-700 border border-brand-200">ER</span>}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Beds</span><span className="font-semibold text-gray-900 flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> {h.beds}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Phone</span><span className="font-semibold text-gray-900 flex items-center gap-1"><Phone className="w-3 h-3" /> {h.phone}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Emergency</span><span className={`font-semibold ${h.emergency ? 'text-green-600' : 'text-gray-400'}`}>{h.emergency ? 'Yes' : 'No'}</span></div>
              </div>
              <button onClick={() => handleDelete(h.id)} className="mt-4 w-full text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg py-2 flex items-center justify-center gap-1.5 transition-colors opacity-0 group-hover:opacity-100">
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
              <h3 className="font-bold text-lg text-gray-900">Add Hospital</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Hospital Name</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="e.g. Apollo Hospital" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Area / Location</label>
                <input type="text" required value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="input-field" placeholder="e.g. Indiranagar" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Number of Beds</label>
                <input type="number" required value={form.beds} onChange={(e) => setForm({ ...form, beds: e.target.value })} className="input-field" placeholder="e.g. 250" min="0" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Phone Number</label>
                <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="+91 80 4612 4000" />
              </div>
              <div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.emergency} onChange={(e) => setForm({ ...form, emergency: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
                  <span className="text-sm font-semibold text-gray-700">Has Emergency Room (ER)</span>
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Hospital'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
