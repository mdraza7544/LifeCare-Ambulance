import { useEffect, useState } from 'react';
import {
  Ambulance,
  Hospital as HospitalIcon,
  User,
  Phone,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
} from 'lucide-react';
import { useApp } from '@/lib/context';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/UI';
import { ambulanceTypePricing } from '@/lib/pricing';
import { generateBookingCode, formatCurrency } from '@/lib/utils';
import { createBooking } from '@/lib/firestoreService';
import { geocodeAddress } from '@/lib/googleMaps';
import LocationPicker from '@/components/LocationPicker';
import HospitalMapPicker, { type RouteInfo } from '@/components/HospitalMapPicker';
import type { AmbulanceType, EmergencyLevel, Hospital } from '@/lib/types';

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

/** Maps the form's emergency level onto the shared data layer's priority enum. */
function toPriority(level: EmergencyLevel): 'critical' | 'high' | 'normal' {
  if (level === 'Critical') return 'critical';
  if (level === 'Urgent') return 'high';
  return 'normal';
}

export default function BookAmbulancePage() {
  const { navigate, addresses } = useApp();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [scheduledIso, setScheduledIso] = useState('');
  const [createdCode, setCreatedCode] = useState('');
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
  });
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const price = ambulanceTypePricing[form.ambulanceType] ?? 1800;

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  const setPickup = (address: string, coords?: { lat: number; lng: number }) =>
    setForm((prev) => ({ ...prev, pickup: address, pickupCoords: coords ?? null }));

  const handleSelectAddress = async (address: string) => {
    setForm((prev) => ({ ...prev, pickup: address, pickupCoords: null }));
    const coords = await geocodeAddress(address);
    if (coords) {
      setForm((prev) => (prev.pickup === address ? { ...prev, pickupCoords: coords } : prev));
    }
  };

  // If a default address is loaded (or user has a saved address with no coords), geocode it
  useEffect(() => {
    const defaultAddr = addresses.find((a) => a.isDefault)?.fullAddress;
    const addr = form.pickup || defaultAddr;
    if (addr && !form.pickupCoords) {
      if (!form.pickup && defaultAddr) {
        setForm((prev) => ({ ...prev, pickup: defaultAddr }));
      }
      geocodeAddress(addr).then((coords) => {
        if (coords) {
          setForm((prev) => (!prev.pickupCoords ? { ...prev, pickupCoords: coords } : prev));
        }
      });
    }
  }, [addresses]);

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
    if (step === 1) return Boolean(form.patientName && form.phone && form.pickup && form.destination);
    if (step === 2) {
      if (!form.ambulanceType || !form.emergencyLevel) return false;
      if (form.bookingType === 'now') return true;
      return Boolean(form.date && form.time) && !scheduledInPast;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!user) {
      setSubmitError('You must be signed in to book an ambulance.');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const scheduledTime =
        form.bookingType === 'now'
          ? new Date().toISOString()
          : new Date(`${form.date}T${form.time}:00+05:30`).toISOString();
      const bookingCode = generateBookingCode();
      await createBooking({
        userId: user.id,
        pickup: form.pickup,
        destination: form.destination,
        priority: toPriority(form.emergencyLevel),
        status: 'pending',
        paymentStatus: 'pending',
        scheduledTime,
        amount: price,
        bookingCode,
        patientName: form.patientName,
        phone: form.phone,
        ambulanceType: form.ambulanceType,
        emergencyLevel: form.emergencyLevel,
        pickupLat: form.pickupCoords?.lat,
        pickupLng: form.pickupCoords?.lng,
        destinationLat: form.destinationCoords?.lat,
        destinationLng: form.destinationCoords?.lng,
        distanceText: routeInfo?.distanceText,
        durationText: routeInfo?.durationText,
        distanceKm: routeInfo?.distanceKm,
      });
      setScheduledIso(scheduledTime);
      setCreatedCode(bookingCode);
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit your booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 animate-fade-in">
        <div className="card p-10 text-center">
          <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Booking Submitted!</h2>
          <p className="text-gray-600 mb-6">
            Your booking request has been received and is <span className="font-semibold text-amber-700">awaiting admin approval</span>.
            You'll see status updates in My Bookings — once accepted, complete payment there to confirm.
          </p>
          <div className="bg-brand-50 rounded-xl p-5 mb-6 text-left">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Booking code:</span> <span className="font-semibold text-gray-900">{createdCode}</span></div>
              <div><span className="text-gray-500">Patient:</span> <span className="font-semibold text-gray-900">{form.patientName}</span></div>
              <div><span className="text-gray-500">From:</span> <span className="font-semibold text-gray-900">{form.pickup}</span></div>
              <div><span className="text-gray-500">To:</span> <span className="font-semibold text-gray-900">{form.destination}</span></div>
              <div><span className="text-gray-500">Ambulance:</span> <span className="font-semibold text-gray-900">{form.ambulanceType}</span></div>
              <div><span className="text-gray-500">Priority:</span> <span className="font-semibold text-gray-900">{form.emergencyLevel}</span></div>
              <div className="col-span-2"><span className="text-gray-500">Schedule:</span> <span className="font-semibold text-gray-900">{form.bookingType === 'now' ? `Book Now · ${kolkataDisplay(new Date(scheduledIso))}` : kolkataDisplay(new Date(scheduledIso))}</span></div>
              {routeInfo && (
                <div className="col-span-2"><span className="text-gray-500">Distance / ETA:</span> <span className="font-semibold text-gray-900">{routeInfo.distanceText} · {routeInfo.durationText}</span></div>
              )}
              <div><span className="text-gray-500">Amount:</span> <span className="font-semibold text-brand-600">{formatCurrency(price)}</span></div>
              <div><span className="text-gray-500">Status:</span> <span className="font-semibold text-amber-700">Pending</span></div>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/bookings')} className="btn-primary">View My Bookings</button>
            <button onClick={() => { setDone(false); setStep(1); }} className="btn-secondary">Book Another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      <PageHeader title="Book Ambulance" subtitle="Complete the form below to request an ambulance" icon={<Ambulance className="w-5 h-5" />} />

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
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleSelectAddress(a.fullAddress)}
                      className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                    >
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
                onRouteInfo={setRouteInfo}
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
                      setRouteInfo(null);
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
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-600">
                Your request is created as <span className="font-semibold text-amber-700">Pending</span>. An admin will review and accept it.
                After acceptance, you'll complete payment to confirm the booking.
              </p>
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
              {routeInfo && (
                <div className="flex justify-between text-sm"><span className="text-gray-500">Distance / ETA</span><span className="font-semibold text-gray-900">{routeInfo.distanceText} · {routeInfo.durationText}</span></div>
              )}
              <div className="flex justify-between text-sm"><span className="text-gray-500">Schedule</span><span className="font-semibold text-gray-900">{form.bookingType === 'now' ? `Book Now · ${kolkataDisplay(now)}` : `${form.date} at ${form.time}`}</span></div>
              <div className="border-t border-brand-100 pt-3 flex justify-between"><span className="font-bold text-gray-700">Total Amount</span><span className="font-extrabold text-brand-600 text-lg">{formatCurrency(price)}</span></div>
            </div>
          </div>
        )}

        {step === 3 && submitError && (
          <p className="mt-6 text-sm text-red-600 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {submitError}
          </p>
        )}

        <div className="flex justify-between mt-8">
          <button onClick={() => (step > 1 ? setStep(step - 1) : navigate('/'))} className="btn-ghost">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          {step < 3 ? (
            <button onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()} className="btn-primary">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><CheckCircle2 className="w-4 h-4" /> Submit Booking</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
