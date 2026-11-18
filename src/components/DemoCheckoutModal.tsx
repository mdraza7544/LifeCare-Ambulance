import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CreditCard,
  Smartphone,
  Building2,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lock,
  Sparkles,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { registerDemoModal, type CheckoutOptions } from '@/lib/payment';
import type { RazorpayHandlerResponse } from '@/lib/razorpay';

type PaymentTab = 'upi' | 'card' | 'netbanking' | 'wallet';
type CheckoutState = 'form' | 'processing' | 'success' | 'failed';

const POPULAR_BANKS = [
  { id: 'HDFC', name: 'HDFC Bank', code: 'HDFC' },
  { id: 'SBI', name: 'State Bank of India', code: 'SBI' },
  { id: 'ICICI', name: 'ICICI Bank', code: 'ICICI' },
  { id: 'AXIS', name: 'Axis Bank', code: 'UTIB' },
  { id: 'KOTAK', name: 'Kotak Mahindra Bank', code: 'KKBK' },
  { id: 'PNB', name: 'Punjab National Bank', code: 'PUNB' },
];

const POPULAR_WALLETS = [
  { id: 'paytm', name: 'Paytm Wallet', icon: '₹' },
  { id: 'phonepe', name: 'PhonePe Wallet', icon: 'P' },
  { id: 'amazonpay', name: 'Amazon Pay', icon: 'A' },
  { id: 'mobikwik', name: 'MobiKwik', icon: 'M' },
];

