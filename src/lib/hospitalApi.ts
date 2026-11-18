import type { Hospital } from '@/lib/types';

/**
 * Raw hospital item schema returned by the third-party Hospitals API.
 * Supports the WIB India Hospitals Dataset format as well as generic REST payloads.
 */
export interface RawHospitalItem {
  id?: string | number;
  name?: string;
  city?: string;
  type?: string;
  beds?: number | string;
  rating?: number | string;
  specialties?: string[];
  speciality?: string | string[];
  specialities?: string[];
  nabh?: boolean;
  address?: string;
  area?: string;
  phone?: string;
  emergency?: boolean;
  lat?: number | string;
  lng?: number | string;
  latitude?: number | string;
  longitude?: number | string;
  [key: string]: unknown;
}

export interface RawHospitalApiResponse {
  name?: string;
  version?: string;
  license?: string;
  source?: string;
  count?: number;
  data?: RawHospitalItem[];
  hospitals?: RawHospitalItem[];
  [key: string]: unknown;
}

export interface FetchHospitalsOptions {
  /** If true, bypasses in-memory and sessionStorage cache */
  forceRefresh?: boolean;
  /** Request timeout in milliseconds (defaults to 10000ms) */
  timeoutMs?: number;
}

export const DEFAULT_HOSPITALS_API_URL = 'https://wibest.in/data/json/hospitals.json';
const CACHE_KEY = 'lifecare_hospitals_cache_v1';
const DEFAULT_TIMEOUT_MS = 10000;

// In-memory cache for fast repeated access during a single session
let inMemoryCache: Hospital[] | null = null;

