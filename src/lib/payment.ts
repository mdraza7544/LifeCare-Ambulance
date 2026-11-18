/**
 * LifeCare Ambulance Service — Unified Payment Gateway Wrapper.
 *
 * Checks VITE_PAYMENT_MODE ("demo" | "razorpay").
 * - Default: "demo" (interactive Razorpay-like simulated checkout modal).
 * - "razorpay": Live/test Razorpay API with server-side order creation.
 *
 * This wrapper is the single entry point for all payment triggers in the app.
 */
import {
  createRazorpayOrder,
  openRazorpayCheckout,
  type RazorpayHandlerResponse,
} from './razorpay';

export type PaymentMode = 'demo' | 'razorpay';

/** Returns the active payment mode from environment variables (defaults to "demo"). */
export function getPaymentMode(): PaymentMode {
  const mode = import.meta.env.VITE_PAYMENT_MODE;
  if (mode === 'razorpay') return 'razorpay';
  return 'demo';
}

export interface CheckoutOptions {
  bookingId: string;
  bookingCode: string;
  amount: number; // in INR (Rupees)
  patientName: string;
  phone: string;
  email: string;
  method?: 'UPI' | 'Card';
  mode?: PaymentMode;
  onSuccess: (response: RazorpayHandlerResponse, methodUsed?: string) => void | Promise<void>;
  onDismiss: () => void;
  onFailure?: (error: Error) => void;
}

type DemoModalLauncher = (options: CheckoutOptions) => void;
let demoModalLauncher: DemoModalLauncher | null = null;

/**
 * Registers the DemoCheckoutModal component as the active demo checkout handler.
 * Called automatically when DemoCheckoutModal mounts.
 */
export function registerDemoModal(launcher: DemoModalLauncher): () => void {
  demoModalLauncher = launcher;
  return () => {
    if (demoModalLauncher === launcher) {
      demoModalLauncher = null;
    }
  };
}

/**
 * Opens checkout modal.
 * - If options.mode is specified, uses that mode directly ("demo" or "razorpay").
 * - Otherwise falls back to VITE_PAYMENT_MODE environment variable.
 */
export async function openCheckout(options: CheckoutOptions): Promise<boolean> {
  const mode = options.mode || getPaymentMode();

  if (mode === 'razorpay') {
    try {
      const order = await createRazorpayOrder(options.bookingId);
      return await openRazorpayCheckout({
        order,
        bookingCode: options.bookingCode,
        patientName: options.patientName,
        phone: options.phone,
        email: options.email,
        method: options.method || 'Card',
        onSuccess: (resp) => options.onSuccess(resp, options.method ? `Razorpay (${options.method})` : 'Razorpay'),
        onDismiss: options.onDismiss,
      });
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      if (options.onFailure) {
        options.onFailure(errorObj);
      }
      throw errorObj;
    }
  }

  // Demo mode
  if (demoModalLauncher) {
    demoModalLauncher(options);
    return true;
  }

  console.warn('[payment] DemoCheckoutModal is not mounted. Ensure it is rendered in PaymentPage.');
  return false;
}
