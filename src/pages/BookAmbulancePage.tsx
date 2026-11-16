import { useEffect } from 'react';
import { Ambulance, Hospital as HospitalIcon, User, Phone, Calendar, Clock, AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft, ShieldCheck, Share2, Loader2, XCircle, Check, Smartphone, CreditCard, Banknote } from 'lucide-react';
import { useApp } from '@/lib/context';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/UI';
import { mockHospitals, ambulanceTypePricing } from '@/lib/mockData';
import { generateBookingCode, formatCurrency } from '@/lib/utils';
import { watchBookingPin } from '@/lib/db';
import { createRazorpayOrder, verifyRazorpayPayment, openRazorpayCheckout, type RazorpayHandlerResponse } from '@/lib/razorpay';
import { useState } from 'react';
import LocationPicker from '@/components/LocationPicker';
import HospitalMapPicker from '@/components/HospitalMapPicker';
import type { Booking, AmbulanceType, EmergencyLevel, BookingPin, Hospital } from '@/lib/types';

const KOLKATA_TZ = 'Asia/Kolkata';

/** Returns the { date: 'YYYY-MM-DD', time: 'HH:MM' } of a Date in Asia/Kolkata. */
function kolkataParts(date: Date): { date: string; time: string } {
  return {
    date: date.toLocaleDateString('en-CA', { timeZone: KOLKATA_TZ }),
    time: date.toLocaleTimeString('en-GB', { timeZone: KOLKATA_TZ, hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

/** Human-readable date & time in Asia/Kolkata (e.g. "6 Nov 2026, 11:05 AM"). */
function kolkataDisplay(date: Date): string {
  return date.toLocaleString('en-IN', { timeZone: KOLKATA_TZ, dateStyle: 'medium', timeStyle: 'short' });
}

export default function BookAmbulancePage() {
  const { navigate, addBooking, updateBookingStatus, addresses } = useApp();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [scheduledIso, setScheduledIso] = useState('');
  const [lastBooking, setLastBooking] = useState<Booking | null>(null);
  const [pin, setPin] = useState<BookingPin | null>(null);
  const [pinCopied, setPinCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [payPending, setPayPending] = useState<string | null>(null);
  // Live clock so "Book Now" reflects the real current date & time.
  const [now, setNow] = useState(() => new Date());

  const [form, setForm] = useState({
    patientName: '',
    phone: '',
    pickup: addresses.find((a) => a.isDefault)?.fullAddress || '',
    pickupCoords: null as { lat: number; lng: number } | null,
    destination: '',
    destinationCoords: null as { lat: number; lng: number } | null,
    ambulanceType: 'Basic' as AmbulanceType,
    emergencyLevel: 'Normal' as EmergencyLevel,
    bookingType: 'now' as 'now' | 'scheduled',
    date: '',
    time: '',
    paymentMethod: 'Cash on service',
  });
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Subscribe to the server-generated verification PIN once a booking is made.
  // The PIN is created by the `onBookingCreated` Cloud Function (server-side),
  // so it appears here shortly after the booking doc is written — it is never
  // generated on the client.
  useEffect(() => {
    if (!lastBooking) return;
    setPin(null);
    setPinCopied(false);
    return watchBookingPin(lastBooking.id, setPin);
  }, [lastBooking]);

  const handleSharePin = async () => {
    if (!pin || !lastBooking) return;
    const text = `LifeCare pickup PIN for booking ${lastBooking.bookingCode}: ${pin.pin}. Share this only with your assigned ambulance driver.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'LifeCare Pickup PIN', text });
      } else {
        await navigator.clipboard.writeText(text);
        setPinCopied(true);
        setTimeout(() => setPinCopied(false), 2000);
      }
    } catch {
      // share dismissed / clipboard denied — no action needed
    }
  };

  const price = ambulanceTypePricing[form.ambulanceType] || 1800;

  const update = (k: string, v: string | { lat: number; lng: number } | null) => setForm({ ...form, [k]: v });

  const setPickup = (address: string, coords?: { lat: number; lng: number }) =>
    setForm({ ...form, pickup: address, pickupCoords: coords ?? form.pickupCoords });

  const setDestinationHospital = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    setForm((prev) => ({
      ...prev,
      destination: hospital.name,
      destinationCoords: { lat: hospital.lat, lng: hospital.lng },
    }));
  };

  const today = kolkataParts(now);
  const isToday = form.date === today.date;
  const minTime = isToday ? today.time : undefined;
  const scheduledInPast =
    form.bookingType === 'scheduled' && form.date && form.time
      ? new Date(`${form.date}T${form.time}:00+05:30`).getTime() <= now.getTime()
      : false;

  const canNext = () => {
    if (step === 1) return form.patientName && form.phone && form.pickup && form.destination;
    if (step === 2) {
      if (!form.ambulanceType || !form.emergencyLevel) return false;
      if (form.bookingType === 'now') return true;
      return Boolean(form.date && form.time) && !scheduledInPast;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (submitting) return; // prevent double-submit → duplicate bookings
    setPayError(null);
    setPayPending(null);
    setSubmitting(true);

    // Create the booking once (status "Scheduled" = pending/unconfirmed until
    // paid). On a payment retry we reuse the same booking so no duplicate is
    // ever created.
    let booking = lastBooking;
    if (!booking) {
      const scheduledFor =
        form.bookingType === 'now'
          ? new Date().toISOString()
          : new Date(`${form.date}T${form.time}:00+05:30`).toISOString();
      booking = {
        id: Math.random().toString(36).slice(2),
        bookingCode: generateBookingCode(),
        patientName: form.patientName,
        phone: form.phone,
        pickup: form.pickup,
        destination: form.destination,
        pickupLat: form.pickupCoords?.lat,
        pickupLng: form.pickupCoords?.lng,
        destinationLat: form.destinationCoords?.lat,
        destinationLng: form.destinationCoords?.lng,
        ambulanceType: form.ambulanceType,
        emergencyLevel: form.emergencyLevel,
        bookingType: form.bookingType,
        scheduledFor,
        status: 'Scheduled',
        amount: price,
        paymentMethod: form.paymentMethod,
        createdAt: new Date().toISOString(),
      };
      setScheduledIso(scheduledFor);
      await addBooking(booking); // writes to Firestore — required for order creation
      setLastBooking(booking);
    }

    // Immutable refs for the Razorpay callbacks.
    const bookingId = booking.id;
    const bookingCode = booking.bookingCode;
    const patientName = booking.patientName;
    const phone = booking.phone;
    const payMethod = form.paymentMethod;

    // Cash on service — no online payment; confirm directly.
    if (payMethod === 'Cash on service') {
      setSubmitting(false);
      setDone(true);
      return;
    }

    // UPI / Card — open Razorpay Checkout and confirm ONLY on verified payment.
    // The amount comes from the booking doc on the server (createRazorpayOrder);
    // the signature is verified on the backend (verifyRazorpayPayment).

    // Authentication guard: Razorpay order creation requires a signed-in user.
    if (!user) {
      setPayError('You must be signed in to pay. Please sign in and try again.');
      setSubmitting(false);
      return;
    }

    try {
      const order = await createRazorpayOrder(bookingId);
      const opened = await openRazorpayCheckout({
        order,
        bookingCode,
        patientName,
        phone,
        email: user?.email || '',
        method: payMethod === 'UPI' ? 'UPI' : 'Card',
        onDismiss: () => {
          setPayError('Payment cancelled. Your booking is saved but not confirmed — tap Confirm Booking to pay again.');
          setSubmitting(false);
        },
        onSuccess: async (response: RazorpayHandlerResponse) => {
          try {
            const result = await verifyRazorpayPayment({ ...response, bookingId });
            if (result.status === 'paid') {
              // Backend already set the booking to "On Going" + Paid; sync local state.
              updateBookingStatus(bookingId, 'On Going');
              setSubmitting(false);
              setDone(true);
            } else if (result.status === 'pending') {
              setPayPending('Payment authorized — awaiting confirmation. Your booking will update shortly.');
              setSubmitting(false);
            } else {
              setPayError('Payment verification failed. Please contact support.');
              setSubmitting(false);
            }
          } catch (err) {
            setPayError(err instanceof Error ? err.message : 'Payment verification failed.');
            setSubmitting(false);
          }
        },
      });
      if (!opened) {
        setPayError('Could not open the payment window. Please try again.');
        setSubmitting(false);
      }
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Could not start the payment. Please try again.');
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 animate-fade-in">
        <div className="card p-10 text-center">
          <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Booking Confirmed!</h2>
          <p className="text-gray-600 mb-6">Your ambulance has been booked successfully. You'll receive updates on your phone.</p>
          <div className="bg-brand-50 rounded-xl p-5 mb-6 text-left">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Patient:</span> <span className="font-semibold text-gray-900">{form.patientName}</span></div>
              <div><span className="text-gray-500">Ambulance:</span> <span className="font-semibold text-gray-900">{form.ambulanceType}</span></div>
              <div><span className="text-gray-500">From:</span> <span className="font-semibold text-gray-900">{form.pickup}</span></div>
              <div><span className="text-gray-500">To:</span> <span className="font-semibold text-gray-900">{form.destination}</span></div>
              <div><span className="text-gray-500">Type:</span> <span className="font-semibold text-gray-900">{form.bookingType === 'now' ? 'Book Now' : 'Scheduled'}</span></div>
              <div><span className="text-gray-500">Date & Time:</span> <span className="font-semibold text-gray-900">{kolkataDisplay(new Date(scheduledIso))}</span></div>
              <div><span className="text-gray-500">Amount:</span> <span className="font-semibold text-brand-600">{formatCurrency(price)}</span></div>
              <div><span className="text-gray-500">Payment:</span> <span className="font-semibold text-gray-900">{form.paymentMethod}</span></div>
            </div>
          </div>

          {/* Pickup verification PIN — generated & stored securely on the backend */}
          <div className="bg-gradient-to-br from-teal-50 to-brand-50 border border-teal-200 rounded-xl p-5 mb-6 text-left">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
              <h3 className="font-bold text-gray-900 text-sm">Pickup Verification PIN</h3>
            </div>
            <p className="text-xs text-gray-600 mb-4">Share this 4-digit PIN with your assigned ambulance driver. The driver must enter it to verify the booking and confirm patient pickup. Keep it private.</p>
            <div className="flex items-center justify-center gap-3 mb-4">
              {pin ? (
                <div className="flex gap-2">
                  {pin.pin.split('').map((d, i) => (
                    <span key={i} className="w-12 h-14 rounded-xl bg-white border-2 border-teal-300 flex items-center justify-center text-2xl font-extrabold text-teal-700 tracking-widest shadow-sm">{d}</span>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-medium">Generating secure PIN…</span>
                </div>
              )}
            </div>
            {pin && (
              <div className="flex gap-2 justify-center">
                <button onClick={handleSharePin} className="btn-primary text-sm">
                  {pinCopied ? <><CheckCircle2 className="w-4 h-4" /> Copied!</> : <><Share2 className="w-4 h-4" /> Share PIN</>}
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/track')} className="btn-primary">Track Ambulance</button>
            <button onClick={() => navigate('/bookings')} className="btn-secondary">View My Bookings</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      <PageHeader title="Book Ambulance" subtitle="Complete the form below to book an ambulance" icon={<Ambulance className="w-5 h-5" />} />

      {/* Stepper */}
      <div className="flex items-center justify-between mb-8">
        {['Patient Details', 'Service Info', 'Review & Confirm'].map((label, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {step > i + 1 ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
              </div>
              <span className={`text-[11px] font-semibold mt-1.5 hidden sm:block ${step >= i + 1 ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
            </div>
            {i < 2 && <div className={`flex-1 h-0.5 mx-2 ${step > i + 1 ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="card p-8">
        {step === 1 && (
          <div className="space-y-5 animate-fade-in">
            <h3 className="font-bold text-lg text-gray-900">Patient & Location Details</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5"><User className="w-4 h-4 text-brand-500" /> Patient Name</label>
                <input type="text" required value={form.patientName} onChange={(e) => update('patientName', e.target.value)} className="input-field" placeholder="Enter patient name" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5"><Phone className="w-4 h-4 text-brand-500" /> Phone Number</label>
                <input type="tel" required value={form.phone} onChange={(e) => update('phone', e.target.value)} className="input-field" placeholder="+91 98765 43210" />
              </div>
            </div>
            <div>
              <LocationPicker
                value={form.pickup}
                onChange={setPickup}
                label="Pickup Location"
              />
              {addresses.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {addresses.map((a) => (
                    <button key={a.id} type="button" onClick={() => update('pickup', a.fullAddress)} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-600 transition-colors">
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5"><HospitalIcon className="w-4 h-4 text-brand-500" /> Destination Hospital</label>
              <HospitalMapPicker
                pickupCoords={form.pickupCoords}
                onHospitalSelect={setDestinationHospital}
                selectedHospital={selectedHospital}
              />
              {selectedHospital && (
                <div className="mt-2 flex items-center gap-2 p-3 rounded-lg bg-brand-50 border border-brand-100">
                  <Check className="w-4 h-4 text-brand-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900">{selectedHospital.name}</p>
                    <p className="text-xs text-gray-500">{selectedHospital.area}, {selectedHospital.city}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedHospital(null);
                      setForm((prev) => ({ ...prev, destination: '', destinationCoords: null }));
                    }}
                    className="text-xs text-red-600 hover:text-red-800 underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            <h3 className="font-bold text-lg text-gray-900">Service & Schedule</h3>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Ambulance Type</label>
              <div className="grid sm:grid-cols-2 gap-3">
                {(Object.keys(ambulanceTypePricing) as AmbulanceType[]).map((t) => (
                  <button key={t} type="button" onClick={() => update('ambulanceType', t)} className={`p-4 rounded-xl border-2 text-left transition-all ${form.ambulanceType === t ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">{t}</span>
                      <span className="text-brand-600 font-bold text-sm">{formatCurrency(ambulanceTypePricing[t])}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Emergency Level</label>
              <div className="grid grid-cols-3 gap-3">
                {(['Critical', 'Urgent', 'Normal'] as EmergencyLevel[]).map((l) => (
                  <button key={l} type="button" onClick={() => update('emergencyLevel', l)} className={`p-3 rounded-xl border-2 font-semibold text-sm transition-all flex items-center justify-center gap-1.5 ${form.emergencyLevel === l ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-600 hover:border-brand-200'}`}>
                    {l === 'Critical' && <AlertTriangle className="w-4 h-4" />}
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Booking Schedule</label>
              <div className="grid sm:grid-cols-2 gap-3">
                <button type="button" onClick={() => update('bookingType', 'now')} className={`p-4 rounded-xl border-2 text-left transition-all ${form.bookingType === 'now' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">Book Now</span>
                    {form.bookingType === 'now' && <CheckCircle2 className="w-5 h-5 text-brand-500" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Dispatch immediately at the current time</p>
                </button>
                <button type="button" onClick={() => update('bookingType', 'scheduled')} className={`p-4 rounded-xl border-2 text-left transition-all ${form.bookingType === 'scheduled' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">Schedule Ambulance</span>
                    {form.bookingType === 'scheduled' && <CheckCircle2 className="w-5 h-5 text-brand-500" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Pick a future date & time</p>
                </button>
              </div>
            </div>
            {form.bookingType === 'now' ? (
              <div className="rounded-xl bg-brand-50 border border-brand-100 p-4 flex items-center gap-3 animate-fade-in">
                <Clock className="w-5 h-5 text-brand-600 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Dispatching now · Asia/Kolkata</p>
                  <p className="text-sm font-semibold text-gray-900">{kolkataDisplay(now)}</p>
                </div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4 animate-fade-in">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5"><Calendar className="w-4 h-4 text-brand-500" /> Date</label>
                  <input type="date" required min={today.date} value={form.date} onChange={(e) => update('date', e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5"><Clock className="w-4 h-4 text-brand-500" /> Time</label>
                  <input type="time" required min={minTime} value={form.time} onChange={(e) => update('time', e.target.value)} className="input-field" />
                </div>
                {scheduledInPast && (
                  <p className="text-xs text-red-600 sm:col-span-2">Please choose a future date and time.</p>
                )}
              </div>
            )}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Payment Method</label>
              <div className="grid grid-cols-3 gap-3">
                {['Cash on service', 'UPI', 'Card'].map((m) => (
                  <button key={m} type="button" onClick={() => update('paymentMethod', m)} className={`p-3 rounded-xl border-2 font-semibold text-sm transition-all ${form.paymentMethod === m ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-gray-200 text-gray-600 hover:border-brand-200'}`}>
                    {m}
                  </button>
                ))}
              </div>
              {form.paymentMethod === 'UPI' && (
                <div className="card p-6 animate-fade-in mt-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg bg-brand-50 flex items-center justify-center shrink-0"><Smartphone className="w-5 h-5 text-brand-600" /></div>
                    <div>
                      <h3 className="font-bold text-gray-900">UPI Payment</h3>
                      <p className="text-xs text-gray-500 mt-1">Pick any UPI app in Razorpay's checkout — GPay, PhonePe, Paytm, BHIM and more. Approve the collect request or enter your UPI PIN to confirm.</p>
                    </div>
                  </div>
                </div>
              )}
              {form.paymentMethod === 'Card' && (
                <div className="card p-6 animate-fade-in mt-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg bg-brand-50 flex items-center justify-center shrink-0"><CreditCard className="w-5 h-5 text-brand-600" /></div>
                    <div>
                      <h3 className="font-bold text-gray-900">Secure Card Payment</h3>
                      <p className="text-xs text-gray-500 mt-1">You'll enter your debit or credit card details in Razorpay's PCI-compliant checkout. Visa, Mastercard, RuPay and Amex are supported. Your card details never touch the LifeCare servers.</p>
                    </div>
                  </div>
                </div>
              )}
              {form.paymentMethod === 'Cash on service' && (
                <div className="card p-6 animate-fade-in mt-4">
                  <div className="flex items-center gap-3 text-gray-600"><Banknote className="w-5 h-5 text-brand-500" /><p className="text-sm">Pay {formatCurrency(price)} directly to the driver after the service is completed.</p></div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 animate-fade-in">
            <h3 className="font-bold text-lg text-gray-900">Review & Confirm</h3>
            <div className="bg-brand-50 rounded-xl p-5 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Patient Name</span><span className="font-semibold text-gray-900">{form.patientName}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Phone</span><span className="font-semibold text-gray-900">{form.phone}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Pickup</span><span className="font-semibold text-gray-900 text-right">{form.pickup}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Destination</span><span className="font-semibold text-gray-900">{form.destination}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Ambulance Type</span><span className="font-semibold text-gray-900">{form.ambulanceType}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Emergency Level</span><span className="font-semibold text-gray-900">{form.emergencyLevel}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Schedule</span><span className="font-semibold text-gray-900">{form.bookingType === 'now' ? `Book Now · ${kolkataDisplay(now)}` : `${form.date} at ${form.time}`}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Payment</span><span className="font-semibold text-gray-900">{form.paymentMethod}</span></div>
              <div className="border-t border-brand-100 pt-3 flex justify-between"><span className="font-bold text-gray-700">Total Amount</span><span className="font-extrabold text-brand-600 text-lg">{formatCurrency(price)}</span></div>
            </div>
          </div>
        )}

        {step === 3 && (payError || payPending) && (
          <div className="mt-6 space-y-2">
            {payError && (
              <p className="text-sm text-red-600 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <XCircle className="w-4 h-4 shrink-0" /> {payError}
              </p>
            )}
            {payPending && (
              <p className="text-sm text-amber-600 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <Clock className="w-4 h-4 shrink-0" /> {payPending}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-between mt-8">
          <button onClick={() => step > 1 ? setStep(step - 1) : navigate('/')} className="btn-ghost">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          {step < 3 ? (
            <button onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()} className="btn-primary">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <><CheckCircle2 className="w-4 h-4" /> Confirm Booking</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

