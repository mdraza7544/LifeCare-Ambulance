import { Ambulance, Clock, Shield, Zap, Phone, MapPin, Heart, Activity, Users, Star, ArrowRight, CheckCircle2, Hospital } from 'lucide-react';
import { useApp } from '@/lib/context';

const heroImage = 'https://images.pexels.com/photos/38485134/pexels-photo-38485134.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

const features = [
  { icon: Clock, title: '24/7 Service', desc: 'Round-the-clock emergency response, every day of the year.' },
  { icon: Zap, title: 'Quick Response', desc: 'Ambulance dispatched within 10 minutes of booking.' },
  { icon: Shield, title: 'Trusted & Safe', desc: 'Certified paramedics and fully equipped vehicles.' },
];

const stats = [
  { value: '50K+', label: 'Patients Served' },
  { value: '10 min', label: 'Avg Response Time' },
  { value: '120+', label: 'Ambulances' },
  { value: '24/7', label: 'Availability' },
];

const steps = [
  { num: '01', title: 'Book an Ambulance', desc: 'Call our helpline or book online in under 2 minutes with patient and pickup details.' },
  { num: '02', title: 'Ambulance Dispatched', desc: 'The nearest available ambulance is assigned and dispatched immediately.' },
  { num: '03', title: 'Track in Real-Time', desc: 'Follow your ambulance live on the map and stay updated on arrival time.' },
  { num: '04', title: 'Safe Hospital Transfer', desc: 'Our paramedics provide care en route and ensure a smooth hospital handover.' },
];

const services = [
  { icon: Ambulance, title: 'Basic Life Support', desc: 'For non-emergency patient transport with essential medical monitoring.', price: 'Rs. 1,800' },
  { icon: Activity, title: 'Advanced Life Support', desc: 'Critically ill patients with advanced equipment and trained paramedics.', price: 'Rs. 3,500' },
  { icon: Heart, title: 'Cardiac Care Ambulance', desc: 'Specialized for heart emergencies with cardiac monitoring and defibrillator.', price: 'Rs. 5,200' },
  { icon: Users, title: 'Neonatal Transport', desc: 'Safe transport for newborns and infants with incubator and specialist care.', price: 'Rs. 4,200' },
];

