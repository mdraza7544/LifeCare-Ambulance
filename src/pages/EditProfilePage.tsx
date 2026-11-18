import { useState } from 'react';
import { User, Mail, Phone, MapPin, Heart, Save, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/lib/context';
import { PageHeader } from '@/components/UI';
import type { UserProfile } from '@/lib/types';

export default function EditProfilePage() {
  const { profile, updateProfile, navigate } = useApp();
  const [form, setForm] = useState<UserProfile>({ ...profile });
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(form);
    setSaved(true);
    setTimeout(() => navigate('/profile'), 1200);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      <button onClick={() => navigate('/profile')} className="btn-ghost mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Profile
      </button>
      <PageHeader title="Edit Profile" subtitle="Update your personal information" icon={<User className="w-5 h-5" />} />

      {saved && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-5 h-5" /> Profile updated successfully!
        </div>
      )}

      <form onSubmit={handleSave} className="card p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5"><User className="w-4 h-4 text-brand-500" /> Full Name</label>
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5"><Mail className="w-4 h-4 text-brand-500" /> Email</label>
            <input type="email" disabled value={form.email} className="input-field bg-gray-50 text-gray-500 cursor-not-allowed" />
            <p className="text-[11px] text-gray-400 mt-1">To change your email address, use "Change Email" on your Profile page.</p>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5"><Phone className="w-4 h-4 text-brand-500" /> Phone</label>
            <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5"><Heart className="w-4 h-4 text-brand-500" /> Blood Group</label>
            <select value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} className="input-field">
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Date of Birth</label>
            <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5"><Phone className="w-4 h-4 text-brand-500" /> Emergency Phone</label>
            <input type="tel" value={form.emergencyPhone} onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })} className="input-field" />
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5"><MapPin className="w-4 h-4 text-brand-500" /> Address</label>
          <textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field resize-none" />
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Emergency Contact Name</label>
          <input type="text" value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} className="input-field" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary"><Save className="w-4 h-4" /> Save Changes</button>
          <button type="button" onClick={() => navigate('/profile')} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </div>
  );
}
