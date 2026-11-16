import type {
  Booking,
  Ambulance,
  Driver,
  User,
  Hospital,
  PaymentRecord,
  NotificationItem,
  Address,
  UserProfile,
} from './types';

export const mockBookings: Booking[] = [
  { id: 'b1', bookingCode: 'LCA-1024', patientName: 'Rahul Sharma', phone: '+91 98765 43210', pickup: 'MG Road, Indiranagar', destination: 'Apollo Hospital', ambulanceType: 'Advanced', emergencyLevel: 'Urgent', scheduledFor: '2026-09-05T14:30:00', status: 'On Going', amount: 3500, paymentMethod: 'Cash on service', createdAt: '2026-09-05T14:05:00' },
  { id: 'b2', bookingCode: 'LCA-1023', patientName: 'Priya Verma', phone: '+91 99876 54321', pickup: 'Sector 18, Noida', destination: 'Fortis Hospital', ambulanceType: 'Cardiac', emergencyLevel: 'Critical', scheduledFor: '2026-09-05T11:00:00', status: 'Completed', amount: 5200, paymentMethod: 'UPI', createdAt: '2026-09-05T10:30:00' },
  { id: 'b3', bookingCode: 'LCA-1022', patientName: 'Amit Kumar', phone: '+91 90123 45678', pickup: 'Banjara Hills', destination: 'KIMS Hospital', ambulanceType: 'Basic', emergencyLevel: 'Normal', scheduledFor: '2026-09-04T18:45:00', status: 'Completed', amount: 1800, paymentMethod: 'Card', createdAt: '2026-09-04T18:20:00' },
  { id: 'b4', bookingCode: 'LCA-1021', patientName: 'Sneha Reddy', phone: '+91 88776 12345', pickup: 'Jubilee Hills', destination: 'Care Hospital', ambulanceType: 'Neonatal', emergencyLevel: 'Urgent', scheduledFor: '2026-09-04T09:15:00', status: 'Cancelled', amount: 4200, paymentMethod: 'UPI', createdAt: '2026-09-04T08:50:00' },
  { id: 'b5', bookingCode: 'LCA-1020', patientName: 'Vikram Singh', phone: '+91 91234 56789', pickup: 'Connaught Place', destination: 'AIIMS Delhi', ambulanceType: 'Advanced', emergencyLevel: 'Critical', scheduledFor: '2026-09-03T22:00:00', status: 'Completed', amount: 6800, paymentMethod: 'Cash on service', createdAt: '2026-09-03T21:30:00' },
  { id: 'b6', bookingCode: 'LCA-1019', patientName: 'Anjali Mehta', phone: '+91 93456 78901', pickup: 'Marine Drive', destination: 'Lilavati Hospital', ambulanceType: 'Basic', emergencyLevel: 'Normal', scheduledFor: '2026-09-06T08:00:00', status: 'Scheduled', amount: 2500, paymentMethod: 'Cash on service', createdAt: '2026-09-05T16:00:00' },
  { id: 'b7', bookingCode: 'LCA-1018', patientName: 'Karan Joshi', phone: '+91 99887 76655', pickup: 'Paldi', destination: 'Zydus Hospital', ambulanceType: 'Cardiac', emergencyLevel: 'Urgent', scheduledFor: '2026-09-02T15:30:00', status: 'Completed', amount: 4800, paymentMethod: 'Card', createdAt: '2026-09-02T15:00:00' },
  { id: 'b8', bookingCode: 'LCA-1017', patientName: 'Deepa Nair', phone: '+91 90110 22334', pickup: 'Kochi Marine', destination: 'Amrita Hospital', ambulanceType: 'Advanced', emergencyLevel: 'Critical', scheduledFor: '2026-09-06T10:30:00', status: 'Scheduled', amount: 5500, paymentMethod: 'UPI', createdAt: '2026-09-05T17:30:00' },
];

