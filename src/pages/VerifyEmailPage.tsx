import { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, CheckCircle2, AlertCircle, RefreshCw, LogOut, Loader2, Ambulance, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApp } from '@/lib/context';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  const { user, sendVerificationEmail, reloadUser, signOut } = useAuth();
  const { navigate } = useApp();

  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifiedNow, setIsVerifiedNow] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // If user is already verified or is admin, redirect to dashboard
  useEffect(() => {
    if (user?.emailVerified || user?.user_metadata?.role === 'admin') {
      setIsVerifiedNow(true);
      const t = setTimeout(() => navigate('/dashboard'), 1500);
      return () => clearTimeout(t);
    }
  }, [user, navigate]);

  // Handle countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      timerRef.current = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [cooldown]);

  // Check verification status
  const checkStatus = useCallback(async (manual = false) => {
    if (manual) setChecking(true);
    setErrorMessage(null);
    try {
      const res = await reloadUser();
      if (res.verified) {
        setIsVerifiedNow(true);
        setInfoMessage('Email verified successfully! Redirecting to dashboard...');
        setTimeout(() => navigate('/dashboard'), 1200);
      } else if (manual) {
        setErrorMessage('Your email is not verified yet. Please check your inbox or click Resend.');
      }
    } catch {
      if (manual) {
        setErrorMessage('Failed to check verification status. Please try again.');
      }
    } finally {
      if (manual) setChecking(false);
    }
  }, [reloadUser, navigate]);

  // 1. Auto-polling every 5 seconds
  useEffect(() => {
    if (isVerifiedNow) return;
    const interval = setInterval(() => {
      checkStatus(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [checkStatus, isVerifiedNow]);

  // 2. Auto-check on window focus (e.g. user returns from email tab)
  useEffect(() => {
    if (isVerifiedNow) return;
    const handleFocus = () => {
      checkStatus(false);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkStatus, isVerifiedNow]);

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setErrorMessage(null);
    setInfoMessage(null);

    const { error } = await sendVerificationEmail();
    setResending(false);

    if (error) {
      setErrorMessage(error);
    } else {
      setInfoMessage('A new verification email has been sent! Please check your inbox.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-brand-50 via-white to-brand-50">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
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
        </div>

        <div className="card p-8 text-center animate-fade-in shadow-card-hover">
          {isVerifiedNow ? (
            <div className="py-6 space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto text-green-600">
                <CheckCircle2 className="w-10 h-10 animate-bounce-subtle" />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900">Email Verified!</h2>
              <p className="text-sm text-gray-600">
                Your account is now fully active. Redirecting you to your dashboard...
              </p>
              <div className="pt-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600 mx-auto" />
              </div>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mx-auto mb-5 shadow-sm">
                <Mail className="w-8 h-8" />
              </div>

              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Verify Your Email</h2>
              <p className="text-sm text-gray-600 mb-4">
                We've sent a verification link to:
              </p>
              <div className="bg-brand-50/60 border border-brand-100 rounded-xl py-2.5 px-4 mb-6 inline-block max-w-full">
                <span className="font-bold text-gray-900 text-sm break-all">
                  {user?.email || 'your email address'}
                </span>
              </div>

              {infoMessage && (
                <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs flex items-center gap-2 text-left animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 text-left animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => checkStatus(true)}
                  disabled={checking}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 font-bold"
                >
                  {checking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Checking Status...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> I Have Verified, Continue
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || resending}
                  className="btn-secondary w-full py-2.5 flex items-center justify-center gap-2 text-sm"
                >
                  {resending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Sending Email...
                    </>
                  ) : cooldown > 0 ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" /> Resend available in {cooldown}s
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" /> Resend Verification Email
                    </>
                  )}
                </button>
              </div>

              {/* Spam note */}
              <div className="mt-6 pt-5 border-t border-gray-100 text-xs text-gray-500 space-y-2">
                <p className="flex items-center justify-center gap-1.5 text-gray-600">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  Didn't receive it? Please check your <span className="font-semibold text-gray-700">Spam / Junk</span> folder.
                </p>
                <p className="text-[11px] text-gray-400">
                  We automatically check for your verification in the background.
                </p>
              </div>

              {/* Sign out / switch account */}
              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-xs text-gray-500 hover:text-brand-600 font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Use a different email / Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
