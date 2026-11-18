export type BookingStatus = 'Scheduled' | 'On Going' | 'Verified' | 'Completed' | 'Cancelled';
export type AmbulanceType = 'Basic' | 'Advanced' | 'Cardiac' | 'Neonatal';
export type EmergencyLevel = 'Critical' | 'Urgent' | 'Normal';

export interface Booking {
  id: string;
  bookingCode: string;
  patientName: string;
  phone: string;
  pickup: string;
  destination: string;
  /** GPS coordinates of the pickup point (from the Google Maps picker). */
  pickupLat?: number;
  pickupLng?: number;
  /** GPS coordinates of the destination hospital (from the Google Maps picker). */
  destinationLat?: number;
  destinationLng?: number;
  ambulanceType: AmbulanceType;
  emergencyLevel: EmergencyLevel;
  scheduledFor: string;
  bookingType?: 'now' | 'scheduled';
  status: BookingStatus;
  amount: number;
  paymentMethod: string;
  createdAt: string;
  /** Firebase UID of the driver assigned to this booking (for PIN verification). */
  assignedDriverUid?: string;
  assignedDriverName?: string;
  /** Set by the backend when the driver verifies the pickup PIN. */
  verifiedAt?: string;
}

/** Server-generated pickup verification PIN linked to a booking. */
export interface BookingPin {
  bookingId: string;
  bookingCode: string;
  userId: string | null;
  /** Plaintext 4-digit PIN — readable only by the booking owner (Firestore rules). */
  pin: string;
  attempts: number;
  maxAttempts: number;
  verified: boolean;
  status: 'active' | 'verified' | 'expired' | 'locked';
  expiresAt: string;
  assignedDriverUid?: string | null;
  assignedDriverName?: string | null;
  createdAt: string;
}

export interface Ambulance {
  id: string;
  code: string;
  type: AmbulanceType;
  driverName: string;
  status: 'Available' | 'On Duty' | 'Maintenance';
  location: string;
  rating: number;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  license: string;
  status: 'Available' | 'On Duty' | 'Off Duty';
  rating: number;
  trips: number;
  ambulanceCode: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinedDate: string;
  bookingsCount: number;
  status: 'Active' | 'Inactive';
}

export interface Hospital {
  id: string;
  name: string;
  area: string;
  city: string;
  address: string;
  beds: number;
  phone: string;
  emergency: boolean;
  lat: number;
  lng: number;
  type?: string;
  specialties?: string[];
  rating?: number;
}

export interface PaymentRecord {
  id: string;
  bookingCode: string;
  patientName: string;
  amount: number;
  method: string;
  status: 'Paid' | 'Pending' | 'Refunded';
  date: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'booking' | 'payment' | 'system' | 'driver';
  bookingId?: string;
}

export interface Address {
  id: string;
  label: string;
  fullAddress: string;
  city: string;
  pincode: string;
  isDefault: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  dob: string;
  bloodGroup: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  email?: string;
}
