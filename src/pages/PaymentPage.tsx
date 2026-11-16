import { useState } from 'react';
import { Wallet, CreditCard, Smartphone, Banknote, Shield, ArrowLeft, CheckCircle2, Lock, XCircle, Clock } from 'lucide-react';
import { useApp } from '@/lib/context';
import { useAuth } from '@/lib/auth';
import { createRazorpayOrder, verifyRazorpayPayment, openRazorpayCheckout } from '@/lib/razorpay';
import { PageHeader } from '@/components/UI';
import { formatCurrency } from '@/lib/utils';

export default function PaymentPage() {
  const { bookings, navigate } = useApp();
  const { user } = useAuth();
  const pending = bookings.find((b) => b.status === 'Scheduled' || b.status === 'On Going') || bookings[0];
  const [method, setMethod] = useState('UPI');
  const [processing, setProcessing] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [payPending, setPayPending] = useState<string | null>(null);

  /**
   * Real-time payment flow:
   *  1. Cloud Function creates a Razorpay order (amount verified server-side).
   *  2. Razorpay Checkout opens in the browser with the PUBLIC key id only.
   *  3. Cloud Function verifies the HMAC signature and records the payment in
   *     Firestore (`payments` collection) + marks the booking paid.
   */
  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    setPayError(null);
    setPayPending(null);

    // Cash on service — no online payment needed.
    if (method === 'Cash on service') {
      setProcessing(true);
      setTimeout(() => navigate('/payment-confirmation'), 800);
      return;
    }

    setProcessing(true);
    try {
      // 1. Create a Razorpay order on the backend (amount read from the booking doc).
      const order = await createRazorpayOrder(pending.id);
      // 2. Open Razorpay Checkout restricted to UPI or Card; the browser only
      //    gets the public key id + order details.
      const opened = await openRazorpayCheckout({
        order,
        bookingCode: order.bookingCode || pending.bookingCode,
        patientName: pending.patientName,
        phone: pending.phone,
        email: user?.email || '',
        method: method === 'UPI' ? 'UPI' : 'Card',
        onDismiss: () => {
          setProcessing(false);
          setPayError('Payment cancelled. You can try again.');
        },
        onSuccess: async (response) => {
          try {
            // 3. Verify the signature on the backend before confirming.
            const result = await verifyRazorpayPayment({ ...response, bookingId: pending.id });
            if (result.status === 'paid') {
              navigate('/payment-confirmation');
            } else if (result.status === 'pending') {
              setPayPending('Payment authorized — awaiting confirmation. Your booking will update shortly.');
              setProcessing(false);
            } else {
              setPayError('Payment verification failed. Please contact support.');
              setProcessing(false);
            }
          } catch (err) {
            setPayError(err instanceof Error ? err.message : 'Payment verification failed.');
            setProcessing(false);
          }
        },
      });
      if (!opened) {
        setPayError('Could not open the payment window. Please try again.');
        setProcessing(false);
      }
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Could not start the payment. Please try again.');
      setProcessing(false);
    }
  };

  if (!pending) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center animate-fade-in">
        <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Payments Due</h2>
        <p className="text-gray-500 mb-6">You have no pending payments.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">Back to Dashboard</button>
      </div>
    );
  }

  const methods = [
    { id: 'UPI', icon: Smartphone, label: 'UPI Payment', desc: 'Pay using any UPI app' },
    { id: 'Card', icon: CreditCard, label: 'Credit/Debit Card', desc: 'Visa, Mastercard, RuPay' },
    { id: 'Cash on service', icon: Banknote, label: 'Cash on Service', desc: 'Pay after the ride' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      <button onClick={() => navigate('/dashboard')} className="btn-ghost mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <PageHeader title="Payment" subtitle={`Booking ${pending.bookingCode}`} icon={<Wallet className="w-5 h-5" />} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h3 className="font-bold text-gray-900 mb-4">Select Payment Method</h3>
            <div className="space-y-3">
              {methods.map((m) => (
                <button key={m.id} onClick={() => setMethod(m.id)} className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all text-left ${method === m.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-200'}`}>
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${method === m.id ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'}`}><m.icon className="w-5 h-5" /></div>
                  <div className="flex-1"><p className="font-semibold text-gray-900 text-sm">{m.label}</p><p className="text-xs text-gray-500">{m.desc}</p></div>
                  {method === m.id && <CheckCircle2 className="w-5 h-5 text-brand-500" />}
                </button>
              ))}
            </div>
          </div>

          {method === 'Card' && (
            <div className="card p-6 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-lg bg-brand-50 flex items-center justify-center shrink-0"><CreditCard className="w-5 h-5 text-brand-600" /></div>
                <div>
                  <h3 className="font-bold text-gray-900">Secure Card Payment</h3>
                  <p className="text-xs text-gray-500 mt-1">You'll enter your debit or credit card details in Razorpay's PCI-compliant checkout. Visa, Mastercard, RuPay and Amex are supported. Your card details never touch the LifeCare servers.</p>
                </div>
              </div>
            </div>
          )}

          {method === 'UPI' && (
            <div className="card p-6 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-lg bg-brand-50 flex items-center justify-center shrink-0"><Smartphone className="w-5 h-5 text-brand-600" /></div>
                <div>
                  <h3 className="font-bold text-gray-900">UPI Payment</h3>
                  <p className="text-xs text-gray-500 mt-1">Pick any UPI app in Razorpay's checkout — GPay, PhonePe, Paytm, BHIM and more. Approve the collect request or enter your UPI PIN to confirm.</p>
                </div>
              </div>
            </div>
          )}

          {method === 'Cash on service' && (
            <div className="card p-6 animate-fade-in">
              <div className="flex items-center gap-3 text-gray-600"><Banknote className="w-5 h-5 text-brand-500" /><p className="text-sm">Pay {formatCurrency(pending.amount)} directly to the driver after the service is completed.</p></div>
            </div>
          )}
        </div>

        <div>
          <div className="card p-6 sticky top-24">
            <h3 className="font-bold text-gray-900 mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-gray-500">Booking ID</span><span className="font-semibold text-gray-900">{pending.bookingCode}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Patient</span><span className="font-semibold text-gray-900">{pending.patientName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Ambulance</span><span className="font-semibold text-gray-900">{pending.ambulanceType}</span></div>
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Service Fee</span><span className="font-semibold text-gray-900">{formatCurrency(pending.amount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Tax</span><span className="font-semibold text-gray-900">Rs. 0</span></div>
            </div>
            <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between">
              <span className="font-bold text-gray-700">Total</span>
              <span className="font-extrabold text-brand-600 text-lg">{formatCurrency(pending.amount)}</span>
            </div>
            <button onClick={handlePay} disabled={processing} className="btn-primary w-full mt-5">
              {processing ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...</> : <><Lock className="w-4 h-4" /> Pay {formatCurrency(pending.amount)}</>}
            </button>
            {payError && (
              <p className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> {payError}
              </p>
            )}
            {payPending && (
              <p className="mt-2 text-xs text-amber-600 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {payPending}
              </p>
            )}
            <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-gray-400"><Shield className="w-3.5 h-3.5" /> Secure payment</div>
          </div>
        </div>
      </div>
    </div>
  );
}
