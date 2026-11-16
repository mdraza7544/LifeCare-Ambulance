import { useState, useEffect, useMemo, useRef } from 'react';
import { Navigation, MapPin, Clock, Phone, Ambulance, Star, ArrowLeft, CheckCircle2 } from 'lucide-react';
import type { DocumentData } from 'firebase/firestore';
import { useApp } from '@/lib/context';
import { PageHeader } from '@/components/UI';
import StatusBadge from '@/components/StatusBadge';
import { watchBooking } from '@/lib/db';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { haversineKm } from '@/lib/utils';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type AnyRef = any;

export default function TrackAmbulancePage() {
  const { bookings, navigate } = useApp();
  const trackable = bookings.filter((b) => b.status === 'On Going' || b.status === 'Scheduled');
  const [selectedId, setSelectedId] = useState<string | null>(trackable[0]?.id || null);
  const [progress, setProgress] = useState(15);
  /* Live ambulance location fields from the Firestore booking doc
     (`ambulance_lat` / `ambulance_lng` — updated by dispatch/admin). */
  const [live, setLive] = useState<DocumentData | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const selected = bookings.find((b) => b.id === selectedId);

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

  const driver = useMemo<{ name: string | null; phone: string | null; rating: number | null; ambulance: string | null }>(() => {
    const d = live;
    if (!d) return { name: null, phone: null, rating: null, ambulance: null };
    const name = typeof d.driver_name === 'string' && d.driver_name ? d.driver_name : null;
    const phone = typeof d.driver_phone === 'string' && d.driver_phone ? d.driver_phone : null;
    const rating = typeof d.driver_rating === 'number' ? d.driver_rating : null;
    const ambulance = typeof d.ambulance_code === 'string' && d.ambulance_code ? d.ambulance_code : null;
    return { name, phone, rating, ambulance };
  }, [live]);
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