export default function HomePage() {
  const { navigate } = useApp();

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-brand-50 via-white to-accent-50 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-5">
          <div className="w-96 h-96 rounded-full bg-brand-400 blur-3xl absolute -top-20 -right-20" />
        </div>
        <div className="max-w-7xl mx-auto px-4 py-12 lg:py-20 relative">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="animate-slide-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-600 text-xs font-semibold mb-5">
                <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse-soft" />
                Available Now - 24/7 Emergency Response
              </div>
              <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight">
                Saving Lives, <span className="text-brand-600">One Ride</span> at a Time
              </h1>
              <p className="text-lg text-gray-600 mt-4 leading-relaxed">
                LifeCare provides fast, reliable, and fully-equipped ambulance services. Book in minutes, track in real-time, and trust certified paramedics for safe transport.
              </p>
              <div className="flex flex-wrap gap-3 mt-7">
                <button onClick={() => navigate('/book')} className="btn-primary text-base px-6 py-3">
                  <Ambulance className="w-5 h-5" />
                  Book Ambulance
                </button>
                <a href="tel:1800LIFECARE" className="btn-secondary text-base px-6 py-3">
                  <Phone className="w-5 h-5" />
                  1800-LIFECARE
                </a>
              </div>
              <div className="flex items-center gap-6 mt-8">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="w-9 h-9 rounded-full border-2 border-white bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold">
                      {['R','P','A','S'][i-1]}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1 text-amber-400">
                    {[1,2,3,4,5].map((i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Rated 4.9/5 by 50,000+ patients</p>
                </div>
              </div>
            </div>
            <div className="relative animate-slide-up">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img src={heroImage} alt="LifeCare ambulance" className="w-full h-[360px] lg:h-[420px] object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-900/30 to-transparent" />
              </div>
              <div className="absolute -bottom-5 -left-5 bg-white rounded-xl shadow-lg p-4 flex items-center gap-3 hidden sm:flex">
                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Avg. 10 min response</p>
                  <p className="text-xs text-gray-500">Across all service areas</p>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 bg-brand-500 text-white rounded-xl shadow-lg p-4 hidden sm:block">
                <Clock className="w-6 h-6 mx-auto" />
                <p className="text-xs font-bold mt-1">24/7</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="card-hover p-6 group">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mb-4 group-hover:scale-110 transition-transform">
                <f.icon className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="bg-brand-600 py-14">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <div key={i} className="text-center text-white">
                <p className="text-3xl lg:text-4xl font-extrabold">{s.value}</p>
                <p className="text-sm text-brand-100 mt-1 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-semibold mb-3">
            <Activity className="w-3.5 h-3.5" /> Simple Process
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">How It Works</h2>
          <p className="text-gray-500 mt-2">Four simple steps from booking to safe hospital arrival</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="relative card p-6 group hover:shadow-card-hover transition-shadow">
              <div className="text-4xl font-extrabold text-brand-100 group-hover:text-brand-200 transition-colors">{s.num}</div>
              <h3 className="font-bold text-gray-900 mt-2 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
              {i < steps.length - 1 && (
                <ArrowRight className="hidden lg:block absolute -right-3 top-1/2 w-6 h-6 text-brand-200" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section className="bg-gradient-to-b from-white to-brand-50/40 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-semibold mb-3">
              <Ambulance className="w-3.5 h-3.5" /> Our Fleet
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900">Ambulance Services</h2>
            <p className="text-gray-500 mt-2">Choose the right ambulance type for your medical needs</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s, i) => (
              <div key={i} className="card-hover p-6 group">
                <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mb-4 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                  <s.icon className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1.5">{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-3">{s.desc}</p>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-brand-600 font-bold">{s.price}</span>
                  <button onClick={() => navigate('/book')} className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1">
                    Book <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hospital Network */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-semibold mb-3">
              <Hospital className="w-3.5 h-3.5" /> Hospital Network
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Connected with Top Hospitals</h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              We partner with leading hospitals across the city to ensure seamless admission and continuity of care. Our paramedics coordinate directly with hospital teams for a smooth handover.
            </p>
            <ul className="space-y-3">
              {['Direct hospital coordination', 'Pre-arrival notification to ER', 'Insurance and TPA support', 'Specialized neonatal & cardiac transfers'].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand-500 shrink-0" />
                  <span className="text-sm text-gray-700 font-medium">{item}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/services')} className="btn-primary mt-7">
              View All Services <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: 'Apollo Hospital', area: 'Indiranagar', beds: '250 beds' },
              { name: 'Fortis Hospital', area: 'Sector 62', beds: '300 beds' },
              { name: 'AIIMS Delhi', area: 'Connaught Place', beds: '500 beds' },
              { name: 'KIMS Hospital', area: 'Banjara Hills', beds: '200 beds' },
            ].map((h, i) => (
              <div key={i} className="card p-5">
                <Hospital className="w-8 h-8 text-brand-500 mb-3" />
                <h4 className="font-bold text-gray-900 text-sm">{h.name}</h4>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{h.area}</p>
                <p className="text-xs text-brand-600 font-semibold mt-2">{h.beds}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="relative bg-gradient-to-r from-brand-600 to-brand-700 rounded-3xl p-10 lg:p-14 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="text-white text-center lg:text-left">
              <h2 className="text-3xl font-extrabold">Need an Ambulance?</h2>
              <p className="text-brand-100 mt-2">Book now and get an ambulance at your doorstep in minutes.</p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <button onClick={() => navigate('/book')} className="inline-flex items-center gap-2 px-6 py-3 bg-white text-brand-600 font-bold rounded-xl shadow-lg hover:bg-brand-50 transition-colors active:scale-[0.98]">
                <Ambulance className="w-5 h-5" /> Book Now
              </button>
              <a href="tel:1800LIFECARE" className="inline-flex items-center gap-2 px-6 py-3 bg-brand-800/50 text-white font-bold rounded-xl border border-white/20 hover:bg-brand-800/70 transition-colors">
                <Phone className="w-5 h-5" /> Call Helpline
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
