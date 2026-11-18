import { useState, useEffect } from 'react';
import {
  Ambulance,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApp } from '@/lib/context';
import { parseAuthActionParams } from '@/lib/authConfig';

function validatePassword(pass: string): { valid: boolean; message: string | null } {
  if (pass.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  const hasLetters = /[a-zA-Z]/.test(pass);
  const hasNumbers = /[0-9]/.test(pass);
  if (!hasLetters || !hasNumbers) {
    return { valid: false, message: 'Password must contain both letters and numbers.' };
  }
  return { valid: true, message: null };
}

export default function ResetPasswordPage() {
  const { verifyResetCode, confirmResetPassword } = useAuth();
  const { navigate } = useApp();

  const [oobCode, setOobCode] = useState<string | null>(null);
  const [emailToReset, setEmailToReset] = useState<string | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(true);
  const [invalidCodeError, setInvalidCodeError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Extract oobCode on mount
  useEffect(() => {
    const { oobCode: codeFromParams } = parseAuthActionParams();
    let code = codeFromParams;

    // Also check hash query params if routed as /reset-password?oobCode=...
    if (!code) {
      const qIdx = window.location.hash.indexOf('?');
      if (qIdx !== -1) {
        const hashParams = new URLSearchParams(window.location.hash.slice(qIdx + 1));
        code = hashParams.get('oobCode');
      }
    }

    if (!code) {
      setInvalidCodeError('Missing or invalid password reset link. Please request a new one.');
      setVerifyingCode(false);
      return;
    }

    setOobCode(code);

    // Verify the oobCode with Firebase
    (async () => {
      setVerifyingCode(true);
      const { email, error } = await verifyResetCode(code);
      setVerifyingCode(false);
      if (error || !email) {
        setInvalidCodeError(error || 'This reset link has expired or has already been used.');
      } else {
        setEmailToReset(email);
      }
    })();
  }, [verifyResetCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) return;
    setSubmitError(null);

    const validation = validatePassword(password);
    if (!validation.valid) {
      setSubmitError(validation.message);
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error } = await confirmResetPassword(oobCode, password);
    setSubmitting(false);

    if (error) {
      setSubmitError(error);
    } else {
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    }
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
          <h1 className="text-2xl font-extrabold text-gray-900">Reset Your Password</h1>
          <p className="text-gray-500 mt-1.5 text-sm">
            {emailToReset ? `Choose a new password for ${emailToReset}` : 'Set a new password for your account'}
          </p>
        </div>

        <div className="card p-8">
          {verifyingCode ? (
            <div className="py-8 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600 mx-auto" />
              <p className="text-sm text-gray-600 font-medium">Validating your reset link...</p>
            </div>
          ) : invalidCodeError ? (
            <div className="text-center py-4 space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto text-red-500">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Reset Link Expired or Invalid</h2>
              <p className="text-sm text-gray-600">
                {invalidCodeError}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="btn-primary w-full py-2.5"
                >
                  Request a New Reset Link
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="btn-ghost text-xs inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </button>
              </div>
            </div>
          ) : isSuccess ? (
            <div className="text-center py-6 space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto text-green-600">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Password Reset Successful!</h2>
              <p className="text-sm text-gray-600">
                Your password has been updated. Redirecting you to sign in...
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="btn-primary w-full py-2.5"
                >
                  Sign In Now
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
              {submitError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-brand-500" /> New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pr-11"
                    placeholder="Min 8 chars with letters & numbers"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-brand-500" /> Confirm New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field"
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                />
              </div>

              {/* Password strength checklist */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-600 space-y-1">
                <p className="font-semibold text-gray-700 mb-1">Password Requirements:</p>
                <p className={password.length >= 8 ? 'text-green-600 font-medium' : 'text-gray-500'}>
                  • Minimum 8 characters
                </p>
                <p className={/[a-zA-Z]/.test(password) && /[0-9]/.test(password) ? 'text-green-600 font-medium' : 'text-gray-500'}>
                  • Mix of letters and numbers
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 font-bold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Updating Password...
                  </>
                ) : (
                  <>
                    Reset Password <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
