/**
 * HospitalMapPicker â€” Google Maps destination selector for ambulance booking.
 *
 * Features:
 *  - Auto-detects and displays the user's current location (with permission).
 *  - Displays nearby hospitals as markers on the map (fetched from third-party Hospitals API).
 *  - Search hospitals by name and city.
 *  - Click a hospital marker or list item to select it as the destination.
 *  - Draws a driving route from pickup â†’ destination using Google Maps Routes API.
 *  - Shows actual road distance and estimated travel time.
 *  - Fully responsive for desktop and mobile.
 *
 * The Google Maps API key is read from VITE_GOOGLE_MAPS_API_KEY via
 * @/lib/googleMaps â€” never hardcoded in source.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MapPin, X, Check, Loader2, Crosshair, Navigation, ChevronRight, AlertTriangle, RotateCw,
} from 'lucide-react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { getHospitals } from '@/lib/hospitalApi';
import type { Hospital } from '@/lib/types';
import { haversineKm } from '@/lib/utils';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type AnyRef = any;

interface HospitalMapPickerProps {
  pickupCoords: { lat: number; lng: number } | null;
  onHospitalSelect: (hospital: Hospital, routeInfo?: RouteInfo) => void;
  onRouteInfo?: (info: RouteInfo | null) => void;
  selectedHospital: Hospital | null;
}

export interface RouteInfo {
  distanceKm: number;
  distanceText: string;
  durationText: string;
  durationSec: number;
  polyline: any[];
}

const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };

export default function HospitalMapPicker({
  pickupCoords,
  onHospitalSelect,
  onRouteInfo,
  selectedHospital,
}: HospitalMapPickerProps) {
  const [showMap, setShowMap] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  // Use refs instead of state for Maps API objects that don't need to trigger re-renders
  const pathRef = useRef<AnyRef | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapsRef = useRef<AnyRef>(null);
  const mapInstanceRef = useRef<AnyRef | null>(null);
  const userMarkerRef = useRef<AnyRef>(null);
  const hospitalMarkerRefs = useRef<Map<string, AnyRef>>(new Map());
  const infoWindowRef = useRef<AnyRef>(null);
  // Guard flag to prevent multiple concurrent map initializations
  const mapInitializingRef = useRef(false);
  // AbortController to cancel in-flight route requests and prevent racing calls
  const abortControllerRef = useRef<AbortController | null>(null);

  // Third-party API hospitals
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  const [hospitalsError, setHospitalsError] = useState<string | null>(null);

  const loadHospitals = useCallback(async (forceRefresh = false) => {
    setHospitalsLoading(true);
    setHospitalsError(null);
    try {
      const data = await getHospitals({ forceRefresh });
      setHospitals(data);
    } catch (err) {
      console.error('[HospitalMapPicker] Error fetching hospitals from API:', err);
      setHospitalsError(err instanceof Error ? err.message : 'Failed to load hospitals');
    } finally {
      setHospitalsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHospitals();
  }, [loadHospitals]);

  const filteredHospitals = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return hospitals;
    return hospitals.filter((h) => {
      return (
        h.name.toLowerCase().includes(q) ||
        h.city.toLowerCase().includes(q) ||
        h.area.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, hospitals]);

  // Decode polyline from Routes API encoded polyline format
  const decodePolyline = useCallback((encoded: string): AnyRef[] => {
    const polyline: AnyRef[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
        index++;
      } while (b >= 0x20);

      lat += (result >> 1) ^ -(result & 1);

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
        index++;
      } while (b >= 0x20);

      lng += (result >> 1) ^ -(result & 1);

      polyline.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }

    return polyline;
  }, []);

  // Parse Routes API v2 duration string (e.g. "120s", "5m30s", "1h15m30s") into seconds
  const parseDuration = useCallback((dur: string): number => {
    const match = dur.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!match) return 0;
    const hours = parseInt(match[1] ?? '0', 10);
    const minutes = parseInt(match[2] ?? '0', 10);
    const seconds = parseInt(match[3] ?? '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }, []);

  const formatDuration = useCallback((totalSeconds: number): string => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }, []);

  // Draw route using Google Maps Routes API v2
  const drawRoute = useCallback(
    async (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) => {
      if (!mapsRef.current) return;

      // Validate API key is configured
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setMapError('Google Maps API key is not configured.');
        setLoading(false);
        return;
      }

      // Validate coordinates with Number.isFinite (catches NaN, Infinity, undefined)
      const isValidCoord = (c: { lat: number; lng: number }) =>
        Number.isFinite(c.lat) &&
        Number.isFinite(c.lng) &&
        c.lat >= -90 &&
        c.lat <= 90 &&
        c.lng >= -180 &&
        c.lng <= 180;

      if (!isValidCoord(origin) || !isValidCoord(destination)) {
        setMapError('Invalid coordinates provided for route calculation.');
        setLoading(false);
        return;
      }

      // Cancel any in-flight route request to prevent racing calls
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setMapError(null);

      try {
        const response = await fetch(
          'https://routes.googleapis.com/directions/v2:computeRoutes',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              // Correct Routes API v2 field paths:
              // routes.polyline.encodedPolyline (not routes.encodedPolyline)
              'X-Goog-FieldMask':
                'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,' +
                'routes.legs.distanceMeters,routes.legs.duration',
            },
            body: JSON.stringify({
              origin: {
                location: {
                  latLng: {
                    latitude: origin.lat,
                    longitude: origin.lng,
                  },
                },
              },
              destination: {
                location: {
                  latLng: {
                    latitude: destination.lat,
                    longitude: destination.lng,
                  },
                },
              },
              travelMode: 'DRIVE',
            }),
            signal: abortControllerRef.current.signal,
            credentials: 'same-origin',
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          // Log the FULL error body so fieldViolations are visible
          console.error('Routes API error:', JSON.stringify(errorData, null, 2));
          const googleError =
            errorData?.error?.message ||
            errorData?.error?.details?.[0]?.description ||
            '';
          throw new Error(
            `Routes API request failed: ${response.status} ${response.statusText}${
              googleError ? ' - ' + googleError : ''
            }`
          );
        }

        const data = await response.json();
        const route = data.routes?.[0];

        if (!route) {
          setRouteInfo(null);
          setLoading(false);
          setMapError('No driving route found between pickup and this hospital.');
          if (pathRef.current) {
            pathRef.current.setMap(null);
            pathRef.current = null;
          }
          return;
        }

        // Routes API v2 response fields:
        // route.distanceMeters (string int64), route.duration (string like "120s")
        // route.polyline.encodedPolyline
        const distanceM = Number(route.distanceMeters ?? 0);
        const durationS = parseDuration(route.duration ?? '0s');
        const distanceKm = distanceM / 1000;

        // Decode polyline from Routes API response
        const encodedPolyline = route.polyline?.encodedPolyline;
        const decodedPath = encodedPolyline ? decodePolyline(encodedPolyline) : [];

        setRouteInfo({
          distanceKm,
          distanceText: distanceKm < 1 ? Math.round(distanceKm * 1000) + ' m' : distanceKm.toFixed(1) + ' km',
          durationText: formatDuration(durationS),
          durationSec: durationS,
          polyline: decodedPath,
        });

        // Render route as polyline on map
        if (pathRef.current) {
          pathRef.current.setMap(null);
        }
        if (decodedPath.length > 0) {
          pathRef.current = new mapsRef.current.Polyline({
            path: decodedPath,
            geodesic: true,
            strokeColor: '#1976d2',
            strokeWeight: 6,
            strokeOpacity: 0.8,
          });
          pathRef.current.setMap(mapInstanceRef.current);
        } else {
          pathRef.current = null;
        }
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') {
          // Request was cancelled by a newer call — not an error
          return;
        }
        console.error('Routes API error:', error);
        setMapError(
          error instanceof Error ? error.message : 'Failed to calculate driving route'
        );
        if (pathRef.current) {
          pathRef.current.setMap(null);
          pathRef.current = null;
        }
        setRouteInfo(null);
      } finally {
        setLoading(false);
      }
    },
    [decodePolyline, parseDuration, formatDuration]
  );

  const addHospitalMarker = useCallback(
    (h: Hospital) => {
      if (!mapInstanceRef.current || !mapsRef.current) return;

      // Clean up any existing marker for this hospital ID first
      if (hospitalMarkerRefs.current.has(h.id)) {
        const oldMarker = hospitalMarkerRefs.current.get(h.id);
        if (oldMarker) {
          try {
            oldMarker.setMap(null);
          } catch {
            // ignore cleanup errors
          }
        }
        hospitalMarkerRefs.current.delete(h.id);
      }

      const isSelected = selectedHospital?.id === h.id;
      let marker: AnyRef | null = null;
      try {
        marker = new mapsRef.current.Marker({
        position: { lat: h.lat, lng: h.lng },
        map: mapInstanceRef.current,
        title: h.name,
        icon: {
          url: `https://maps.google.com/mapfiles/ms/icons/${isSelected ? 'yellow' : 'red'}-dot.png`,
          scaledSize: new mapsRef.current.Size(36, 36),
        },
        zIndex: isSelected ? 997 : 996,
      });
      } catch (err) {
        console.error('Failed to create hospital marker:', err);
        return;
      }

      if (!marker) return;

      marker.addListener('click', () => {
        if (!mapInstanceRef.current) return;
        try {
          mapInstanceRef.current.setCenter({ lat: h.lat, lng: h.lng });
          mapInstanceRef.current.setZoom(16);
        } catch {
          // ignore map operation errors
        }
        if (pickupCoords) {
          drawRoute(pickupCoords, { lat: h.lat, lng: h.lng });
        }
        onHospitalSelect(h, routeInfo ?? undefined);
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(
          '<div style="font-family:Inter,sans-serif;font-size:13px;padding:6px 8px;">' +
            '<div style="font-weight:700;color:#E63946;">' + h.name + '</div>' +
            '<div style="font-size:12px;color:#666;">' + h.area + ', ' + h.city + '</div>' +
            '<div style="font-size:12px;color:#666;">' + h.address + '</div>' +
            '<div style="margin-top:6px;font-size:12px;color:#0EA5E9;font-weight:600;">Click to select as destination</div>' +
          '</div>'
        );
        }
        if (infoWindowRef.current && marker && mapInstanceRef.current) {
          try {
            infoWindowRef.current.open(mapInstanceRef.current, marker);
          } catch (openErr) {
            console.error('Failed to open infoWindow:', openErr);
          }
        }
      });

      hospitalMarkerRefs.current.set(h.id, marker);
    },
    [mapInstanceRef, selectedHospital, pickupCoords, onHospitalSelect, routeInfo, drawRoute]
  );

  const initMap = useCallback(async () => {
    // Prevent multiple concurrent initializations
    if (mapInitializingRef.current || mapInstanceRef.current) return;
    if (!mapRef.current) return;

    mapInitializingRef.current = true;
    setLoading(true);
    setMapError(null);

    try {
      const maps = await loadGoogleMaps();
      mapsRef.current = maps;
      const center = userLocation ?? pickupCoords ?? DEFAULT_CENTER;

      // Remove any existing map instance to prevent duplicates
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.setMap(null);
        } catch {
          // ignore cleanup errors
        }
      }

      mapInstanceRef.current = new maps.Map(mapRef.current, {
        center,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
      });

      infoWindowRef.current = new maps.InfoWindow();

      if (userLocation) {
        userMarkerRef.current = new maps.Marker({
          position: userLocation,
          map: mapInstanceRef.current,
          title: 'Your location',
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            scaledSize: new maps.Size(32, 32),
          },
          zIndex: 999,
        });
        new maps.Circle({
          center: userLocation,
          radius: 200,
          fillColor: '#0EA5E9',
          fillOpacity: 0.15,
          strokeColor: '#0EA5E9',
          strokeOpacity: 0.6,
          strokeWeight: 1,
          map: mapInstanceRef.current,
        });
      }

      // Add hospital markers (only once, not on dependency changes)
      if (filteredHospitals.length > 0) {
        hospitalMarkerRefs.current.forEach((m) => {
          try { if (m) m.setMap(null); } catch { /* ignore */ }
        });
        hospitalMarkerRefs.current.clear();
        filteredHospitals.forEach((h) => addHospitalMarker(h));
      }

      if (pickupCoords) {
        if (userMarkerRef.current) {
          try {
            userMarkerRef.current.setMap(null);
          } catch {
            // ignore cleanup errors
          }
        }
        userMarkerRef.current = new maps.Marker({
          position: pickupCoords,
          map: mapInstanceRef.current,
          title: 'Pickup',
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
            scaledSize: new maps.Size(32, 32),
          },
          zIndex: 998,
        });
      }

      if (selectedHospital && pickupCoords) {
        drawRoute(pickupCoords, { lat: selectedHospital.lat, lng: selectedHospital.lng });
      }

      setLoading(false);
    } catch (err) {
      setLoading(false);
      setMapError(err instanceof Error ? err.message : 'Could not load the map.');
    } finally {
      mapInitializingRef.current = false;
    }
  }, [userLocation, pickupCoords, selectedHospital, addHospitalMarker, drawRoute]);

  // Track selected hospital ID to prevent re-renders
  const selectedHospitalIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentId = selectedHospital?.id ?? null;
    selectedHospitalIdRef.current = currentId;

    if (pickupCoords && selectedHospital) {
      drawRoute(pickupCoords, { lat: selectedHospital.lat, lng: selectedHospital.lng });
    } else {
      if (pathRef.current) {
        pathRef.current.setMap(null);
        pathRef.current = null;
      }
      setRouteInfo(null);
    }
  }, [pickupCoords, selectedHospital?.id, drawRoute]);

  // Propagate route info (distance/ETA) to the parent whenever it changes so the
  // booking document can persist it. A ref avoids refiring when the parent's
  // callback identity changes between renders.
  const onRouteInfoRef = useRef(onRouteInfo);
  useEffect(() => { onRouteInfoRef.current = onRouteInfo; }, [onRouteInfo]);
  useEffect(() => { onRouteInfoRef.current?.(routeInfo ?? null); }, [routeInfo]);

  useEffect(() => {
    if (!mapInstanceRef.current || !mapsRef.current) return;
    hospitalMarkerRefs.current.forEach((m) => { if (m) m.setMap(null); });
    hospitalMarkerRefs.current.clear();
    filteredHospitals.forEach((h) => addHospitalMarker(h));
  }, [filteredHospitals, addHospitalMarker]);

  useEffect(() => {
    if (!showMap) return;
    initMap();
  }, [showMap]);

  // Clean up map resources when map closes (showMap becomes false)
  useEffect(() => {
    if (showMap) return;
    // Dispose map instance so it can be recreated when showMap becomes true again
    hospitalMarkerRefs.current.forEach((m) => {
      try {
        if (m) m.setMap(null);
      } catch {
        // ignore cleanup errors
      }
    });
    hospitalMarkerRefs.current.clear();

    if (userMarkerRef.current) {
      try {
        userMarkerRef.current.setMap(null);
      } catch {
        // ignore cleanup errors
      }
      userMarkerRef.current = null;
    }

    // Remove route polyline
    if (pathRef.current) {
      try {
        pathRef.current.setMap(null);
      } catch {
        // ignore cleanup errors
      }
      pathRef.current = null;
    }

    // Clear map instance reference so the map can be recreated when showMap is toggled again.
    // (The previous code only nulled a `.map` property, leaving the ref truthy and blocking
    // re-initialization - which is why the destination hospital map appeared blank on re-open.)
    if (mapInstanceRef.current !== null) {
      try {
        mapInstanceRef.current = null;
      } catch {
        // ignore cleanup errors
      }
    }

    mapInitializingRef.current = false;
    setRouteInfo(null);
  }, [showMap]);

  // Clean up map resources when map closes or component unmounts
  useEffect(() => {
    return () => {
      // Clear all hospital markers
      hospitalMarkerRefs.current.forEach((m) => {
        try {
          if (m) m.setMap(null);
        } catch {
          // ignore cleanup errors
        }
      });
      hospitalMarkerRefs.current.clear();

      // Remove user location marker
      if (userMarkerRef.current) {
        try {
          userMarkerRef.current.setMap(null);
        } catch {
          // ignore cleanup errors
        }
        userMarkerRef.current = null;
      }

      // Remove route polyline
      if (pathRef.current) {
        try {
          pathRef.current.setMap(null);
        } catch {
          // ignore cleanup errors
        }
        pathRef.current = null;
      }

      // Dispose the map instance so it can be recreated on demand.
      if (mapInstanceRef.current !== null) {
        try {
          mapInstanceRef.current = null;
        } catch {
          // ignore cleanup errors
        }
      }

      // Reset initializing flag
      mapInitializingRef.current = false;
    };
  }, []);

  const detectCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setMapError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setMapError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        initMap();
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setMapError('Location access denied. You can still search hospitals manually.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setMapError('Location information is unavailable.');
        } else if (err.code === err.TIMEOUT) {
          setMapError('Location request timed out.');
        } else {
          setMapError('Unable to detect your location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [initMap]);

  const selectHospital = useCallback(
    (h: Hospital) => {
      setMapError(null);
      if (pickupCoords) {
        drawRoute(pickupCoords, { lat: h.lat, lng: h.lng });
      }
      onHospitalSelect(h, routeInfo ?? undefined);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter({ lat: h.lat, lng: h.lng });
        mapInstanceRef.current.setZoom(16);
      }
    },
    [pickupCoords, drawRoute, onHospitalSelect, routeInfo]
  );

  /* ---- Render ---- */

  return (
    <div className="space-y-4">
      {mapError && (
        <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-start gap-2 animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Route error: </span>
            <span>{mapError}</span>
          </div>
          <button
            type="button"
            onClick={() => setMapError(null)}
            className="text-red-500 hover:text-red-700 p-0.5"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between bg-brand-50 rounded-xl p-4 border border-brand-100">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-brand-600 shrink-0" />
          <div>
            <h4 className="font-bold text-gray-900 text-sm">Select Destination Hospital</h4>
            <p className="text-xs text-gray-500">Choose a hospital on the map or search below.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowMap(!showMap)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-colors hover:bg-brand-100 text-brand-600"
        >
          {showMap ? (<> <X className="w-4 h-4" /> Hide Map </>) : (<> <MapPin className="w-4 h-4" /> Show Map </>)}
        </button>
      </div>

      {!showMap && (
        <button
          type="button"
          onClick={detectCurrentLocation}
          disabled={locating}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          {locating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="hidden sm:inline">Detecting locationâ€¦</span>
            </>
          ) : (
            <>
              <Crosshair className="w-4 h-4" />
              <span className="hidden sm:inline">Use My Current Location</span>
            </>
          )}
        </button>
      )}

      {showMap && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search hospital by name or cityâ€¦"
                className="flex-1 input-field text-sm py-2"
              />
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                disabled={!searchQuery}
                className="px-3 py-2 rounded-lg text-gray-500 hover:text-brand-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative aspect-[4/3] w-full rounded-xl border border-gray-200 overflow-hidden bg-gray-100">
            <div ref={mapRef} className="w-full h-full" />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-10">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
              </div>
            )}
            {locating && userLocation && (
              <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 shadow-sm text-xs font-semibold text-gray-700">
                <Crosshair className="w-3 h-3 text-brand-600 shrink-0" />
                <span>Your location</span>
              </div>
            )}
          </div>

          {mapError && (
            <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <X className="w-3 h-3" /> {mapError}
            </p>
          )}

          {routeInfo && pickupCoords && selectedHospital && (
            <div className="bg-brand-50 rounded-xl p-4 border border-brand-100 shadow-sm">
              <div className="flex items-start gap-3 mb-3">
                <Navigation className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h5 className="font-bold text-gray-900 text-sm">Route to {selectedHospital.name}</h5>
                  <p className="text-xs text-gray-500">{selectedHospital.area}, {selectedHospital.city}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-white border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Distance</p>
                  <p className="font-bold text-gray-900">{routeInfo.distanceText}</p>
                </div>
                <div className="p-3 rounded-lg bg-white border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">ETA (driving)</p>
                  <p className="font-bold text-gray-900">{routeInfo.durationText}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => selectHospital(selectedHospital)}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg font-semibold text-sm hover:bg-brand-700 transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Select {selectedHospital.name}</span>
              </button>
            </div>
          )}

          {selectedHospital && !pickupCoords && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Set a precise pickup location (use &quot;My Location&quot; or the map pin) to calculate the route, distance and ETA.
              </p>
            </div>
          )}

          {selectedHospital && pickupCoords && mapError && (
            <div className="bg-red-50 rounded-xl p-4 border border-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 flex-1">
                <span className="font-semibold">Unable to calculate route:</span> {mapError}
              </div>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto border-t border-gray-100 bg-white rounded-b-xl">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {hospitalsLoading
                  ? 'Loading hospitals...'
                  : `${filteredHospitals.length} hospital${filteredHospitals.length !== 1 ? 's' : ''} found`}
              </span>
              {hospitalsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />}
            </div>

            {hospitalsLoading && (
              <div className="p-6 text-center text-xs text-gray-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
                <span>Loading hospitals from directory...</span>
              </div>
            )}

            {hospitalsError && !hospitalsLoading && (
              <div className="p-4 bg-red-50 text-red-700 text-xs flex items-center justify-between border-b border-red-100">
                <span>{hospitalsError}</span>
                <button
                  type="button"
                  onClick={() => loadHospitals(true)}
                  className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 shrink-0 ml-2"
                >
                  <RotateCw className="w-3 h-3" /> Retry
                </button>
              </div>
            )}

            {!hospitalsLoading &&
              filteredHospitals.map((h) => {
                const isSelected = selectedHospital?.id === h.id;
                const dist = pickupCoords ? haversineKm(pickupCoords.lat, pickupCoords.lng, h.lat, h.lng) : null;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => selectHospital(h)}
                    className={`w-full flex items-center justify-between px-3 py-3 text-left transition-colors border-b border-gray-50 last:border-0 ${
                      isSelected
                        ? 'bg-brand-50 border-l-4 border-brand-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${isSelected ? 'text-brand-600' : 'text-gray-900'}`}>
                          {h.name}
                        </span>
                        {h.emergency && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                            Emergency
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {h.area}, {h.city}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{h.address}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {dist != null && (
                        <span className="text-xs font-semibold text-gray-700">
                          {dist < 1 ? Math.round(dist * 1000) + ' m' : dist.toFixed(1) + ' km'}
                        </span>
                      )}
                      <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                    </div>
                  </button>
                );
              })}
            {!hospitalsLoading && !hospitalsError && filteredHospitals.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                No hospitals match your search.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