/**
 * Known approximate coordinates for major cities in the dataset.
 * Used as a fallback when the third-party API does not supply lat/lng.
 */
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  delhi: { lat: 28.6139, lng: 77.209 },
  'new delhi': { lat: 28.6139, lng: 77.209 },
  gurugram: { lat: 28.4595, lng: 77.0266 },
  gurgaon: { lat: 28.4595, lng: 77.0266 },
  faridabad: { lat: 28.4089, lng: 77.3178 },
  noida: { lat: 28.5355, lng: 77.391 },
  'greater noida': { lat: 28.4744, lng: 77.504 },
  ghaziabad: { lat: 28.6692, lng: 77.4538 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  'navi mumbai': { lat: 19.033, lng: 73.0297 },
  thane: { lat: 19.2183, lng: 72.9781 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  pune: { lat: 18.5204, lng: 73.8567 },
  'pimpri-chinchwad': { lat: 18.6279, lng: 73.8009 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  coimbatore: { lat: 11.0168, lng: 76.9558 },
  indore: { lat: 22.7196, lng: 75.8577 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  kochi: { lat: 9.9312, lng: 76.2673 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  visakhapatnam: { lat: 17.6868, lng: 83.2185 },
  bhopal: { lat: 23.2599, lng: 77.4126 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
  mysore: { lat: 12.2958, lng: 76.6394 },
  vadodara: { lat: 22.3072, lng: 73.1812 },
  patna: { lat: 25.5941, lng: 85.1376 },
  surat: { lat: 21.1702, lng: 72.8311 },
  mangalore: { lat: 12.9141, lng: 74.856 },
  trichy: { lat: 10.7905, lng: 78.7047 },
  madurai: { lat: 9.9252, lng: 78.1198 },
  vellore: { lat: 12.9165, lng: 79.1325 },
  ranchi: { lat: 23.3441, lng: 85.3096 },
  dehradun: { lat: 30.3165, lng: 78.0322 },
  raipur: { lat: 21.2514, lng: 81.6296 },
};

/**
 * Returns the configured Hospitals API URL from environment variables,
 * or defaults to the WIB India Hospitals Dataset.
 */
export function getHospitalApiUrl(): string {
  const envUrl = import.meta.env.VITE_HOSPITALS_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim();
  }
  return DEFAULT_HOSPITALS_API_URL;
}

/**
 * Extracts a likely area or neighborhood from an address line.
 */
function extractArea(address: string, city: string): string {
  if (!address) return city || 'Central';
  // Common pattern: "Sector 18A, Dwarka, New Delhi 110075" -> "Dwarka" or "Sector 18A"
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    // Return second to last or first depending on city presence
    const candidate = parts[parts.length - 2];
    if (candidate && !/\d{6}/.test(candidate)) {
      return candidate;
    }
    return parts[0];
  }
  return parts[0] || city || 'Central';
}

/**
 * Maps a single raw API hospital item into the strongly-typed `Hospital` model.
 */
export function mapRawHospital(raw: RawHospitalItem, index: number): Hospital {
  const name = String(raw.name ?? 'Unnamed Hospital').trim();
  const city = String(raw.city ?? 'Delhi').trim();
  const area = String(raw.area ?? extractArea(String(raw.address ?? ''), city)).trim();
  const address = String(raw.address ?? `${name}, ${city}`).trim();

  // Parse beds
  const rawBeds = typeof raw.beds === 'number' ? raw.beds : parseInt(String(raw.beds ?? 0), 10);
  const beds = Number.isFinite(rawBeds) && rawBeds >= 0 ? rawBeds : 0;

  // Emergency: true if NABH accredited or explicit emergency flag
  const emergency = Boolean(raw.emergency ?? raw.nabh ?? false);

  // Phone: keep existing or provide standard helpline
  const phone = raw.phone && String(raw.phone).trim().length > 0
    ? String(raw.phone).trim()
    : '+91 1800 123 4567';

  // Type: Private, Government, Trust, etc.
  const type = String(raw.type ?? 'General').trim();

  // Rating
  const rawRating = typeof raw.rating === 'number' ? raw.rating : parseFloat(String(raw.rating ?? ''));
  const rating = Number.isFinite(rawRating) ? rawRating : undefined;

  // Specialties
  let specialties: string[] = [];
  if (Array.isArray(raw.specialties)) {
    specialties = raw.specialties.map(String).map((s) => s.trim()).filter(Boolean);
  } else if (Array.isArray(raw.specialities)) {
    specialties = raw.specialities.map(String).map((s) => s.trim()).filter(Boolean);
  } else if (typeof raw.speciality === 'string' && raw.speciality.trim().length > 0) {
    specialties = [raw.speciality.trim()];
  } else if (Array.isArray(raw.speciality)) {
    specialties = raw.speciality.map(String).map((s) => s.trim()).filter(Boolean);
  }

  // Lat / Lng resolution:
  const rawLat = Number(raw.lat ?? raw.latitude);
  const rawLng = Number(raw.lng ?? raw.longitude);
  let lat: number;
  let lng: number;

  if (Number.isFinite(rawLat) && Number.isFinite(rawLng) && rawLat !== 0 && rawLng !== 0) {
    lat = rawLat;
    lng = rawLng;
  } else {
    // City fallback + deterministic offset so markers don't overlap completely
    const cityKey = city.toLowerCase();
    const baseCoords = CITY_COORDINATES[cityKey] ?? CITY_COORDINATES['delhi'];
    // Jitter by ~0.01-0.03 degrees (~1-3 km) based on index
    const angle = (index * 137.5 * Math.PI) / 180; // golden ratio angle
    const radius = 0.01 + ((index % 10) * 0.002);
    lat = Number((baseCoords.lat + Math.cos(angle) * radius).toFixed(6));
    lng = Number((baseCoords.lng + Math.sin(angle) * radius).toFixed(6));
  }

  // ID: clean slug + index
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = raw.id ? String(raw.id) : `${slug || 'h'}-${index}`;

  return {
    id,
    name,
    area,
    city,
    address,
    beds,
    phone,
    emergency,
    lat,
    lng,
    type,
    specialties: specialties.length > 0 ? specialties : undefined,
    rating,
  };
}

/**
 * Fetches hospitals directly from the API endpoint with timeout, CORS handling,
 * and error propagation.
 */
export async function fetchHospitalsApi(options: FetchHospitalsOptions = {}): Promise<Hospital[]> {
  const url = getHospitalApiUrl();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API responded with HTTP ${response.status} (${response.statusText || 'Error'})`);
    }

    const payload = (await response.json()) as RawHospitalApiResponse | RawHospitalItem[];

    let rawList: RawHospitalItem[] = [];
    if (Array.isArray(payload)) {
      rawList = payload;
    } else if (payload && Array.isArray(payload.data)) {
      rawList = payload.data;
    } else if (payload && Array.isArray(payload.hospitals)) {
      rawList = payload.hospitals;
    } else {
      throw new Error('API response did not contain a valid hospital array');
    }

    const hospitals = rawList.map((item, index) => mapRawHospital(item, index));

    // Cache the fresh result
    inMemoryCache = hospitals;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(hospitals));
      }
    } catch {
      // Ignore sessionStorage quota or privacy mode errors
    }

    return hospitals;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Hospital API request timed out after ${timeoutMs / 1000}s. Please check your network connection.`);
    }

    if (err instanceof TypeError) {
      // TypeError is typical for CORS blocking or offline network failure
      throw new Error(
        'Unable to reach the Hospitals API. This may be caused by network unavailability or CORS restrictions. Please try again.'
      );
    }

    if (err instanceof Error) {
      throw err;
    }

    throw new Error('An unknown error occurred while fetching hospital data.');
  }
}

/**
 * Primary function to retrieve hospitals.
 * Checks in-memory cache -> sessionStorage cache -> network fetch.
 * Pass `{ forceRefresh: true }` to bypass cache.
 */
export async function getHospitals(options: FetchHospitalsOptions = {}): Promise<Hospital[]> {
  if (!options.forceRefresh) {
    // 1. Check in-memory cache
    if (inMemoryCache && inMemoryCache.length > 0) {
      return inMemoryCache;
    }

    // 2. Check sessionStorage
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const cachedRaw = window.sessionStorage.getItem(CACHE_KEY);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw) as Hospital[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            inMemoryCache = parsed;
            return parsed;
          }
        }
      }
    } catch {
      // Cache read error; proceed to network
    }
  }

  // 3. Fetch from API
  return fetchHospitalsApi(options);
}

/**
 * Clears both in-memory and sessionStorage hospital caches.
 */
export function clearHospitalCache(): void {
  inMemoryCache = null;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(CACHE_KEY);
    }
  } catch {
    // ignore
  }
}