export const mockAmbulances: Ambulance[] = [
  { id: 'a1', code: 'AMB-001', type: 'Advanced', driverName: 'Ramesh Yadav', status: 'On Duty', location: 'Indiranagar', rating: 4.8 },
  { id: 'a2', code: 'AMB-002', type: 'Cardiac', driverName: 'Suresh Patel', status: 'Available', location: 'Jubilee Hills', rating: 4.9 },
  { id: 'a3', code: 'AMB-003', type: 'Basic', driverName: 'Mohan Lal', status: 'Available', location: 'Sector 18', rating: 4.6 },
  { id: 'a4', code: 'AMB-004', type: 'Neonatal', driverName: 'Arjun Reddy', status: 'Maintenance', location: 'Workshop', rating: 4.7 },
  { id: 'a5', code: 'AMB-005', type: 'Advanced', driverName: 'Kamal Singh', status: 'On Duty', location: 'Marine Drive', rating: 4.5 },
  { id: 'a6', code: 'AMB-006', type: 'Basic', driverName: 'Vijay Kumar', status: 'Available', location: 'Connaught Place', rating: 4.8 },
];

export const mockDrivers: Driver[] = [
  { id: 'd1', name: 'Ramesh Yadav', phone: '+91 98111 22222', license: 'DL-0420190001234', status: 'On Duty', rating: 4.8, trips: 342, ambulanceCode: 'AMB-001' },
  { id: 'd2', name: 'Suresh Patel', phone: '+91 98222 33333', license: 'DL-0420180005678', status: 'Available', rating: 4.9, trips: 510, ambulanceCode: 'AMB-002' },
  { id: 'd3', name: 'Mohan Lal', phone: '+91 98333 44444', license: 'DL-0420170009012', status: 'Available', rating: 4.6, trips: 278, ambulanceCode: 'AMB-003' },
  { id: 'd4', name: 'Arjun Reddy', phone: '+91 98444 55555', license: 'DL-0420200003456', status: 'Off Duty', rating: 4.7, trips: 198, ambulanceCode: 'AMB-004' },
  { id: 'd5', name: 'Kamal Singh', phone: '+91 98555 66666', license: 'DL-0420190007890', status: 'On Duty', rating: 4.5, trips: 421, ambulanceCode: 'AMB-005' },
  { id: 'd6', name: 'Vijay Kumar', phone: '+91 98666 77777', license: 'DL-0420210002345', status: 'Available', rating: 4.8, trips: 365, ambulanceCode: 'AMB-006' },
];

export const mockUsers: User[] = [
  { id: 'u1', name: 'Rahul Sharma', email: 'rahul.s@email.com', phone: '+91 98765 43210', joinedDate: '2026-08-01', bookingsCount: 12, status: 'Active' },
  { id: 'u2', name: 'Priya Verma', email: 'priya.v@email.com', phone: '+91 99876 54321', joinedDate: '2026-08-15', bookingsCount: 8, status: 'Active' },
  { id: 'u3', name: 'Amit Kumar', email: 'amit.k@email.com', phone: '+91 90123 45678', joinedDate: '2026-07-20', bookingsCount: 5, status: 'Active' },
  { id: 'u4', name: 'Sneha Reddy', email: 'sneha.r@email.com', phone: '+91 88776 12345', joinedDate: '2026-07-05', bookingsCount: 3, status: 'Inactive' },
  { id: 'u5', name: 'Vikram Singh', email: 'vikram.s@email.com', phone: '+91 91234 56789', joinedDate: '2026-06-28', bookingsCount: 15, status: 'Active' },
  { id: 'u6', name: 'Anjali Mehta', email: 'anjali.m@email.com', phone: '+91 93456 78901', joinedDate: '2026-08-22', bookingsCount: 2, status: 'Active' },
];

