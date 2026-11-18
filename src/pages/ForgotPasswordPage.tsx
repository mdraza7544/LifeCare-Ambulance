import { useState, useEffect, useRef } from 'react';
import { Ambulance, Mail, ArrowRight, CheckCircle2, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApp } from '@/lib/context';

const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const { navigate } = useApp();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (cooldown > 0) {
      timerRef.current = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading || cooldown > 0) return;
    setLoading(true);

    // Call resetPassword (configured with getActionCodeSettings)
    await resetPassword(email);
    setLoading(false);
    setSent(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-brand-50 via-white to-brand-50">
      <div className="w-full max-w-md">
        {/* Header */}
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
            {sent ? 'Check your email for reset instructions' : "Enter your email and we'll send you a password reset link"}
          </p>
        </div>

        <div className="card p-8">
          {sent ? (
            <div className="text-center py-4 animate-fade-in space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto text-green-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <p className="text-gray-900 font-bold text-base">Check Your Inbox</p>
              <p className="text-sm text-gray-600">
                If an account exists for <span className="font-semibold text-gray-900">{email}</span>, a password reset link has been sent. Please follow the link in the email to set a new password.
              </p>
              <p className="text-xs text-gray-400">
                Didn't see it? Be sure to check your spam or junk folder.
              </p>

              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={cooldown > 0 || loading}
                  className="btn-secondary w-full py-2.5 text-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                    </>
                  ) : cooldown > 0 ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" /> Resend available in {cooldown}s
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" /> Resend Reset Link
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="btn-ghost w-full text-xs inline-flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </button>
              </div>
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

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full text-base py-3 flex items-center justify-center gap-2 font-bold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Sending Link...
                    </>
                  ) : (
                    <>
                      Send Reset Link <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Remember your password?{' '}
                <button
                  onClick={() => navigate('/login')}
                  className="text-brand-600 font-semibold hover:underline"
                >
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
