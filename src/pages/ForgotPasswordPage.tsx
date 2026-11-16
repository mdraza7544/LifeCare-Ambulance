import { useState } from 'react';
import { Ambulance, Mail, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApp } from '@/lib/context';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const { navigate } = useApp();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await resetPassword(email);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setSent(true);
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
          <h1 className="text-2xl font-extrabold text-gray-900">Forgot Password</h1>
          <p className="text-gray-500 mt-1.5 text-sm">
            {sent ? 'Check your email for a reset link' : 'Enter your email and we\'ll send you a reset link'}
          </p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {sent ? (
            <div className="text-center py-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-gray-700 font-medium mb-1">Reset link sent!</p>
              <p className="text-sm text-gray-500 mb-6">
                We've sent a password reset link to <span className="font-semibold text-gray-700">{email}</span>.
                Check your inbox and follow the instructions to reset your password.
              </p>
              <button onClick={() => navigate('/login')} className="btn-primary w-full">
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-brand-500" /> Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full text-base py-3">
                  {loading ? 'Sending...' : <>Send Reset Link <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Remember your password?{' '}
                <button onClick={() => navigate('/login')} className="text-brand-600 font-semibold hover:underline">
                  Sign in
                </button>
              </p>
            </>
          )}
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