export const mockHospitals: Hospital[] = [
  { id: 'h1', name: 'Apollo Hospital', area: 'Indiranagar', city: 'Bengaluru', address: '154, 11th Main Rd, Indiranagar, Bengaluru, Karnataka 560038', beds: 250, phone: '+91 80 4612 4000', emergency: true, lat: 12.9716, lng: 77.6003 },
  { id: 'h2', name: 'Fortis Hospital', area: 'Sector 62', city: 'Noida', address: 'Fortis Hospital, Sector 62, Noida, Uttar Pradesh 201301', beds: 300, phone: '+91 11 4713 3000', emergency: true, lat: 28.5355, lng: 77.3910 },
  { id: 'h3', name: 'KIMS Hospital', area: 'Banjara Hills', city: 'Hyderabad', address: 'KIMS Hospital, Banjara Hills, Hyderabad, Telangana 500034', beds: 200, phone: '+91 40 2335 5000', emergency: true, lat: 17.4306, lng: 78.4484 },
  { id: 'h4', name: 'Care Hospital', area: 'Jubilee Hills', city: 'Hyderabad', address: 'Care Hospitals, Road No. 1, Banjara Hills, Hyderabad, Telangana 500034', beds: 180, phone: '+91 40 2340 2000', emergency: false, lat: 17.4306, lng: 78.4484 },
  { id: 'h5', name: 'AIIMS Delhi', area: 'Connaught Place', city: 'New Delhi', address: 'AIIMS, Ansari Nagar, East of Ansari Nagar, New Delhi, Delhi 110029', beds: 500, phone: '+91 11 2658 8500', emergency: true, lat: 28.5833, lng: 77.2167 },
  { id: 'h6', name: 'Lilavati Hospital', area: 'Marine Drive', city: 'Mumbai', address: 'Lilavati Hospital, Bandra West, Mumbai, Maharashtra 400050', beds: 220, phone: '+91 22 2675 1000', emergency: true, lat: 19.0760, lng: 72.8223 },
];

export const mockPayments: PaymentRecord[] = [
  { id: 'p1', bookingCode: 'LCA-1023', patientName: 'Priya Verma', amount: 5200, method: 'UPI', status: 'Paid', date: '2026-09-05T11:00:00' },
  { id: 'p2', bookingCode: 'LCA-1022', patientName: 'Amit Kumar', amount: 1800, method: 'Card', status: 'Paid', date: '2026-09-04T18:45:00' },
  { id: 'p3', bookingCode: 'LCA-1021', patientName: 'Sneha Reddy', amount: 4200, method: 'UPI', status: 'Refunded', date: '2026-09-04T09:15:00' },
  { id: 'p4', bookingCode: 'LCA-1020', patientName: 'Vikram Singh', amount: 6800, method: 'Cash on service', status: 'Paid', date: '2026-09-03T22:00:00' },
  { id: 'p5', bookingCode: 'LCA-1018', patientName: 'Karan Joshi', amount: 4800, method: 'Card', status: 'Paid', date: '2026-09-02T15:30:00' },
  { id: 'p6', bookingCode: 'LCA-1024', patientName: 'Rahul Sharma', amount: 3500, method: 'Cash on service', status: 'Pending', date: '2026-09-05T14:30:00' },
];

export const mockNotifications: NotificationItem[] = [
  { id: 'n1', title: 'Ambulance dispatched', message: 'Your ambulance LCA-1024 has been dispatched and is on the way.', time: '2 min ago', read: false, type: 'driver' },
  { id: 'n2', title: 'Booking confirmed', message: 'Booking LCA-1019 is confirmed for Sep 6, 8:00 AM.', time: '1 hour ago', read: false, type: 'booking' },
  { id: 'n3', title: 'Payment received', message: 'Payment of Rs. 5,200 received for LCA-1023.', time: '3 hours ago', read: true, type: 'payment' },
  { id: 'n4', title: 'Welcome to LifeCare', message: 'Your account is set up. Book your first ambulance anytime.', time: '2 days ago', read: true, type: 'system' },
];

export const mockAddresses: Address[] = [
  { id: 'addr1', label: 'Home', fullAddress: '12, 4th Cross, Indiranagar 1st Stage', city: 'Bengaluru', pincode: '560038', isDefault: true },
  { id: 'addr2', label: 'Work', fullAddress: 'Tower B, Prestige Tech Park, Kadubeesanahalli', city: 'Bengaluru', pincode: '560103', isDefault: false },
];

export const mockProfile: UserProfile = {
  name: 'Rahul Sharma',
  email: 'rahul.s@email.com',
  phone: '+91 98765 43210',
  dob: '1990-05-14',
  bloodGroup: 'B+',
  address: '12, 4th Cross, Indiranagar 1st Stage, Bengaluru 560038',
  emergencyContact: 'Anita Sharma',
  emergencyPhone: '+91 98765 11111',
};

export const ambulanceTypePricing: Record<string, number> = {
  Basic: 1800,
  Advanced: 3500,
  Cardiac: 5200,
  Neonatal: 4200,
};

export const hospitalList = mockHospitals.map((h) => h.name);
