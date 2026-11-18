/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Firebase (client SDK config — web API keys are public identifiers, safe for the browser)
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;

  // EmailJS (browser keys are public by design; restrict the service in the EmailJS dashboard)
  readonly VITE_EMAILJS_SERVICE_ID: string;
  readonly VITE_EMAILJS_TEMPLATE_ID: string;
  readonly VITE_EMAILJS_PUBLIC_KEY: string;

  // Google Maps
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;

  // Third-party Hospitals API
  readonly VITE_HOSPITALS_API_URL?: string;

  // Payment Mode ('demo' | 'razorpay')
  readonly VITE_PAYMENT_MODE?: 'demo' | 'razorpay';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
