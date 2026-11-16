import { useState } from 'react';
import { MapPin, Plus, Trash2, Star, ArrowLeft, Home, Briefcase } from 'lucide-react';
import { useApp } from '@/lib/context';
import { PageHeader, EmptyState } from '@/components/UI';
import { generateId } from '@/lib/utils';

export default function ManageAddressPage() {
  const { addresses, addAddress, removeAddress, setDefaultAddress, navigate } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: 'Home', fullAddress: '', city: '', pincode: '', isDefault: false });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addAddress({ id: generateId(), ...form });
    setForm({ label: 'Home', fullAddress: '', city: '', pincode: '', isDefault: false });
    setShowForm(false);
  };

  const labelIcon: Record<string, typeof Home> = { Home, Work: Briefcase };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      <button onClick={() => navigate('/profile')} className="btn-ghost mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Profile
      </button>
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Manage Addresses" subtitle="Add and organize your saved locations" icon={<MapPin className="w-5 h-5" />} />
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> Add Address
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card p-6 mb-6 space-y-4 animate-slide-up">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Label</label>
              <select value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="input-field">
                <option>Home</option><option>Work</option><option>Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Pincode</label>
              <input type="text" required value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} className="input-field" placeholder="560038" />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Full Address</label>
            <textarea rows={2} required value={form.fullAddress} onChange={(e) => setForm({ ...form, fullAddress: e.target.value })} className="input-field resize-none" placeholder="Enter complete address" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">City</label>
            <input type="text" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-field" placeholder="Bengaluru" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="w-4 h-4 rounded text-brand-500 focus:ring-brand-400" />
            Set as default address
          </label>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary text-sm">Save Address</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-sm">Cancel</button>
          </div>
        </form>
      )}

      {addresses.length === 0 ? (
        <EmptyState icon={<MapPin className="w-8 h-8" />} title="No saved addresses" message="Add an address to speed up your booking process." action={<button onClick={() => setShowForm(true)} className="btn-primary">Add Address</button>} />
      ) : (
        <div className="space-y-3">
          {addresses.map((a) => {
            const Icon = labelIcon[a.label] || MapPin;
            return (
              <div key={a.id} className="card p-5">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0"><Icon className="w-5 h-5" /></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900">{a.label}</p>
                      {a.isDefault && <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">Default</span>}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{a.fullAddress}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.city} - {a.pincode}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {!a.isDefault && <button onClick={() => setDefaultAddress(a.id)} className="p-2 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600 transition-colors" title="Set as default"><Star className="w-4 h-4" /></button>}
                    <button onClick={() => removeAddress(a.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-brand-600 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