function generateDemoId(prefix: string): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let rand = '';
  for (let i = 0; i < 14; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_${rand}`;
}

export default function DemoCheckoutModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [activeTab, setActiveTab] = useState<PaymentTab>('card');
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('form');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedPaymentId, setGeneratedPaymentId] = useState<string>('');

  // Form states (kept only in local component memory — never saved to DB or logs)
  const [cardNumber, setCardNumber] = useState('4111 1111 1111 1111');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');
  const [cardName, setCardName] = useState('');
  const [upiId, setUpiId] = useState('user@okaxis');
  const [selectedBank, setSelectedBank] = useState('HDFC');
  const [selectedWallet, setSelectedWallet] = useState('paytm');

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Register with payment wrapper on mount
  useEffect(() => {
    const unregister = registerDemoModal((opts) => {
      setOptions(opts);
      setCardName(opts.patientName || 'Cardholder');
      setCheckoutState('form');
      setErrorMessage(null);
      setGeneratedPaymentId('');
      if (opts.method === 'UPI') {
        setActiveTab('upi');
      } else {
        setActiveTab('card');
      }
      setIsOpen(true);
    });
    return unregister;
  }, []);

  // Lock background scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  const handleDismiss = useCallback(() => {
    if (checkoutState === 'processing') return; // Do not dismiss mid-transaction
    setIsOpen(false);
    if (options) {
      options.onDismiss();
    }
  }, [checkoutState, options]);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDismiss]);

  // Card Number Formatter (inserts space every 4 digits)
  const handleCardNumberChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 16);
    const parts = clean.match(/.{1,4}/g);
    setCardNumber(parts ? parts.join(' ') : clean);
  };

  // Expiry Formatter (MM/YY)
  const handleExpiryChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    if (clean.length >= 3) {
      setCardExpiry(`${clean.slice(0, 2)}/${clean.slice(2, 4)}`);
    } else {
      setCardExpiry(clean);
    }
  };

  // Execute Payment Simulation
  const executePayment = (forceFail: boolean = false) => {
    setErrorMessage(null);

    // Basic Input Validations
    if (activeTab === 'card') {
      const cleanNum = cardNumber.replace(/\s/g, '');
      if (cleanNum.length < 13) {
        setErrorMessage('Please enter a valid 16-digit card number.');
        return;
      }
      if (cardExpiry.length < 5) {
        setErrorMessage('Please enter valid expiry date (MM/YY).');
        return;
      }
      if (cardCvv.length < 3) {
        setErrorMessage('Please enter valid 3-digit CVV.');
        return;
      }
    } else if (activeTab === 'upi') {
      if (!upiId.trim() || !upiId.includes('@')) {
        setErrorMessage('Please enter a valid UPI ID (e.g. mobile@upi or name@bank).');
        return;
      }
    }

    // Determine success or failure
    const isFailureCard = cardNumber.replace(/\s/g, '') === '4000000000000002';
    const willFail = forceFail || isFailureCard;

    setCheckoutState('processing');

    // Simulate bank authorization delay (~2 seconds)
    setTimeout(() => {
      if (willFail) {
        setCheckoutState('failed');
      } else {
        const payId = generateDemoId('pay_demo');
        const orderId = generateDemoId('order_demo');
        setGeneratedPaymentId(payId);
        setCheckoutState('success');

        // Determine method label
        let methodLabel = 'Demo (Card)';
        if (activeTab === 'upi') methodLabel = 'Demo (UPI)';
        else if (activeTab === 'netbanking') methodLabel = `Demo (Netbanking - ${selectedBank})`;
        else if (activeTab === 'wallet') methodLabel = `Demo (Wallet - ${selectedWallet})`;

        const demoResponse: RazorpayHandlerResponse = {
          razorpay_payment_id: payId,
          razorpay_order_id: orderId,
          razorpay_signature: `demo_sig_${Math.random().toString(36).slice(2)}`,
        };

        // Auto-close modal after ~1.5 seconds and trigger onSuccess
        setTimeout(() => {
          setIsOpen(false);
          if (options) {
            void options.onSuccess(demoResponse, methodLabel);
          }
        }, 1500);
      }
    }, 2000);
  };

  if (!isOpen || !options) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-checkout-title"
    >
      {/* Modal Container */}
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col max-h-[92vh] animate-scale-up"
      >
        {/* Razorpay-style Gradient Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-brand-900 text-white p-5 relative">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={checkoutState === 'processing'}
            aria-label="Close checkout"
            className="absolute right-4 top-4 text-gray-300 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-amber-950 shadow-sm uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> DEMO MODE - No real money
            </span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="demo-checkout-title" className="text-lg font-extrabold tracking-tight">
                LifeCare Ambulance Service
              </h2>
              <p className="text-xs text-blue-200 mt-0.5">
                Booking: <span className="font-mono font-semibold text-white">{options.bookingCode}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-blue-200 uppercase tracking-wide block font-semibold">
                Amount to Pay
              </span>
              <span className="text-2xl font-black text-white tracking-tight">
                {formatCurrency(options.amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto">
          {/* STATE 1: PROCESSING */}
          {checkoutState === 'processing' && (
            <div className="p-10 text-center flex flex-col items-center justify-center space-y-4 my-8 animate-fade-in">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-brand-100 border-t-brand-600 animate-spin" />
                <Lock className="w-6 h-6 text-brand-600 absolute inset-0 m-auto" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Processing Demo Payment…</h3>
              <p className="text-xs text-gray-500 max-w-xs">
                Simulating secure bank authorization. Please do not close this window or refresh.
              </p>
            </div>
          )}

          {/* STATE 2: SUCCESS */}
          {checkoutState === 'success' && (
            <div className="p-10 text-center flex flex-col items-center justify-center space-y-3 my-6 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 animate-bounce" />
              </div>
              <h3 className="text-xl font-extrabold text-gray-900">Payment Successful!</h3>
              <p className="text-xs text-gray-500">
                Payment ID:{' '}
                <span className="font-mono font-semibold text-gray-800">{generatedPaymentId}</span>
              </p>
              <p className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-3 py-1 rounded-full inline-block mt-2">
                ✓ Booking confirmed. Redirecting to receipt…
              </p>
            </div>
          )}

          {/* STATE 3: FAILED */}
          {checkoutState === 'failed' && (
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-3 my-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                <XCircle className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-extrabold text-gray-900">Payment Failed</h3>
              <p className="text-xs text-rose-600 font-medium bg-rose-50 px-3 py-1.5 rounded-lg">
                Declined by issuing bank (Simulated Failure Scenario)
              </p>
              <p className="text-xs text-gray-500">
                You used test card <span className="font-mono font-semibold">4000 0000 0000 0002</span> or clicked "Simulate Failure".
              </p>
              <div className="flex gap-3 mt-4 w-full max-w-xs">
                <button
                  type="button"
                  onClick={() => setCheckoutState('form')}
                  className="btn-primary flex-1 text-xs py-2.5"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="btn-secondary flex-1 text-xs py-2.5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* STATE 4: MAIN PAYMENT FORM */}
          {checkoutState === 'form' && (
            <div>
              {/* Payment Methods Nav (Top Tabs) */}
              <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-100 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('card');
                    setErrorMessage(null);
                  }}
                  className={`py-3 px-2 flex flex-col sm:flex-row items-center justify-center gap-1.5 border-b-2 transition-all ${
                    activeTab === 'card'
                      ? 'border-brand-600 text-brand-600 bg-white shadow-sm'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('upi');
                    setErrorMessage(null);
                  }}
                  className={`py-3 px-2 flex flex-col sm:flex-row items-center justify-center gap-1.5 border-b-2 transition-all ${
                    activeTab === 'upi'
                      ? 'border-brand-600 text-brand-600 bg-white shadow-sm'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>UPI / QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('netbanking');
                    setErrorMessage(null);
                  }}
                  className={`py-3 px-2 flex flex-col sm:flex-row items-center justify-center gap-1.5 border-b-2 transition-all ${
                    activeTab === 'netbanking'
                      ? 'border-brand-600 text-brand-600 bg-white shadow-sm'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Netbanking</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('wallet');
                    setErrorMessage(null);
                  }}
                  className={`py-3 px-2 flex flex-col sm:flex-row items-center justify-center gap-1.5 border-b-2 transition-all ${
                    activeTab === 'wallet'
                      ? 'border-brand-600 text-brand-600 bg-white shadow-sm'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  <span>Wallet</span>
                </button>
              </div>

              {/* Tab Contents */}
              <div className="p-5">
                {errorMessage && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* 1. CARD TAB */}
                {activeTab === 'card' && (
                  <div className="space-y-4 text-xs">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-semibold text-gray-700">Card Number</label>
                        <span className="text-[10px] text-gray-400">Visa / Mastercard / RuPay</span>
                      </div>
                      <input
                        ref={firstInputRef}
                        type="text"
                        value={cardNumber}
                        onChange={(e) => handleCardNumberChange(e.target.value)}
                        placeholder="4111 1111 1111 1111"
                        maxLength={19}
                        className="input-field font-mono text-sm py-2"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-gray-700 block mb-1">Expiry (MM/YY)</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => handleExpiryChange(e.target.value)}
                          placeholder="MM/YY"
                          maxLength={5}
                          className="input-field font-mono text-sm py-2"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-gray-700 block mb-1">CVV</label>
                        <input
                          type="password"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                          placeholder="123"
                          maxLength={3}
                          className="input-field font-mono text-sm py-2"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-gray-700 block mb-1">Cardholder Name</label>
                      <input
                        type="text"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="Name on Card"
                        className="input-field text-sm py-2"
                      />
                    </div>

                    {/* Test Card Quick Selectors */}
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-[11px] font-semibold text-gray-500 mb-1.5">
                        Test Cards (Tap to populate):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCardNumber('4111 1111 1111 1111');
                            setCardExpiry('12/28');
                            setCardCvv('123');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold hover:bg-emerald-100 transition-colors"
                        >
                          ✓ Success Card (4111...)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCardNumber('4000 0000 0000 0002');
                            setCardExpiry('12/28');
                            setCardCvv('123');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold hover:bg-rose-100 transition-colors"
                        >
                          ✕ Failure Card (4000...02)
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. UPI TAB */}
                {activeTab === 'upi' && (
                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="font-semibold text-gray-700 block mb-1">
                        Enter UPI ID / VPA
                      </label>
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@okaxis, mobile@upi"
                        className="input-field text-sm py-2"
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        Any valid UPI address format will simulate a successful approval.
                      </p>
                    </div>

                    {/* Quick UPI Presets */}
                    <div>
                      <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Popular UPI Apps:</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {['Google Pay', 'PhonePe', 'Paytm'].map((app) => (
                          <button
                            key={app}
                            type="button"
                            onClick={() => setUpiId(`${app.toLowerCase().replace(/\s/g, '')}@upi`)}
                            className="p-2 rounded-xl bg-gray-50 hover:bg-brand-50 border border-gray-200 hover:border-brand-300 font-semibold text-gray-700 hover:text-brand-700 transition-all text-xs"
                          >
                            {app}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. NETBANKING TAB */}
                {activeTab === 'netbanking' && (
                  <div className="space-y-4 text-xs">
                    <p className="font-semibold text-gray-700">Select Popular Bank:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {POPULAR_BANKS.map((bank) => (
                        <button
                          key={bank.id}
                          type="button"
                          onClick={() => setSelectedBank(bank.name)}
                          className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                            selectedBank === bank.name
                              ? 'border-brand-600 bg-brand-50/60 font-bold text-brand-900 ring-1 ring-brand-600'
                              : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                          }`}
                        >
                          <span>{bank.name}</span>
                          <span className="text-[10px] font-mono text-gray-400">{bank.code}</span>
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="font-semibold text-gray-700 block mb-1">Or Other Bank</label>
                      <select
                        value={selectedBank}
                        onChange={(e) => setSelectedBank(e.target.value)}
                        className="input-field text-xs py-2"
                      >
                        <option value="HDFC Bank">HDFC Bank</option>
                        <option value="State Bank of India">State Bank of India</option>
                        <option value="Bank of Baroda">Bank of Baroda</option>
                        <option value="Canara Bank">Canara Bank</option>
                        <option value="Union Bank of India">Union Bank of India</option>
                        <option value="IndusInd Bank">IndusInd Bank</option>
                        <option value="Yes Bank">Yes Bank</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* 4. WALLET TAB */}
                {activeTab === 'wallet' && (
                  <div className="space-y-4 text-xs">
                    <p className="font-semibold text-gray-700">Select Wallet Provider:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {POPULAR_WALLETS.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setSelectedWallet(w.name)}
                          className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                            selectedWallet === w.name
                              ? 'border-brand-600 bg-brand-50/60 font-bold text-brand-900 ring-1 ring-brand-600'
                              : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                          }`}
                        >
                          <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-xs text-gray-700">
                            {w.icon}
                          </span>
                          <span>{w.name}</span>
                        </button>
                      ))}
                    </div>

                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-[11px] text-gray-500">
                      Linking simulated phone:{' '}
                      <span className="font-semibold text-gray-800">
                        {options.phone || '+91 98765 43210'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => executePayment(false)}
                    className="w-full btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
                  >
                    <Lock className="w-4 h-4" /> Pay {formatCurrency(options.amount)}
                  </button>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                    <span className="inline-flex items-center gap-1 text-gray-400">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Demo Sandbox Mode
                    </span>

                    <button
                      type="button"
                      onClick={() => executePayment(true)}
                      className="text-rose-600 hover:text-rose-700 font-medium underline underline-offset-2 hover:opacity-80 transition-opacity"
                    >
                      Simulate failure flow
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Razorpay replica footer */}
        <div className="bg-gray-50 px-5 py-2.5 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-600">Secured by</span>
            <span className="font-bold tracking-tight text-brand-700">LifeCare Pay</span>
            <span className="text-gray-300">|</span>
            <span>Razorpay UI Replica</span>
          </div>
          <span>256-bit encryption</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
