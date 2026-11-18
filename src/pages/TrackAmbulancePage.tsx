import { useState, useEffect, useMemo, useRef } from 'react';
import { Navigation, MapPin, Clock, Phone, Ambulance, Star, ArrowLeft, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import type { DocumentData } from 'firebase/firestore';
import { useApp } from '@/lib/context';
import { useAuth } from '@/lib/auth';
import { useBookings, useAmbulances, useDrivers, markBookingReached } from '@/lib/firestoreService';
import { PageHeader } from '@/components/UI';
import StatusBadge from '@/components/StatusBadge';
import { watchBooking } from '@/lib/db';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { haversineKm } from '@/lib/utils';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type AnyRef = any;

export default function TrackAmbulancePage() {
  const { user } = useAuth();
  const { data: fsBookings } = useBookings(user?.id);
  const { data: ambulances } = useAmbulances();
  const { data: drivers } = useDrivers();
  const { bookings: contextBookings, navigate } = useApp();

  const [reaching, setReaching] = useState(false);
  const [reachError, setReachError] = useState<string | null>(null);

  const hashId = useMemo(() => {
    const match = (window.location.hash || '').match(/[?&]id=([^&]+)/);
    return match?.[1] ?? null;
  }, []);

  const allBookings = useMemo(() => {
    if (fsBookings && fsBookings.length > 0) {
      return fsBookings.map((b) => ({
        id: b.id,
        bookingCode: b.bookingCode || b.id.slice(0, 8),
        patientName: b.patientName || '',
        phone: b.phone || '',
        pickup: b.pickup,
        destination: b.destination,
        pickupLat: b.pickupLat,
        pickupLng: b.pickupLng,
        destinationLat: b.destinationLat,
        destinationLng: b.destinationLng,
        ambulanceType: (b.ambulanceType as any) || 'Basic',
        emergencyLevel: (b.emergencyLevel as any) || 'Normal',
        scheduledFor: b.scheduledTime,
        status: b.status as any,
        amount: b.amount,
        paymentMethod: b.paymentMethod || 'Razorpay',
        createdAt: b.createdAt,
        ambulanceId: b.ambulanceId,
        driverId: b.driverId,
      }));
    }
    return contextBookings;
  }, [fsBookings, contextBookings]);

  const trackable = allBookings.filter(
    (b) =>
      b.status === 'allocated' ||
      b.status === 'confirmed' ||
      b.status === 'On Going' ||
      b.status === 'Scheduled',
  );

  const [selectedId, setSelectedId] = useState<string | null>(
    hashId || trackable[0]?.id || null,
  );

  useEffect(() => {
    if (hashId) {
      setSelectedId(hashId);
    } else if (!selectedId && trackable.length > 0) {
      setSelectedId(trackable[0].id);
    }
  }, [hashId, trackable]);

  const [progress, setProgress] = useState(15);
  /* Live ambulance location fields from the Firestore booking doc
     (`ambulance_lat` / `ambulance_lng` — updated by dispatch/admin). */
  const [live, setLive] = useState<DocumentData | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const selected = allBookings.find((b) => b.id === selectedId);
  const currentStatus = (live?.status ?? selected?.status ?? '').toLowerCase();

  const handleMarkReached = async () => {
    if (!selectedId) return;
    setReaching(true);
    setReachError(null);
    try {
      await markBookingReached(selectedId);
    } catch (err) {
      setReachError(err instanceof Error ? err.message : 'Failed to mark as reached.');
    } finally {
      setReaching(false);
    }
  };

  const pickup = useMemo<{ lat: number; lng: number } | null>(() => {
    if (!selected) return null;
    return typeof selected.pickupLat === 'number' && typeof selected.pickupLng === 'number'
      ? { lat: selected.pickupLat, lng: selected.pickupLng }
      : null;
  }, [selected]);

  const ambulance = useMemo<{ lat: number; lng: number } | null>(() => {
    if (!live) return null;
    return typeof live.ambulance_lat === 'number' && typeof live.ambulance_lng === 'number'
      ? { lat: live.ambulance_lat, lng: live.ambulance_lng }
      : null;
  }, [live]);

  /* Straight-line distance between the ambulance and the pickup point. */
  const distanceKm = useMemo<number | null>(
    () => (ambulance && pickup ? haversineKm(ambulance.lat, ambulance.lng, pickup.lat, pickup.lng) : null),
    [ambulance, pickup],
  );

  /* Live subscription — re-fires whenever the booking doc changes. */
  useEffect(() => {
    setLive(null);
    if (!selectedId) return;
    const unsubscribe = watchBooking(selectedId, (data) => setLive(data));
    return unsubscribe;
  }, [selectedId]);

  useEffect(() => {
    if (selected && selected.status === 'On Going') {
      setProgress(15);
      const interval = setInterval(() => {
        setProgress((p) => (p < 90 ? p + 1 : p));
      }, 800);
      return () => clearInterval(interval);
    }
    setProgress(0);
  }, [selectedId, selected]);

  /* ---- Google map ---- */
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AnyRef>(null);
  const pickupMarkerRef = useRef<AnyRef>(null);
  const ambulanceMarkerRef = useRef<AnyRef>(null);

  // Create the map once a booking is selected.
  useEffect(() => {
    if (!selected || !mapDivRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const maps = await loadGoogleMaps();
        if (cancelled || !mapDivRef.current) return;
        const center = ambulance ?? pickup ?? { lat: 12.9716, lng: 77.5946 };
        if (!mapRef.current) {
          mapRef.current = new maps.Map(mapDivRef.current, {
            center,
            zoom: 14,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
        } else {
          mapRef.current.setCenter(center);
        }
        setMapError(null);
      } catch (err) {
        if (!cancelled) {
          setMapError(err instanceof Error ? err.message : 'Google Maps failed to load.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, mapError === null]);

  // Keep the markers in sync with pickup / live ambulance positions.
  useEffect(() => {
    if (!mapRef.current) return;
    const maps = window.google?.maps;
    if (!maps) return;

    if (pickup) {
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = new maps.Marker({
          position: pickup,
          map: mapRef.current,
          title: `Pickup — ${selected?.pickup ?? ''}`,
        });
      } else {
        pickupMarkerRef.current.setPosition(pickup);
        pickupMarkerRef.current.setMap(mapRef.current);
      }
    } else if (pickupMarkerRef.current) {
      pickupMarkerRef.current.setMap(null);
    }

    if (ambulance) {
      if (!ambulanceMarkerRef.current) {
        ambulanceMarkerRef.current = new maps.Marker({
          position: ambulance,
          map: mapRef.current,
          title: 'Ambulance (live location)',
          icon: {
            path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: '#E63946',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });
      } else {
        ambulanceMarkerRef.current.setPosition(ambulance);
        ambulanceMarkerRef.current.setMap(mapRef.current);
      }
      if (pickup) {
        const bounds = new maps.LatLngBounds();
        bounds.extend(pickup);
        bounds.extend(ambulance);
        mapRef.current.fitBounds(bounds, 60);
      } else {
        mapRef.current.setCenter(ambulance);
        mapRef.current.setZoom(15);
      }
    }
  }, [ambulance, pickup, selected?.pickup]);

  const assignedAmb = useMemo(() => {
    const ambId = live?.ambulanceId || (selected as any)?.ambulanceId;
    return ambulances.find((a) => a.id === ambId);
  }, [live, selected, ambulances]);

  const assignedDriver = useMemo(() => {
    const driverId = live?.driverId || (selected as any)?.driverId;
    return drivers.find((d) => d.id === driverId);
  }, [live, selected, drivers]);

  const driver = useMemo<{ name: string | null; phone: string | null; rating: number | null; ambulance: string | null }>(() => {
    const d = live;
    const vehicleName = assignedAmb
      ? `${assignedAmb.number} (${assignedAmb.type})`
      : typeof d?.ambulance_code === 'string' && d.ambulance_code
      ? d.ambulance_code
      : null;

    const name = assignedDriver?.name ?? (typeof d?.driver_name === 'string' && d.driver_name ? d.driver_name : null);
    const phone = assignedDriver?.phone ?? (typeof d?.driver_phone === 'string' && d.driver_phone ? d.driver_phone : null);
    const rating = typeof d?.driver_rating === 'number' ? d.driver_rating : null;
    return { name, phone, rating, ambulance: vehicleName };
  }, [live, assignedAmb, assignedDriver]);
  const eta = Math.max(1, Math.round((100 - progress) * 0.12));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      <button onClick={() => navigate('/dashboard')} className="btn-ghost mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>
      <PageHeader title="Track Ambulance" subtitle="Real-time tracking of your ambulance" icon={<Navigation className="w-5 h-5" />} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          {trackable.map((b) => (
            <button key={b.id} onClick={() => setSelectedId(b.id)} className={`w-full text-left card p-4 transition-all ${selectedId === b.id ? 'border-2 border-brand-500' : 'hover:border-brand-200'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 shrink-0"><Ambulance className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900">{b.bookingCode}</p>
                  <p className="text-xs text-gray-500 truncate">{b.pickup} → {b.destination}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selected && (
            <div className="card p-6">
              {/* Google Map: pickup point + live ambulance location. */}
              <div className="rounded-xl h-64 mb-5 relative overflow-hidden bg-gray-100">
                <div ref={mapDivRef} className="absolute inset-0" />
                {mapError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50 p-4">
                    <div className="text-center max-w-xs">
                      <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-gray-600">Map unavailable</p>
                      <p className="text-xs text-gray-400 mt-1">{mapError}</p>
                    </div>
                  </div>
                )}
                {!mapError && !pickup && !ambulance && (
                  <div className="absolute inset-x-0 bottom-0 bg-white/90 px-3 py-2 text-xs text-gray-500 border-t border-gray-200">
                    Waiting for location data — pickup coordinates are captured when booking via the map picker, and the ambulance position updates live.
                  </div>
                )}
                {ambulance && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 shadow-sm text-xs font-semibold text-gray-700">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live location
                  </div>
                )}
                {distanceKm !== null && (
                  <div className="absolute top-3 right-3 bg-brand-500 text-white rounded-lg px-3 py-1.5 shadow text-xs font-bold">
                    {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} from pickup
                  </div>
                )}
              </div>

              {selected.status === 'On Going' && (
                <div className="flex items-center justify-between bg-brand-50 rounded-xl p-4 mb-5">
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-brand-600" />
                    <div><p className="text-xs text-gray-500">Estimated Arrival</p><p className="font-bold text-brand-600 text-lg">{eta} min</p></div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Progress</p>
                    <p className="font-bold text-gray-900">{distanceKm !== null ? (distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m away` : `${distanceKm.toFixed(1)} km away`) : `${progress}%`}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold">{driver.name ? driver.name.charAt(0) : <Ambulance className="w-6 h-6" />}</div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{driver.name ?? 'Driver to be assigned'}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-500">{driver.rating != null ? (<><Star className="w-3 h-3 text-amber-400 fill-current" /> {driver.rating}{driver.ambulance ? ` - ${driver.ambulance}` : ''}</>) : (driver.ambulance ?? 'Awaiting assignment')}</div>
                </div>
                {driver.phone ? (<a href={`tel:${driver.phone.replace(/\s/g,'')}`} className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white hover:bg-brand-600 transition-colors"><Phone className="w-5 h-5" /></a>) : (<div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400"><Phone className="w-5 h-5" /></div>)}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-gray-50"><p className="text-xs text-gray-500">Booking ID</p><p className="font-semibold text-gray-900">{selected.bookingCode}</p></div>
                <div className="p-3 rounded-lg bg-gray-50"><p className="text-xs text-gray-500">Ambulance Type</p><p className="font-semibold text-gray-900">{selected.ambulanceType}</p></div>
              </div>

              {selected.status === 'On Going' && progress >= 90 && (
                <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2 text-green-700 text-sm font-medium">
                  <CheckCircle2 className="w-5 h-5" /> Ambulance is arriving at your location!
                </div>
              )}

              {reachError && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{reachError}</span>
                </div>
              )}

              {currentStatus === 'allocated' && (
                <div className="mt-5 p-4 rounded-xl bg-teal-50 border border-teal-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-teal-900 text-sm">Ambulance Allocated & In Transit</p>
                    <p className="text-xs text-teal-700 mt-0.5">
                      Once the patient has reached the destination, click below to mark the trip as reached.
                    </p>
                  </div>
                  <button
                    onClick={handleMarkReached}
                    disabled={reaching}
                    className="btn-primary text-xs py-2.5 px-4 bg-teal-600 hover:bg-teal-700 border-teal-600 text-white inline-flex items-center gap-1.5 shrink-0 shadow-sm"
                  >
                    {reaching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Updating…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark as Reached
                      </>
                    )}
                  </button>
                </div>
              )}

              {currentStatus === 'completed' && (
                <div className="mt-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-emerald-900">Trip Completed</p>
                    <p className="text-emerald-700">Ambulance has reached the destination. Thank you for using LifeCare.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



