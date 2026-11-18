import { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Heart,
  Edit,
  ArrowLeft,
  LogOut,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  X,
  Sparkles,
} from 'lucide-react';
import { useApp } from '@/lib/context';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/UI';

export default function ProfilePage() {
  const { profile, navigate, addresses } = useApp();
  const { user, changeEmail, reloadUser, signOut } = useAuth();

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Auto reload on focus to catch email verification return
  useEffect(() => {
    const handleFocus = () => {
      reloadUser().catch(() => {});
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [reloadUser]);

  const handleEmailChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    if (!newEmail.trim() || !currentPassword) {
      setEmailError('Please enter your new email address and current password.');
      return;
    }

    if (newEmail.trim().toLowerCase() === user?.email.toLowerCase()) {
      setEmailError('The new email is the same as your current email.');
      return;
    }

    setEmailLoading(true);
    const { error } = await changeEmail(newEmail.trim(), currentPassword);
    setEmailLoading(false);

    if (error) {
      setEmailError(error);
    } else {
      setEmailSuccess(
        `Verification link sent to ${newEmail.trim()}. Your email will change after you click the link.`,
      );
      setNewEmail('');
      setCurrentPassword('');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <button onClick={() => navigate('/dashboard')} className="btn-ghost mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>
      <PageHeader
        title="My Profile"
        subtitle="Manage your personal information and account security"
        icon={<User className="w-5 h-5" />}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* User Card */}
        <div className="card p-6 text-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
            {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <h3 className="font-bold text-lg text-gray-900">{profile.name || user?.user_metadata?.full_name || 'LifeCare User'}</h3>
          <p className="text-sm text-gray-500 break-all">{user?.email || profile.email}</p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            <span>Email Verified</span>
          </div>

          <div className="flex justify-center gap-2 mt-5">
            <button onClick={() => navigate('/edit-profile')} className="btn-primary text-sm flex-1">
              <Edit className="w-4 h-4" /> Edit Profile
            </button>
            <button onClick={handleSignOut} title="Sign Out" className="btn-secondary text-sm px-3">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Personal Info */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-900">Personal Information</h3>
              <button
                type="button"
                onClick={() => setShowEmailModal(true)}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" /> Change Email
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: User, label: 'Full Name', value: profile.name || user?.user_metadata?.full_name || '—' },
                { icon: Mail, label: 'Email', value: user?.email || profile.email || '—' },
                { icon: Phone, label: 'Phone', value: profile.phone || user?.user_metadata?.phone || '—' },
                { icon: Heart, label: 'Blood Group', value: profile.bloodGroup || '—' },
                { icon: User, label: 'Date of Birth', value: profile.dob || '—' },
                {
                  icon: Phone,
                  label: 'Emergency Contact',
                  value: profile.emergencyContact
                    ? `${profile.emergencyContact} (${profile.emergencyPhone || '—'})`
                    : '—',
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-brand-500 shrink-0">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Change Email Modal */}
          {showEmailModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="card w-full max-w-md p-6 bg-white shadow-2xl relative">
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">Change Email Address</h3>
                    <p className="text-xs text-gray-500">Requires verification to the new email</p>
                  </div>
                </div>

                {emailSuccess && (
                  <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <span>{emailSuccess}</span>
                  </div>
                )}

                {emailError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{emailError}</span>
                  </div>
                )}

                <form onSubmit={handleEmailChangeSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Current Email</label>
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="input-field bg-gray-50 text-gray-500 cursor-not-allowed text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">New Email Address</label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="new-email@example.com"
                      className="input-field text-sm"
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-brand-500" /> Current Password (for security)
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="input-field text-sm"
                      autoComplete="current-password"
                    />
                  </div>

                  <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p>
                      Your current email stays active until you click the verification link sent to your new address.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowEmailModal(false)}
                      className="btn-secondary flex-1 text-sm py-2.5"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={emailLoading}
                      className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-2 font-bold"
                    >
                      {emailLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                        </>
                      ) : (
                        'Send Verification'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Saved Addresses */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-900">Saved Addresses</h3>
              <button
                onClick={() => navigate('/address')}
                className="text-sm font-semibold text-brand-600 hover:underline"
              >
                Manage
              </button>
            </div>
            <div className="space-y-3">
              {addresses.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <MapPin className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {a.label} {a.isDefault && <span className="text-xs text-brand-600 font-bold ml-1">Default</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {a.fullAddress}, {a.city} - {a.pincode}
                    </p>
                  </div>
                </div>
              ))}
              {addresses.length === 0 && (
                <p className="text-xs text-gray-500 py-2">No saved addresses yet.</p>
              )}
            </div>
          </div>

          {/* Account Actions */}
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-5 h-5 text-brand-600" />
              <h3 className="font-bold text-lg text-gray-900">Account Actions</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <button onClick={() => navigate('/notifications')} className="btn-secondary text-sm">
                Notifications
              </button>
              <button onClick={() => navigate('/bookings')} className="btn-secondary text-sm">
                My Bookings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
