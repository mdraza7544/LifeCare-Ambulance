import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Crosshair, Search, X, Check, Loader2 } from 'lucide-react';
import { loadGoogleMaps, geocodeAddress } from '@/lib/googleMaps';

interface LocationPickerProps {
  value: string;
  onChange: (address: string, coords?: { lat: number; lng: number }) => void;
  label?: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

interface SearchResult {
  display_name: string;
  lat: number;
  lng: number;
}

const DEFAULT_CENTER: Coordinates = { lat: 12.9716, lng: 77.5946 }; // Bengaluru

export default function LocationPicker({ value, onChange, label = 'Pickup Location' }: LocationPickerProps) {
  const [showMap, setShowMap] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [marker, setMarker] = useState<Coordinates | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const mapInstanceRef = useRef<any>(null);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const markerRef = useRef<any>(null);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const geocoderRef = useRef<any>(null);

  /* Map click/drag events from the Maps JS API. */
  interface MapsEvent {
    latLng?: { lat(): number; lng(): number };
  }

  /* Reverse geocode coordinates into an address via the Google Geocoding API. */
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const maps = await loadGoogleMaps();
      if (!geocoderRef.current) geocoderRef.current = new maps.Geocoder();
      const res = await geocoderRef.current.geocode({ location: { lat, lng } });
      const first = res?.results?.[0];
      return first?.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }, []);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setMarker({ lat, lng });
    if (markerRef.current) markerRef.current.setPosition({ lat, lng });
    const address = await reverseGeocode(lat, lng);
    onChange(address, { lat, lng });
  }, [onChange, reverseGeocode]);

  const initMap = useCallback(async (center: Coordinates) => {
    try {
      const maps = await loadGoogleMaps();
      if (!mapRef.current) return;
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new maps.Map(mapRef.current, {
          center,
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapInstanceRef.current.addListener('click', (e: MapsEvent) => {
          if (e.latLng) handleMapClick(e.latLng.lat(), e.latLng.lng());
        });
      } else {
        mapInstanceRef.current.setCenter(center);
      }
      if (!markerRef.current) {
        markerRef.current = new maps.Marker({
          position: center,
          map: mapInstanceRef.current,
          draggable: true,
        });
        markerRef.current.addListener('dragend', (e: MapsEvent) => {
          handleMapClick(e.latLng!.lat(), e.latLng!.lng());
        });
      } else {
        markerRef.current.setMap(mapInstanceRef.current);
        markerRef.current.setPosition(center);
      }
      setMapError(null);
    } catch (err) {
      setMapError(err instanceof Error ? err.message : 'Could not load Google Maps.');
    }
  }, [handleMapClick]);

  const useMyLocation = () => {
    setMapError(null);
    if (!navigator.geolocation) {
      setMapError('Geolocation is not supported by your browser.');
      return;
    }
    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLoadingLocation(false);
        setShowMap(true);
        const coords = { lat: latitude, lng: longitude };
        await initMap(coords);
        const address = await reverseGeocode(latitude, longitude);
        setMarker(coords);
        onChange(address, coords);
      },
      (err) => {
        setLoadingLocation(false);
        setMapError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Please allow location access or select manually.'
            : 'Could not fetch your location. Please try again or select on map.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const openMap = () => {
    setShowMap(true);
    setMapError(null);
    setTimeout(() => {
      initMap(marker ?? DEFAULT_CENTER);
    }, 100);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const maps = await loadGoogleMaps();
      if (!geocoderRef.current) geocoderRef.current = new maps.Geocoder();
      const res = await geocoderRef.current.geocode({ address: searchQuery });
      const results: SearchResult[] = (res?.results ?? []).slice(0, 5).map((r: { formatted_address: string; geometry: { location: { lat(): number; lng(): number } } }) => ({
        display_name: r.formatted_address,
        lat: r.geometry.location.lat(),
        lng: r.geometry.location.lng(),
      }));
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  const selectSearchResult = (result: SearchResult) => {
    onChange(result.display_name, { lat: result.lat, lng: result.lng });
    setSearchQuery('');
    setSearchResults([]);
    setMarker({ lat: result.lat, lng: result.lng });
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat: result.lat, lng: result.lng });
      mapInstanceRef.current.setZoom(16);
      if (markerRef.current) markerRef.current.setPosition({ lat: result.lat, lng: result.lng });
    }
  };

  useEffect(() => {
    return () => {
      if (markerRef.current) markerRef.current.setMap(null);
      if (mapInstanceRef.current) {
        window.google?.maps?.event?.clearInstanceListeners?.(mapInstanceRef.current);
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  return (
    <div>
      <label className="text-sm font-semibold text-gray-700 mb-1.5 block flex items-center gap-1.5">
        <MapPin className="w-4 h-4 text-brand-500" /> {label}
      </label>

      <div className="flex gap-2">
        <input
          type="text"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (value && value.trim().length > 3) {
              geocodeAddress(value).then((coords) => {
                if (coords) onChange(value, coords);
              });
            }
          }}
          className="input-field"
          placeholder="Enter address or use map"
        />
        <button
          type="button"
          onClick={openMap}
          className="shrink-0 px-3 py-2.5 bg-brand-50 text-brand-600 font-semibold rounded-lg border border-brand-200 hover:bg-brand-100 transition-colors flex items-center gap-1.5 text-sm"
        >
          <MapPin className="w-4 h-4" /> Map
        </button>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={loadingLocation}
          className="shrink-0 px-3 py-2.5 bg-blue-50 text-blue-600 font-semibold rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1.5 text-sm disabled:opacity-50"
        >
          {loadingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
          <span className="hidden sm:inline">My Location</span>
        </button>
      </div>

      {mapError && (
        <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
          <X className="w-3 h-3" /> {mapError}
        </p>
      )}

      {showMap && (
        <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden animate-fade-in">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-brand-500" /> Select on Map
              </h4>
              <button
                type="button"
                onClick={() => setShowMap(false)}
                className="p-1 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                className="input-field text-sm py-2"
                placeholder="Search for a place..."
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching}
                className="shrink-0 px-3 py-2 bg-brand-500 text-white font-semibold rounded-lg hover:bg-brand-600 transition-colors text-sm flex items-center gap-1"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 bg-white rounded-lg border border-gray-200 max-h-40 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectSearchResult(r)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-brand-50 transition-colors border-b border-gray-100 last:border-0"
                  >
                    <span className="text-gray-700">{r.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div ref={mapRef} className="w-full h-72 bg-gray-100" />

          {value && (
            <div className="bg-brand-50 px-4 py-2.5 border-t border-brand-100 flex items-start gap-2">
              <Check className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-700 font-medium">
                {value}
                {marker && (
                  <span className="text-gray-400 font-normal">
                    {' '}({marker.lat.toFixed(5)}, {marker.lng.toFixed(5)})
                  </span>
                )}
              </p>
            </div>
          )}
          <p className="text-xs text-gray-400 px-4 py-2 bg-gray-50">
            Click anywhere on the map to set the location.
          </p>
        </div>
      )}
    </div>
  );
}
