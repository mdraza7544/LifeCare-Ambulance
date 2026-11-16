// EmailJS browser client — sends emergency/safety emails directly from the
// frontend (EmailJS is designed for browser use; its public key is not a
// secret). Twilio SMS is NOT sent from here — it goes through Cloud Functions
// so the Twilio credentials never reach the browser.
import emailjs from '@emailjs/browser';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export interface SafetyEmailParams {
  to_email: string;
  to_name: string;
  subject: string;
  message: string;
  from_name?: string;
  reply_to?: string;
}

/** True when the EmailJS env vars have been filled in with real values. */
function isEmailConfigured(): boolean {
  return Boolean(
    SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY &&
    !SERVICE_ID.includes('your-') && !TEMPLATE_ID.includes('your-') && !PUBLIC_KEY.includes('your'),
  );
}

/**
 * Sends a safety/emergency email through EmailJS.
 * Returns true when the email was dispatched, false when skipped or failed
 * (callers degrade gracefully so the UI is never blocked on email delivery).
 */
export async function sendSafetyEmail(params: SafetyEmailParams): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn('[emailjs] Not configured — skipping email send. Set VITE_EMAILJS_* in .env.');
    return false;
  }
  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      { from_name: 'LifeCare Ambulance Service', ...params },
      { publicKey: PUBLIC_KEY },
    );
    return true;
  } catch (err) {
    console.warn('[emailjs] Email send failed.', err);
    return false;
  }
}