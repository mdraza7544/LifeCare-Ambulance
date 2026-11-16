import { Ambulance, Heart, Target, Eye, Award, Users, Shield, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/UI';

export default function AboutPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      <PageHeader title="About Us" subtitle="Dedicated to saving lives with compassion and speed" icon={<Heart className="w-5 h-5" />} />

      <div className="grid lg:grid-cols-2 gap-10 items-center mb-16">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-semibold mb-3">
            <Ambulance className="w-3.5 h-3.5" /> Our Story
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-4">A Mission to Save Lives</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            LifeCare Ambulance Service was founded with a single goal: to ensure that every patient gets timely, safe, and professional medical transport when it matters most. What began as a small fleet of 5 ambulances has grown into a network of 120+ vehicles serving over 50,000 patients across the country.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Today, we partner with leading hospitals, employ certified paramedics, and use smart dispatch technology to reach patients faster than ever before. Every ride is a commitment to care.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { value: '50K+', label: 'Patients Served', icon: Users },
            { value: '120+', label: 'Ambulances', icon: Ambulance },
            { value: '10 min', label: 'Avg Response', icon: TrendingUp },
            { value: '24/7', label: 'Availability', icon: Shield },
          ].map((s, i) => (
            <div key={i} className="card p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 mx-auto mb-3">
                <s.icon className="w-6 h-6" />
              </div>
              <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 font-medium mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-16">
        {[
          { icon: Target, title: 'Our Mission', desc: 'To provide fast, reliable, and affordable ambulance services to every patient in need, regardless of location or time.' },
          { icon: Eye, title: 'Our Vision', desc: 'To be the most trusted emergency medical transport network, setting the standard for response time and patient care.' },
          { icon: Award, title: 'Our Values', desc: 'Compassion, speed, safety, and professionalism guide every decision we make and every ride we operate.' },
        ].map((v, i) => (
          <div key={i} className="card-hover p-6">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mb-4">
              <v.icon className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-lg text-gray-900 mb-2">{v.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{v.desc}</p>
          </div>
        ))}
      </div>

      <div className="card p-8 bg-gradient-to-r from-brand-50 to-accent-50">
        <h3 className="text-xl font-extrabold text-gray-900 mb-6 text-center">Leadership Team</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { name: 'Dr. Arvind Krishnan', role: 'Founder & CEO', initial: 'A' },
            { name: 'Dr. Meera Iyer', role: 'Medical Director', initial: 'M' },
            { name: 'Rajesh Nair', role: 'Head of Operations', initial: 'R' },
            { name: 'Sunita Rao', role: 'Head of Training', initial: 'S' },
          ].map((p, i) => (
            <div key={i} className="text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
                {p.initial}
              </div>
              <p className="font-bold text-gray-900 text-sm">{p.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{p.role}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
