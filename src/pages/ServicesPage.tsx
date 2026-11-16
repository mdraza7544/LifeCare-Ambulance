import { Ambulance, Activity, Heart, Users, Shield, Clock, Phone, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/lib/context';
import { PageHeader } from '@/components/UI';

const services = [
  { icon: Ambulance, title: 'Basic Life Support', desc: 'Essential patient transport with trained attendants and basic medical monitoring for non-critical cases.', price: 'Rs. 1,800', features: ['Trained attendant', 'First aid kit', 'Oxygen support', 'Patient monitoring'] },
  { icon: Activity, title: 'Advanced Life Support', desc: 'For critically ill patients requiring advanced life-saving equipment and experienced paramedics.', price: 'Rs. 3,500', features: ['Ventilator', 'Cardiac monitor', 'Emergency medicines', 'Experienced paramedic'] },
  { icon: Heart, title: 'Cardiac Care Ambulance', desc: 'Specialized ambulance for heart emergencies, equipped with defibrillator and cardiac specialist.', price: 'Rs. 5,200', features: ['Defibrillator', 'ECG monitor', 'Cardiac medicines', 'Cardiac specialist'] },
  { icon: Users, title: 'Neonatal Transport', desc: 'Safe and specialized transport for newborns and infants with incubator and neonatal care.', price: 'Rs. 4,200', features: ['Incubator', 'Neonatal monitoring', 'Specialist nurse', 'Temperature control'] },
];

export default function ServicesPage() {
  const { navigate } = useApp();
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      <PageHeader title="Our Services" subtitle="Comprehensive ambulance solutions for every medical need" icon={<Ambulance className="w-5 h-5" />} />
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        {services.map((s, i) => (
          <div key={i} className="card-hover p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                <s.icon className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-gray-900">{s.title}</h3>
                  <span className="text-brand-600 font-bold text-lg">{s.price}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1 mb-4">{s.desc}</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {s.features.map((f, j) => (
                    <div key={j} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" /> {f}
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate('/book')} className="btn-primary text-sm w-full">
                  Book This Ambulance <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {[
          { icon: Shield, title: 'Certified & Insured', desc: 'All ambulances are government-certified and fully insured for patient safety.' },
          { icon: Clock, title: '10-Minute Response', desc: 'We guarantee ambulance dispatch within 10 minutes of booking confirmation.' },
          { icon: Phone, title: '24/7 Helpline', desc: 'Our emergency helpline is available round-the-clock, every day of the year.' },
        ].map((f, i) => (
          <div key={i} className="card p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mx-auto mb-4">
              <f.icon className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
            <p className="text-sm text-gray-600">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
