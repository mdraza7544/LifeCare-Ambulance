import { CheckCircle2, Download, Home, Calendar } from 'lucide-react';
import { useApp } from '@/lib/context';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export default function PaymentConfirmationPage() {
  const { bookings, navigate } = useApp();
  const booking = bookings[0];

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 animate-fade-in">
      <div className="card p-10 text-center">
        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Payment Successful!</h2>
        <p className="text-gray-600 mb-6">Your payment has been processed successfully. A receipt has been sent to your registered phone.</p>

        {booking && (
          <div className="bg-brand-50 rounded-xl p-5 mb-6 text-left">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Booking ID:</span> <span className="font-semibold text-gray-900">{booking.bookingCode}</span></div>
              <div><span className="text-gray-500">Amount:</span> <span className="font-semibold text-brand-600">{formatCurrency(booking.amount)}</span></div>
              <div><span className="text-gray-500">Patient:</span> <span className="font-semibold text-gray-900">{booking.patientName}</span></div>
              <div><span className="text-gray-500">Method:</span> <span className="font-semibold text-gray-900">{booking.paymentMethod}</span></div>
              <div className="col-span-2"><span className="text-gray-500">Date:</span> <span className="font-semibold text-gray-900">{formatDateTime(booking.scheduledFor)}</span></div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          <button onClick={() => navigate('/bookings')} className="btn-primary"><Calendar className="w-4 h-4" /> View Bookings</button>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary"><Home className="w-4 h-4" /> Dashboard</button>
          <button className="btn-ghost"><Download className="w-4 h-4" /> Download Receipt</button>
        </div>
      </div>
    </div>
  );
}
