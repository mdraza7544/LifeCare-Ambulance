import { Phone, Search, MapPin, Navigation, ClipboardCheck, ArrowRight } from 'lucide-react';
import { useApp } from '@/lib/context';
import { PageHeader } from '@/components/UI';

const steps = [
  { icon: Phone, title: 'Book or Call', desc: 'Book online in 2 minutes or call our 24/7 helpline. Provide patient details, pickup, and destination.' },
  { icon: Search, title: 'Ambulance Assigned', desc: 'Our system finds the nearest available ambulance suited to your medical requirement.' },
  { icon: Navigation, title: 'Real-Time Tracking', desc: 'Track your ambulance live on the map. Get ETA updates and driver contact information.' },
  { icon: MapPin, title: 'Pickup & Care', desc: 'Our paramedics arrive, stabilize the patient, and provide medical care during transport.' },
  { icon: ClipboardCheck, title: 'Hospital Handover', desc: 'We coordinate with the destination hospital ER for a smooth and fast admission.' },
];

export default function HowItWorksPage() {
  const { navigate } = useApp();
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      <PageHeader title="How It Works" subtitle="From booking to hospital handover in five simple steps" icon={<Navigation className="w-5 h-5" />} />
      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-brand-100 hidden md:block" />
        <div className="space-y-6">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-5 items-start">
              <div className="relative z-10 w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center text-white shrink-0 shadow-lg">
                <s.icon className="w-7 h-7" />
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white text-brand-600 text-xs font-bold flex items-center justify-center border-2 border-brand-100">{i+1}</span>
              </div>
              <div className="card p-6 flex-1 mt-2">
                <h3 className="font-bold text-lg text-gray-900 mb-1">{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-12 text-center bg-brand-50 rounded-2xl p-8">
        <h3 className="text-2xl font-extrabold text-gray-900 mb-2">Ready to Book?</h3>
        <p className="text-gray-600 mb-5">Get an ambulance at your doorstep in minutes.</p>
        <button onClick={() => navigate('/book')} className="btn-primary text-base px-6 py-3">
          Book Ambulance Now <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
