/**
 * Loads the Google Maps JavaScript API (Places + Geocoding libraries) once and
 * resolves with the global `google.maps` namespace.
 *
 * The API key comes from VITE_GOOGLE_MAPS_API_KEY (public identifier — restrict
 * it to your domains in Google Cloud Console). No secrets are bundled here.
 */
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// The Maps JS API namespace (untyped — we intentionally avoid adding the
// @types/google.maps dependency for this small surface).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GoogleMaps = any;

let loadPromise: Promise<GoogleMaps> | null = null;

declare global {
  interface Window {
    google?: { maps?: GoogleMaps };
  }
}

export function loadGoogleMaps(): Promise<GoogleMaps> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (!apiKey) {
      reject(new Error('Google Maps is not configured (VITE_GOOGLE_MAPS_API_KEY missing).'));
      return;
    }
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }
    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      '&libraries=places';
    script.async = true;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load the Google Maps script.'));
    };
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else {
        loadPromise = null;
        reject(new Error('Google Maps loaded but the namespace is unavailable.'));
      }
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Geocodes an address string to `{ lat, lng }` coordinates using the Google Maps Geocoder.
 * Returns null if geocoding fails or no valid coordinates are found.
 */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  try {
    const maps = await loadGoogleMaps();
    const geocoder = new maps.Geocoder();
    const res = await geocoder.geocode({ address: trimmed });
    const loc = res?.results?.[0]?.geometry?.location;
    if (loc) {
      const lat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
      const lng = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
  } catch (err) {
    console.warn('[googleMaps] geocodeAddress failed for:', trimmed, err);
  }
  return null;
}


