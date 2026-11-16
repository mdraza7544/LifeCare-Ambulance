import { User, Mail, Phone, MapPin, Heart, Edit, ArrowLeft, LogOut, Shield } from 'lucide-react';
import { useApp } from '@/lib/context';
import { PageHeader } from '@/components/UI';

export default function ProfilePage() {
  const { profile, navigate, addresses } = useApp();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <button onClick={() => navigate('/dashboard')} className="btn-ghost mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>
      <PageHeader title="My Profile" subtitle="Manage your personal information" icon={<User className="w-5 h-5" />} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-6 text-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
            {profile.name.charAt(0)}
          </div>
          <h3 className="font-bold text-lg text-gray-900">{profile.name}</h3>
          <p className="text-sm text-gray-500">{profile.email}</p>
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={() => navigate('/edit-profile')} className="btn-primary text-sm flex-1">
              <Edit className="w-4 h-4" /> Edit
            </button>
            <button onClick={() => navigate('/')} className="btn-secondary text-sm">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h3 className="font-bold text-lg text-gray-900 mb-4">Personal Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: User, label: 'Full Name', value: profile.name },
                { icon: Mail, label: 'Email', value: profile.email },
                { icon: Phone, label: 'Phone', value: profile.phone },
                { icon: Heart, label: 'Blood Group', value: profile.bloodGroup },
                { icon: User, label: 'Date of Birth', value: profile.dob },
                { icon: Phone, label: 'Emergency Contact', value: `${profile.emergencyContact} (${profile.emergencyPhone})` },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-brand-500 shrink-0"><item.icon className="w-4 h-4" /></div>
                  <div><p className="text-xs text-gray-500">{item.label}</p><p className="text-sm font-semibold text-gray-900">{item.value}</p></div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-900">Saved Addresses</h3>
              <button onClick={() => navigate('/address')} className="text-sm font-semibold text-brand-600 hover:underline">Manage</button>
            </div>
            <div className="space-y-3">
              {addresses.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <MapPin className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{a.label} {a.isDefault && <span className="text-xs text-brand-600 font-bold ml-1">Default</span>}</p>
                    <p className="text-xs text-gray-500">{a.fullAddress}, {a.city} - {a.pincode}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-5 h-5 text-brand-600" />
              <h3 className="font-bold text-lg text-gray-900">Account Actions</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <button onClick={() => navigate('/notifications')} className="btn-secondary text-sm">Notifications</button>
              <button onClick={() => navigate('/bookings')} className="btn-secondary text-sm">My Bookings</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
