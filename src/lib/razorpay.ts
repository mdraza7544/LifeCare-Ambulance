/**
 * Client-side Razorpay helpers — single source of truth for opening Checkout.
 *
 * Used by the booking flow (BookAmbulancePage) and the standalone payment page.
 * The Key Secret NEVER appears here: orders are created and signatures verified
 * by Cloud Functions (createRazorpayOrder / verifyRazorpayPayment). The browser
 * only ever receives the public key id, order id and amount.
 *
 * Calls are made via HTTP POST to the Firebase onRequest endpoints with the
 * Firebase ID token in the Authorization header. This avoids CORS preflight
 * issues that occur when onCall functions are invoked via raw fetch.
 */
import { auth } from './firebase';

export interface RazorpayOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  bookingCode: string;
}

export interface RazorpayVerifyResponse {
  ok: boolean;
  status: 'paid' | 'pending' | 'failed';
  orderId: string;
  paymentId: string;
}

export interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutInstance {
  open(): void;
}
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayCheckoutInstance;

let razorpayPromise: Promise<RazorpayCtor> | null = null;
let isScriptLoading = false;
let scriptLoaded = false;

/** Returns true if the Razorpay constructor is already available on window. */
export function isRazorpayAvailable(): boolean {
  return typeof (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay !== 'undefined';
}

/** Resets script-load state so loadRazorpay() can be retried after a failure. */
export function retryLoadRazorpay(): void {
  razorpayPromise = null;
  isScriptLoading = false;
  scriptLoaded = false;
}

/**
 * Returns the correct Functions URL for the given endpoint.
 *
 * In development (localhost), points to the Firebase Emulator Suite at
 * http://127.0.0.1:5001 unless VITE_FUNCTIONS_EMULATOR is explicitly set
 * to 'false'. In production, uses the deployed Cloud Functions URL.
 *
 * The project ID comes from VITE_FIREBASE_PROJECT_ID (never hardcoded).
 */
function getFunctionsUrl(endpoint: string): string {
  const useEmulator =
    import.meta.env.VITE_FUNCTIONS_EMULATOR !== 'false' &&
    typeof window !== 'undefined' &&
    window.location.hostname === 'localhost';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (useEmulator) {
    return `http://127.0.0.1:5001/${projectId}/us-central1/${endpoint}`;
  }
  return `https://us-central1-${projectId}.cloudfunctions.net/${endpoint}`;
}

/** Loads the Razorpay Checkout script once and resolves the global constructor. */
export function loadRazorpay(): Promise<RazorpayCtor> {
  if (razorpayPromise) return razorpayPromise;

  razorpayPromise = new Promise<RazorpayCtor>((resolve, reject) => {
    const w = window as unknown as { Razorpay?: RazorpayCtor };

    if (w.Razorpay) {
      resolve(w.Razorpay);
      return;
    }

    if (isScriptLoading) {
      // Script is already loading — wait for it to finish.
      const check = setInterval(() => {
        if ((w as unknown as { Razorpay?: RazorpayCtor }).Razorpay) {
          clearInterval(check);
          const RazorpayCtor = (w as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
          resolve(RazorpayCtor!);
        }
      }, 100);
      return;
    }

    isScriptLoading = true;
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;

    script.onload = () => {
      const ctor = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
      isScriptLoading = false;
      if (ctor) {
        scriptLoaded = true;
        resolve(ctor);
      } else {
        razorpayPromise = null;
        reject(new Error('Razorpay script loaded but constructor is unavailable.'));
      }
    };

    script.onerror = () => {
      isScriptLoading = false;
      razorpayPromise = null;
      scriptLoaded = false;
      reject(new Error('Failed to load the Razorpay checkout script. Check your internet connection and ad-blocker settings.'));
    };

    document.head.appendChild(script);
  });
  return razorpayPromise;
}

/** Creates a Razorpay order for a booking (server-side; amount from the booking doc). */
export async function createRazorpayOrder(bookingId: string): Promise<RazorpayOrder> {
  const token = await getIdToken();
  const functionsUrl = getFunctionsUrl('createRazorpayOrder');
  const res = await fetch(functionsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ bookingId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Could not create the payment order.');
  }
  return res.json();
}

/** Gets the Firebase ID token for the current user (required for authenticated calls). */
async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to pay.');
  }
  return user.getIdToken();
}

/** Verifies the payment signature on the backend (never on the client). */
export async function verifyRazorpayPayment(
  payload: RazorpayHandlerResponse & { bookingId: string },
): Promise<RazorpayVerifyResponse> {
  const token = await getIdToken();
  const functionsUrl = getFunctionsUrl('verifyRazorpayPayment');
  const res = await fetch(functionsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Payment verification failed.');
  }
  return res.json();
}

export interface OpenCheckoutOptions {
  order: RazorpayOrder;
  bookingCode: string;
  patientName: string;
  phone: string;
  email: string;
  method: 'UPI' | 'Card';
  onSuccess: (response: RazorpayHandlerResponse) => void | Promise<void>;
  onDismiss: () => void;
}

/**
 * Opens Razorpay Checkout restricted to the chosen method:
 *  - UPI  -> only UPI apps are shown.
 *  - Card -> only debit/credit card entry is shown.
 * Resolves once the modal is open; payment result arrives via onSuccess/onDismiss.
 * Returns `true` when the checkout modal was opened, `false` if it could not be opened.
 */
export async function openRazorpayCheckout(opts: OpenCheckoutOptions): Promise<boolean> {
  try {
    if (!isRazorpayAvailable()) {
      // Attempt to load the script if Razorpay isn't already available.
      await loadRazorpay();
    }

    if (!isRazorpayAvailable()) {
      return false;
    }

    const Razorpay = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay!;
    const methodConfig =
      opts.method === 'UPI'
        ? { upi: true, card: false, netbanking: false, wallet: false }
        : { upi: false, card: true, netbanking: false, wallet: false };

    const checkout = new Razorpay({
      key: opts.order.keyId,
      order_id: opts.order.orderId,
      amount: opts.order.amount,
      currency: opts.order.currency,
      name: 'LifeCare Ambulance Service',
      description: `Booking ${opts.bookingCode}`,
      method: methodConfig,
      prefill: {
        name: opts.patientName,
        contact: opts.phone,
        email: opts.email,
      },
      theme: { color: '#0EA5E9' },
      handler: (response: unknown) => {
        void opts.onSuccess(response as RazorpayHandlerResponse);
      },
      modal: {
        ondismiss: opts.onDismiss,
      },
    });
    checkout.open();
    return true;
  } catch (err) {
    console.error('[razorpay] openRazorpayCheckout failed:', err);
    return false;
  }
}
