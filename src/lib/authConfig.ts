import type { ActionCodeSettings } from 'firebase/auth';

/**
 * Returns the base URL of the web application for email action links.
 * Reads from VITE_APP_URL, falling back to window.location.origin.
 */
export function getAppUrl(): string {
  const envUrl = import.meta.env.VITE_APP_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:5173';
}

/**
 * Standard ActionCodeSettings for Firebase Auth client emails.
 * handleCodeInApp: false ensures standard web email link behavior.
 */
export function getActionCodeSettings(continuePath: string = '/dashboard'): ActionCodeSettings {
  const appUrl = getAppUrl();
  const cleanHash = continuePath.startsWith('/') ? continuePath : `/${continuePath}`;
  return {
    url: `${appUrl}/#${cleanHash}`,
    handleCodeInApp: false,
  };
}

export interface AuthActionParams {
  mode: string | null;
  oobCode: string | null;
  apiKey: string | null;
  continueUrl: string | null;
}

/**
 * Parses Firebase action parameters from window.location.search or window.location.hash.
 * Handles cases where Firebase appends query parameters BEFORE the hash router
 * (e.g. https://domain/?mode=verifyEmail&oobCode=...#/).
 */
export function parseAuthActionParams(): AuthActionParams {
  if (typeof window === 'undefined') {
    return { mode: null, oobCode: null, apiKey: null, continueUrl: null };
  }

  const searchParams = new URLSearchParams(window.location.search);
  let mode = searchParams.get('mode');
  let oobCode = searchParams.get('oobCode');
  let apiKey = searchParams.get('apiKey');
  let continueUrl = searchParams.get('continueUrl');

  // Fallback to checking hash query string
  if (!mode || !oobCode) {
    const hashIndex = window.location.hash.indexOf('?');
    if (hashIndex !== -1) {
      const hashParams = new URLSearchParams(window.location.hash.slice(hashIndex + 1));
      mode = mode || hashParams.get('mode');
      oobCode = oobCode || hashParams.get('oobCode');
      apiKey = apiKey || hashParams.get('apiKey');
      continueUrl = continueUrl || hashParams.get('continueUrl');
    }
  }

  return { mode, oobCode, apiKey, continueUrl };
}

/**
 * Strips Firebase action query parameters from the browser URL without triggering a page reload.
 */
export function cleanAuthActionParamsFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('mode');
  url.searchParams.delete('oobCode');
  url.searchParams.delete('apiKey');
  url.searchParams.delete('lang');
  window.history.replaceState({}, document.title, url.pathname + url.hash);
}
