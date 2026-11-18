import { useState } from 'react';
import { Ambulance, Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApp } from '@/lib/context';

export default function SignupPage() {
  const { signUp } = useAuth();
  const { navigate } = useApp();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: err } = await signUp(form.email, form.password, form.fullName, form.phone);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setSuccess('Account created! A verification email has been sent to your inbox.');
      setTimeout(() => navigate('/verify-email'), 1200);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-brand-50 via-white to-brand-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2.5 mb-6 group">
            <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <Ambulance className="w-7 h-7 text-white" />
            </div>
            <div className="text-left">
              <div className="font-extrabold text-xl text-gray-900">LifeCare</div>
              <div className="text-[11px] text-brand-600 font-semibold tracking-wide">AMBULANCE SERVICE</div>
            </div>
          </button>
          <h1 className="text-2xl font-extrabold text-gray-900">Create Account</h1>
          <p className="text-gray-500 mt-1.5 text-sm">Join LifeCare to book and track ambulances</p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5">
                <User className="w-4 h-4 text-brand-500" /> Full Name
              </label>
              <input type="text" required value={form.fullName} onChange={(e) => update('fullName', e.target.value)} className="input-field" placeholder="Enter your full name" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-brand-500" /> Email Address
              </label>
              <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} className="input-field" placeholder="you@example.com" autoComplete="email" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-brand-500" /> Phone Number
              </label>
              <input type="tel" required value={form.phone} onChange={(e) => update('phone', e.target.value)} className="input-field" placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-brand-500" /> Password
              </label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} required value={form.password} onChange={(e) => update('password', e.target.value)} className="input-field pr-11" placeholder="Min 6 characters" autoComplete="new-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-brand-500" /> Confirm Password
              </label>
              <input type={showPassword ? 'text' : 'password'} required value={form.confirm} onChange={(e) => update('confirm', e.target.value)} className="input-field" placeholder="Re-enter password" autoComplete="new-password" />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full text-base py-3 mt-2">
              {loading ? 'Creating account...' : <>Create Account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <button onClick={() => navigate('/login')} className="text-brand-600 font-semibold hover:underline">
              Sign in
            </button>
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          <button onClick={() => navigate('/')} className="hover:text-brand-600 transition-colors">
            Back to home
          </button>
        </p>
      </div>
    </div>
  );
}
