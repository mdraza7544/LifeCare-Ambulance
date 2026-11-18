import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, Ambulance } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useApp } from '@/lib/context';
import { parseAuthActionParams, cleanAuthActionParamsFromUrl } from '@/lib/authConfig';

export default function AuthActionPage() {
  const { applyAction } = useAuth();
  const { navigate } = useApp();

  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionDone, setActionDone] = useState(false);

  useEffect(() => {
    const { mode, oobCode } = parseAuthActionParams();

    if (!mode || !oobCode) {
      setErrorMessage('Missing action parameters or invalid link.');
      setLoading(false);
      return;
    }

    // Clean URL query parameters so they don't linger
    cleanAuthActionParamsFromUrl();

    // Route resetPassword to dedicated ResetPasswordPage
    if (mode === 'resetPassword') {
      navigate(`/reset-password?oobCode=${encodeURIComponent(oobCode)}`);
      return;
    }

    // Handle verification and recovery actions
    (async () => {
      setLoading(true);
      const { error } = await applyAction(oobCode);
      setLoading(false);
      setActionDone(true);

      if (error) {
        setErrorMessage(error);
      } else {
        if (mode === 'verifyEmail') {
          setSuccessMessage('Your email address has been verified successfully!');
        } else if (mode === 'recoverEmail') {
          setSuccessMessage('Your email change has been reverted. Your original email has been restored.');
        } else if (mode === 'verifyAndChangeEmail') {
          setSuccessMessage('Your new email address has been verified and updated successfully!');
        } else {
          setSuccessMessage('Action completed successfully.');
        }
      }
    })();
  }, [applyAction, navigate]);

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
        </div>

        <div className="card p-8 text-center animate-fade-in shadow-card-hover">
          {loading ? (
            <div className="py-8 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-brand-600 mx-auto" />
              <p className="text-sm text-gray-600 font-medium">Processing your request...</p>
            </div>
          ) : actionDone && successMessage ? (
            <div className="py-4 space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto text-green-600">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Success!</h2>
              <p className="text-sm text-gray-600">{successMessage}</p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                >
                  Continue to Dashboard <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto text-red-500">
                <AlertCircle className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Unable to Process Action</h2>
              <p className="text-sm text-gray-600">{errorMessage}</p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="btn-primary w-full py-2.5"
                >
                  Return to Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
