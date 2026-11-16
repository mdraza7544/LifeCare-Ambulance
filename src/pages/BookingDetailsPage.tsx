import { Ambulance, MapPin, Hospital, Calendar, Clock, Phone, User, Wallet, ArrowLeft, Navigation, Star, MessageSquare } from 'lucide-react';
import { useApp } from '@/lib/context';
import { PageHeader } from '@/components/UI';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export default function BookingDetailsPage() {
  const { bookings, navigate } = useApp();
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const id = params.get('id');
  const booking = bookings.find((b) => b.id === id);

  if (!booking) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center animate-fade-in">
        <Ambulance className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Booking Not Found</h2>
        <p className="text-gray-500 mb-6">The booking you're looking for doesn't exist.</p>
        <button onClick={() => navigate('/bookings')} className="btn-primary">Back to My Bookings</button>
      </div>
    );
  }

  const driver = { name: 'Ramesh Yadav', phone: '+91 98111 22222', rating: 4.8, ambulance: 'AMB-001' };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <button onClick={() => navigate('/bookings')} className="btn-ghost mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Bookings
      </button>
      <PageHeader title={booking.bookingCode} subtitle={`Booked on ${formatDateTime(booking.createdAt)}`} icon={<Ambulance className="w-5 h-5" />} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg text-gray-900">Trip Details</h3>
              <StatusBadge status={booking.status} />
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center shrink-0"><MapPin className="w-5 h-5 text-brand-600" /></div>
                <div><p className="text-xs text-gray-500 font-semibold uppercase">Pickup</p><p className="text-sm font-semibold text-gray-900">{booking.pickup}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0"><Hospital className="w-5 h-5 text-green-600" /></div>
                <div><p className="text-xs text-gray-500 font-semibold uppercase">Destination</p><p className="text-sm font-semibold text-gray-900">{booking.destination}</p></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-gray-100">
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" /><div><p className="text-xs text-gray-500">Date</p><p className="text-sm font-semibold text-gray-900">{formatDateTime(booking.scheduledFor).split(',')[0]}</p></div></div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /><div><p className="text-xs text-gray-500">Time</p><p className="text-sm font-semibold text-gray-900">{formatDateTime(booking.scheduledFor).split(',')[1]}</p></div></div>
            </div>
          </div>

          {booking.status === 'On Going' && (
            <div className="card p-6">
              <h3 className="font-bold text-lg text-gray-900 mb-4">Live Tracking</h3>
              <div className="bg-gray-100 rounded-xl h-48 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#E63946 1px, transparent 1px), linear-gradient(90deg, #E63946 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div className="relative text-center">
                  <div className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center mx-auto mb-2 animate-pulse-soft">
                    <Ambulance className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Ambulance en route</p>
                  <p className="text-xs text-gray-500">ETA: 8 minutes</p>
                </div>
              </div>
              <button onClick={() => navigate('/track')} className="btn-primary w-full mt-4">
                <Navigation className="w-4 h-4" /> Open Live Tracking
              </button>
            </div>
          )}

          {booking.status === 'Completed' && (
            <div className="card p-6">
              <h3 className="font-bold text-lg text-gray-900 mb-4">Share Your Feedback</h3>
              <div className="flex items-center gap-1 mb-4">
                {[1,2,3,4,5].map((i) => <Star key={i} className="w-8 h-8 text-amber-400 fill-current cursor-pointer hover:scale-110 transition-transform" />)}
              </div>
              <textarea rows={3} className="input-field resize-none mb-3" placeholder="Tell us about your experience..." />
              <button onClick={() => navigate('/feedback')} className="btn-primary">
                <MessageSquare className="w-4 h-4" /> Submit Feedback
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-bold text-gray-900 mb-4">Patient Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><User className="w-4 h-4 text-gray-400" /><span className="text-gray-600">{booking.patientName}</span></div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /><span className="text-gray-600">{booking.phone}</span></div>
              <div className="flex items-center gap-2"><Ambulance className="w-4 h-4 text-gray-400" /><span className="text-gray-600">{booking.ambulanceType} Ambulance</span></div>
              <div className="flex items-center gap-2"><Star className="w-4 h-4 text-gray-400" /><span className="text-gray-600">{booking.emergencyLevel} Emergency</span></div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-bold text-gray-900 mb-4">Driver Details</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold">{driver.name.charAt(0)}</div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{driver.name}</p>
                <div className="flex items-center gap-1 text-xs text-gray-500"><Star className="w-3 h-3 text-amber-400 fill-current" /> {driver.rating} - {driver.ambulance}</div>
              </div>
            </div>
            <a href={`tel:${driver.phone.replace(/\s/g,'')}`} className="btn-secondary w-full text-sm">
              <Phone className="w-4 h-4" /> Call Driver
            </a>
          </div>

          <div className="card p-6">
            <h3 className="font-bold text-gray-900 mb-4">Payment Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Ambulance Fee</span><span className="font-semibold text-gray-900">{formatCurrency(booking.amount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Method</span><span className="font-semibold text-gray-900">{booking.paymentMethod}</span></div>
              <div className="border-t border-gray-100 pt-2 flex justify-between"><span className="font-bold text-gray-700">Total</span><span className="font-extrabold text-brand-600 text-lg">{formatCurrency(booking.amount)}</span></div>
            </div>
            {booking.status === 'Completed' && booking.paymentMethod !== 'Cash on service' && (
              <button onClick={() => navigate('/payment')} className="btn-secondary w-full mt-4 text-sm">
                <Wallet className="w-4 h-4" /> View Payment
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
